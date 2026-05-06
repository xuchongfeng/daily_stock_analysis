# -*- coding: utf-8 -*-
"""
===================================
分析服务层
===================================

职责：
1. 封装股票分析逻辑
2. 调用 analyzer 和 pipeline 执行分析
3. 保存分析结果到数据库
"""

import logging
import uuid
from typing import Optional, Dict, Any, Callable, TYPE_CHECKING

from src.repositories.analysis_repo import AnalysisRepository

if TYPE_CHECKING:
    from src.storage import AnalysisHistory
from src.report_language import (
    get_sentiment_label,
    get_localized_stock_name,
    localize_operation_advice,
    localize_trend_prediction,
    normalize_report_language,
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    分析服务
    
    封装股票分析相关的业务逻辑
    """
    
    def __init__(self):
        """初始化分析服务"""
        self.repo = AnalysisRepository()
        self.last_error: Optional[str] = None
    
    def analyze_stock(
        self,
        stock_code: str,
        report_type: str = "detailed",
        force_refresh: bool = False,
        query_id: Optional[str] = None,
        send_notification: bool = True,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        portal_user_id: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        执行股票分析
        
        Args:
            stock_code: 股票代码
            report_type: 报告类型 (simple/detailed)
            force_refresh: 是否强制刷新
            query_id: 查询 ID（可选）
            send_notification: 是否发送通知（API 触发默认发送）
            
        Returns:
            分析结果字典，包含:
            - stock_code: 股票代码
            - stock_name: 股票名称
            - report: 分析报告
        """
        try:
            self.last_error = None
            # 导入分析相关模块
            from src.config import get_config
            from src.core.pipeline import StockAnalysisPipeline
            from src.enums import ReportType
            
            # 生成 query_id
            if query_id is None:
                query_id = uuid.uuid4().hex
            
            # 获取配置
            config = get_config()
            ttl = float(getattr(config, "analysis_reuse_ttl_hours", 3.0) or 0.0)
            if not force_refresh and ttl > 0:
                reuse_fn = getattr(self.repo, "get_latest_reusable_analysis", None)
                recent = (
                    reuse_fn(stock_code, within_hours=ttl)
                    if callable(reuse_fn)
                    else None
                )
                if recent is not None:
                    logger.info(
                        "分析结果复用（近 %.1f 小时内、不区分用户）: stock=%s source_query_id=%s created_at=%s -> query_id=%s",
                        ttl,
                        stock_code,
                        recent.query_id,
                        recent.created_at.isoformat() if recent.created_at else "",
                        query_id,
                    )
                    return self._build_analysis_response_from_history(
                        recent,
                        query_id=query_id,
                        report_type_fallback=report_type,
                    )
            
            # 创建分析流水线
            pipeline = StockAnalysisPipeline(
                config=config,
                query_id=query_id,
                query_source="api",
                progress_callback=progress_callback,
                portal_user_id=portal_user_id,
            )
            
            # 确定报告类型 (API: simple/detailed/full/brief -> ReportType)
            rt = ReportType.from_str(report_type)
            
            # 执行分析
            result = pipeline.process_single_stock(
                code=stock_code,
                skip_analysis=False,
                single_stock_notify=send_notification,
                report_type=rt,
            )
            
            if result is None:
                logger.warning(f"分析股票 {stock_code} 返回空结果")
                self.last_error = self.last_error or f"分析股票 {stock_code} 返回空结果"
                return None

            if not getattr(result, "success", True):
                self.last_error = getattr(result, "error_message", None) or f"分析股票 {stock_code} 失败"
                logger.warning(f"分析股票 {stock_code} 未成功完成: {self.last_error}")
                return None
            
            # 构建响应
            return self._build_analysis_response(result, query_id, report_type=rt.value)
            
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"分析股票 {stock_code} 失败: {e}", exc_info=True)
            return None
    
    def _build_analysis_response(
        self, 
        result: Any, 
        query_id: str,
        report_type: str = "detailed",
    ) -> Dict[str, Any]:
        """
        构建分析响应
        
        Args:
            result: AnalysisResult 对象
            query_id: 查询 ID
            report_type: 归一化后的报告类型
            
        Returns:
            格式化的响应字典
        """
        # 获取狙击点位
        sniper_points = {}
        if hasattr(result, 'get_sniper_points'):
            sniper_points = result.get_sniper_points() or {}
        
        # 计算情绪标签
        report_language = normalize_report_language(getattr(result, "report_language", "zh"))
        sentiment_label = get_sentiment_label(result.sentiment_score, report_language)
        stock_name = get_localized_stock_name(getattr(result, "name", None), result.code, report_language)
        
        # 构建报告结构
        report = {
            "meta": {
                "query_id": query_id,
                "stock_code": result.code,
                "stock_name": stock_name,
                "report_type": report_type,
                "report_language": report_language,
                "current_price": result.current_price,
                "change_pct": result.change_pct,
                "model_used": getattr(result, "model_used", None),
            },
            "summary": {
                "analysis_summary": result.analysis_summary,
                "operation_advice": localize_operation_advice(result.operation_advice, report_language),
                "trend_prediction": localize_trend_prediction(result.trend_prediction, report_language),
                "sentiment_score": result.sentiment_score,
                "sentiment_label": sentiment_label,
            },
            "strategy": {
                "ideal_buy": sniper_points.get("ideal_buy"),
                "secondary_buy": sniper_points.get("secondary_buy"),
                "stop_loss": sniper_points.get("stop_loss"),
                "take_profit": sniper_points.get("take_profit"),
            },
            "details": {
                "news_summary": result.news_summary,
                "technical_analysis": result.technical_analysis,
                "fundamental_analysis": result.fundamental_analysis,
                "risk_warning": result.risk_warning,
            }
        }
        
        return {
            "stock_code": result.code,
            "stock_name": stock_name,
            "report": report,
        }

    def _build_analysis_response_from_history(
        self,
        record: "AnalysisHistory",
        *,
        query_id: str,
        report_type_fallback: str = "detailed",
    ) -> Dict[str, Any]:
        """由 analysis_history 行构造与 ``_build_analysis_response`` 一致的 ``report`` 结构（供跨用户短时复用）。"""
        from src.utils.data_processing import parse_json_field, normalize_model_used
        from src.report_language import (
            get_sentiment_label,
            get_localized_stock_name,
            localize_operation_advice,
            localize_trend_prediction,
            normalize_report_language,
        )

        raw_result = parse_json_field(record.raw_result)
        rd = raw_result if isinstance(raw_result, dict) else {}
        report_language = normalize_report_language(rd.get("report_language"))
        stock_name = get_localized_stock_name(record.name, record.code, report_language)
        sentiment_label = get_sentiment_label(record.sentiment_score, report_language)

        rt = getattr(record, "report_type", None) or report_type_fallback

        def _sniper_str(v: Any) -> Optional[str]:
            if v is None:
                return None
            return str(v)

        report = {
            "meta": {
                "query_id": query_id,
                "stock_code": record.code,
                "stock_name": stock_name,
                "report_type": rt,
                "report_language": report_language,
                "created_at": record.created_at.isoformat() if record.created_at else None,
                "current_price": rd.get("current_price"),
                "change_pct": rd.get("change_pct"),
                "model_used": normalize_model_used(rd.get("model_used")),
            },
            "summary": {
                "analysis_summary": record.analysis_summary,
                "operation_advice": localize_operation_advice(record.operation_advice, report_language),
                "trend_prediction": localize_trend_prediction(record.trend_prediction, report_language),
                "sentiment_score": record.sentiment_score,
                "sentiment_label": sentiment_label,
            },
            "strategy": {
                "ideal_buy": _sniper_str(getattr(record, "ideal_buy", None)),
                "secondary_buy": _sniper_str(getattr(record, "secondary_buy", None)),
                "stop_loss": _sniper_str(getattr(record, "stop_loss", None)),
                "take_profit": _sniper_str(getattr(record, "take_profit", None)),
            },
            "details": {
                "news_summary": rd.get("news_summary"),
                "technical_analysis": rd.get("technical_analysis"),
                "fundamental_analysis": rd.get("fundamental_analysis"),
                "risk_warning": rd.get("risk_warning"),
            },
        }

        return {
            "stock_code": record.code,
            "stock_name": stock_name,
            "report": report,
        }

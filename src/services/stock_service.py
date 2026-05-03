# -*- coding: utf-8 -*-
"""
===================================
股票数据服务层
===================================

职责：
1. 封装股票数据获取逻辑
2. 提供实时行情和历史数据接口
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List

from data_provider.base import DataFetcherManager, canonical_stock_code

from src.repositories.stock_repo import StockRepository
from src.storage import StockDaily

logger = logging.getLogger(__name__)


def _stock_daily_row_to_item(row: StockDaily) -> Dict[str, Any]:
    d = row.date
    date_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)
    return {
        "date": date_str,
        "open": float(row.open or 0),
        "high": float(row.high or 0),
        "low": float(row.low or 0),
        "close": float(row.close or 0),
        "volume": float(row.volume) if row.volume is not None else None,
        "amount": float(row.amount) if row.amount is not None else None,
        "change_percent": float(row.pct_chg) if row.pct_chg is not None else None,
    }


def _history_should_fetch_remote(
    rows: List[StockDaily],
    *,
    requested_days: int,
    end_date: date,
) -> bool:
    """本地 ``stock_daily`` 缺失、明显不足或过久未更新时，再走数据源拉取并入库。"""
    if not rows:
        return True
    min_bars = max(10, min(int(requested_days), 365) // 4)
    if len(rows) < min_bars:
        return True
    latest = rows[-1].date
    if latest < end_date - timedelta(days=8):
        return True
    return False


class StockService:
    """
    股票数据服务
    
    封装股票数据获取的业务逻辑
    """
    
    def __init__(self):
        """初始化股票数据服务"""
        self.repo = StockRepository()
    
    def get_realtime_quote(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """
        获取股票实时行情
        
        Args:
            stock_code: 股票代码
            
        Returns:
            实时行情数据字典
        """
        try:
            # 调用数据获取器获取实时行情
            from data_provider.base import DataFetcherManager
            
            manager = DataFetcherManager()
            quote = manager.get_realtime_quote(stock_code)
            
            if quote is None:
                logger.warning(f"获取 {stock_code} 实时行情失败")
                return None
            
            # UnifiedRealtimeQuote 是 dataclass，使用 getattr 安全访问字段
            # 字段映射: UnifiedRealtimeQuote -> API 响应
            # - code -> stock_code
            # - name -> stock_name
            # - price -> current_price
            # - change_amount -> change
            # - change_pct -> change_percent
            # - open_price -> open
            # - high -> high
            # - low -> low
            # - pre_close -> prev_close
            # - volume -> volume
            # - amount -> amount
            return {
                "stock_code": getattr(quote, "code", stock_code),
                "stock_name": getattr(quote, "name", None),
                "current_price": getattr(quote, "price", 0.0) or 0.0,
                "change": getattr(quote, "change_amount", None),
                "change_percent": getattr(quote, "change_pct", None),
                "open": getattr(quote, "open_price", None),
                "high": getattr(quote, "high", None),
                "low": getattr(quote, "low", None),
                "prev_close": getattr(quote, "pre_close", None),
                "volume": getattr(quote, "volume", None),
                "amount": getattr(quote, "amount", None),
                "update_time": datetime.now().isoformat(),
            }
            
        except ImportError:
            logger.warning("DataFetcherManager 未找到，使用占位数据")
            return self._get_placeholder_quote(stock_code)
        except Exception as e:
            logger.error(f"获取实时行情失败: {e}", exc_info=True)
            return None
    
    def get_history_data(
        self,
        stock_code: str,
        period: str = "daily",
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取股票历史行情
        
        Args:
            stock_code: 股票代码
            period: K 线周期 (daily/weekly/monthly)
            days: 获取天数
            
        Returns:
            历史行情数据字典
            
        Raises:
            ValueError: 当 period 不是 daily 时抛出（weekly/monthly 暂未实现）
        """
        # 验证 period 参数，只支持 daily
        if period != "daily":
            raise ValueError(
                f"暂不支持 '{period}' 周期，目前仅支持 'daily'。"
                "weekly/monthly 聚合功能将在后续版本实现。"
            )

        canon = canonical_stock_code(stock_code)
        if not canon:
            logger.warning("历史行情: 无效股票代码 %r", stock_code)
            return {"stock_code": stock_code, "period": period, "data": []}

        end_d = date.today()
        start_d = end_d - timedelta(days=int(days))

        try:
            rows = self.repo.get_range(canon, start_d, end_d)
            manager: Optional[DataFetcherManager] = None

            if _history_should_fetch_remote(rows, requested_days=int(days), end_date=end_d):
                try:
                    manager = DataFetcherManager()
                    df, source = manager.get_daily_data(canon, days=int(days))
                    if df is not None and not df.empty:
                        self.repo.save_dataframe(df, canon, source or "Unknown")
                    rows = self.repo.get_range(canon, start_d, end_d)
                except Exception as e:
                    logger.warning(
                        "历史行情: %s 远端补齐失败，使用本地已有数据: %s",
                        canon,
                        e,
                        exc_info=True,
                    )

            if manager is None:
                manager = DataFetcherManager()

            stock_name = manager.get_stock_name(canon)
            data = [_stock_daily_row_to_item(r) for r in rows]

            if not data:
                logger.warning("获取 %s 历史数据为空（本地与远端均无有效日线）", canon)

            return {
                "stock_code": canon,
                "stock_name": stock_name,
                "period": period,
                "data": data,
            }

        except ImportError:
            logger.warning("DataFetcherManager 未找到，返回空数据")
            return {"stock_code": canon, "period": period, "data": []}
        except Exception as e:
            logger.error(f"获取历史数据失败: {e}", exc_info=True)
            return {"stock_code": canon, "period": period, "data": []}
    
    def _get_placeholder_quote(self, stock_code: str) -> Dict[str, Any]:
        """
        获取占位行情数据（用于测试）
        
        Args:
            stock_code: 股票代码
            
        Returns:
            占位行情数据
        """
        return {
            "stock_code": stock_code,
            "stock_name": f"股票{stock_code}",
            "current_price": 0.0,
            "change": None,
            "change_percent": None,
            "open": None,
            "high": None,
            "low": None,
            "prev_close": None,
            "volume": None,
            "amount": None,
            "update_time": datetime.now().isoformat(),
        }

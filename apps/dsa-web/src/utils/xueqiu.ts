/**
 * 雪球个股页路径：沪深 A 为 https://xueqiu.com/S/SZ000155 、https://xueqiu.com/S/SH603163
 * 北交所常见为 BJ + 代码（与雪球展示一致时补链）。
 */

const SIX = /^\d{6}$/;

function prefixForSixDigits(digits: string): 'SH' | 'SZ' | 'BJ' | null {
  const c = digits[0];
  if (c === '6' || c === '9') {
    return 'SH';
  }
  if (c === '0' || c === '2' || c === '3') {
    return 'SZ';
  }
  if (c === '8' || c === '4') {
    return 'BJ';
  }
  return null;
}

/** 若可识别为雪球支持的 A 股/北交所代码则返回 https URL，否则 null（不强制链到错误标的）。 */
export function xueqiuStockHref(stockCode: string): string | null {
  const raw = (stockCode || '').trim().toUpperCase();
  if (!raw) {
    return null;
  }

  if (/^(SH|SZ|BJ)\d{6}$/.test(raw)) {
    return `https://xueqiu.com/S/${raw}`;
  }

  if (SIX.test(raw)) {
    const p = prefixForSixDigits(raw);
    if (!p) {
      return null;
    }
    return `https://xueqiu.com/S/${p}${raw}`;
  }

  return null;
}

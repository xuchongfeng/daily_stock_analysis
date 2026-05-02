const SIX = /^\d{6}$/;

function prefixForSixDigits(digits: string): 'SH' | 'SZ' | 'BJ' | null {
  const c = digits[0];
  if (c === '6' || c === '9') return 'SH';
  if (c === '0' || c === '2' || c === '3') return 'SZ';
  if (c === '8' || c === '4') return 'BJ';
  return null;
}

/** 可识别则返回雪球个股页 URL */
export function xueqiuStockHref(stockCode: string): string | null {
  const raw = (stockCode || '').trim().toUpperCase();
  if (!raw) return null;
  if (/^(SH|SZ|BJ)\d{6}$/.test(raw)) {
    return `https://xueqiu.com/S/${raw}`;
  }
  if (SIX.test(raw)) {
    const p = prefixForSixDigits(raw);
    if (!p) return null;
    return `https://xueqiu.com/S/${p}${raw}`;
  }
  return null;
}

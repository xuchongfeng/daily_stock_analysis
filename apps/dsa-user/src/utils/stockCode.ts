interface ValidationResult {
  valid: boolean;
  normalized: string;
}

const STOCK_CODE_PATTERNS = [
  /^\d{6}$/,
  /^(SH|SZ|BJ)\d{6}$/,
  /^\d{6}\.(SH|SZ|SS|BJ)$/,
  /^\d{5}$/,
  /^HK\d{1,5}$/,
  /^\d{1,5}\.HK$/,
  /^[A-Z]{1,5}(?:\.(?:US|[A-Z]))?$/,
];

export function validateStockCode(value: string): ValidationResult {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, normalized };
  }
  const valid = STOCK_CODE_PATTERNS.some((regex) => regex.test(normalized));
  return { valid, normalized };
}

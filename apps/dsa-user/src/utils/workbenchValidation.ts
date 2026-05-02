interface ValidationResult {
  valid: boolean;
  message?: string;
  normalized: string;
}

const SUPPORTED_QUERY_CHARACTERS = /^[A-Z0-9.\u3400-\u9FFF\s]+$/;

const STOCK_CODE_PATTERNS = [
  /^\d{6}$/,
  /^(SH|SZ|BJ)\d{6}$/,
  /^\d{6}\.(SH|SZ|SS|BJ)$/,
  /^\d{5}$/,
  /^HK\d{1,5}$/,
  /^\d{1,5}\.HK$/,
  /^[A-Z]{1,5}(?:\.(?:US|[A-Z]))?$/,
];

export function looksLikeStockCodeWorkbench(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return STOCK_CODE_PATTERNS.some((regex) => regex.test(normalized));
}

export function validateStockCodeWorkbench(value: string): ValidationResult {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: '请输入股票代码', normalized };
  }
  const valid = looksLikeStockCodeWorkbench(normalized);
  return {
    valid,
    message: valid ? undefined : '股票代码格式不正确',
    normalized,
  };
}

export function isObviouslyInvalidStockQueryWorkbench(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  if (!normalized || looksLikeStockCodeWorkbench(normalized)) {
    return false;
  }
  if (!SUPPORTED_QUERY_CHARACTERS.test(normalized)) {
    return true;
  }
  const hasLetters = /[A-Z]/.test(normalized);
  const hasDigits = /\d/.test(normalized);
  return hasLetters && hasDigits;
}

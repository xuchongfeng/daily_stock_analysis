export type StrategyPriceKind = 'ideal_buy' | 'secondary_buy' | 'stop_loss' | 'take_profit';

export interface StrategyPriceLineSpec {
  kind: StrategyPriceKind;
  price: number;
  title: string;
  color: string;
}

export const STRATEGY_PRICE_LINE_COLORS: Record<StrategyPriceKind, string> = {
  ideal_buy: '#15803d',
  secondary_buy: '#65a30d',
  stop_loss: '#b91c1c',
  take_profit: '#7c3aed',
};

const MA_PERIOD_TOKEN = '(?:5|10|15|20|30|60|90|120|250)';

export function stripMovingAverageTokensFromStrategyText(input: string): string {
  let s = input;
  s = s.replace(/\b(?:MA|EMA|SMA)\s*\d+(?:\.\d+)?\b/gi, ' ');
  s = s.replace(/\d+\s*日均线\b/g, ' ');
  s = s.replace(/\b日均线\s*\d+(?:\.\d+)?\b/g, ' ');
  s = s.replace(/\b均线\s*\d+(?:\.\d+)?\b/g, ' ');
  const maChain = new RegExp(`\\b${MA_PERIOD_TOKEN}\\b(?:\\s+${MA_PERIOD_TOKEN}\\b)+`, 'gi');
  const maComma = new RegExp(`\\b${MA_PERIOD_TOKEN}\\b(?:\\s*[，、,]\\s*${MA_PERIOD_TOKEN}\\b)+`, 'gi');
  const maSlash = new RegExp(`\\b${MA_PERIOD_TOKEN}(?:\\s*[/／]\\s*${MA_PERIOD_TOKEN})+\\b`, 'gi');
  s = s.replace(maSlash, ' ');
  s = s.replace(maComma, ' ');
  s = s.replace(maChain, ' ');
  return s;
}

function extractPositiveNumbers(raw: string | undefined | null, maxCount: number): number[] {
  if (raw == null) return [];
  const s = stripMovingAverageTokensFromStrategyText(String(raw).replace(/,/g, '')).trim();
  if (!s || s === '—' || s === '-') return [];
  const re = /\d+(?:\.\d+)?/g;
  const out: number[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null && out.length < maxCount) {
    const v = parseFloat(m[0]);
    if (!Number.isFinite(v) || v <= 0 || v > 1_000_000_000) {
      continue;
    }
    const key = String(v);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  return out;
}

export type StrategyFieldsInput = {
  idealBuy?: string;
  secondaryBuy?: string;
  stopLoss?: string;
  takeProfit?: string;
};

export type StrategyFieldLabels = {
  idealBuy: string;
  secondaryBuy: string;
  stopLoss: string;
  takeProfit: string;
};

export function buildStrategyPriceLineSpecs(
  strategy: StrategyFieldsInput | null | undefined,
  labels: StrategyFieldLabels,
  langZh: boolean,
): StrategyPriceLineSpec[] {
  if (!strategy) {
    return [];
  }
  const lowSuf = langZh ? '（低）' : ' (L)';
  const highSuf = langZh ? '（高）' : ' (H)';

  const entries: Array<{ kind: StrategyPriceKind; raw?: string }> = [
    { kind: 'ideal_buy', raw: strategy.idealBuy },
    { kind: 'secondary_buy', raw: strategy.secondaryBuy },
    { kind: 'stop_loss', raw: strategy.stopLoss },
    { kind: 'take_profit', raw: strategy.takeProfit },
  ];

  const specs: StrategyPriceLineSpec[] = [];
  for (const { kind, raw } of entries) {
    const label =
      kind === 'ideal_buy'
        ? labels.idealBuy
        : kind === 'secondary_buy'
          ? labels.secondaryBuy
          : kind === 'stop_loss'
            ? labels.stopLoss
            : labels.takeProfit;
    const nums = extractPositiveNumbers(raw, 2).sort((a, b) => a - b);
    const color = STRATEGY_PRICE_LINE_COLORS[kind];
    if (nums.length === 0) {
      continue;
    }
    if (nums.length === 1) {
      specs.push({ kind, price: nums[0], title: label, color });
      continue;
    }
    specs.push({ kind, price: nums[0], title: `${label}${lowSuf}`, color });
    specs.push({ kind, price: nums[1], title: `${label}${highSuf}`, color });
  }
  return specs;
}

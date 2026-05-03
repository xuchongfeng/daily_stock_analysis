import type { HistogramData, Time } from 'lightweight-charts';

/** 日线 Bar：兼容接口字段 ``volume``（后端 snake_case 与前端一致） */
export interface BarWithVolume {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export function rowsHaveTradeVolume(rows: BarWithVolume[]): boolean {
  return rows.some((r) => {
    const v = r.volume;
    return v != null && Number.isFinite(Number(v)) && Number(v) > 0;
  });
}

/** 与蜡烛同色逻辑：收涨绿、收跌红；无成交量时用浅灰占位柱以免断档 */
export function toVolumeHistogramData(rows: BarWithVolume[]): HistogramData<Time>[] {
  const up = '#22c55e';
  const down = '#ef4444';
  const empty = 'rgba(148, 163, 184, 0.25)';
  return rows.map((r) => {
    const vol = r.volume != null && Number.isFinite(Number(r.volume)) ? Math.max(0, Number(r.volume)) : 0;
    const isUp = r.close >= r.open;
    return {
      time: r.date.trim() as Time,
      value: vol,
      color: vol <= 0 ? empty : isUp ? up : down,
    };
  });
}

import type { HistogramData, Time } from 'lightweight-charts';

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

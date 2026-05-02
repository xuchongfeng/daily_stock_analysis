import { create } from 'zustand';
import { watchlistApi } from '../api/watchlist';

function normalizeCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

type WatchlistState = {
  codes: string[];
  labels: Record<string, string>;
  updatedAt: string | null;
  loading: boolean;
  saving: boolean;
  fetch: () => Promise<void>;
  add: (code: string, name?: string | null) => Promise<void>;
  remove: (code: string) => Promise<void>;
};

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  codes: [],
  labels: {},
  updatedAt: null,
  loading: false,
  saving: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const r = await watchlistApi.get();
      set({
        codes: r.codes || [],
        labels: r.labels || {},
        updatedAt: r.updatedAt ?? null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  add: async (codeRaw, stockName) => {
    const c = normalizeCode(codeRaw);
    if (!c) return;
    const { codes, labels } = get();
    if (codes.includes(c)) return;
    const nextCodes = [...codes, c];
    const nextLabels = { ...labels };
    if (stockName && String(stockName).trim()) {
      nextLabels[c] = String(stockName).trim().slice(0, 120);
    }
    set({ saving: true });
    try {
      const r = await watchlistApi.put({ codes: nextCodes, labels: nextLabels });
      set({
        codes: r.codes || [],
        labels: r.labels || {},
        updatedAt: r.updatedAt ?? null,
        saving: false,
      });
    } catch (e) {
      set({ saving: false });
      throw e;
    }
  },

  remove: async (codeRaw) => {
    const c = normalizeCode(codeRaw);
    if (!c) return;
    const { codes, labels } = get();
    const nextCodes = codes.filter((x) => x !== c);
    const nextLabels = { ...labels };
    delete nextLabels[c];
    set({ saving: true });
    try {
      const r = await watchlistApi.put({ codes: nextCodes, labels: nextLabels });
      set({
        codes: r.codes || [],
        labels: r.labels || {},
        updatedAt: r.updatedAt ?? null,
        saving: false,
      });
    } catch (e) {
      set({ saving: false });
      throw e;
    }
  },
}));

import { useState, useEffect } from 'react';
import type { StockIndexItem } from './types';
import { loadStockIndex } from './stockIndexLoader';
import type { IndexLoadResult } from './stockIndexLoader';

export interface UseStockIndexResult {
  index: StockIndexItem[];
  loading: boolean;
  error: Error | null;
  fallback: boolean;
  loaded: boolean;
}

export function useStockIndex(): UseStockIndexResult {
  const [index, setIndex] = useState<StockIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const result: IndexLoadResult = await loadStockIndex();

      if (mounted) {
        setIndex(result.data);
        setFallback(result.fallback);
        if (result.error) {
          setError(result.error);
        }
        setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    index,
    loading,
    error,
    fallback,
    loaded: !loading,
  };
}

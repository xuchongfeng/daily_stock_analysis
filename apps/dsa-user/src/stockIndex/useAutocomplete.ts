import { useState, useCallback, useRef, useEffect } from 'react';
import type { StockIndexItem, StockSuggestion } from './types';
import { searchStocks } from './searchStocks';
import { SEARCH_CONFIG } from './stockIndexFields';

export interface UseAutocompleteOptions {
  minLength?: number;
  debounceMs?: number;
  limit?: number;
}

export interface UseAutocompleteResult {
  query: string;
  setQuery: (value: string) => void;
  suggestions: StockSuggestion[];
  isOpen: boolean;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
  highlightPrevious: () => void;
  highlightNext: () => void;
  handleSelect: (suggestion: StockSuggestion) => void;
  close: () => void;
  reset: () => void;
  isComposing: boolean;
  setIsComposing: (composing: boolean) => void;
  runtimeFallback: boolean;
  error: Error | null;
}

export function useAutocomplete(
  index: StockIndexItem[],
  options: UseAutocompleteOptions = {},
): UseAutocompleteResult {
  const {
    minLength = SEARCH_CONFIG.MIN_QUERY_LENGTH,
    debounceMs = SEARCH_CONFIG.DEBOUNCE_MS,
    limit = SEARCH_CONFIG.DEFAULT_LIMIT,
  } = options;

  const [query, setQueryState] = useState('');
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isComposing, setIsComposing] = useState(false);
  const [runtimeFallback, setRuntimeFallback] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string) => {
      if (runtimeFallback) {
        return;
      }

      if (q.length < minLength) {
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      try {
        const results = searchStocks(q, index, { limit });
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      } catch (caught) {
        const runtimeError = caught instanceof Error ? caught : new Error('Autocomplete search failed');
        console.error('Autocomplete search failed. Falling back to plain input.', runtimeError);
        setError(runtimeError);
        setRuntimeFallback(true);
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [index, minLength, limit, runtimeFallback],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQueryState(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (runtimeFallback) {
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        search(value);
      }, debounceMs);
    },
    [search, debounceMs, runtimeFallback],
  );

  const handleSelect = useCallback((suggestion: StockSuggestion) => {
    setQueryState(suggestion.displayCode);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  }, []);

  const highlightPrevious = useCallback(() => {
    setHighlightedIndex((prev) => {
      if (prev <= 0) return suggestions.length - 1;
      return prev - 1;
    });
  }, [suggestions.length]);

  const highlightNext = useCallback(() => {
    setHighlightedIndex((prev) => {
      if (prev >= suggestions.length - 1) return 0;
      return prev + 1;
    });
  }, [suggestions.length]);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const reset = useCallback(() => {
    setQueryState('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery: handleInputChange,
    suggestions,
    isOpen,
    highlightedIndex,
    setHighlightedIndex,
    highlightPrevious,
    highlightNext,
    handleSelect,
    close,
    reset,
    isComposing,
    setIsComposing,
    runtimeFallback,
    error,
  };
}

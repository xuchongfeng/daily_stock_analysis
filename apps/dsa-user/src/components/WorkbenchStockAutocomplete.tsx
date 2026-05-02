/**
 * Workbench stock query input with local index autocomplete (same data as dsa-web).
 */

import { Component, useRef, useEffect, useState } from 'react';
import type { CSSProperties, ErrorInfo, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStockIndex } from '../stockIndex/useStockIndex';
import { useAutocomplete } from '../stockIndex/useAutocomplete';
import type { StockSuggestion } from '../stockIndex/types';

export interface WorkbenchStockAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (code: string, name?: string, source?: 'manual' | 'autocomplete') => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function FallbackInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '输入股票代码或名称',
  className,
}: WorkbenchStockAutocompleteProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !disabled && value) {
          onSubmit(value);
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      data-autocomplete-mode="fallback"
      autoComplete="off"
    />
  );
}

interface BoundaryProps extends WorkbenchStockAutocompleteProps {
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

class WorkbenchStockAutocompleteBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workbench autocomplete error. Falling back to plain input.', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      const { children, ...fallbackProps } = this.props;
      void children;
      return <FallbackInput {...fallbackProps} />;
    }

    return this.props.children;
  }
}

const MARKET_LABELS: Record<string, string> = {
  CN: 'A股',
  HK: '港股',
  US: '美股',
  INDEX: '指数',
  ETF: 'ETF',
  BSE: '北交所',
};

const MATCH_LABELS: Record<string, string> = {
  exact: '精确',
  prefix: '前缀',
  contains: '包含',
  fuzzy: '模糊',
};

function WorkbenchSuggestionsList({
  suggestions,
  highlightedIndex,
  onSelect,
  onMouseEnter,
  style,
}: {
  suggestions: StockSuggestion[];
  highlightedIndex: number;
  onSelect: (suggestion: StockSuggestion) => void;
  onMouseEnter: (index: number) => void;
  style: CSSProperties;
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <ul
      id="workbench-stock-suggestions"
      className="workbench-stock-suggest-list"
      style={style}
      role="listbox"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.canonicalCode}
          role="option"
          aria-selected={index === highlightedIndex}
          className={
            index === highlightedIndex
              ? 'workbench-stock-suggest-item is-active'
              : 'workbench-stock-suggest-item'
          }
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => onMouseEnter(index)}
        >
          <span className="workbench-stock-suggest-market">
            {MARKET_LABELS[suggestion.market] ?? suggestion.market}
          </span>
          <span className="workbench-stock-suggest-main">
            <span className="workbench-stock-suggest-name">{suggestion.nameZh}</span>
            <span className="workbench-stock-suggest-code mono">{suggestion.displayCode}</span>
          </span>
          <span className="workbench-stock-suggest-match">
            {MATCH_LABELS[suggestion.matchType] ?? suggestion.matchType}
          </span>
        </li>
      ))}
    </ul>
  );
}

function WorkbenchStockAutocompleteInner({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '输入股票代码或名称，如 600519、贵州茅台、AAPL',
  className = 'workbench-query-input',
}: WorkbenchStockAutocompleteProps) {
  const { index, loading, fallback } = useStockIndex();
  const {
    setQuery,
    suggestions,
    isOpen,
    highlightedIndex,
    setHighlightedIndex,
    highlightPrevious,
    highlightNext,
    close,
    isComposing,
    setIsComposing,
    runtimeFallback,
    error: autocompleteError,
  } = useAutocomplete(index);

  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef(value);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: string;
  } | null>(null);

  const updateDropdownPosition = () => {
    if (!inputRef.current) {
      setDropdownStyle(null);
      return;
    }

    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      top: rect.bottom,
      left: rect.left,
      width: `${rect.width}px`,
    });
  };

  const closeSuggestions = () => {
    close();
    setDropdownStyle(null);
  };

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setQuery(value);
      prevValueRef.current = value;
    }
  }, [value, setQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(updateDropdownPosition);
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!autocompleteError) {
      return;
    }
    console.error('Workbench autocomplete runtime fallback activated.', autocompleteError);
  }, [autocompleteError]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          const selected = suggestions[highlightedIndex];
          onChange(selected.displayCode);
          closeSuggestions();
          onSubmit(selected.canonicalCode, selected.nameZh, 'autocomplete');
        } else {
          onSubmit(value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSuggestions();
        break;
      default:
        break;
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => closeSuggestions(), 200);
  };

  if (fallback || loading || runtimeFallback) {
    return (
      <FallbackInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  const inputClassName =
    isOpen && dropdownStyle ? `${className} workbench-query-input-suggest-open` : className;

  return (
    <div className="workbench-stock-autocomplete">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onFocus={() => {
          if (isOpen) {
            updateDropdownPosition();
          }
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        aria-autocomplete="list"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="workbench-stock-suggestions"
        autoComplete="off"
      />

      {isOpen && dropdownStyle
        ? createPortal(
            <WorkbenchSuggestionsList
              suggestions={suggestions}
              highlightedIndex={highlightedIndex}
              onSelect={(s) => {
                onChange(s.displayCode);
                closeSuggestions();
                onSubmit(s.canonicalCode, s.nameZh, 'autocomplete');
              }}
              onMouseEnter={(idx) => setHighlightedIndex(idx)}
              style={{
                position: 'fixed',
                top: dropdownStyle.top,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
                zIndex: 200,
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

export function WorkbenchStockAutocomplete(props: WorkbenchStockAutocompleteProps) {
  return (
    <WorkbenchStockAutocompleteBoundary {...props}>
      <WorkbenchStockAutocompleteInner {...props} />
    </WorkbenchStockAutocompleteBoundary>
  );
}

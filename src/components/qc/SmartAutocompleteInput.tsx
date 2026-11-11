import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Database } from 'lucide-react';

interface SmartAutocompleteInputProps {
  id?: string;
  value: string;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  onChange: (value: string) => void;
  onGridKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
}

export const SmartAutocompleteInput: React.FC<SmartAutocompleteInputProps> = ({
  id,
  value,
  options,
  placeholder = '',
  emptyLabel = 'No matching database entries',
  onChange,
  onGridKeyDown,
  onFocus,
  style,
  className = '',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const query = (value || '').trim().toLowerCase();
    if (!query) {
      return options.slice(0, 60);
    }
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const opt of options) {
      const lower = opt.toLowerCase();
      if (lower.startsWith(query)) {
        startsWith.push(opt);
      } else if (lower.includes(query)) {
        includes.push(opt);
      }
    }
    return [...startsWith, ...includes].slice(0, 60);
  }, [options, value]);

  const exactMatch = useMemo(() => {
    const clean = (value || '').trim().toLowerCase();
    if (!clean) return false;
    return options.some(opt => opt.toLowerCase() === clean);
  }, [options, value]);

  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(220, Math.max(88, filteredOptions.length * 32 + 36));
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    setMenuPos({
      top: openUpward ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 2,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 240) - 8)),
      width: Math.max(rect.width, 240),
    });
  }, [filteredOptions.length]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    const handleScrollOrResize = () => updateMenuPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setHighlightedIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setHighlightedIdx(-1);
      }
      return;
    }

    if (e.key === 'ArrowDown' && (isOpen || e.altKey)) {
      if (!isOpen && e.altKey) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIdx(filteredOptions.length > 0 ? 0 : -1);
        return;
      }
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        setHighlightedIdx(prev => (prev + 1) % filteredOptions.length);
        return;
      }
    }

    if (e.key === 'ArrowUp' && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      setHighlightedIdx(prev => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      return;
    }

    if ((e.key === 'Enter' || e.key === 'Tab') && isOpen) {
      if (highlightedIdx >= 0 && highlightedIdx < filteredOptions.length) {
        onChange(filteredOptions[highlightedIdx]);
      }
      setIsOpen(false);
      setHighlightedIdx(-1);
      if (onGridKeyDown) {
        onGridKeyDown(e);
      }
      return;
    }

    if (onGridKeyDown) {
      onGridKeyDown(e);
    }
  };

  const dropdownNode =
    isOpen && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              maxHeight: '220px',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
              zIndex: 99999,
              padding: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '4px',
                fontSize: '0.68rem',
                fontWeight: 600,
                color: '#64748B',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Database size={10} />
                Database Suggestions ({filteredOptions.length})
              </span>
              {value.trim() && !exactMatch && (
                <span style={{ color: '#B45309' }}>Custom entry</span>
              )}
            </div>

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '10px 8px', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
                {emptyLabel}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isHighlighted = idx === highlightedIdx;
                const isSelected = opt.toLowerCase() === (value || '').trim().toLowerCase();
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={e => {
                      e.preventDefault();
                      selectOption(opt);
                      inputRef.current?.focus();
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 700 : 500,
                      backgroundColor: isHighlighted
                        ? '#ECFDF5'
                        : isSelected
                          ? '#F1F5F9'
                          : 'transparent',
                      color: isHighlighted ? '#065F46' : '#0F172A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>
                        Selected
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        className={`qc3-inline-input ${className}`.trim()}
        style={{
          paddingRight: '22px',
          ...style,
        }}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          onFocus?.();
          updateMenuPosition();
        }}
        onClick={() => {
          setIsOpen(true);
          updateMenuPosition();
        }}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIdx(-1);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Toggle database dropdown"
        onMouseDown={e => {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(prev => !prev);
          updateMenuPosition();
        }}
        style={{
          position: 'absolute',
          right: '3px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: isOpen ? '#059669' : '#94A3B8',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
        title="Show database dropdown options"
      >
        <ChevronDown size={13} />
      </button>
      {dropdownNode}
    </div>
  );
};

import React from 'react';
import { normalizeQcMetricStatus, getCellPastelBackground } from '../../utils/qcBatchHelpers';

interface QcMetricPillSelectorProps {
  id?: string;
  value: string;
  ariaLabel?: string;
  onChange: (value: string) => void;
  onGridKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  compact?: boolean;
}

const PILL_OPTIONS: Array<{
  key: 'pass' | 'review' | 'fail';
  label: string;
  value: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}> = [
  {
    key: 'pass',
    label: 'Pass',
    value: 'Pass',
    activeBg: '#D1FAE5',
    activeBorder: '#6EE7B7',
    activeText: '#065F46',
  },
  {
    key: 'review',
    label: 'Review',
    value: 'Review',
    activeBg: '#FEF3C7',
    activeBorder: '#FCD34D',
    activeText: '#92400E',
  },
  {
    key: 'fail',
    label: 'Fail',
    value: 'Fail',
    activeBg: '#FFE4E6',
    activeBorder: '#FDA4AF',
    activeText: '#9F1239',
  },
];

export const QcMetricPillSelector: React.FC<QcMetricPillSelectorProps> = ({
  id,
  value,
  ariaLabel,
  onChange,
  onGridKeyDown,
  compact = false,
}) => {
  const status = normalizeQcMetricStatus(value);

  const toggleValue = (targetValue: string, targetKey: 'pass' | 'review' | 'fail') => {
    if (status === targetKey) {
      onChange('');
    } else {
      onChange(targetValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key.toLowerCase();
    if (key === 'p' || key === '1') {
      e.preventDefault();
      toggleValue('Pass', 'pass');
      return;
    }
    if (key === 'r' || key === '2') {
      e.preventDefault();
      toggleValue('Review', 'review');
      return;
    }
    if (key === 'f' || key === '3') {
      e.preventDefault();
      toggleValue('Fail', 'fail');
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (status === 'empty') onChange('Pass');
      else if (status === 'pass') onChange('Review');
      else if (status === 'review') onChange('Fail');
      else onChange('');
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange('');
      return;
    }
    onGridKeyDown?.(e);
  };

  return (
    <div
      id={id}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      data-qc-status={status}
      onKeyDown={handleKeyDown}
      className="qc3-pill-group"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '3px' : '4px',
        padding: compact ? '2px 3px' : '3px 4px',
        width: '100%',
        height: '100%',
        minHeight: compact ? '30px' : '34px',
        backgroundColor: getCellPastelBackground(status),
        outline: 'none',
        boxSizing: 'border-box',
      }}
    >
      {PILL_OPTIONS.map(opt => {
        const isActive = status === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            tabIndex={-1}
            aria-pressed={isActive}
            onClick={e => {
              e.stopPropagation();
              toggleValue(opt.value, opt.key);
            }}
            style={{
              flex: 1,
              height: compact ? '22px' : '24px',
              padding: compact ? '0 4px' : '0 6px',
              borderRadius: '999px',
              border: `1px solid ${isActive ? opt.activeBorder : '#E2E8F0'}`,
              backgroundColor: isActive ? opt.activeBg : '#FFFFFF',
              color: isActive ? opt.activeText : '#64748B',
              fontSize: compact ? '0.67rem' : '0.7rem',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
      {status === 'custom' && value.trim() && (
        <span
          title={`Custom value: ${value}`}
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color: '#92400E',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '4px',
            padding: '1px 4px',
            maxWidth: '48px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
};

export const QcMetricStatusBadge: React.FC<{ value: string }> = ({ value }) => {
  const clean = (value || '').trim();
  const status = normalizeQcMetricStatus(clean);

  if (!clean || status === 'empty') {
    return <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>—</span>;
  }

  const palette =
    status === 'pass'
      ? { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' }
      : status === 'fail'
        ? { bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239' }
        : { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 9px',
        borderRadius: '999px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {clean}
    </span>
  );
};

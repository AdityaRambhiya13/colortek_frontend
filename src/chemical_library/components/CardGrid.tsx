import React from 'react';
import type { ChemicalRecord } from '../types';

interface CardGridProps {
  records: ChemicalRecord[];
  searchQuery: string;
  onClearSearch: () => void;
  onCardClick: (record: ChemicalRecord) => void;
}

export const CardGrid: React.FC<CardGridProps> = ({
  records,
  searchQuery,
  onClearSearch,
  onCardClick,
}) => {
  const highlightText = (text: string) => {
    if (!text || !searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ background: 'var(--lib-archival-beige-light)', color: 'var(--lib-ink-dark)', padding: '0 2px' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (records.length === 0) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', border: '1px dashed var(--lib-olive-muted)', background: 'var(--lib-paper-card)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--lib-ink-primary)', marginBottom: '8px' }}>
          NO RECORD FOUND
        </h3>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--lib-olive-muted)', fontSize: '15px' }}>
          No chemical compound matches the search parameters.
        </p>
        <button
          onClick={onClearSearch}
          style={{
            marginTop: '18px',
            background: 'var(--lib-ink-primary)',
            color: 'var(--lib-paper-primary)',
            border: 'none',
            padding: '10px 20px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          RESET SEARCH
        </button>
      </div>
    );
  }

  return (
    <div className="chem-lib-grid">
      {records.map((item) => (
        <div
          key={item.id}
          className="chem-lib-card"
          onClick={() => onCardClick(item)}
          style={{ cursor: 'pointer' }}
          title="Click to edit and view details in tab form"
        >
          <div>
            <div className="chem-lib-card-top">
              <span className="chem-lib-card-code">{item.code || item.callNumber}</span>
              {item.drawer && <span className="chem-lib-card-drawer">{item.drawer}</span>}
            </div>
            <div className="chem-lib-card-name" style={{ minHeight: '24px' }}>
              {item.name ? highlightText(item.name) : <span style={{ color: 'var(--lib-olive-muted)', fontStyle: 'italic' }}>—</span>}
            </div>
            <div className="chem-lib-card-divider" />
            <div className="chem-lib-card-meta-label">CATEGORY</div>
            <div className="chem-lib-card-category">
              {item.category ? highlightText(item.category) : <span style={{ color: 'var(--lib-olive-muted)' }}>—</span>}
            </div>
            <div className="chem-lib-card-meta-label">DESCRIPTION</div>
            <div className="chem-lib-card-desc">
              {item.description ? highlightText(item.description) : <span style={{ color: 'var(--lib-olive-muted)' }}>—</span>}
            </div>
          </div>
          <div className="chem-lib-card-footer">
            <span className="chem-lib-card-link">EDIT DETAILS ✎</span>
          </div>
        </div>
      ))}
    </div>
  );
};

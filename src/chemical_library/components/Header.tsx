import React from 'react';
import { Search, X } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchClear: () => void;
  totalRecordsCount: number;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchClear,
  totalRecordsCount,
  onLogoClick,
}) => {
  return (
    <header className="chem-lib-header">
      <div className="chem-lib-brand" onClick={onLogoClick}>
        <div className="chem-lib-brand-mark">
          <span>CA</span>
        </div>
        <div>
          <h1 className="chem-lib-brand-title">Chemical Archive</h1>
          <p className="chem-lib-brand-sub">Research & Compound Library</p>
        </div>
      </div>

      <div className="chem-lib-search-box">
        <Search className="chem-lib-search-icon" size={16} />
        <input
          type="text"
          className="chem-lib-search-input"
          placeholder="Search exact code (e.g. D-250, Tc-1000), name, formula..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="chem-lib-search-clear" onClick={onSearchClear} title="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--lib-olive-muted)' }}>
        {totalRecordsCount.toLocaleString()} CATALOGED SPECIMENS
      </div>
    </header>
  );
};

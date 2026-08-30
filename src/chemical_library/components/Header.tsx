import React from 'react';
import { Search, X, ShieldCheck, LogOut } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchClear: () => void;
  totalRecordsCount: number;
  onLogoClick: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchClear,
  totalRecordsCount,
  onLogoClick,
  onLogout,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#166534',
            background: '#dcfce7',
            padding: '4px 10px',
            borderRadius: '2px',
            border: '1px solid #bbf7d0',
          }}
          title="256-Bit Cryptography & Multi-Factor Security Active"
        >
          <ShieldCheck size={14} /> 256-BIT ENCRYPTED
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--lib-olive-muted)' }}>
          {totalRecordsCount.toLocaleString()} SPECIMENS
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: '1px solid var(--lib-border-subtle)',
              padding: '6px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lib-ink-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '2px',
            }}
            title="Lock & Logout Session"
          >
            <LogOut size={13} /> LOGOUT
          </button>
        )}
      </div>
    </header>
  );
};


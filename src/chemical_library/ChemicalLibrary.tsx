import React, { useState, useEffect, useMemo } from 'react';
import './ChemicalLibrary.css';
import type { ChemicalRecord, CollectionMeta, SortOrder } from './types';
import { CHEMICAL_DATA } from './chemicalData';
import { Header } from './components/Header';
import { CollectionSidebar } from './components/CollectionSidebar';
import { IndexTabs } from './components/IndexTabs';
import { CardGrid } from './components/CardGrid';
import { Pagination } from './components/Pagination';
import { EditTabModal } from './components/EditTabModal';
import { LibraryAuthGate } from './components/LibraryAuthGate';
import { getActiveSession, terminateSession } from './security/cryptoEngine';

const COLLECTIONS: CollectionMeta[] = [
  { id: 'ALL', label: 'ALL RECORDS', range: 'Entire Archive Index', count: 3381 },
  { id: 'D', label: 'D COLLECTION', range: 'D-001 to D-500', count: 500 },
  { id: 'R', label: 'R COLLECTION', range: 'R-001 to R-500', count: 500 },
  { id: 'Tc', label: 'Tc COLLECTION', range: 'Tc-001 to Tc-1000', count: 1000 },
  { id: 'W', label: 'W COLLECTION', range: 'W-001 to W-100', count: 100 },
  { id: 'B', label: 'B COLLECTION', range: 'B-001 to B-100', count: 100 },
  { id: 'G', label: 'G COLLECTION', range: 'G-100 to G-200', count: 101 },
  { id: 'Y', label: 'Y COLLECTION', range: 'Y-001 to Y-1000', count: 1000 },
  { id: 'MISC', label: 'MISCELLANEOUS', range: 'MISC-001 to MISC-080', count: 80 },
];

const PAGE_SIZE = 36;

export const ChemicalLibrary: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Check active cryptographic session
  useEffect(() => {
    getActiveSession().then((session) => {
      if (session) {
        setIsAuthenticated(true);
      }
      setIsCheckingAuth(false);
    });
  }, []);

  const [allRecords, setAllRecords] = useState<ChemicalRecord[]>(() => {
    try {
      const saved = localStorage.getItem('chemical_archive_records_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return CHEMICAL_DATA;
  });

  const [activeCollection, setActiveCollection] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortCriterion, setSortCriterion] = useState<SortOrder>('code');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRecord, setSelectedRecord] = useState<ChemicalRecord | null>(null);

  const handleLogout = () => {
    terminateSession();
    setIsAuthenticated(false);
  };

  // Auto-save handler
  const handleUpdateRecord = (updated: ChemicalRecord) => {
    setAllRecords((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      try {
        localStorage.setItem('chemical_archive_records_v1', JSON.stringify(next));
      } catch {
        // LocalStorage quota fallback
      }
      return next;
    });
    setSelectedRecord(updated);
  };

  // Filtered & sorted records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allRecords.filter((item) => {
      if (activeCollection !== 'ALL' && item.prefix !== activeCollection) return false;
      if (!q) return true;
      const code = (item.code || item.callNumber || '').toLowerCase();
      return (
        code === q ||
        code.includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortCriterion === 'code') return a.prefix.localeCompare(b.prefix) || parseInt(a.num) - parseInt(b.num);
      if (sortCriterion === 'code_desc') return b.prefix.localeCompare(a.prefix) || parseInt(b.num) - parseInt(a.num);
      if (sortCriterion === 'name') return a.name.localeCompare(b.name);
      if (sortCriterion === 'category') return a.category.localeCompare(b.category);
      return 0;
    });

    return list;
  }, [allRecords, activeCollection, searchQuery, sortCriterion]);

  // Virtual pagination slice
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredRecords.length);
  const pageRecords = filteredRecords.slice(startIndex, endIndex);

  // Handlers
  const handleCollectionChange = (id: string) => {
    setActiveCollection(id);
    setCurrentPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 80, behavior: 'smooth' });
  };

  const currentCollMeta = COLLECTIONS.find((c) => c.id === activeCollection) || COLLECTIONS[0];

  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAE8B4', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#574A24' }}>
        VERIFYING AES-256 SESSION...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LibraryAuthGate onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="chem-lib-root">
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchClear={handleClearSearch}
        totalRecordsCount={allRecords.length}
        onLogoClick={() => handleCollectionChange('ALL')}
        onLogout={handleLogout}
      />

      <div className="chem-lib-layout">
        <CollectionSidebar
          collections={COLLECTIONS}
          activeCollection={activeCollection}
          onSelectCollection={handleCollectionChange}
        />

        <main className="chem-lib-main">
          <div className="chem-lib-title-strip">
            <div>
              <h2 className="chem-lib-heading">{currentCollMeta.label}</h2>
              <div className="chem-lib-sub-badge">
                <span>{filteredRecords.length.toLocaleString()} CATALOGED CHEMICAL RECORDS</span>
                <span className="chem-lib-dot" />
                <span>NIST VERIFIED ARCHIVE</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--lib-olive-muted)' }}>
                Sort:
              </span>
              <select
                value={sortCriterion}
                onChange={(e) => setSortCriterion(e.target.value as SortOrder)}
                style={{
                  background: 'var(--lib-paper-surface)',
                  border: '1px solid var(--lib-border-subtle)',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--lib-ink-primary)',
                  borderRadius: '2px',
                  outline: 'none',
                }}
              >
                <option value="code">Product Code (Ascending)</option>
                <option value="code_desc">Product Code (Descending)</option>
                <option value="name">Product Name (A-Z)</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>

          <IndexTabs
            collections={COLLECTIONS}
            activeCollection={activeCollection}
            onSelectCollection={handleCollectionChange}
          />

          <CardGrid
            records={pageRecords}
            searchQuery={searchQuery}
            onClearSearch={handleClearSearch}
            onCardClick={(record) => setSelectedRecord(record)}
          />

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalRecords={filteredRecords.length}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={handlePageChange}
          />
        </main>
      </div>

      <EditTabModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onUpdateRecord={handleUpdateRecord}
      />
    </div>
  );
};
export default ChemicalLibrary;

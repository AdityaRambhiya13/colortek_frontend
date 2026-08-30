import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  startIndex,
  endIndex,
  onPageChange,
}) => {
  if (totalRecords === 0) return null;

  const renderPageButtons = () => {
    if (totalPages <= 1) return null;

    const btns: React.ReactNode[] = [];
    btns.push(
      <button
        key="prev"
        className="chem-lib-btn-page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        PREV
      </button>
    );

    const startP = Math.max(1, currentPage - 2);
    const endP = Math.min(totalPages, currentPage + 2);

    if (startP > 1) {
      btns.push(
        <button key={1} className="chem-lib-btn-page" onClick={() => onPageChange(1)}>
          1
        </button>
      );
      if (startP > 2) {
        btns.push(
          <span key="dots-1" style={{ fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
            ...
          </span>
        );
      }
    }

    for (let p = startP; p <= endP; p++) {
      btns.push(
        <button
          key={p}
          className={`chem-lib-btn-page ${p === currentPage ? 'active' : ''}`}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      );
    }

    if (endP < totalPages) {
      if (endP < totalPages - 1) {
        btns.push(
          <span key="dots-2" style={{ fontFamily: 'var(--font-mono)', padding: '0 4px' }}>
            ...
          </span>
        );
      }
      btns.push(
        <button key={totalPages} className="chem-lib-btn-page" onClick={() => onPageChange(totalPages)}>
          {totalPages}
        </button>
      );
    }

    btns.push(
      <button
        key="next"
        className="chem-lib-btn-page"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        NEXT
      </button>
    );

    return btns;
  };

  return (
    <div className="chem-lib-pagination">
      <div className="chem-lib-page-info">
        Showing {startIndex + 1} - {endIndex} of {totalRecords.toLocaleString()} records (Page {currentPage} of {totalPages})
      </div>
      <div className="chem-lib-page-btns">{renderPageButtons()}</div>
    </div>
  );
};

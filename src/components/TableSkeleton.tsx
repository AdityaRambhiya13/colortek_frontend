import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols = 4 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '12px 0' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', gap: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--border-color, #E2E8F0)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton-item" style={{
            flex: 1,
            height: '20px',
            backgroundColor: 'var(--border-color, #E2E8F0)',
            borderRadius: '4px'
          }} />
        ))}
      </div>
      {/* Rows Skeletons */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border-color, #E2E8F0)', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton-item" style={{
              flex: 1,
              height: '16px',
              backgroundColor: 'var(--border-color, #E2E8F0)',
              borderRadius: '4px',
              opacity: 0.8 - (c * 0.1)
            }} />
          ))}
        </div>
      ))}
    </div>
  );
};

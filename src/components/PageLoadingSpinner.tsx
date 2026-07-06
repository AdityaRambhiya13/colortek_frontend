import React from 'react';

export const PageLoadingSpinner: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      width: '100%',
      gap: '16px',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid var(--border-color, #E2E8F0)',
        borderTopColor: 'var(--primary-color, #3B82F6)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-light, #94a3b8)' }}>
        LOADING SECURE WORKSPACE...
      </span>
    </div>
  );
};

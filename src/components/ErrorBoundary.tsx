import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught boundary error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-app, #F8FAFC)',
          color: 'var(--text-primary, #1e293b)',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--color-error-light, #fef2f2)',
            color: 'var(--color-error, #EF4444)',
            padding: '20px',
            borderRadius: '50%',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={48} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
            Application Encounters an Issue
          </h2>
          <p style={{ color: 'var(--text-secondary, #475569)', maxWidth: '480px', fontSize: '0.9rem', marginBottom: '24px' }}>
            A runtime error occurred. The details have been logged. You can reload the application to recover.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: 'var(--primary-color, #3B82F6)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

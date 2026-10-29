import React from 'react';
import { ShieldAlert, RefreshCw, RotateCcw, Copy, Check } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleCopyError = () => {
    if (!this.state.error) return;
    const details = `Error: ${this.state.error.message}\nStack:\n${this.state.error.stack || 'No stack trace'}\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: undefined, copied: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app, #f4f7fb)',
          color: 'var(--text-primary, #1e293b)',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--color-error-light, #fee2e2)',
            color: 'var(--color-error, #ef4444)',
            padding: '20px',
            borderRadius: '50%',
            marginBottom: '20px',
            boxShadow: 'var(--shadow-md, 0 8px 24px rgba(149, 157, 165, 0.15))'
          }}>
            <ShieldAlert size={44} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Application Encountered an Issue
          </h2>

          <p style={{
            color: 'var(--text-secondary, #475569)',
            maxWidth: '520px',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            marginBottom: '20px'
          }}>
            {this.props.fallbackMessage || 'A runtime error occurred in this view. Your session data is intact. You can try recovering the view or reload the application.'}
          </p>

          {this.state.error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '8px',
              maxWidth: '620px',
              width: '100%',
              fontSize: '0.85rem',
              textAlign: 'left',
              marginBottom: '24px',
              border: '1px solid #fecaca',
              overflowX: 'auto',
              fontFamily: 'monospace'
            }}>
              <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleTryAgain}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--primary-color, #6366f1)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <RotateCcw size={16} />
              Try Again
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary, #1e293b)',
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <RefreshCw size={16} />
              Reload App
            </button>

            <button
              onClick={this.handleCopyError}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                color: 'var(--text-secondary, #475569)',
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Copy details for developer support"
            >
              {this.state.copied ? <Check size={16} color="var(--color-success, #10b981)" /> : <Copy size={16} />}
              {this.state.copied ? 'Copied Details' : 'Copy Error Details'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

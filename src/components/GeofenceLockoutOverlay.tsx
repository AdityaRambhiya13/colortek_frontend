import React from 'react';
import { MapPin, ShieldAlert, RefreshCw, LogOut, Navigation, AlertTriangle } from 'lucide-react';

interface GeofenceLockoutOverlayProps {
  locationName: string;
  allowedRadius: number;
  distance: number | null;
  error: string | null;
  isChecking: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export const GeofenceLockoutOverlay: React.FC<GeofenceLockoutOverlayProps> = ({
  locationName,
  allowedRadius,
  distance,
  error,
  isChecking,
  onRefresh,
  onLogout,
}) => {
  const isPermissionIssue = error && (error.toLowerCase().includes('denied') || error.toLowerCase().includes('permission'));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(9, 9, 11, 0.88)',
        backdropFilter: 'blur(16px)',
        padding: '24px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(15, 15, 18, 0.98) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.25), 0 0 40px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
        }}
      >
        {/* Pulsing Radar Alert Icon */}
        <div
          style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              border: '2px solid rgba(239, 68, 68, 0.25)',
              animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
          <MapPin size={38} color="#ef4444" />
        </div>

        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-0.01em' }}>
            You Must Be in the Building to Access CMS
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Access to <strong>Colortek CMS</strong> is strictly geofenced to authorized company premises. You must be physically inside the building to access the app or else login and system usage are blocked.
          </p>
        </div>

        {/* Distance / Status Info Card */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Designated Facility
            </span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>
              {locationName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Authorized Radius
            </span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#38bdf8' }}>
              Within {allowedRadius} meters
            </span>
          </div>

          {distance !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Current Distance
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>
                ~{distance} meters away
              </span>
            </div>
          )}
        </div>

        {/* Error / Instruction Message */}
        {error && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '0.82rem',
              color: '#fca5a5',
              textAlign: 'left',
              lineHeight: '1.4',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '2px' }}>
                {isPermissionIssue ? 'Permission Required' : 'Perimeter Alert'}
              </p>
              <p>{error}</p>
              {isPermissionIssue && (
                <p style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: '6px' }}>
                  Tip: Click the padlock 🔒 or settings icon next to the URL in your browser, set <strong>Location</strong> to <strong>Allow</strong>, and click &ldquo;Refresh Location&rdquo;.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '4px' }}>
          <button
            onClick={onRefresh}
            disabled={isChecking}
            style={{
              flex: 1,
              padding: '12px 18px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: isChecking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s ease',
              opacity: isChecking ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <RefreshCw size={16} className={isChecking ? 'spin' : ''} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isChecking ? 'Checking Location...' : 'Refresh Location'}</span>
          </button>

          <button
            onClick={onLogout}
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

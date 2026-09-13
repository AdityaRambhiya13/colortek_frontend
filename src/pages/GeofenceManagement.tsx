import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Globe, 
  ShieldCheck, 
  Settings, 
  RefreshCw, 
  Sliders, 
  Crosshair,
  ExternalLink,
  Laptop,
  Smartphone
} from 'lucide-react';
import { AdminAPI } from '../services/api';

interface GeofenceManagementProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const GeofenceManagement: React.FC<GeofenceManagementProps> = ({ onShowToast }) => {
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceName, setGeofenceName] = useState('Company Premises');
  const [geofenceLat, setGeofenceLat] = useState('0.0');
  const [geofenceLon, setGeofenceLon] = useState('0.0');
  const [geofenceRadius, setGeofenceRadius] = useState('200');
  const [geofenceUpdatedAt, setGeofenceUpdatedAt] = useState<string | null>(null);
  const [geofenceUpdatedBy, setGeofenceUpdatedBy] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingAdminLocation, setDetectingAdminLocation] = useState(false);
  const [adminLiveDistance, setAdminLiveDistance] = useState<number | null>(null);
  const [adminLocationAccuracy, setAdminLocationAccuracy] = useState<number | null>(null);

  const fetchGeofenceConfig = async () => {
    setLoading(true);
    try {
      const [success, data] = await AdminAPI.getGeofenceConfig();
      if (success && data && typeof data !== 'string') {
        setGeofenceEnabled(Boolean(data.is_enabled));
        setGeofenceName(data.name || 'Company Premises');
        setGeofenceLat(String(data.latitude || 0));
        setGeofenceLon(String(data.longitude || 0));
        setGeofenceRadius(String(data.radius_meters || 200));
        setGeofenceUpdatedAt(data.updated_at || null);
        setGeofenceUpdatedBy(data.updated_by || null);
      }
    } catch {
      onShowToast('Failed to load geofencing configuration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeofenceConfig();
  }, []);

  const handleSaveGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(geofenceLat);
    const lon = parseFloat(geofenceLon);
    const radius = parseFloat(geofenceRadius);

    if (isNaN(lat) || isNaN(lon)) {
      onShowToast('Latitude and Longitude must be valid numbers.', 'warning');
      return;
    }
    if (isNaN(radius) || radius <= 0) {
      onShowToast('Allowed radius must be a positive number in meters.', 'warning');
      return;
    }

    setSaving(true);
    const [success, res] = await AdminAPI.updateGeofenceConfig({
      is_enabled: geofenceEnabled,
      name: geofenceName.trim() || 'Company Premises',
      latitude: lat,
      longitude: lon,
      radius_meters: radius,
    });
    setSaving(false);

    if (success && res && typeof res !== 'string') {
      onShowToast(`Geofence settings updated successfully! (${geofenceEnabled ? 'ACTIVE / ENFORCED' : 'DISABLED'})`, 'success');
      setGeofenceUpdatedAt(res.updated_at || new Date().toISOString());
      setGeofenceUpdatedBy(res.updated_by || 'admin');
    } else {
      onShowToast(typeof res === 'string' ? res : 'Failed to save geofence configuration.', 'error');
    }
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      onShowToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setDetectingAdminLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setGeofenceLat(lat);
        setGeofenceLon(lon);
        setAdminLocationAccuracy(Math.round(pos.coords.accuracy));
        setDetectingAdminLocation(false);
        setAdminLiveDistance(0);
        onShowToast(`GPS Position Acquired: (${lat}, ${lon}) with ±${Math.round(pos.coords.accuracy)}m accuracy`, 'success');
      },
      (err) => {
        setDetectingAdminLocation(false);
        let msg = 'Failed to retrieve current location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Click the lock icon in your address bar and set Location to Allow.';
        }
        onShowToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleTestAdminDistance = () => {
    if (!('geolocation' in navigator)) {
      onShowToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    const targetLat = parseFloat(geofenceLat);
    const targetLon = parseFloat(geofenceLon);
    if (isNaN(targetLat) || isNaN(targetLon)) {
      onShowToast('Please enter valid coordinates first.', 'warning');
      return;
    }

    setDetectingAdminLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingAdminLocation(false);
        const R = 6371000;
        const dLat = ((targetLat - pos.coords.latitude) * Math.PI) / 180;
        const dLon = ((targetLon - pos.coords.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((pos.coords.latitude * Math.PI) / 180) *
            Math.cos((targetLat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = Math.round(R * c);
        setAdminLiveDistance(dist);
        setAdminLocationAccuracy(Math.round(pos.coords.accuracy));
        const rad = parseFloat(geofenceRadius) || 200;
        if (dist <= rad) {
          onShowToast(`Position verified: ~${dist}m from center — Safely inside authorized perimeter (${rad}m) ✅`, 'success');
        } else {
          onShowToast(`Position: ~${dist}m from center — Outside perimeter by ~${dist - rad}m (${rad}m allowed) 📍`, 'info');
        }
      },
      () => {
        setDetectingAdminLocation(false);
        onShowToast('Could not retrieve current position.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const radiusPresets = [
    { label: '100m', desc: 'Single Building', val: '100' },
    { label: '250m', desc: 'Plant / Facility', val: '250' },
    { label: '500m', desc: 'Industrial Estate', val: '500' },
    { label: '1000m', desc: '1 km Zone', val: '1000' },
    { label: '2500m', desc: '2.5 km Area', val: '2500' },
  ];

  const parsedRadius = parseFloat(geofenceRadius) || 200;
  const isInside = adminLiveDistance !== null && adminLiveDistance <= parsedRadius;

  return (
    <div className="geofence-wrapper">
      {/* Dynamic Responsive Styles for Laptop & Mobile viewports */}
      <style>{`
        .geofence-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
          margin: 0 auto;
          color: #f8fafc;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 100%;
          box-sizing: border-box;
        }

        .geofence-header-banner {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 22px 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
        }

        .geofence-header-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: ${geofenceEnabled ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #64748b, #475569)'};
        }

        .geofence-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .geofence-header-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: ${geofenceEnabled ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)' : 'rgba(100, 116, 139, 0.15)'};
          border: 1px solid ${geofenceEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.25)'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${geofenceEnabled ? '#34d399' : '#94a3b8'};
          flex-shrink: 0;
          box-shadow: ${geofenceEnabled ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none'};
        }

        .geofence-header-title {
          font-size: 1.35rem;
          font-weight: 800;
          margin: 0;
          color: #ffffff;
          letter-spacing: -0.01em;
        }

        .geofence-refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 10px;
          background-color: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 40px;
        }
        .geofence-refresh-btn:hover {
          background-color: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .geofence-admin-banner {
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%);
          border: 1px solid rgba(129, 140, 248, 0.28);
          border-radius: 14px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        /* 2-column on laptop, 1-column on mobile */
        .geofence-main-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 20px;
          width: 100%;
          box-sizing: border-box;
        }

        .geofence-card {
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
          box-sizing: border-box;
          width: 100%;
        }

        .geofence-coords-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }

        .geofence-input {
          width: 100%;
          background-color: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          padding: 12px 14px;
          color: #ffffff;
          font-size: 0.92rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }
        .geofence-input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }

        .geofence-gps-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background-color: rgba(14, 165, 233, 0.15);
          border: 1px solid rgba(14, 165, 233, 0.35);
          color: #38bdf8;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 36px;
        }
        .geofence-gps-btn:hover:not(:disabled) {
          background-color: rgba(14, 165, 233, 0.28);
          color: #ffffff;
        }

        .geofence-presets-container {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .geofence-preset-btn {
          padding: 8px 6px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          transition: all 0.15s ease;
          min-height: 52px;
          justify-content: center;
          box-sizing: border-box;
        }

        .geofence-submit-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          gap: 12px;
          flex-wrap: wrap;
        }

        .geofence-submit-btn {
          padding: 12px 28px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
          border: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.92rem;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(2, 132, 199, 0.35);
          transition: all 0.2s ease;
          min-height: 44px;
        }
        .geofence-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(2, 132, 199, 0.45);
        }

        .geofence-radar-box {
          position: relative;
          width: 100%;
          height: 230px;
          background-color: #090d16;
          border-radius: 12px;
          border: 1px solid rgba(14, 165, 233, 0.25);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .geofence-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          background-color: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
          width: 100%;
          box-sizing: border-box;
        }
        .geofence-action-btn:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.14);
          color: #ffffff;
        }

        /* Device indicator pill */
        .geofence-device-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.05);
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* MOBILE & SMALL TABLET OPTIMIZATIONS (< 768px) */
        @media (max-width: 768px) {
          .geofence-wrapper {
            gap: 16px;
          }

          .geofence-main-grid {
            grid-template-columns: 1fr !important;
            gap: 16px;
          }

          .geofence-header-banner {
            padding: 16px 14px !important;
            border-radius: 12px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }

          .geofence-header-content {
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .geofence-header-icon {
            width: 44px !important;
            height: 44px !important;
            border-radius: 10px !important;
          }

          .geofence-header-title {
            font-size: 1.2rem !important;
          }

          .geofence-refresh-btn {
            width: 100% !important;
            justify-content: center !important;
            height: 42px !important;
          }

          .geofence-admin-banner {
            padding: 14px 12px !important;
            border-radius: 12px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .geofence-card {
            padding: 18px 14px !important;
            border-radius: 12px !important;
            gap: 16px !important;
          }

          .geofence-coords-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .geofence-coords-top-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }

          .geofence-gps-btn {
            width: 100% !important;
            justify-content: center !important;
            height: 40px !important;
          }

          .geofence-presets-container {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 6px !important;
          }

          .geofence-preset-btn {
            min-height: 48px !important;
            padding: 6px 4px !important;
          }

          .geofence-submit-bar {
            flex-direction: column-reverse !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .geofence-submit-btn {
            width: 100% !important;
            height: 46px !important;
            font-size: 0.95rem !important;
          }

          .geofence-radar-box {
            height: 185px !important;
          }
        }

        /* EXTRA NARROW MOBILE SCREENS (< 420px) */
        @media (max-width: 420px) {
          .geofence-presets-container {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* Top Banner Header */}
      <div className="geofence-header-banner">
        <div className="geofence-header-accent" />

        <div className="geofence-header-content">
          <div className="geofence-header-icon">
            <MapPin size={26} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="geofence-header-title">
                Geofence Perimeter Control
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '20px',
                backgroundColor: geofenceEnabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.18)',
                color: geofenceEnabled ? '#34d399' : '#94a3b8',
                border: `1px solid ${geofenceEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.25)'}`
              }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: geofenceEnabled ? '#10b981' : '#64748b',
                  boxShadow: geofenceEnabled ? '0 0 8px #10b981' : 'none'
                }} />
                {geofenceEnabled ? 'ACTIVE / ENFORCED' : 'DISABLED'}
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Restricts application access for standard users to the designated physical facility.
            </p>
          </div>
        </div>

        <button
          onClick={fetchGeofenceConfig}
          disabled={loading}
          className="geofence-refresh-btn"
          title="Reload geofence parameters from server"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Admin Exemption Royal Banner */}
      <div className="geofence-admin-banner">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a5b4fc',
            flexShrink: 0,
            marginTop: '2px'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
              Administrator Privilege: Unrestricted Anywhere Access
            </div>
            <div style={{ color: '#c7d2fe', fontSize: '0.8rem', marginTop: '2px', lineHeight: '1.4' }}>
              As an Administrator, you can access all modules from <strong>any location worldwide</strong> (office, home, or traveling). Geofencing strictly governs standard employee accounts.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#818cf8',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            padding: '5px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            whiteSpace: 'nowrap'
          }}>
            Admin Exemption Active
          </span>
          <span className="geofence-device-indicator">
            <Laptop size={12} />
            <span>Laptop</span>
            <span>+</span>
            <Smartphone size={12} />
            <span>Mobile</span>
          </span>
        </div>
      </div>

      {/* Main Grid: Form (Left) + Live Radar & Distance Inspector (Right) */}
      <div className="geofence-main-grid">
        {/* Left Column: Settings Configuration Form */}
        <form onSubmit={handleSaveGeofence} className="geofence-card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#38bdf8',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Settings size={18} />
              <span>Boundary Parameters</span>
            </h3>

            {geofenceUpdatedAt && (
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Synced: {new Date(geofenceUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Master Enforcement Toggle Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            backgroundColor: geofenceEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.25)',
            border: `1px solid ${geofenceEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '12px',
            transition: 'all 0.3s ease',
            gap: '12px'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>
                Enforce Geofencing for Regular Users
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                {geofenceEnabled 
                  ? 'Active: Users outside the perimeter cannot access data' 
                  : 'Disabled: All users can log in from any location'}
              </div>
            </div>

            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={geofenceEnabled}
                onChange={(e) => setGeofenceEnabled(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: geofenceEnabled ? '#10b981' : '#475569',
                transition: '0.25s',
                borderRadius: '28px',
                boxShadow: geofenceEnabled ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none'
              }}>
                <span style={{
                  position: 'absolute',
                  height: '22px',
                  width: '22px',
                  left: geofenceEnabled ? '25px' : '3px',
                  bottom: '3px',
                  backgroundColor: '#ffffff',
                  transition: '0.25s',
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }} />
              </span>
            </label>
          </div>

          {/* Facility Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Facility / Premises Name
            </label>
            <input
              type="text"
              value={geofenceName}
              onChange={(e) => setGeofenceName(e.target.value)}
              placeholder="e.g. Colortek Factory & Laboratory"
              required
              className="geofence-input"
            />
          </div>

          {/* Location Coordinates Setup (Dual-Mode) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="geofence-coords-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Center Coordinates
              </label>
              
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={detectingAdminLocation}
                className="geofence-gps-btn"
                title="Capture GPS coordinates of your current phone or laptop location"
              >
                <Crosshair size={14} className={detectingAdminLocation ? 'spin' : ''} style={{ animation: detectingAdminLocation ? 'spin 1s linear infinite' : 'none' }} />
                <span>{detectingAdminLocation ? 'Detecting GPS...' : '📍 Auto-Detect My Location'}</span>
              </button>
            </div>

            {/* Latitude & Longitude Inputs */}
            <div className="geofence-coords-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Latitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={geofenceLat}
                  onChange={(e) => setGeofenceLat(e.target.value)}
                  placeholder="e.g. 19.076090"
                  required
                  className="geofence-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Longitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={geofenceLon}
                  onChange={(e) => setGeofenceLon(e.target.value)}
                  placeholder="e.g. 72.877426"
                  required
                  className="geofence-input"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.76rem', color: '#94a3b8' }}>
              <span>💡 Right-click your building on Google Maps to copy exact numbers, or click &ldquo;Auto-Detect&rdquo;.</span>
              {parseFloat(geofenceLat) !== 0 && parseFloat(geofenceLon) !== 0 && (
                <a
                  href={`https://www.google.com/maps?q=${geofenceLat},${geofenceLon}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)'
                  }}
                >
                  <ExternalLink size={12} />
                  <span>View in Google Maps</span>
                </a>
              )}
            </div>
          </div>

          {/* Allowed Radius Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Authorized Radius
              </label>
              <span style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#38bdf8',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                padding: '2px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(14, 165, 233, 0.25)'
              }}>
                {geofenceRadius} meters
              </span>
            </div>

            <input
              type="number"
              min="20"
              max="50000"
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(e.target.value)}
              required
              className="geofence-input"
            />

            {/* Quick Radius Presets (Responsive Grid) */}
            <div className="geofence-presets-container">
              {radiusPresets.map((preset) => {
                const active = geofenceRadius === preset.val;
                return (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setGeofenceRadius(preset.val)}
                    className="geofence-preset-btn"
                    style={{
                      backgroundColor: active ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${active ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: active ? '#ffffff' : '#cbd5e1',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{preset.label}</span>
                    <span style={{ fontSize: '0.66rem', color: active ? '#e0f2fe' : '#94a3b8', textAlign: 'center' }}>{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="geofence-submit-bar">
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
              {geofenceUpdatedBy ? `Last saved by ${geofenceUpdatedBy}` : 'Changes saved immediately to cloud'}
            </span>

            <button
              type="submit"
              disabled={saving}
              className="geofence-submit-btn"
            >
              {saving ? 'Saving...' : '💾 Save Geofence Settings'}
            </button>
          </div>
        </form>

        {/* Right Column: Live Radar Preview & Distance Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {/* Radar & Perimeter Graphic Card */}
          <div className="geofence-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#38bdf8',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Globe size={18} />
                <span>Perimeter Visualizer & Inspector</span>
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Real-time GPS Radar</span>
            </div>

            {/* Radar Graphic Container */}
            <div className="geofence-radar-box">
              {/* Grid lines background */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.15) 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }} />

              {/* Concentric radar rings */}
              <div style={{
                position: 'absolute',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                border: '1px dashed rgba(14, 165, 233, 0.25)'
              }} />
              <div style={{
                position: 'absolute',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                backgroundColor: 'rgba(14, 165, 233, 0.03)'
              }} />
              <div style={{
                position: 'absolute',
                width: '65px',
                height: '65px',
                borderRadius: '50%',
                border: '1px solid rgba(14, 165, 233, 0.5)'
              }} />

              {/* Center Pin (Premises) */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  border: '3px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(14, 165, 233, 0.6)'
                }}>
                  <MapPin size={17} color="#ffffff" />
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#e0f2fe',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  maxWidth: '180px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {geofenceName || 'Center'}
                </span>
              </div>

              {/* Radius Badge overlay */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '12px',
                fontSize: '0.74rem',
                color: '#38bdf8',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(14, 165, 233, 0.3)'
              }}>
                Radius: {geofenceRadius}m
              </div>
            </div>

            {/* Live Distance Inspector */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Configured Target:</span>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.86rem' }}>
                  {geofenceLat}, {geofenceLon}
                </span>
              </div>

              {adminLiveDistance !== null && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: isInside ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isInside ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>Distance from Center Pin:</span>
                    <span style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: isInside ? '#34d399' : '#f87171'
                    }}>
                      {adminLiveDistance === 0 ? '0m (Exact center coordinate)' : `~${adminLiveDistance}m from center`}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: isInside ? '#34d399' : '#f87171'
                  }}>
                    {isInside 
                      ? `✅ Safely inside building perimeter (${adminLiveDistance}m from center, allowed: ${parsedRadius}m)` 
                      : `📍 Outside building perimeter (${adminLiveDistance}m away, exceeds ${parsedRadius}m radius limit)`}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestAdminDistance}
                disabled={detectingAdminLocation}
                className="geofence-action-btn"
              >
                <Navigation size={16} className={detectingAdminLocation ? 'spin' : ''} style={{ animation: detectingAdminLocation ? 'spin 1s linear infinite' : 'none' }} />
                <span>{detectingAdminLocation ? 'Measuring Distance...' : '📡 Measure Distance From My Location'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default GeofenceManagement;

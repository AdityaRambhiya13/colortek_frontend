import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Globe, 
  ShieldCheck, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Radio, 
  Crosshair,
  ExternalLink
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
          onShowToast(`Distance: ${dist}m — Inside authorized perimeter (${rad}m) ✅`, 'success');
        } else {
          onShowToast(`Distance: ${dist}m — Outside perimeter (${rad}m) 📍`, 'info');
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Accent gradient line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: geofenceEnabled 
            ? 'linear-gradient(90deg, #10b981, #06b6d4)' 
            : 'linear-gradient(90deg, #64748b, #475569)'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: geofenceEnabled 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)' 
              : 'rgba(100, 116, 139, 0.15)',
            border: `1px solid ${geofenceEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.25)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: geofenceEnabled ? '#34d399' : '#94a3b8',
            boxShadow: geofenceEnabled ? '0 0 25px rgba(16, 185, 129, 0.2)' : 'none'
          }}>
            <MapPin size={28} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
                Geofence Perimeter Control
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
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
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '6px 0 0 0' }}>
              Restricts application access for standard users to the designated physical facility.
            </p>
          </div>
        </div>

        <button
          onClick={fetchGeofenceConfig}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {/* Admin Exemption Royal Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%)',
        border: '1px solid rgba(129, 140, 248, 0.28)',
        borderRadius: '14px',
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a5b4fc',
            flexShrink: 0
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>
              Administrator Privilege: Unrestricted Anywhere Access
            </div>
            <div style={{ color: '#c7d2fe', fontSize: '0.82rem', marginTop: '2px', lineHeight: '1.4' }}>
              As an Administrator, you can access all modules from <strong>any location worldwide</strong> (office, home, or travelling). Geofencing strictly governs non-admin employee accounts.
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#818cf8',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}>
          Admin Exemption Active
        </span>
      </div>

      {/* Main Grid: Form + Live Radar/Inspector */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '24px'
      }}>
        {/* Left Column: Settings Configuration Form */}
        <form 
          onSubmit={handleSaveGeofence}
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '14px'
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
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Synced: {new Date(geofenceUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Master Enforcement Toggle Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: geofenceEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.25)',
            border: `1px solid ${geofenceEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: '12px',
            transition: 'all 0.3s ease'
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                Enforce Geofencing for Regular Users
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
                {geofenceEnabled 
                  ? 'Active: Users outside the perimeter cannot access data' 
                  : 'Disabled: All users can log in from any location'}
              </div>
            </div>

            <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px', cursor: 'pointer' }}>
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
                  left: geofenceEnabled ? '26px' : '3px',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Facility / Facility Premises Name
            </label>
            <input
              type="text"
              value={geofenceName}
              onChange={(e) => setGeofenceName(e.target.value)}
              placeholder="e.g. Colortek Factory & Laboratory"
              required
              style={{
                width: '100%',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Location Coordinates Setup (Dual-Mode) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Center GPS Coordinates
              </label>
              
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={detectingAdminLocation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid rgba(14, 165, 233, 0.35)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: detectingAdminLocation ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Crosshair size={14} className={detectingAdminLocation ? 'spin' : ''} style={{ animation: detectingAdminLocation ? 'spin 1s linear infinite' : 'none' }} />
                <span>{detectingAdminLocation ? 'Detecting GPS...' : '📍 Use My Current Location'}</span>
              </button>
            </div>

            {/* Latitude & Longitude Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Latitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={geofenceLat}
                  onChange={(e) => setGeofenceLat(e.target.value)}
                  placeholder="e.g. 19.076090"
                  required
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Longitude</span>
                <input
                  type="number"
                  step="0.000001"
                  value={geofenceLon}
                  onChange={(e) => setGeofenceLon(e.target.value)}
                  placeholder="e.g. 72.877426"
                  required
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.4' }}>
              💡 <strong>Two Ways to Set:</strong> Click <em>&ldquo;Use My Current Location&rdquo;</em> while inside the building, or right-click your building on <strong>Google Maps</strong> and paste the coordinates above.
            </div>
          </div>

          {/* Allowed Radius Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Authorized Radius
              </label>
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#38bdf8',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                padding: '3px 10px',
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
              style={{
                width: '100%',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            {/* Quick Radius Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {radiusPresets.map((preset) => {
                const active = geofenceRadius === preset.val;
                return (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setGeofenceRadius(preset.val)}
                    style={{
                      flex: '1 1 80px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: active ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${active ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                      color: active ? '#ffffff' : '#cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{preset.label}</span>
                    <span style={{ fontSize: '0.68rem', color: active ? '#e0f2fe' : '#94a3b8' }}>{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {geofenceUpdatedBy ? `Last saved by ${geofenceUpdatedBy}` : 'Ready to save'}
            </span>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.2s ease',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Saving Settings...' : '💾 Save Geofence Settings'}
            </button>
          </div>
        </form>

        {/* Right Column: Live Radar Preview & Distance Inspector */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px'
        }}>
          {/* Radar & Perimeter Graphic Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
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
              <Globe size={18} />
              <span>Perimeter Visualizer & Inspector</span>
            </h3>

            {/* Radar Animation Container */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              backgroundColor: '#090d16',
              borderRadius: '12px',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Grid lines */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.15) 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }} />

              {/* Concentric rings */}
              <div style={{
                position: 'absolute',
                width: '190px',
                height: '190px',
                borderRadius: '50%',
                border: '1px dashed rgba(14, 165, 233, 0.25)'
              }} />
              <div style={{
                position: 'absolute',
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                backgroundColor: 'rgba(14, 165, 233, 0.03)'
              }} />
              <div style={{
                position: 'absolute',
                width: '70px',
                height: '70px',
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
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  border: '3px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(14, 165, 233, 0.6)'
                }}>
                  <MapPin size={18} color="#ffffff" />
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#e0f2fe',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}>
                  {geofenceName || 'Center'}
                </span>
              </div>

              {/* Radius Label */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '14px',
                fontSize: '0.75rem',
                color: '#38bdf8',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                padding: '4px 10px',
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
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Center Target:</span>
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.88rem' }}>
                  {geofenceLat}, {geofenceLon}
                </span>
              </div>

              {adminLiveDistance !== null && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: isInside ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isInside ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Your Current Distance:</span>
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: isInside ? '#34d399' : '#f87171'
                    }}>
                      ~{adminLiveDistance} meters away
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isInside ? '#34d399' : '#f87171'
                  }}>
                    {isInside 
                      ? '✅ Within perimeter (standard users would be allowed access)' 
                      : '📍 Outside perimeter (standard users would be locked out)'}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestAdminDistance}
                disabled={detectingAdminLocation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: detectingAdminLocation ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '4px'
                }}
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

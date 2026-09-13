import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthAPI } from '../services/api';
import type { GeofenceConfig } from '../services/api';

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeofenceState {
  isChecking: boolean;
  isInside: boolean;
  distance: number | null;
  allowedRadius: number;
  locationName: string;
  userCoords: { lat: number; lng: number } | null;
  error: string | null;
  isGeofenceActive: boolean;
  refreshLocation: () => Promise<void>;
}

export function useGeofence(enabled: boolean = true): GeofenceState {
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isInside, setIsInside] = useState<boolean>(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [allowedRadius, setAllowedRadius] = useState<number>(200);
  const [locationName, setLocationName] = useState<string>('Company Premises');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeofenceActive, setIsGeofenceActive] = useState<boolean>(false);

  const geofenceConfigRef = useRef<GeofenceConfig | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const evaluatePosition = useCallback((position: GeolocationPosition) => {
    const coords = position.coords;
    const lat = coords.latitude;
    const lng = coords.longitude;
    setUserCoords({ lat, lng });

    // Cache in sessionStorage for Axios request headers
    sessionStorage.setItem('user_lat', String(lat));
    sessionStorage.setItem('user_lng', String(lng));

    const cfg = geofenceConfigRef.current;
    if (!cfg || !cfg.is_enabled) {
      setIsInside(true);
      setDistance(0);
      setError(null);
      setIsChecking(false);
      return;
    }

    const dist = calculateDistanceMeters(lat, lng, cfg.latitude, cfg.longitude);
    const roundedDist = Math.round(dist);
    setDistance(roundedDist);
    setAllowedRadius(cfg.radius_meters);
    setLocationName(cfg.name || 'Company Premises');

    if (dist <= cfg.radius_meters) {
      setIsInside(true);
      setError(null);
    } else {
      setIsInside(false);
      setError(`You are ~${roundedDist}m away from ${cfg.name || 'the authorized premises'} (allowed: ${Math.round(cfg.radius_meters)}m). You must be inside the building to access Colortek CMS.`);
    }
    setIsChecking(false);
  }, []);

  const evaluateError = useCallback((err: GeolocationPositionError) => {
    setIsChecking(false);
    let msg = 'Unable to determine your physical location. You must be in the building to access Colortek CMS.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        msg = 'Location access is denied. Please enable location permissions in your browser to verify that you are inside the building.';
        break;
      case err.POSITION_UNAVAILABLE:
        msg = 'GPS/Location signal unavailable. Connect to company Wi-Fi or step near a window inside the facility.';
        break;
      case err.TIMEOUT:
        msg = 'Location request timed out. Please click "Refresh Location" while inside the building.';
        break;
    }
    setError(msg);
    setIsInside(false);
  }, []);

  const refreshLocation = useCallback(async () => {
    if (!enabled) return;
    setIsChecking(true);

    try {
      const [success, cfg] = await AuthAPI.getGeofenceConfig();
      if (success && cfg && typeof cfg !== 'string') {
        geofenceConfigRef.current = cfg;
        setIsGeofenceActive(Boolean(cfg.is_enabled));
        setAllowedRadius(cfg.radius_meters);
        setLocationName(cfg.name || 'Company Premises');

        if (!cfg.is_enabled) {
          setIsInside(true);
          setError(null);
          setIsChecking(false);
          return;
        }
      }
    } catch {
      // Fall back to current ref if fetch fails
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your current browser.');
      setIsInside(false);
      setIsChecking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(evaluatePosition, evaluateError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    });
  }, [enabled, evaluatePosition, evaluateError]);

  useEffect(() => {
    if (!enabled) {
      setIsChecking(false);
      setIsInside(true);
      setError(null);
      return;
    }

    refreshLocation();

    // Set up continuous location watcher
    if ('geolocation' in navigator) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          evaluatePosition,
          evaluateError,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      } catch (e) {
        console.warn('Geolocation watchPosition failed to initialize:', e);
      }
    }

    // Periodic heartbeat sync every 45 seconds
    const interval = setInterval(() => {
      refreshLocation();
    }, 45000);

    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, refreshLocation, evaluatePosition, evaluateError]);

  return {
    isChecking,
    isInside,
    distance,
    allowedRadius,
    locationName,
    userCoords,
    error,
    isGeofenceActive,
    refreshLocation,
  };
}

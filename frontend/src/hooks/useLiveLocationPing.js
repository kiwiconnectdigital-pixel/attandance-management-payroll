import { useEffect, useRef } from 'react';
import { attendanceAPI } from '../services/api';

const PING_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useLiveLocationPing(isCheckedIn) {
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const sendPing = () => {
      if (inFlightRef.current) return; // avoid overlapping calls
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          inFlightRef.current = true;
          try {
            await attendanceAPI.trackLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          } catch (err) {
            console.warn('Location ping failed:', err?.response?.data?.message || err.message);
          } finally {
            inFlightRef.current = false;
          }
        },
        (err) => console.warn('Geolocation error:', err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    };

    function handleVisibility() {
      if (document.visibilityState === 'visible') sendPing();
    }

    if (isCheckedIn) {
      sendPing();
      intervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isCheckedIn]);
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowPathIcon, MapPinIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { attendanceAPI } from '../../services/api';

const REFRESH_MS = 20000;
const FALLBACK_CENTER = [23.1815, 79.9864]; // used only if there's no location data at all

function makeDivIcon(color) {
  return L.divIcon({
    className: 'll-marker-wrap',
    html: `<div class="ll-marker-pulse" style="--dot-color:${color}"><span></span></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

const CHECKED_IN_ICON = makeDivIcon('#22c55e');
const CHECKED_OUT_ICON = makeDivIcon('#5a6a85');

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
    } else {
      map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [50, 50] });
    }
  }, [points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function timeAgo(iso) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function LiveLocationsPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | checked_in | checked_out
  const timerRef = useRef(null);

  const fetchLocations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await attendanceAPI.getLiveLocations();
      setEmployees(res.data.data.employees || []);
      setLastFetched(new Date());
    } catch {
      if (!silent) toast.error('Failed to load live locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    timerRef.current = setInterval(() => fetchLocations(true), REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchLocations]);

  const visible = employees.filter((e) => (filter === 'all' ? true : e.status === filter));
  const checkedInCount = employees.filter((e) => e.status === 'checked_in').length;
  const selected = visible.find((e) => e.attendanceId === selectedId) || null;

  const defaultCenter = visible.length > 0 ? [visible[0].latitude, visible[0].longitude] : FALLBACK_CENTER;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .ll-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .ll-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623; color: #f0f4ff;
          min-height: 100vh; padding: 24px 20px 40px;
          -webkit-font-smoothing: antialiased;
        }
        .ll-topbar {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: 14px; margin-bottom: 6px;
        }
        .ll-topbar h1 {
          font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800;
          letter-spacing: -0.02em;
        }
        .ll-sub { font-size: 13px; color: #8b9ab5; margin-top: 4px; }
        .ll-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ll-filter-group {
          display: flex; background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 3px;
        }
        .ll-filter-btn {
          border: none; background: transparent; color: #8b9ab5;
          font-family: 'DM Sans', system-ui, sans-serif; font-size: 12px; font-weight: 600;
          padding: 7px 13px; border-radius: 8px; cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .ll-filter-btn.active { background: rgba(99,102,241,0.15); color: #a5b4fc; }
        .ll-refresh-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
          color: #a5b4fc; font-size: 12px; font-weight: 600; font-family: 'DM Sans', system-ui, sans-serif;
          padding: 9px 14px; border-radius: 10px; cursor: pointer; transition: opacity 0.15s;
        }
        .ll-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ll-refresh-btn svg { width: 14px; height: 14px; }
        .ll-refresh-btn svg.spin { animation: llSpin 0.9s linear infinite; }
        @keyframes llSpin { to { transform: rotate(360deg); } }
        .ll-updated { font-size: 11px; color: #5a6a85; margin: 10px 2px 16px; font-family: 'DM Mono', monospace; }

        .ll-body {
          display: grid; grid-template-columns: 1fr 300px; gap: 16px;
          height: calc(100vh - 170px); min-height: 420px;
        }
        .ll-map-wrap {
          border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07);
          background: #1a2336; position: relative;
        }
        .ll-loading, .ll-empty {
          height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #5a6a85; font-size: 13px;
        }
        .ll-spinner {
          width: 26px; height: 26px; border-radius: 50%;
          border: 2px solid rgba(99,102,241,0.2); border-top-color: #818cf8;
          animation: llSpin2 0.7s linear infinite;
        }
        @keyframes llSpin2 { to { transform: rotate(360deg); } }

        .ll-sidebar {
          background: rgba(26,35,54,0.85); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 16px; display: flex; flex-direction: column; overflow: hidden;
        }
        .ll-sidebar-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
          color: rgba(255,255,255,0.3); margin-bottom: 12px; flex-shrink: 0;
        }
        .ll-emp-list { overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .ll-emp-card {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          background: rgba(15,22,35,0.6); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .ll-emp-card:hover, .ll-emp-card.active {
          border-color: rgba(129,140,248,0.35); background: rgba(99,102,241,0.08);
        }
        .ll-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ll-dot.checked_in { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
        .ll-dot.checked_out { background: #5a6a85; }
        .ll-emp-info { min-width: 0; }
        .ll-emp-name { font-size: 13px; font-weight: 600; color: #f0f4ff; }
        .ll-emp-meta { font-size: 11px; color: #5a6a85; margin-top: 1px; }
        .ll-empty-side { font-size: 12px; color: #3a4a65; padding: 20px 0; text-align: center; }

        .ll-marker-pulse { width: 20px; height: 20px; position: relative; }
        .ll-marker-pulse span {
          position: absolute; inset: 0; border-radius: 50%;
          background: var(--dot-color); border: 2px solid #0f1623;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot-color) 30%, transparent);
        }

        @media (max-width: 800px) {
          .ll-body { grid-template-columns: 1fr; height: auto; }
          .ll-map-wrap { height: 380px; }
          .ll-sidebar { max-height: 320px; }
        }
      `}</style>

      <div className="ll-root">
        <div className="ll-topbar">
          <div>
            <h1>Live Locations</h1>
            <div className="ll-sub">
              {checkedInCount} employee{checkedInCount !== 1 ? 's' : ''} currently checked in
            </div>
          </div>
          <div className="ll-actions">
            <div className="ll-filter-group">
              {['all', 'checked_in', 'checked_out'].map((f) => (
                <button
                  key={f}
                  className={`ll-filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'checked_in' ? 'Checked In' : 'Checked Out'}
                </button>
              ))}
            </div>
            <button className="ll-refresh-btn" onClick={() => fetchLocations()} disabled={loading}>
              <ArrowPathIcon className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {lastFetched && <div className="ll-updated">Last updated {timeAgo(lastFetched.toISOString())}</div>}

        <div className="ll-body">
          <div className="ll-map-wrap">
            {loading && employees.length === 0 ? (
              <div className="ll-loading">
                <div className="ll-spinner" />
                Loading locations…
              </div>
            ) : visible.length === 0 ? (
              <div className="ll-empty">
                <MapPinIcon style={{ width: 32, height: 32 }} />
                No location data available
              </div>
            ) : (
              <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <FitBounds points={visible} />
                {visible.map((emp) => (
                  <Marker
                    key={emp.attendanceId}
                    position={[emp.latitude, emp.longitude]}
                    icon={emp.status === 'checked_in' ? CHECKED_IN_ICON : CHECKED_OUT_ICON}
                    eventHandlers={{ click: () => setSelectedId(emp.attendanceId) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                        <strong>{emp.name}</strong>
                        <br />
                        {emp.employeeCode} · {emp.department}
                        <br />
                        {emp.branchName && (
                          <>
                            Branch: {emp.branchName}
                            <br />
                          </>
                        )}
                        Status: {emp.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                        <br />
                        Updated: {timeAgo(emp.lastUpdated)}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>

          <div className="ll-sidebar">
            <div className="ll-sidebar-title">Employees ({visible.length})</div>
            <div className="ll-emp-list">
              {visible.map((emp) => (
                <div
                  key={emp.attendanceId}
                  className={`ll-emp-card ${selected?.attendanceId === emp.attendanceId ? 'active' : ''}`}
                  onClick={() => setSelectedId(emp.attendanceId)}
                >
                  <div className={`ll-dot ${emp.status}`} />
                  <div className="ll-emp-info">
                    <div className="ll-emp-name">{emp.name}</div>
                    <div className="ll-emp-meta">
                      {emp.branchName || '—'} · {timeAgo(emp.lastUpdated)}
                    </div>
                  </div>
                </div>
              ))}
              {visible.length === 0 && !loading && <div className="ll-empty-side">No employees to show</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
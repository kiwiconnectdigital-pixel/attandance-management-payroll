import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { XMarkIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api, { attendanceAPI } from '../../services/api';

function toNum(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}
// NOTE: adjust this import if your employee-list call lives under a different
// service — e.g. `import { employeeAPI } from '../../services/api'` and then
// `employeeAPI.getAll()` below, if that helper already exists in your api.js.

const SOURCE_COLOR = { checkin: '#4ade80', checkout: '#f87171', periodic: '#818cf8' };
const SOURCE_LABEL = { checkin: 'Check-in', checkout: 'Check-out', periodic: 'Location ping' };

function dotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0f1623;box-shadow:0 0 0 2px ${color}55"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FitToPoints({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 15);
    else map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [40, 40] });
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function EmployeeTimelineDrawer({ onClose }) {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trail, setTrail] = useState([]);
  const [attendanceMeta, setAttendanceMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Adjust this path to match your actual employee-list endpoint.
        const res = await api.get('/employees');
        const payload = res.data;
        // Try every shape we've seen this API use elsewhere, in order,
        // and fall back to [] rather than crash if none match.
        const list =
          (Array.isArray(payload?.data?.employees) && payload.data.employees) ||
          (Array.isArray(payload?.data?.records) && payload.data.records) ||
          (Array.isArray(payload?.data) && payload.data) ||
          (Array.isArray(payload?.employees) && payload.employees) ||
          (Array.isArray(payload) && payload) ||
          [];
        if (list.length === 0) {
          // eslint-disable-next-line no-console
          console.warn('EmployeeTimelineDrawer: unexpected /employees response shape:', payload);
        }
        setEmployees(list);
      } catch {
        toast.error('Failed to load employee list');
        setEmployees([]);
      } finally {
        setEmpLoading(false);
      }
    })();
  }, []);

  const loadTimeline = useCallback(async () => {
    if (!employeeId || !date) return;
    setLoading(true);
    setSearched(true);
    setTrail([]);
    setAttendanceMeta(null);
    try {
      const attRes = await attendanceAPI.getAll({ employeeId, startDate: date, endDate: date, limit: 1 });
      const record = attRes.data.data?.records?.[0];
      if (!record) {
        toast.error('No attendance record for this employee on that date');
        return;
      }
      setAttendanceMeta(record);
      const trailRes = await api.get(`/attendance/${record.id || record._id}/location-trail`);
      const trailPayload = trailRes.data;
      const points =
        (Array.isArray(trailPayload?.data?.points) && trailPayload.data.points) ||
        (Array.isArray(trailPayload?.points) && trailPayload.points) ||
        (Array.isArray(trailPayload?.data) && trailPayload.data) ||
        [];
      if (points.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('EmployeeTimelineDrawer: unexpected location-trail response shape:', trailPayload);
      }
      setTrail(points);
    } catch {
      toast.error('Failed to load location timeline');
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    if (employeeId) loadTimeline();
  }, [employeeId, date, loadTimeline]);
  
const trail_ = trail
  .map((p) => ({
    ...p,
    latitude: toNum(p.latitude),
    longitude: toNum(p.longitude),
  }))
  .filter((p) => p.latitude !== null && p.longitude !== null);

const polylinePositions = trail_.map((p) => [p.latitude, p.longitude]);

  return (
    <>
      <style>{`
        .etd-overlay { position: fixed; inset: 0; z-index: 150; background: rgba(5,10,20,0.72); backdrop-filter: blur(4px); }
        .etd-drawer {
          position: fixed; top: 0; right: 0; bottom: 0; width: min(640px, 100vw);
          background: #0f1623; border-left: 1px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column; z-index: 151;
          animation: etdSlideIn 0.25s cubic-bezier(.22,.68,0,1.2);
          font-family: 'DM Sans', system-ui, sans-serif; color: #f0f4ff;
        }
        @keyframes etdSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .etd-head {
          padding: 20px 22px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        }
        .etd-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
        .etd-sub { font-size: 12px; color: #5a6a85; margin-top: 3px; }
        .etd-close {
          width: 32px; height: 32px; border-radius: 9px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09); color: #8090aa; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .etd-close svg { width: 16px; height: 16px; }

        .etd-controls { display: flex; gap: 10px; padding: 16px 22px; flex-wrap: wrap; flex-shrink: 0; }
        .etd-select, .etd-date {
          flex: 1; min-width: 140px; padding: 10px 12px; background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; color: #f0f4ff;
          font-size: 13px; font-family: 'DM Sans', system-ui, sans-serif; outline: none;
        }
        .etd-select option { background: #1a2336; }

        .etd-map-wrap {
          margin: 0 22px; height: 280px; border-radius: 14px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07); background: #1a2336; flex-shrink: 0;
        }
        .etd-loading, .etd-empty {
          height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #5a6a85; font-size: 13px; text-align: center; padding: 0 20px;
        }
        .etd-spinner {
          width: 24px; height: 24px; border-radius: 50%;
          border: 2px solid rgba(99,102,241,0.2); border-top-color: #818cf8;
          animation: etdSpin 0.7s linear infinite;
        }
        @keyframes etdSpin { to { transform: rotate(360deg); } }

        .etd-timeline { flex: 1; overflow-y: auto; padding: 18px 22px 24px; }
        .etd-timeline-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
          color: rgba(255,255,255,0.3); margin-bottom: 12px;
        }
        .etd-timeline-list { display: flex; flex-direction: column; gap: 2px; }
        .etd-tl-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .etd-tl-item:last-child { border-bottom: none; }
        .etd-tl-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
        .etd-tl-body { flex: 1; min-width: 0; }
        .etd-tl-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .etd-tl-time {
          display: flex; align-items: center; gap: 4px;
          font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; color: #f0f4ff;
        }
        .etd-tl-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .etd-tl-loc { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5a6a85; margin-top: 3px; }
        .etd-empty-tl { text-align: center; padding: 30px 0; color: #3a4a65; font-size: 13px; }
      `}</style>
      <div className="etd-overlay" onClick={onClose} />
      <div className="etd-drawer">
        <div className="etd-head">
          <div>
            <div className="etd-title">Employee Timeline</div>
            <div className="etd-sub">Full movement trail for a single day</div>
          </div>
          <button className="etd-close" onClick={onClose}>
            <XMarkIcon />
          </button>
        </div>

        <div className="etd-controls">
          <select
            className="etd-select"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={empLoading}
          >
            <option value="">{empLoading ? 'Loading employees…' : 'Select employee'}</option>
            {employees.map((emp) => (
              <option key={emp.id || emp._id} value={emp.id || emp._id}>
                {emp.name} {emp.employeeCode || emp.employee_code ? `(${emp.employeeCode || emp.employee_code})` : ''}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="etd-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="etd-map-wrap">
          {loading ? (
            <div className="etd-loading">
              <div className="etd-spinner" />
              Loading timeline…
            </div>
          ) : trail.length === 0 ? (
            <div className="etd-empty">
              <MapPinIcon style={{ width: 28, height: 28 }} />
              {!searched ? 'Select an employee to see their trail' : 'No location points for this day'}
            </div>
          ) : (
            <MapContainer
              center={[trail[0].latitude, trail[0].longitude]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <FitToPoints points={trail} />
              <Polyline
                positions={polylinePositions}
                pathOptions={{ color: '#818cf8', weight: 3, opacity: 0.6, dashArray: '6 6' }}
              />
              {trail.map((p, i) => (
                <Marker key={i} position={[p.latitude, p.longitude]} icon={dotIcon(SOURCE_COLOR[p.source] || '#818cf8')}>
                  <Popup>
                    <div style={{ fontFamily: 'sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      <strong>{SOURCE_LABEL[p.source] || p.source}</strong>
                      <br />
                      {fmtTime(p.recorded_at)}
                      <br />
                      {p.address || `${p.latitude?.toFixed(5)}, ${p.longitude?.toFixed(5)}`}
                      {p.accuracy_meters && (
                        <>
                          <br />±{Math.round(p.accuracy_meters)}m accuracy
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <div className="etd-timeline">
          <div className="etd-timeline-title">Timeline ({trail.length} points)</div>
          {trail.length === 0 ? (
            <div className="etd-empty-tl">Nothing to show yet.</div>
          ) : (
            <div className="etd-timeline-list">
              {trail.map((p, i) => (
                <div key={i} className="etd-tl-item">
                  <div className="etd-tl-dot" style={{ background: SOURCE_COLOR[p.source] || '#818cf8' }} />
                  <div className="etd-tl-body">
                    <div className="etd-tl-row">
                      <span className="etd-tl-time">
                        <ClockIcon style={{ width: 12, height: 12 }} /> {fmtTime(p.recorded_at)}
                      </span>
                      <span
                        className="etd-tl-badge"
                        style={{
                          color: SOURCE_COLOR[p.source],
                          background: `${SOURCE_COLOR[p.source]}18`,
                          border: `1px solid ${SOURCE_COLOR[p.source]}33`,
                        }}
                      >
                        {SOURCE_LABEL[p.source] || p.source}
                      </span>
                    </div>
                    <div className="etd-tl-loc">
                      <MapPinIcon style={{ width: 11, height: 11 }} />{' '}
                      {p.address || `${p.latitude?.toFixed(5)}, ${p.longitude?.toFixed(5)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
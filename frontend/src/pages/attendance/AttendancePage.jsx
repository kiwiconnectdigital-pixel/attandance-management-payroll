import { useState, useEffect, useRef } from 'react';
import { attendanceAPI } from '../../services/api';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) { return String(n).padStart(2, '0'); }

function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const [records, setRecords]         = useState([]);
  const [showCamera, setShowCamera]   = useState(false);
  const [captureMode, setCaptureMode] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [now, setNow]                 = useState(new Date());
  const [detailRecord, setDetailRecord] = useState(null); // for detail modal
  const [detailLoading, setDetailLoading] = useState(false);
  const webcamRef = useRef(null);

  // Live clock — every 10s
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Lock scroll when any modal open
  useEffect(() => {
    document.body.style.overflow = (showCamera || detailRecord) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showCamera, detailRecord]);

  const fetchAttendance = async () => {
    try {
      const res = await attendanceAPI.getAll({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
      setRecords(res.data.data.records);
    } catch {
      toast.error('Failed to fetch attendance');
    }
  };

  useEffect(() => { fetchAttendance(); }, []);

  // Open detail modal — fetch fresh data by id
  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailRecord({ _id: id, _loading: true }); // show modal immediately
    try {
      const res = await attendanceAPI.getById(id);
      setDetailRecord(res.data.data);
    } catch {
      toast.error('Failed to load detail');
      setDetailRecord(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!webcamRef.current) return;
    setLoading(true);
    try {
      const position = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      ).catch(() => null);

      const imageSrc = webcamRef.current.getScreenshot();
      const blob = await fetch(imageSrc).then((r) => r.blob());

      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');
      formData.append('latitude', position?.coords.latitude ?? 0);
      formData.append('longitude', position?.coords.longitude ?? 0);
      formData.append('address', 'GPS captured');

      if (captureMode === 'checkin') {
        await attendanceAPI.checkIn(formData);
        toast.success('Checked in successfully!');
      } else {
        await attendanceAPI.checkOut(formData);
        toast.success('Checked out successfully!');
      }

      setShowCamera(false);
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived today values ──────────────────────────────────────────────────
  const todayRecord = records.find((r) => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  });

  const checkInTime  = fmtTime(todayRecord?.checkIns?.[0]?.time);
  const checkOutTime = fmtTime(todayRecord?.checkOuts?.[0]?.time);

  const workedHours = (() => {
    if (!todayRecord?.checkIns?.[0]?.time) return null;
    if (todayRecord?.checkOuts?.[0]?.time) {
      return todayRecord.workingHours > 0
        ? todayRecord.workingHours.toFixed(1) + 'h' : null;
    }
    const diffH = (now.getTime() - new Date(todayRecord.checkIns[0].time).getTime()) / 3600000;
    return diffH > 0 ? diffH.toFixed(1) + 'h' : null;
  })();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .atn-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .atn-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623; color: #f0f4ff;
          min-height: 100vh; padding-bottom: 90px;
          -webkit-font-smoothing: antialiased;
        }
        .atn-topbar {
          position: sticky; top: 0; z-index: 40;
          background: rgba(15,22,35,0.88); backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
        }
        .atn-topbar h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
        .atn-date-chip {
          font-size: 12px; color: #8b9ab5; background: #243047;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 4px 10px; font-family: 'DM Mono', monospace;
        }
        .atn-page { padding: 20px; max-width: 680px; margin: 0 auto; }

        /* Today card */
        .atn-today-card {
          background: linear-gradient(135deg, #1a2336 0%, #1e2d45 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 20px; margin-bottom: 16px;
          position: relative; overflow: hidden;
        }
        .atn-today-card::before {
          content: ''; position: absolute; top: -40px; right: -40px;
          width: 120px; height: 120px;
          background: radial-gradient(circle, rgba(79,142,255,0.15) 0%, transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        .atn-card-label {
          font-size: 11px; font-weight: 500; color: #8b9ab5;
          letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px;
          display: flex; align-items: center; gap: 6px;
        }
        .atn-live-dot {
          width: 7px; height: 7px; background: #22c55e;
          border-radius: 50%; display: inline-block; animation: atn-pulse 2s infinite;
        }
        @keyframes atn-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .atn-big-time {
          font-family: 'DM Mono', monospace; font-size: 38px; font-weight: 400;
          letter-spacing: -1px; line-height: 1; color: #f0f4ff;
        }
        .atn-sub { font-size: 13px; color: #8b9ab5; margin-top: 6px; }
        .atn-status-row { display: flex; gap: 10px; margin-top: 16px; }
        .atn-status-pill {
          flex: 1; background: #243047;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 10px 12px;
        }
        .atn-sp-label {
          font-size: 10px; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.7px; color: #5a6a85; margin-bottom: 3px;
        }
        .atn-sp-val { font-size: 15px; font-weight: 500; font-family: 'DM Mono', monospace; }
        .atn-sp-val.green { color: #22c55e; }
        .atn-sp-val.muted { color: #8b9ab5; }

        /* Action buttons */
        .atn-action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .atn-action-btn {
          border: none; cursor: pointer; border-radius: 16px;
          padding: 18px 16px; font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 600; font-size: 15px; color: #fff;
          display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
          transition: transform 0.15s, opacity 0.15s;
        }
        .atn-action-btn:active { transform: scale(0.97); }
        .atn-action-btn.checkin { background: linear-gradient(135deg,#16803a,#15803d); box-shadow: 0 4px 20px rgba(34,197,94,0.25); }
        .atn-action-btn.checkout { background: linear-gradient(135deg,#b91c1c,#dc2626); box-shadow: 0 4px 20px rgba(239,68,68,0.2); }
        .atn-btn-icon { font-size: 22px; }
        .atn-btn-sub { font-size: 12px; opacity: 0.75; font-weight: 400; }

        /* Section title */
        .atn-section-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 1px; color: #8b9ab5; margin-bottom: 12px; padding: 0 2px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .atn-section-title span { font-size: 11px; color: #4f8eff; font-weight: 500; text-transform: none; letter-spacing: 0; }

        /* Record cards */
        .atn-records-list { display: flex; flex-direction: column; gap: 8px; }
        .atn-record-card {
          background: rgba(26,35,54,0.9); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 14px 16px;
          display: flex; align-items: center; gap: 14px;
          transition: background 0.15s, border-color 0.15s;
          cursor: pointer;
        }
        .atn-record-card:hover { background: #1a2336; border-color: rgba(79,142,255,0.25); }
        .atn-date-block { flex-shrink: 0; text-align: center; min-width: 40px; }
        .atn-day { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 500; line-height: 1; color: #f0f4ff; }
        .atn-weekday { font-size: 10px; color: #5a6a85; font-weight: 500; text-transform: uppercase; margin-top: 2px; }
        .atn-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.07); flex-shrink: 0; }
        .atn-record-body { flex: 1; min-width: 0; }
        .atn-record-times { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
        .atn-record-time { display: flex; flex-direction: column; }
        .atn-rt-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #5a6a85; font-weight: 500; }
        .atn-rt-val { font-family: 'DM Mono', monospace; font-size: 14px; color: #f0f4ff; font-weight: 500; margin-top: 1px; }
        .atn-rt-val.dash { color: #5a6a85; }
        .atn-record-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
        .atn-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; letter-spacing: 0.2px; }
        .atn-badge.present { background: rgba(34,197,94,0.12); color: #22c55e; }
        .atn-badge.absent { background: rgba(239,68,68,0.12); color: #ef4444; }
        .atn-badge.half_day { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .atn-badge.late { background: rgba(239,68,68,0.1); color: #ef4444; font-weight: 400; font-size: 10px; }
        .atn-record-hours { margin-left: auto; flex-shrink: 0; font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; color: #8b9ab5; }
        .atn-record-chevron { color: #3a4a65; font-size: 16px; flex-shrink: 0; margin-left: 4px; }

        /* ── Detail Modal ── */
        .atn-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .atn-modal-sheet {
          background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px 24px 0 0; width: 100%; max-width: 480px;
          padding: 0 0 36px; animation: atn-slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
          max-height: 85vh; overflow-y: auto;
        }
        @keyframes atn-slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .atn-modal-handle { width: 36px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 12px auto 0; }
        .atn-modal-header {
          padding: 16px 20px 12px; display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; background: #1a2336; z-index: 2;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .atn-modal-title { font-size: 16px; font-weight: 600; color: #f0f4ff; }
        .atn-modal-title small { font-size: 13px; font-weight: 400; color: #8b9ab5; display: block; margin-top: 2px; }
        .atn-modal-close {
          width: 32px; height: 32px; border-radius: 50%;
          background: #243047; border: 1px solid rgba(255,255,255,0.07);
          color: #8b9ab5; font-size: 20px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; line-height: 1;
        }

        /* Detail body */
        .atn-detail-body { padding: 16px 20px; }

        .atn-detail-stats {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 20px;
        }
        .atn-detail-stat {
          background: #243047; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px;
        }
        .atn-detail-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #5a6a85; font-weight: 500; margin-bottom: 4px; }
        .atn-detail-stat-val { font-family: 'DM Mono', monospace; font-size: 15px; font-weight: 500; color: #f0f4ff; }
        .atn-detail-stat-val.green { color: #22c55e; }
        .atn-detail-stat-val.amber { color: #f59e0b; }
        .atn-detail-stat-val.red   { color: #ef4444; }

        .atn-punch-section { margin-bottom: 16px; }
        .atn-punch-section-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.8px; color: #5a6a85; margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .atn-punch-section-title .dot {
          width: 6px; height: 6px; border-radius: 50%;
        }
        .atn-punch-section-title .dot.green { background: #22c55e; }
        .atn-punch-section-title .dot.red   { background: #ef4444; }

        .atn-punch-item {
          background: #0f1623; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 10px 14px; margin-bottom: 6px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .atn-punch-time { font-family: 'DM Mono', monospace; font-size: 15px; font-weight: 500; color: #f0f4ff; }
        .atn-punch-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .atn-punch-score {
          font-size: 10px; color: #5a6a85;
          background: #243047; border-radius: 4px; padding: 2px 6px;
          font-family: 'DM Mono', monospace;
        }
        .atn-punch-score.good { color: #22c55e; }
        .atn-punch-score.bad  { color: #ef4444; }
        .atn-punch-verified { font-size: 10px; color: #22c55e; }

        .atn-empty-punch { font-size: 13px; color: #3a4a65; padding: 8px 0; }

        .atn-detail-skeleton {
          display: flex; flex-direction: column; gap: 10px; padding: 20px;
        }
        .atn-skel {
          background: linear-gradient(90deg, #243047 25%, #2a3858 50%, #243047 75%);
          background-size: 200% 100%; border-radius: 8px; height: 16px;
          animation: atn-shimmer 1.4s infinite;
        }
        @keyframes atn-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* Camera modal */
        .atn-cam-wrap { position: relative; width: 100%; aspect-ratio: 4/3; background: #000; overflow: hidden; }
        .atn-cam-wrap video, .atn-cam-wrap > div:first-child { width: 100% !important; height: 100% !important; object-fit: cover; }
        .atn-cam-guide { position: absolute; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
        .atn-cam-guide svg { width: 140px; height: 160px; opacity: 0.35; }
        .atn-modal-actions { padding: 16px 20px 0; display: flex; gap: 10px; }
        .atn-btn-capture {
          flex: 1; border: none; cursor: pointer; border-radius: 10px;
          padding: 14px; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; font-weight: 600; color: #fff;
          transition: opacity 0.15s, transform 0.1s;
        }
        .atn-btn-capture:active { transform: scale(0.97); }
        .atn-btn-capture:disabled { opacity: 0.6; cursor: not-allowed; }
        .atn-btn-capture.checkin-btn { background: linear-gradient(135deg,#16803a,#15803d); }
        .atn-btn-capture.checkout-btn { background: linear-gradient(135deg,#b91c1c,#dc2626); }
        .atn-btn-cancel {
          padding: 14px 18px; background: #243047;
          border: 1px solid rgba(255,255,255,0.07); border-radius: 10px;
          cursor: pointer; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; color: #8b9ab5; font-weight: 500;
        }
        .atn-btn-cancel:hover { background: #1a2336; }
        .atn-empty { text-align: center; padding: 40px 20px; color: #5a6a85; font-size: 14px; }

        @media (min-width: 600px) {
          .atn-page { padding: 24px 32px; }
          .atn-today-card { padding: 24px 28px; }
          .atn-big-time { font-size: 48px; }
          .atn-modal-sheet { border-radius: 24px; max-width: 420px; margin: 24px; }
          .atn-modal-overlay { align-items: center; }
        }
        @media (min-width: 900px) {
          .atn-page { padding: 32px 40px; }
          .atn-action-row { max-width: 440px; }
        }
        @media (max-width: 360px) {
          .atn-status-row { gap: 6px; }
          .atn-sp-val { font-size: 13px; }
          .atn-action-row { gap: 8px; }
          .atn-action-btn { padding: 14px 12px; font-size: 14px; }
          .atn-detail-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="atn-root">
        <div className="atn-topbar">
          <h1>Attendance</h1>
          <div className="atn-date-chip">
            {WEEKDAYS[now.getDay()]} {pad(now.getDate())} {MONTHS[now.getMonth()]}
          </div>
        </div>

        <div className="atn-page">
          {/* Today Card */}
          <div className="atn-today-card">
            <div className="atn-card-label"><span className="atn-live-dot" />Today</div>
            <div className="atn-big-time">{pad(now.getHours())}:{pad(now.getMinutes())}</div>
            <div className="atn-sub">{WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}</div>
            <div className="atn-status-row">
              <div className="atn-status-pill">
                <div className="atn-sp-label">Check In</div>
                <div className={`atn-sp-val ${checkInTime ? 'green' : 'muted'}`}>{checkInTime || '—'}</div>
              </div>
              <div className="atn-status-pill">
                <div className="atn-sp-label">Check Out</div>
                <div className={`atn-sp-val ${checkOutTime ? 'green' : 'muted'}`}>{checkOutTime || '—'}</div>
              </div>
              <div className="atn-status-pill">
                <div className="atn-sp-label">Hours</div>
                <div className={`atn-sp-val ${workedHours ? 'green' : 'muted'}`}>{workedHours || '—'}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="atn-action-row">
            <button className="atn-action-btn checkin" onClick={() => { setCaptureMode('checkin'); setShowCamera(true); }}>
              <span className="atn-btn-icon">✔</span>
              Check In
              <span className="atn-btn-sub">Tap to mark arrival</span>
            </button>
            <button className="atn-action-btn checkout" onClick={() => { setCaptureMode('checkout'); setShowCamera(true); }}>
              <span className="atn-btn-icon">✖</span>
              Check Out
              <span className="atn-btn-sub">Tap to mark departure</span>
            </button>
          </div>

          {/* Records */}
          <div className="atn-section-title">
            This Month
            <span>{MONTHS[now.getMonth()]} {now.getFullYear()}</span>
          </div>

          <div className="atn-records-list">
            {records.length === 0 ? (
              <div className="atn-empty">No attendance records this month</div>
            ) : (
              records.map((r) => {
                const d = new Date(r.date);
                const ciVal = fmtTime(r.checkIns?.[0]?.time);
                const coVal = fmtTime(r.checkOuts?.[0]?.time);
                const badgeLabel = r.status === 'half_day' ? 'Half Day'
                  : r.status.charAt(0).toUpperCase() + r.status.slice(1);

                return (
                  <div key={r._id} className="atn-record-card" onClick={() => openDetail(r._id)}>
                    <div className="atn-date-block">
                      <div className="atn-day">{pad(d.getDate())}</div>
                      <div className="atn-weekday">{WEEKDAYS[d.getDay()]}</div>
                    </div>
                    <div className="atn-divider" />
                    <div className="atn-record-body">
                      <div className="atn-record-times">
                        <div className="atn-record-time">
                          <div className="atn-rt-label">In</div>
                          <div className={`atn-rt-val ${ciVal ? '' : 'dash'}`}>{ciVal || '—'}</div>
                        </div>
                        <div className="atn-record-time">
                          <div className="atn-rt-label">Out</div>
                          <div className={`atn-rt-val ${coVal ? '' : 'dash'}`}>{coVal || '—'}</div>
                        </div>
                      </div>
                      <div className="atn-record-meta">
                        <span className={`atn-badge ${r.status}`}>{badgeLabel}</span>
                        {r.isLate && <span className="atn-badge late">Late {r.lateByMinutes}m</span>}
                      </div>
                    </div>
                    <div className="atn-record-hours">{r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—'}</div>
                    <div className="atn-record-chevron">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detailRecord && (
        <div className="atn-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetailRecord(null); }}>
          <div className="atn-modal-sheet">
            <div className="atn-modal-handle" />
            <div className="atn-modal-header">
              <div className="atn-modal-title">
                Attendance Detail
                {!detailRecord._loading && (
                  <small>
                    {(() => { const d = new Date(detailRecord.date); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; })()}
                  </small>
                )}
              </div>
              <button className="atn-modal-close" onClick={() => setDetailRecord(null)}>×</button>
            </div>

            {detailRecord._loading ? (
              <div className="atn-detail-skeleton">
                {[80, 60, 100, 60, 80].map((w, i) => (
                  <div key={i} className="atn-skel" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <div className="atn-detail-body">
                {/* Stats row */}
                <div className="atn-detail-stats">
                  <div className="atn-detail-stat">
                    <div className="atn-detail-stat-label">Status</div>
                    <div className={`atn-detail-stat-val ${detailRecord.status === 'present' ? 'green' : detailRecord.status === 'absent' ? 'red' : 'amber'}`}>
                      {detailRecord.status === 'half_day' ? 'Half Day' : detailRecord.status?.charAt(0).toUpperCase() + detailRecord.status?.slice(1)}
                    </div>
                  </div>
                  <div className="atn-detail-stat">
                    <div className="atn-detail-stat-label">Hours</div>
                    <div className={`atn-detail-stat-val ${detailRecord.workingHours > 0 ? 'green' : ''}`}>
                      {detailRecord.workingHours > 0 ? `${detailRecord.workingHours.toFixed(2)}h` : '—'}
                    </div>
                  </div>
                  <div className="atn-detail-stat">
                    <div className="atn-detail-stat-label">Overtime</div>
                    <div className={`atn-detail-stat-val ${detailRecord.overtimeHours > 0 ? 'amber' : ''}`}>
                      {detailRecord.overtimeHours > 0 ? `${detailRecord.overtimeHours.toFixed(2)}h` : '—'}
                    </div>
                  </div>
                  <div className="atn-detail-stat">
                    <div className="atn-detail-stat-label">Late</div>
                    <div className={`atn-detail-stat-val ${detailRecord.isLate ? 'red' : 'green'}`}>
                      {detailRecord.isLate ? `${detailRecord.lateByMinutes}m` : 'On time'}
                    </div>
                  </div>
                  <div className="atn-detail-stat">
                    <div className="atn-detail-stat-label">Punches</div>
                    <div className="atn-detail-stat-val">
                      {(detailRecord.checkIns?.length || 0) + (detailRecord.checkOuts?.length || 0)}
                    </div>
                  </div>
                </div>

                {/* Check-ins */}
                <div className="atn-punch-section">
                  <div className="atn-punch-section-title">
                    <span className="dot green" /> Check Ins ({detailRecord.checkIns?.length || 0})
                  </div>
                 {detailRecord.checkIns?.length > 0 ? detailRecord.checkIns.map((p, i) => (
  <div key={i} className="atn-punch-item">
    <div>
      <div className="atn-punch-time">{fmtTime(p.time)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#5a6a85' }}>Punch #{i + 1}</span>
        {/* ✅ Per-punch late badge */}
        {p.isLate
          ? <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, padding: '1px 6px' }}>
              Late {p.lateByMinutes}m
            </span>
          : <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 4, padding: '1px 6px' }}>
              On time
            </span>
        }
      </div>
    </div>
    <div className="atn-punch-meta">
      <span className={`atn-punch-score ${p.faceMatchScore < 0.45 ? 'good' : 'bad'}`}>
        Face {p.faceMatchScore?.toFixed(3)}
      </span>
      {p.faceVerified && <span className="atn-punch-verified">✓ Verified</span>}
    </div>
  </div>
)) : <div className="atn-empty-punch">No check-ins recorded</div>}
                </div>

                {/* Check-outs */}
                <div className="atn-punch-section">
                  <div className="atn-punch-section-title">
                    <span className="dot red" /> Check Outs ({detailRecord.checkOuts?.length || 0})
                  </div>
                  {detailRecord.checkOuts?.length > 0 ? detailRecord.checkOuts.map((p, i) => (
                    <div key={i} className="atn-punch-item">
                      <div>
                        <div className="atn-punch-time">{fmtTime(p.time)}</div>
                        <div style={{ fontSize: 11, color: '#5a6a85', marginTop: 2 }}>Punch #{i + 1}</div>
                      </div>
                      <div className="atn-punch-meta">
                        <span className={`atn-punch-score ${p.faceMatchScore < 0.45 ? 'good' : 'bad'}`}>
                          Face {p.faceMatchScore?.toFixed(3)}
                        </span>
                        {p.faceVerified && <span className="atn-punch-verified">✓ Verified</span>}
                      </div>
                    </div>
                  )) : <div className="atn-empty-punch">No check-outs recorded</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Camera Modal ── */}
      {showCamera && (
        <div className="atn-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCamera(false); }}>
          <div className="atn-modal-sheet">
            <div className="atn-modal-handle" />
            <div className="atn-modal-header">
              <div className="atn-modal-title">
                {captureMode === 'checkin' ? 'Check In' : 'Check Out'}
                <small>Position your face in the frame</small>
              </div>
              <button className="atn-modal-close" onClick={() => setShowCamera(false)}>×</button>
            </div>
            <div className="atn-cam-wrap">
              <Webcam ref={webcamRef} screenshotFormat="image/jpeg" mirrored
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div className="atn-cam-guide">
                <svg viewBox="0 0 140 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="136" height="156" rx="68" stroke="white" strokeWidth="2" strokeDasharray="6 4" />
                  <path d="M0 24 L0 0 L24 0" stroke="white" strokeWidth="3" fill="none" />
                  <path d="M116 0 L140 0 L140 24" stroke="white" strokeWidth="3" fill="none" />
                  <path d="M0 136 L0 160 L24 160" stroke="white" strokeWidth="3" fill="none" />
                  <path d="M116 160 L140 160 L140 136" stroke="white" strokeWidth="3" fill="none" />
                </svg>
              </div>
            </div>
            <div className="atn-modal-actions">
              <button
                className={`atn-btn-capture ${captureMode === 'checkin' ? 'checkin-btn' : 'checkout-btn'}`}
                onClick={handleCapture} disabled={loading}
              >
                {loading ? 'Processing...' : '📸 Capture & Submit'}
              </button>
              <button className="atn-btn-cancel" onClick={() => setShowCamera(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
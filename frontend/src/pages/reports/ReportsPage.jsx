import { useState, useEffect } from 'react';
import { ArrowDownTrayIcon, DocumentChartBarIcon, BanknotesIcon, InformationCircleIcon, XMarkIcon, ChevronDownIcon, ClockIcon, MapPinIcon, CalendarDaysIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getMonthOptions } from '../../utils/helpers';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  return (
    <>
      <style>{`
        .lb-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          animation: lbFade 0.15s ease;
        }
        @keyframes lbFade { from{opacity:0} to{opacity:1} }
        .lb-img {
          max-width: 90vw; max-height: 85vh;
          border-radius: 14px; border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 32px 80px rgba(0,0,0,0.6);
        }
        .lb-close {
          position: fixed; top: 20px; right: 20px;
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .lb-close svg { width: 18px; height: 18px; }
      `}</style>
      <div className="lb-overlay" onClick={onClose}>
        <img className="lb-img" src={src} alt="selfie" onClick={e => e.stopPropagation()} />
        <button className="lb-close" onClick={onClose}><XMarkIcon /></button>
      </div>
    </>
  );
}

// ── Attendance Drawer ─────────────────────────────────────────────────────────
function AttendanceDrawer({ params, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const LIMIT = 20;

  const fetchPage = async (p) => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/all-detailed', {
        params: { month: params.month, year: params.year, page: p, limit: LIMIT },
      });
      setRecords(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch {
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(1); }, []);

  const totalPages = Math.ceil(total / LIMIT);
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
  const statusColor = (s) => {
    const map = { present: '#4ade80', absent: '#f87171', late: '#fbbf24', 'half-day': '#38bdf8', holiday: '#a78bfa' };
    return (s && map[s.toLowerCase()]) || '#5a6a85';
  };

  return (
    <>
      <style>{`
        .ad-overlay { position:fixed;inset:0;z-index:100;background:rgba(5,10,20,0.7);backdrop-filter:blur(4px);animation:adFadeIn 0.2s ease; }
        @keyframes adFadeIn{from{opacity:0}to{opacity:1}}
        .ad-drawer { position:fixed;top:0;right:0;bottom:0;width:min(580px,100vw);background:#0f1623;border-left:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;z-index:101;animation:adSlideIn 0.25s cubic-bezier(.22,.68,0,1.2); }
        @keyframes adSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .ad-head { padding:20px 22px 18px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
        .ad-head-title { font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#f0f4ff;letter-spacing:-0.02em; }
        .ad-head-sub { font-size:12px;color:#5a6a85; }
        .ad-close-btn { width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:#8090aa;cursor:pointer;display:flex;align-items:center;justify-content:center; }
        .ad-close-btn svg { width:16px;height:16px; }
        .ad-body { flex:1;overflow-y:auto;padding:16px 22px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent; }
        .ad-loading { display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;color:#5a6a85;font-size:13px; }
        .ad-spinner { width:28px;height:28px;border-radius:50%;border:2px solid rgba(99,102,241,0.2);border-top-color:#818cf8;animation:adSpin 0.7s linear infinite; }
        @keyframes adSpin{to{transform:rotate(360deg)}}
        .ad-empty { text-align:center;padding:48px 0;color:#5a6a85;font-size:13px; }
        .ad-record { background:rgba(26,35,54,0.7);border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:10px;overflow:hidden; }
        .ad-record-head { display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer; }
        .ad-avatar { width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#818cf8;font-family:'Syne',sans-serif;font-size:13px;font-weight:800; }
        .ad-rec-name { font-size:14px;font-weight:600;color:#f0f4ff; }
        .ad-rec-meta { font-size:11px;color:#5a6a85;margin-top:2px; }
        .ad-status-dot { display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:capitalize;padding:4px 9px;border-radius:20px; }
        .ad-chevron { color:#5a6a85;transition:transform 0.2s; }
        .ad-chevron svg { width:14px;height:14px; }
        .ad-chevron.open { transform:rotate(180deg); }
        .ad-record-body { padding:0 16px 14px;border-top:1px solid rgba(255,255,255,0.05); }
        .ad-log-section { margin-top:12px; }
        .ad-log-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.25);margin-bottom:8px; }
        .ad-log-entry { display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04); }
        .ad-log-entry:last-child { border-bottom:none; }
        .ad-log-icon { width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .ad-log-icon svg { width:13px;height:13px; }
        .ad-log-time { font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:#f0f4ff; }
        .ad-log-loc { font-size:11px;color:#5a6a85;margin-top:2px;display:flex;align-items:center;gap:4px; }
        .ad-late-tag { font-size:10px;font-weight:700;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.25);padding:2px 7px;border-radius:20px;margin-left:6px; }
        .ad-selfie { width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;cursor:pointer; }
        .ad-stats-row { display:flex;gap:8px;margin-top:12px; }
        .ad-stat { flex:1;background:rgba(15,22,35,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:8px 10px; }
        .ad-stat-label { font-size:10px;color:#5a6a85;text-transform:uppercase;letter-spacing:0.07em; }
        .ad-stat-val { font-family:'DM Mono',monospace;font-size:15px;font-weight:500;color:#f0f4ff;margin-top:2px; }
        .ad-footer { padding:14px 22px;border-top:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
        .ad-page-info { font-size:12px;color:#5a6a85; }
        .ad-page-btn { padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);color:#818cf8;cursor:pointer; }
        .ad-page-btn:disabled { opacity:0.35;cursor:not-allowed; }
      `}</style>
      <div className="ad-overlay" onClick={onClose} />
      <div className="ad-drawer">
        <div className="ad-head">
          <div>
            <div className="ad-head-title">Detailed Attendance</div>
            <div className="ad-head-sub">
              {new Date(params.year, params.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              {total > 0 && ` · ${total} records`}
            </div>
          </div>
          <button className="ad-close-btn" onClick={onClose}><XMarkIcon /></button>
        </div>
        <div className="ad-body">
          {loading ? (
            <div className="ad-loading"><div className="ad-spinner" /><span>Loading…</span></div>
          ) : records.length === 0 ? (
            <div className="ad-empty">No records found.</div>
          ) : records.map((rec) => {
            const isOpen = expandedId === rec._id;
            const initials = rec.employee?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
            const sColor = statusColor(rec.status);
            return (
              <div key={rec._id} className="ad-record">
                <div className="ad-record-head" onClick={() => setExpandedId(isOpen ? null : rec._id)}>
                  <div className="ad-avatar">{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ad-rec-name">{rec.employee?.name || 'Unknown'}</div>
                    <div className="ad-rec-meta">{rec.employee?.employeeCode} · {rec.employee?.department} · {fmtDate(rec.date)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="ad-status-dot" style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}33` }}>{rec.status || 'unknown'}</span>
                    <span className={`ad-chevron${isOpen ? ' open' : ''}`}><ChevronDownIcon /></span>
                  </div>
                </div>
                {isOpen && (
                  <div className="ad-record-body">
                    <div className="ad-stats-row">
                      {[['Working hrs', rec.workingHours], ['Overtime hrs', rec.overtimeHours], ['Check-ins', rec.checkIns?.length ?? 0], ['Check-outs', rec.checkOuts?.length ?? 0]].map(([l, v]) => (
                        <div key={l} className="ad-stat"><div className="ad-stat-label">{l}</div><div className="ad-stat-val">{v ?? '—'}</div></div>
                      ))}
                    </div>
                    {rec.checkIns?.length > 0 && (
                      <div className="ad-log-section">
                        <div className="ad-log-label">Check-ins</div>
                        {rec.checkIns.map((ci, i) => (
                          <div key={i} className="ad-log-entry">
                            <div className="ad-log-icon" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}><ClockIcon /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="ad-log-time">{fmt(ci.time)}{ci.isLate && <span className="ad-late-tag">+{ci.lateByMinutes}m late</span>}</div>
                              {ci.location && <div className="ad-log-loc"><MapPinIcon style={{ width: 11, height: 11 }} />{ci.location.address || `${ci.location.lat?.toFixed(4)}, ${ci.location.lng?.toFixed(4)}`}</div>}
                            </div>
                            {ci.selfie && <img className="ad-selfie" src={`${BASE_URL}/${ci.selfie}`} alt="selfie" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {rec.checkOuts?.length > 0 && (
                      <div className="ad-log-section">
                        <div className="ad-log-label">Check-outs</div>
                        {rec.checkOuts.map((co, i) => (
                          <div key={i} className="ad-log-entry">
                            <div className="ad-log-icon" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}><ClockIcon /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="ad-log-time">{fmt(co.time)}</div>
                              {co.location && <div className="ad-log-loc"><MapPinIcon style={{ width: 11, height: 11 }} />{co.location.address || `${co.location.lat?.toFixed(4)}, ${co.location.lng?.toFixed(4)}`}</div>}
                            </div>
                            {co.selfie && <img className="ad-selfie" src={`${BASE_URL}/${co.selfie}`} alt="selfie" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="ad-footer">
            <span className="ad-page-info">Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ad-page-btn" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>← Prev</button>
              <button className="ad-page-btn" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Inline Attendance Log ─────────────────────────────────────────────────────
function InlineAttendanceLog({ params }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const LIMIT = 20;

  const fetchPage = async (p) => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/all-detailed', {
        params: { month: params.month, year: params.year, page: p, limit: LIMIT },
      });
      setRecords(res.data.data || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch {
      toast.error('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(1); }, [params.month, params.year]);

  const totalPages = Math.ceil(total / LIMIT);
  const fmt = (d) => d ? new Date(d).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
  const statusColor = (s) => {
    const map = { present: '#4ade80', absent: '#f87171', late: '#fbbf24', 'half-day': '#38bdf8', holiday: '#a78bfa' };
    return (s && map[s.toLowerCase()]) || '#5a6a85';
  };

  return (
    <>
      <style>{`
        .ial-root { margin-top: 28px; }
        .ial-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .ial-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 800; color: #f0f4ff; letter-spacing: -0.02em;
        }
        .ial-count {
          font-size: 11px; color: #5a6a85;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 3px 10px; border-radius: 20px;
        }

        .ial-loading { display:flex;align-items:center;gap:10px;padding:32px 0;color:#5a6a85;font-size:13px; }
        .ial-spinner { width:22px;height:22px;border-radius:50%;border:2px solid rgba(99,102,241,0.2);border-top-color:#818cf8;animation:ialSpin 0.7s linear infinite;flex-shrink:0; }
        @keyframes ialSpin{to{transform:rotate(360deg)}}
        .ial-empty { text-align:center;padding:40px 0;color:#5a6a85;font-size:13px; }

        /* Table */
        .ial-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.07); }
        .ial-table {
          width: 100%; border-collapse: collapse;
          font-size: 13px;
        }
        .ial-table thead tr {
          background: rgba(15,22,35,0.8);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ial-table th {
          padding: 10px 14px; text-align: left;
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .ial-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.12s;
        }
        .ial-table tbody tr:last-child { border-bottom: none; }
        .ial-table tbody tr:hover { background: rgba(255,255,255,0.025); }
        .ial-table td { padding: 10px 14px; vertical-align: top; color: #c8d4ee; }

        .ial-emp { display:flex; align-items:center; gap:10px; }
        .ial-initials {
          width:32px;height:32px;border-radius:9px;flex-shrink:0;
          background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.25);
          display:flex;align-items:center;justify-content:center;
          font-family:'Syne',sans-serif;font-size:11px;font-weight:800;color:#818cf8;
        }
        .ial-emp-name { font-size:13px;font-weight:600;color:#f0f4ff; }
        .ial-emp-meta { font-size:11px;color:#5a6a85; }

        .ial-badge {
          display:inline-block;font-size:10px;font-weight:700;text-transform:capitalize;
          padding:3px 8px;border-radius:20px;
        }

        .ial-logs { display:flex;flex-direction:column;gap:6px; }
        .ial-log-row { display:flex;align-items:center;gap:8px; }
        .ial-log-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
        .ial-log-time { font-family:'DM Mono',monospace;font-size:12px;color:#f0f4ff;white-space:nowrap; }
        .ial-log-loc { font-size:11px;color:#5a6a85;display:flex;align-items:center;gap:3px; }
        .ial-log-loc svg { width:10px;height:10px;flex-shrink:0; }
        .ial-late { font-size:10px;font-weight:700;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.25);padding:2px 6px;border-radius:20px; }

        /* bigger selfies */
        .ial-selfies { display:flex;flex-wrap:wrap;gap:6px; }
        .ial-selfie {
          width:56px;height:56px;border-radius:10px;object-fit:cover;
          border:1px solid rgba(255,255,255,0.1);cursor:pointer;
          transition:transform 0.15s,border-color 0.15s;flex-shrink:0;
        }
        .ial-selfie:hover { transform:scale(1.06);border-color:rgba(129,140,248,0.5); }

        /* pagination */
        .ial-pager {
          display:flex;align-items:center;justify-content:space-between;
          margin-top:14px;
        }
        .ial-pager-info { font-size:12px;color:#5a6a85; }
        .ial-pager-btns { display:flex;gap:8px; }
        .ial-pager-btn {
          padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;
          background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);
          color:#818cf8;cursor:pointer;transition:background 0.15s;
          font-family:'DM Sans',system-ui,sans-serif;
        }
        .ial-pager-btn:hover:not(:disabled) { background:rgba(99,102,241,0.2); }
        .ial-pager-btn:disabled { opacity:0.35;cursor:not-allowed; }
      `}</style>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div className="ial-root">
        <div className="ial-head">
          <div className="ial-title">Check-in / Check-out Log</div>
          {total > 0 && <span className="ial-count">{total} records</span>}
        </div>

        {loading ? (
          <div className="ial-loading"><div className="ial-spinner" /><span>Loading records…</span></div>
        ) : records.length === 0 ? (
          <div className="ial-empty">No attendance records found for this period.</div>
        ) : (
          <>
            <div className="ial-table-wrap">
              <table className="ial-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check-ins</th>
                    <th>Check-outs</th>
                    <th>Selfies</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const initials = rec.employee?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
                    const sColor = statusColor(rec.status);
                    const allSelfies = [
                      ...(rec.checkIns || []).filter(c => c.selfie).map(c => ({ src: `${BASE_URL}/${c.selfie}`, type: 'in' })),
                      ...(rec.checkOuts || []).filter(c => c.selfie).map(c => ({ src: `${BASE_URL}/${c.selfie}`, type: 'out' })),
                    ];
                    return (
                      <tr key={rec._id}>
                        {/* Employee */}
                        <td>
                          <div className="ial-emp">
                            <div className="ial-initials">{initials}</div>
                            <div>
                              <div className="ial-emp-name">{rec.employee?.name || 'Unknown'}</div>
                              <div className="ial-emp-meta">{rec.employee?.employeeCode} · {rec.employee?.department}</div>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ whiteSpace: 'nowrap', color: '#8090aa' }}>
                          {rec.date ? new Date(rec.date).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                        </td>

                        {/* Status */}
                        <td>
                          <span className="ial-badge" style={{ background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}33` }}>
                            {rec.status || 'unknown'}
                          </span>
                        </td>

                        {/* Check-ins */}
                        <td>
                          <div className="ial-logs">
                            {rec.checkIns?.length > 0 ? rec.checkIns.map((ci, i) => (
                              <div key={i}>
                                <div className="ial-log-row">
                                  <div className="ial-log-dot" style={{ background: '#4ade80' }} />
                                  <span className="ial-log-time">{fmt(ci.time)}</span>
                                  {ci.isLate && <span className="ial-late">+{ci.lateByMinutes}m</span>}
                                </div>
                                {ci.location && (
                                  <div className="ial-log-loc" style={{ marginLeft: 14 }}>
                                    <MapPinIcon />{ci.location.address || `${ci.location.lat?.toFixed(3)}, ${ci.location.lng?.toFixed(3)}`}
                                  </div>
                                )}
                              </div>
                            )) : <span style={{ color: '#3a4a65' }}>—</span>}
                          </div>
                        </td>

                        {/* Check-outs */}
                        <td>
                          <div className="ial-logs">
                            {rec.checkOuts?.length > 0 ? rec.checkOuts.map((co, i) => (
                              <div key={i}>
                                <div className="ial-log-row">
                                  <div className="ial-log-dot" style={{ background: '#f87171' }} />
                                  <span className="ial-log-time">{fmt(co.time)}</span>
                                </div>
                                {co.location && (
                                  <div className="ial-log-loc" style={{ marginLeft: 14 }}>
                                    <MapPinIcon />{co.location.address || `${co.location.lat?.toFixed(3)}, ${co.location.lng?.toFixed(3)}`}
                                  </div>
                                )}
                              </div>
                            )) : <span style={{ color: '#3a4a65' }}>—</span>}
                          </div>
                        </td>

                        {/* Selfies */}
                        <td>
                          <div className="ial-selfies">
                            {allSelfies.length > 0 ? allSelfies.map((s, i) => (
                              <img
                                key={i}
                                className="ial-selfie"
                                src={s.src}
                                alt={`${s.type} selfie`}
                                onClick={() => setLightbox(s.src)}
                                title={`Check-${s.type} selfie`}
                              />
                            )) : <span style={{ color: '#3a4a65', fontSize: 12 }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="ial-pager">
                <span className="ial-pager-info">Page {page} of {totalPages}</span>
                <div className="ial-pager-btns">
                  <button className="ial-pager-btn" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>← Prev</button>
                  <button className="ial-pager-btn" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}>Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Reports Page ──────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [params, setParams] = useState({
    month: new Date().getMonth() + 1,
    year: CURRENT_YEAR,
  });
  const [downloading, setDownloading] = useState(null);
  const [showAttendanceDrawer, setShowAttendanceDrawer] = useState(false);
  const navigate = useNavigate();

  const downloadReport = async (type, format) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    const loadId = toast.loading(`Generating ${type} ${format.toUpperCase()}…`);
    try {
      const url = `/reports/${type}/${format}?month=${params.month}&year=${params.year}`;
      const response = await api.get(url, { responseType: 'blob' });
      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}_report_${params.year}_${params.month}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success('Report downloaded', { id: loadId });
    } catch {
      toast.error('Failed to generate report', { id: loadId });
    } finally {
      setDownloading(null);
    }
  };

  const reportCards = [
    {
      title: 'Detailed Attendance Logs',
      description: 'View all check-ins, check-outs, and employee selfies with timestamps.',
      type: 'attendance-detailed',
      formats: [{ id: 'view', label: 'View in Drawer', accent: '#38bdf8', accentBg: 'rgba(56,189,248,0.1)', accentBorder: 'rgba(56,189,248,0.25)' }],
      Icon: DocumentChartBarIcon,
      iconBg: 'rgba(56,189,248,0.12)', iconBorder: 'rgba(56,189,248,0.25)', iconColor: '#38bdf8', glowColor: 'rgba(56,189,248,0.12)',
    },
    {
      title: 'Workforce Attendance',
      description: 'Comprehensive log of check-ins, late marks, and overtime hours across all departments.',
      type: 'attendance',
      formats: [
        { id: 'pdf', label: 'Export PDF', accent: '#f87171', accentBg: 'rgba(239,68,68,0.1)', accentBorder: 'rgba(239,68,68,0.25)' },
        { id: 'excel', label: 'Export Excel', accent: '#4ade80', accentBg: 'rgba(34,197,94,0.1)', accentBorder: 'rgba(34,197,94,0.25)' },
      ],
      Icon: DocumentChartBarIcon,
      iconBg: 'rgba(99,102,241,0.12)', iconBorder: 'rgba(99,102,241,0.25)', iconColor: '#a5b4fc', glowColor: 'rgba(99,102,241,0.15)',
    },
    {
      title: 'Financial Payroll',
      description: 'Granular breakdown of earnings, statutory deductions, and net disbursements.',
      type: 'payroll',
      formats: [{ id: 'pdf', label: 'Export PDF', accent: '#f87171', accentBg: 'rgba(239,68,68,0.1)', accentBorder: 'rgba(239,68,68,0.25)' }],
      Icon: BanknotesIcon,
      iconBg: 'rgba(34,197,94,0.12)', iconBorder: 'rgba(34,197,94,0.25)', iconColor: '#4ade80', glowColor: 'rgba(34,197,94,0.12)',
    },
  ];

  const scopeLabel = new Date(params.year, params.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        .rp-root { font-family:'DM Sans',system-ui,sans-serif;background:#0f1623;color:#f0f4ff;min-height:100vh;padding:28px 20px 100px;-webkit-font-smoothing:antialiased; }
        .rp-root *,.rp-root *::before,.rp-root *::after{box-sizing:border-box;margin:0;padding:0;}
        .rp-header { margin-bottom:28px; }
        .rp-title { font-family:'Syne',sans-serif;font-size:clamp(22px,5vw,30px);font-weight:800;letter-spacing:-0.03em;line-height:1.1; }
        .rp-title-accent { color:#818cf8; }
        .rp-subtitle { font-size:14px;color:#5a6a85;margin-top:6px; }
        .rp-section-label { font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-bottom:12px; }
        .rp-config { background:rgba(26,35,54,0.85);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:18px 20px;margin-bottom:28px;display:flex;align-items:flex-end;flex-wrap:wrap;gap:16px; }
        .rp-selects { display:flex;gap:12px;flex:1;min-width:200px; }
        .rp-field { display:flex;flex-direction:column;gap:6px;flex:1;min-width:0; }
        .rp-field-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:rgba(255,255,255,0.3); }
        .rp-select { width:100%;padding:10px 14px;background:rgba(15,22,35,0.7);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f0f4ff;font-size:14px;font-family:'DM Sans',system-ui,sans-serif;outline:none;-webkit-appearance:none;cursor:pointer; }
        .rp-select option { background:#1a2336; }
        .rp-scope { display:flex;flex-direction:column;gap:3px;padding:10px 16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;flex-shrink:0; }
        .rp-scope-label { font-size:10px;color:rgba(255,255,255,0.3);font-weight:600;text-transform:uppercase;letter-spacing:0.06em; }
        .rp-scope-val { font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:#818cf8; }
        .rp-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:28px; }
        .rp-card { background:rgba(26,35,54,0.85);border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:22px;position:relative;overflow:hidden;transition:border-color 0.2s,transform 0.18s;display:flex;flex-direction:column;gap:18px;animation:rpFadeUp 0.4s ease both; }
        .rp-card:hover { border-color:rgba(255,255,255,0.14);transform:translateY(-2px); }
        @keyframes rpFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .rp-card-glow { position:absolute;top:-30px;right:-30px;width:110px;height:110px;border-radius:50%;filter:blur(40px);pointer-events:none; }
        .rp-card-head { display:flex;align-items:flex-start;gap:14px; }
        .rp-icon-box { width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .rp-icon-box svg { width:20px;height:20px; }
        .rp-card-title { font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:#f0f4ff;letter-spacing:-0.2px;margin-bottom:5px; }
        .rp-card-desc { font-size:12px;color:#5a6a85;line-height:1.55; }
        .rp-formats { display:flex;flex-wrap:wrap;gap:8px; }
        .rp-fmt-btn { display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:9px;font-size:12px;font-weight:600;font-family:'DM Sans',system-ui,sans-serif;cursor:pointer;border:1px solid;transition:opacity 0.15s,transform 0.1s;white-space:nowrap; }
        .rp-fmt-btn:hover:not(:disabled){opacity:0.85;}
        .rp-fmt-btn:active:not(:disabled){transform:scale(0.96);}
        .rp-fmt-btn:disabled{opacity:0.45;cursor:not-allowed;}
        .rp-fmt-btn svg{width:13px;height:13px;flex-shrink:0;}
        @keyframes rpPulse{0%,100%{opacity:0.5}50%{opacity:1}}
        .rp-fmt-btn.loading{animation:rpPulse 1.2s infinite;}
        .rp-info { display:flex;align-items:flex-start;gap:12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:14px 16px; }
        .rp-info svg{width:16px;height:16px;color:#818cf8;flex-shrink:0;margin-top:1px;}
        .rp-info p{font-size:12px;color:rgba(165,180,252,0.8);line-height:1.55;}
        .rp-info strong{color:#a5b4fc;}
        @media(max-width:700px){.rp-grid{grid-template-columns:1fr;}.rp-scope{width:100%;}}
        @media(max-width:480px){.rp-root{padding:20px 14px 100px;}.rp-card{padding:18px 16px;}}
        @media(max-width:360px){.rp-selects{flex-direction:column;}.rp-fmt-btn{font-size:11px;padding:8px 12px;}}
      `}</style>

      <div className="rp-root">
        <div className="rp-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 className="rp-title">Report <span className="rp-title-accent">Vault</span></h1>
              <p className="rp-subtitle">Generate and export certified organisational records.</p>
            </div>
            <button
              onClick={() => navigate('/reports/calendar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'transform 0.2s, opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <CalendarDaysIcon style={{ width: '18px', height: '18px' }} />
              Manage Attendance
              <ArrowRightIcon style={{ width: '14px', height: '14px' }} />
            </button>
            <button
              onClick={() => navigate('/holidays')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'transform 0.2s, opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <CalendarDaysIcon style={{ width: '18px', height: '18px' }} />
              Manage Holidays
              <ArrowRightIcon style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>

        <div className="rp-section-label">Export Configuration</div>
        <div className="rp-config">
          <div className="rp-selects">
            <div className="rp-field">
              <label className="rp-field-label">Month</label>
              <select className="rp-select" value={params.month} onChange={e => setParams(p => ({ ...p, month: parseInt(e.target.value) }))}>
                {getMonthOptions().map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="rp-field">
              <label className="rp-field-label">Year</label>
              <select className="rp-select" value={params.year} onChange={e => setParams(p => ({ ...p, year: parseInt(e.target.value) }))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="rp-scope">
            <span className="rp-scope-label">Scope</span>
            <span className="rp-scope-val">{scopeLabel}</span>
          </div>
        </div>

        <div className="rp-section-label">Available Reports</div>
        <div className="rp-grid">
          {reportCards.map((card, idx) => (
            <div key={card.type} className="rp-card" style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="rp-card-glow" style={{ background: card.glowColor }} />
              <div className="rp-card-head">
                <div className="rp-icon-box" style={{ background: card.iconBg, border: `1px solid ${card.iconBorder}`, color: card.iconColor }}>
                  <card.Icon />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rp-card-title">{card.title}</div>
                  <div className="rp-card-desc">{card.description}</div>
                </div>
              </div>
              <div className="rp-formats">
                {card.formats.map((fmt) => {
                  const key = `${card.type}-${fmt.id}`;
                  const isThis = downloading === key;
                  if (card.type === 'attendance-detailed' && fmt.id === 'view') {
                    return (
                      <button key={fmt.id} className="rp-fmt-btn" style={{ background: fmt.accentBg, borderColor: fmt.accentBorder, color: fmt.accent }} onClick={() => setShowAttendanceDrawer(true)}>
                        <DocumentChartBarIcon />{fmt.label}
                      </button>
                    );
                  }
                  return (
                    <button key={fmt.id} className={`rp-fmt-btn${isThis ? ' loading' : ''}`} style={{ background: fmt.accentBg, borderColor: fmt.accentBorder, color: fmt.accent }} disabled={!!downloading} onClick={() => downloadReport(card.type, fmt.id)}>
                      <ArrowDownTrayIcon />{isThis ? 'Generating…' : fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rp-info">
          <InformationCircleIcon />
          <p><strong>Note:</strong> Attendance logs include cross-branch data. Payroll exports reflect <strong>finalised</strong> records only.</p>
        </div>

        {/* ── Inline log always visible below the note ── */}
        <InlineAttendanceLog params={params} />
      </div>

      {showAttendanceDrawer && (
        <AttendanceDrawer params={params} onClose={() => setShowAttendanceDrawer(false)} />
      )}
    </>
  );
}
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeAPI, attendanceAPI, leaveAPI } from '../../services/api';
import { formatDate, formatINR } from '../../utils/helpers';
import toast from 'react-hot-toast';

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function pad(n) { return String(n).padStart(2, '0'); }

const ATT_STATUS = {
  present:  { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', dot: '#22c55e'  },
  absent:   { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', dot: '#ef4444'  },
  half_day: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', dot: '#f59e0b'  },
};
const LEAVE_STATUS = {
  pending:   { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', dot: '#f59e0b' },
  approved:  { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  rejected:  { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  cancelled: { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', dot: '#64748b' },
};
const LEAVE_TYPE_META = {
  CL: { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc' },
  SL: { bg: 'rgba(239,68,68,0.1)',   text: '#fca5a5' },
  PL: { bg: 'rgba(34,197,94,0.1)',   text: '#86efac' },
};

const TABS = ['overview', 'attendance', 'leaves'];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee,   setEmployee]   = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves,     setLeaves]     = useState([]);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const now = new Date();
    Promise.all([
      employeeAPI.getById(id),
      attendanceAPI.getAll({ employeeId: id, month: now.getMonth() + 1, year: now.getFullYear() }),
      leaveAPI.getAll({ employeeId: id }),
    ]).then(([empRes, attRes, leaveRes]) => {
      setEmployee(empRes.data.data);
      setAttendance(attRes.data.data.records);
      setLeaves(leaveRes.data.data);
    }).catch(() => toast.error('Failed to load employee data'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', background:'#0f1623' }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(79,142,255,0.2)', borderTopColor:'#4f8eff', borderRadius:'50%', animation:'ep-spin 0.8s linear infinite' }} />
      <style>{`@keyframes ep-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!employee) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'#5a6a85', fontFamily:'DM Sans,sans-serif', background:'#0f1623', minHeight:'100vh' }}>
      Employee not found
    </div>
  );

  const gross = Object.values(employee.salary || {}).reduce((s, v) => s + (v || 0), 0);
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const initials = employee.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .ep-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          min-height: 100vh;
          padding: 24px 20px 100px;
          -webkit-font-smoothing: antialiased;
        }
        .ep-root *, .ep-root *::before, .ep-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Nav row ── */
        .ep-nav {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 22px; flex-wrap: wrap; gap: 10px;
        }
        .ep-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: #8b9ab5; background: none; border: none;
          cursor: pointer; font-family: 'DM Sans', system-ui, sans-serif;
          padding: 6px 0; transition: color 0.15s;
        }
        .ep-back:hover { color: #f0f4ff; }
        .ep-edit-btn {
          padding: 9px 18px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #3b5bdb, #4f8eff);
          color: #fff; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 4px 14px rgba(79,142,255,0.25);
        }
        .ep-edit-btn:hover { opacity: 0.9; }
        .ep-edit-btn:active { transform: scale(0.97); }

        /* ── Profile hero ── */
        .ep-hero {
          background: linear-gradient(135deg, #1a2336 0%, #1e2d45 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 16px;
          display: flex; align-items: center;
          gap: 18px; flex-wrap: wrap;
          position: relative; overflow: hidden;
        }
        .ep-hero::before {
          content: '';
          position: absolute; top: -30px; right: -30px;
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, rgba(79,142,255,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .ep-avatar {
          width: 62px; height: 62px; border-radius: 50%;
          background: rgba(79,142,255,0.15);
          border: 2px solid rgba(79,142,255,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; color: #93c5fd;
          flex-shrink: 0; letter-spacing: -0.5px;
        }
        .ep-hero-info { flex: 1; min-width: 0; }
        .ep-emp-name { font-size: 20px; font-weight: 700; color: #f0f4ff; letter-spacing: -0.3px; margin-bottom: 3px; }
        .ep-designation { font-size: 13px; color: #8b9ab5; margin-bottom: 8px; }
        .ep-badges { display: flex; flex-wrap: wrap; gap: 7px; }
        .ep-badge {
          font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 7px;
        }
        .ep-badge.code { background: rgba(79,142,255,0.12); color: #93c5fd; font-family: 'DM Mono', monospace; }
        .ep-badge.branch { background: rgba(255,255,255,0.06); color: #8b9ab5; }
        .ep-badge.active   { background: rgba(34,197,94,0.12);  color: #4ade80; }
        .ep-badge.inactive { background: rgba(239,68,68,0.12);  color: #f87171; }
        .ep-gross {
          text-align: right; flex-shrink: 0;
        }
        .ep-gross-val { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 600; color: #4f8eff; }
        .ep-gross-label { font-size: 11px; color: #5a6a85; margin-top: 3px; }

        /* ── Quick stats ── */
        .ep-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 24px;
        }
        .ep-stat {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 14px 16px;
        }
        .ep-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #5a6a85; margin-bottom: 5px; }
        .ep-stat-val { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 600; }

        /* ── Tabs ── */
        .ep-tabs {
          display: flex; gap: 4px;
          background: rgba(26,35,54,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 4px;
          margin-bottom: 20px; width: fit-content;
        }
        .ep-tab {
          padding: 8px 18px; border-radius: 9px; border: none;
          font-size: 13px; font-weight: 500; cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          color: #5a6a85; background: transparent;
          transition: background 0.15s, color 0.15s;
          text-transform: capitalize; white-space: nowrap;
        }
        .ep-tab.active { background: rgba(79,142,255,0.15); color: #93c5fd; font-weight: 600; }
        .ep-tab:not(.active):hover { color: #8b9ab5; background: rgba(255,255,255,0.04); }

        /* ── Overview grid ── */
        .ep-overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ep-info-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 18px 20px;
        }
        .ep-info-card-title { font-size: 13px; font-weight: 600; color: #f0f4ff; margin-bottom: 14px; }
        .ep-info-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          gap: 12px;
        }
        .ep-info-row:last-of-type { border-bottom: none; padding-bottom: 0; }
        .ep-info-key { font-size: 12px; color: #5a6a85; font-weight: 500; flex-shrink: 0; }
        .ep-info-val { font-size: 13px; color: #f0f4ff; font-weight: 500; text-align: right; word-break: break-all; }
        .ep-info-val.mono { font-family: 'DM Mono', monospace; font-size: 12px; }
        .ep-salary-net {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 10px; margin-top: 4px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .ep-salary-net-label { font-size: 13px; font-weight: 600; color: #f0f4ff; }
        .ep-salary-net-val { font-family: 'DM Mono', monospace; font-size: 16px; font-weight: 600; color: #4f8eff; }

        /* ── Attendance list ── */
        .ep-att-list { display: flex; flex-direction: column; gap: 8px; }
        .ep-att-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px 16px;
          display: flex; align-items: center; gap: 14px;
          transition: background 0.15s;
        }
        .ep-att-card:hover { background: rgba(30,45,69,0.9); }
        .ep-att-date { flex-shrink: 0; text-align: center; min-width: 38px; }
        .ep-att-day { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 500; line-height: 1; }
        .ep-att-wd  { font-size: 9px; color: #5a6a85; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
        .ep-att-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.07); flex-shrink: 0; }
        .ep-att-body { flex: 1; min-width: 0; }
        .ep-att-times { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 3px; }
        .ep-att-time { display: flex; flex-direction: column; }
        .ep-att-t-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #5a6a85; font-weight: 600; }
        .ep-att-t-val { font-family: 'DM Mono', monospace; font-size: 13px; color: #f0f4ff; font-weight: 500; margin-top: 1px; }
        .ep-att-t-val.dash { color: #5a6a85; }
        .ep-att-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .ep-status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 600;
          padding: 2px 8px; border-radius: 20px; letter-spacing: 0.2px;
        }
        .ep-status-dot { width: 5px; height: 5px; border-radius: 50%; }
        .ep-late-tag { font-size: 10px; color: #f87171; }
        .ep-att-hours {
          margin-left: auto; flex-shrink: 0;
          font-family: 'DM Mono', monospace; font-size: 12px; color: #8b9ab5;
        }

        /* ── Leave list ── */
        .ep-leave-list { display: flex; flex-direction: column; gap: 8px; }
        .ep-leave-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 13px 16px;
          display: flex; align-items: center; gap: 14px;
          transition: background 0.15s;
        }
        .ep-leave-card:hover { background: rgba(30,45,69,0.9); }
        .ep-leave-type-badge {
          font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 8px;
          letter-spacing: 0.3px; flex-shrink: 0; text-align: center; min-width: 42px;
        }
        .ep-leave-body { flex: 1; min-width: 0; }
        .ep-leave-dates { font-family: 'DM Mono', monospace; font-size: 12px; color: #8b9ab5; margin-bottom: 3px; }
        .ep-leave-reason { font-size: 12px; color: #5a6a85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ep-leave-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
        .ep-days-chip { font-size: 11px; font-family: 'DM Mono', monospace; color: #5a6a85; }

        /* ── Empty state ── */
        .ep-empty { text-align: center; padding: 44px 20px; color: #5a6a85; font-size: 14px; }

        /* ── Responsive ── */
        @media (max-width: 760px) {
          .ep-stats { grid-template-columns: repeat(2, 1fr); }
          .ep-overview-grid { grid-template-columns: 1fr; }
          .ep-tabs { width: 100%; }
          .ep-tab { flex: 1; text-align: center; }
        }
        @media (max-width: 560px) {
          .ep-root { padding: 18px 14px 100px; }
          .ep-hero { padding: 18px 16px; }
          .ep-gross { width: 100%; text-align: left; }
          .ep-gross-val { font-size: 18px; }
          .ep-tabs { gap: 2px; }
          .ep-tab { padding: 7px 12px; font-size: 12px; }
          .ep-att-times { gap: 10px; }
        }
        @media (max-width: 380px) {
          .ep-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .ep-stat { padding: 12px 12px; }
          .ep-stat-val { font-size: 17px; }
        }
      `}</style>

      <div className="ep-root">

        {/* ── Nav ── */}
        <div className="ep-nav">
          <button className="ep-back" onClick={() => navigate('/employees')}>
            ← Back to Employees
          </button>
          <button className="ep-edit-btn" onClick={() => navigate(`/employees/${id}/edit`)}>
            Edit Employee
          </button>
        </div>

        {/* ── Hero ── */}
        <div className="ep-hero">
          <div className="ep-avatar">{initials}</div>
          <div className="ep-hero-info">
            <div className="ep-emp-name">{employee.name}</div>
            <div className="ep-designation">{employee.designation} · {employee.department}</div>
            <div className="ep-badges">
              <span className="ep-badge code">{employee.employeeCode}</span>
              {employee.branch?.name && <span className="ep-badge branch">{employee.branch.name}</span>}
              <span className={`ep-badge ${employee.isActive ? 'active' : 'inactive'}`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="ep-gross">
            <div className="ep-gross-val">{formatINR(gross)}</div>
            <div className="ep-gross-label">Gross / month</div>
          </div>
        </div>

        {/* ── Quick stats ── */}
        <div className="ep-stats">
          {[
            { label: 'Present (Month)', value: presentCount,                     color: '#4ade80' },
            { label: 'CL Balance',      value: `${employee.leaveBalance?.CL ?? 0}d`, color: '#93c5fd' },
            { label: 'SL Balance',      value: `${employee.leaveBalance?.SL ?? 0}d`, color: '#c4b5fd' },
            { label: 'PL Balance',      value: `${employee.leaveBalance?.PL ?? 0}d`, color: '#fbbf24' },
          ].map((s) => (
            <div key={s.label} className="ep-stat">
              <div className="ep-stat-label">{s.label}</div>
              <div className="ep-stat-val" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="ep-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`ep-tab${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {activeTab === 'overview' && (
          <div className="ep-overview-grid">

            {/* Contact */}
            <div className="ep-info-card">
              <div className="ep-info-card-title">Contact Details</div>
              {[
                ['Email',        employee.email,              false],
                ['Phone',        employee.phone,              false],
                ['Joining Date', fmt(employee.dateOfJoining), false],
              ].map(([k, v]) => (
                <div key={k} className="ep-info-row">
                  <span className="ep-info-key">{k}</span>
                  <span className="ep-info-val">{v || '—'}</span>
                </div>
              ))}
            </div>

            {/* Salary */}
            <div className="ep-info-card">
              <div className="ep-info-card-title">Salary Breakdown</div>
              {Object.entries(employee.salary || {}).map(([k, v]) => (
                <div key={k} className="ep-info-row">
                  <span className="ep-info-key" style={{ textTransform: 'uppercase' }}>{k}</span>
                  <span className="ep-info-val">{formatINR(v)}</span>
                </div>
              ))}
              <div className="ep-salary-net">
                <span className="ep-salary-net-label">Gross Total</span>
                <span className="ep-salary-net-val">{formatINR(gross)}</span>
              </div>
            </div>

            {/* Bank details */}
            {employee.bankDetails?.accountNumber && (
              <div className="ep-info-card">
                <div className="ep-info-card-title">Bank Details</div>
                {[
                  ['Account No', employee.bankDetails.accountNumber],
                  ['Bank',       employee.bankDetails.bankName],
                  ['IFSC',       employee.bankDetails.ifscCode],
                ].map(([k, v]) => (
                  <div key={k} className="ep-info-row">
                    <span className="ep-info-key">{k}</span>
                    <span className="ep-info-val mono">{v || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ ATTENDANCE ══ */}
        {activeTab === 'attendance' && (
          attendance.length === 0
            ? <div className="ep-empty">No attendance records this month</div>
            : (
              <div className="ep-att-list">
                {attendance.map((r) => {
                  const d = new Date(r.date);
                  const sm = ATT_STATUS[r.status] || ATT_STATUS.absent;
                  const ci = fmtTime(r.checkIn?.time);
                  const co = fmtTime(r.checkOut?.time);
                  const statusLabel = r.status === 'half_day' ? 'Half Day'
                    : r.status.charAt(0).toUpperCase() + r.status.slice(1);
                  return (
                    <div key={r._id} className="ep-att-card">
                      <div className="ep-att-date">
                        <div className="ep-att-day">{pad(d.getDate())}</div>
                        <div className="ep-att-wd">{WEEKDAYS[d.getDay()]}</div>
                      </div>
                      <div className="ep-att-divider" />
                      <div className="ep-att-body">
                        <div className="ep-att-times">
                          <div className="ep-att-time">
                            <span className="ep-att-t-label">In</span>
                            <span className={`ep-att-t-val${ci ? '' : ' dash'}`}>{ci || '—'}</span>
                          </div>
                          <div className="ep-att-time">
                            <span className="ep-att-t-label">Out</span>
                            <span className={`ep-att-t-val${co ? '' : ' dash'}`}>{co || '—'}</span>
                          </div>
                        </div>
                        <div className="ep-att-meta">
                          <span className="ep-status-badge" style={{ background: sm.bg, color: sm.text }}>
                            <span className="ep-status-dot" style={{ background: sm.dot }} />
                            {statusLabel}
                          </span>
                          {r.isLate && <span className="ep-late-tag">Late +{r.lateByMinutes}m</span>}
                        </div>
                      </div>
                      <div className="ep-att-hours">
                        {r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
        )}

        {/* ══ LEAVES ══ */}
        {activeTab === 'leaves' && (
          leaves.length === 0
            ? <div className="ep-empty">No leave records found</div>
            : (
              <div className="ep-leave-list">
                {leaves.map((l) => {
                  const tm = LEAVE_TYPE_META[l.leaveType] || LEAVE_TYPE_META.CL;
                  const sm = LEAVE_STATUS[l.status]       || LEAVE_STATUS.cancelled;
                  return (
                    <div key={l._id} className="ep-leave-card">
                      <span className="ep-leave-type-badge" style={{ background: tm.bg, color: tm.text }}>
                        {l.leaveType}
                      </span>
                      <div className="ep-leave-body">
                        <div className="ep-leave-dates">
                          {fmt(l.startDate)} → {fmt(l.endDate)}
                        </div>
                        <div className="ep-leave-reason">{l.reason}</div>
                      </div>
                      <div className="ep-leave-right">
                        <span className="ep-status-badge" style={{ background: sm.bg, color: sm.text }}>
                          <span className="ep-status-dot" style={{ background: sm.dot }} />
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                        <span className="ep-days-chip">{l.totalDays}d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
        )}

      </div>
    </>
  );
}
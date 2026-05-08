import { useState, useEffect } from 'react';
import { leaveAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const LEAVE_TYPES = [
  { value: 'CL', label: 'Casual Leave', short: 'CL' },
  { value: 'SL', label: 'Sick Leave', short: 'SL' },
  { value: 'PL', label: 'Privilege Leave', short: 'PL' },
  { value: 'HD', label: 'Half Day', short: 'HD' },
];

const STATUS_META = {
  pending:   { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', dot: '#f59e0b' },
  approved:  { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  rejected:  { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  cancelled: { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', dot: '#64748b' },
};

const TYPE_META = {
  CL: { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc' },
  SL: { bg: 'rgba(239,68,68,0.1)',   text: '#fca5a5' },
  PL: { bg: 'rgba(34,197,94,0.1)',   text: '#86efac' },
  HD: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
};

function daysBetween(a, b) {
  if (!a || !b) return 0;
  const diff = Math.abs(new Date(b) - new Date(a));
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeavePage() {
  const { isAdmin, isHR } = useAuth();
  const [leaves, setLeaves]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ 
    leaveType: 'CL', 
    startDate: '', 
    endDate: '', 
    reason: '',
    halfDayOption: 'first_half' // 'first_half' or 'second_half'
  });

  const fetchLeaves = async () => {
    try {
      const res = await leaveAPI.getAll();
      setLeaves(res.data.data);
    } catch {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  useEffect(() => {
    document.body.style.overflow = showForm ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showForm]);

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        totalDays: form.leaveType === 'HD' ? 0.5 : daysBetween(form.startDate, form.endDate)
      };
      await leaveAPI.apply(payload);
      toast.success('Leave applied successfully');
      setShowForm(false);
      setForm({ leaveType: 'CL', startDate: '', endDate: '', reason: '', halfDayOption: 'first_half' });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await leaveAPI.review(id, { status, reviewRemarks: status === 'approved' ? 'Approved' : 'Rejected' });
      toast.success(`Leave ${status}`);
      fetchLeaves();
    } catch {
      toast.error('Failed to update leave');
    }
  };

  const previewDays = form.leaveType === 'HD' ? 0.5 : daysBetween(form.startDate, form.endDate);
  const isHalfDay = form.leaveType === 'HD';

  // Summary counts
  const counts = leaves.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .lv-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          min-height: 100vh;
          padding: 28px 20px 100px;
          -webkit-font-smoothing: antialiased;
        }
        .lv-root *, .lv-root *::before, .lv-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Topbar ── */
        .lv-topbar {
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap;
          gap: 12px; margin-bottom: 24px;
        }
        .lv-topbar h1 {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 700; letter-spacing: -0.4px;
        }
        .lv-apply-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #3b5bdb, #4f8eff);
          color: #fff; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; transition: opacity 0.15s, transform 0.12s;
          box-shadow: 0 4px 16px rgba(79,142,255,0.3);
          white-space: nowrap;
        }
        .lv-apply-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .lv-apply-btn:active { transform: scale(0.97); }

        /* ── Summary chips ── */
        .lv-summary {
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-bottom: 24px;
        }
        .lv-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 10px;
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          font-size: 13px;
        }
        .lv-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .lv-chip-label { color: #8b9ab5; }
        .lv-chip-val { font-family: 'DM Mono', monospace; font-weight: 500; color: #f0f4ff; }

        /* ── Cards list ── */
        .lv-list { display: flex; flex-direction: column; gap: 10px; }

        .lv-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 16px 18px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 16px;
          transition: border-color 0.18s, background 0.18s;
          animation: lvFadeUp 0.35s ease both;
        }
        .lv-card:hover { border-color: rgba(79,142,255,0.25); background: rgba(30,45,69,0.9); }
        @keyframes lvFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* left: type badge + dates */
        .lv-card-left { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 48px; }
        .lv-type-badge {
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          padding: 4px 9px; border-radius: 7px;
        }
        .lv-days-pill {
          font-family: 'DM Mono', monospace;
          font-size: 11px; color: #5a6a85;
        }

        /* middle: employee + dates + reason */
        .lv-card-mid { min-width: 0; }
        .lv-emp-name { font-size: 15px; font-weight: 600; color: #f0f4ff; margin-bottom: 3px; }
        .lv-date-range {
          font-size: 12px; color: #8b9ab5;
          font-family: 'DM Mono', monospace; margin-bottom: 5px;
        }
        .lv-halfday-info {
          font-size: 11px; color: #fbbf24;
          background: rgba(245,158,11,0.1);
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          margin-top: 4px;
        }
        .lv-reason {
          font-size: 12px; color: #5a6a85;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 100%;
        }

        /* right: status + actions */
        .lv-card-right {
          display: flex; flex-direction: column;
          align-items: flex-end; gap: 8px; flex-shrink: 0;
        }
        .lv-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 20px;
          letter-spacing: 0.2px; white-space: nowrap;
        }
        .lv-status-dot { width: 5px; height: 5px; border-radius: 50%; }
        .lv-action-row { display: flex; gap: 6px; }
        .lv-btn-approve, .lv-btn-reject {
          font-size: 11px; font-weight: 600;
          padding: 5px 10px; border-radius: 7px;
          border: none; cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          transition: opacity 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .lv-btn-approve { background: rgba(34,197,94,0.12); color: #4ade80; }
        .lv-btn-reject  { background: rgba(239,68,68,0.1);  color: #f87171; }
        .lv-btn-approve:hover { background: rgba(34,197,94,0.22); }
        .lv-btn-reject:hover  { background: rgba(239,68,68,0.2);  }
        .lv-btn-approve:active, .lv-btn-reject:active { transform: scale(0.96); }

        /* ── Empty / loading ── */
        .lv-empty {
          background: rgba(26,35,54,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; padding: 60px 24px;
          text-align: center;
        }
        .lv-empty-icon { font-size: 38px; margin-bottom: 12px; }
        .lv-empty-title { font-size: 15px; font-weight: 600; color: #f0f4ff; margin-bottom: 5px; }
        .lv-empty-sub { font-size: 13px; color: #5a6a85; }

        /* skeleton */
        .lv-skel {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px; padding: 16px 18px;
          display: flex; align-items: center; gap: 16px;
          height: 78px;
        }
        .skel { background: rgba(255,255,255,0.06); border-radius: 6px; animation: lvShim 1.4s ease infinite; }
        @keyframes lvShim { 0%,100%{opacity:0.5} 50%{opacity:1} }

        /* ── Modal overlay ── */
        .lv-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .lv-sheet {
          background: #1a2336;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px 24px 0 0;
          width: 100%; max-width: 480px;
          padding: 0 0 36px;
          animation: lvSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes lvSlideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .lv-sheet-handle {
          width: 36px; height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px; margin: 12px auto 0;
        }
        .lv-sheet-header {
          padding: 16px 22px 12px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .lv-sheet-title { font-size: 16px; font-weight: 700; color: #f0f4ff; }
        .lv-sheet-close {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: #8b9ab5; font-size: 18px; line-height: 1;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .lv-sheet-body { padding: 20px 22px 0; display: flex; flex-direction: column; gap: 16px; }

        /* form elements */
        .lv-field { display: flex; flex-direction: column; gap: 6px; }
        .lv-label { font-size: 12px; font-weight: 600; color: #8b9ab5; letter-spacing: 0.04em; text-transform: uppercase; }

        .lv-select, .lv-input, .lv-textarea {
          width: 100%; padding: 11px 14px;
          background: rgba(15,22,35,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #f0f4ff;
          font-size: 14px; font-family: 'DM Sans', system-ui, sans-serif;
          outline: none; transition: border-color 0.15s;
          -webkit-appearance: none;
        }
        .lv-select:focus, .lv-input:focus, .lv-textarea:focus {
          border-color: rgba(79,142,255,0.5);
          box-shadow: 0 0 0 3px rgba(79,142,255,0.1);
        }
        .lv-select option { background: #1a2336; }
        .lv-textarea { resize: vertical; min-height: 80px; }

        .lv-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .lv-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }

        .lv-days-preview {
          font-size: 12px; color: #4f8eff;
          font-family: 'DM Mono', monospace; margin-top: 2px;
        }

        .lv-halfday-options {
          display: flex; gap: 12px; margin-top: 8px;
        }
        .lv-radio-option {
          display: flex; align-items: center; gap: 6px;
          cursor: pointer;
        }
        .lv-radio-option input[type="radio"] {
          accent-color: #4f8eff;
          width: 14px; height: 14px;
        }
        .lv-radio-label {
          font-size: 12px; color: #8b9ab5;
        }

        .lv-form-actions { display: flex; gap: 10px; margin-top: 4px; }
        .lv-submit-btn {
          flex: 1; padding: 13px;
          background: linear-gradient(135deg, #3b5bdb, #4f8eff);
          border: none; border-radius: 10px;
          color: #fff; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s;
        }
        .lv-submit-btn:hover { opacity: 0.9; }
        .lv-submit-btn:active { transform: scale(0.97); }
        .lv-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .lv-cancel-btn {
          padding: 13px 20px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #8b9ab5;
          font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; transition: background 0.15s;
        }
        .lv-cancel-btn:hover { background: rgba(255,255,255,0.09); }

        /* ── Responsive ── */
        @media (min-width: 600px) {
          .lv-sheet { border-radius: 20px; max-width: 440px; margin: 24px; }
          .lv-overlay { align-items: center; }
        }
        @media (max-width: 640px) {
          .lv-root { padding: 20px 14px 100px; }
          .lv-card { grid-template-columns: auto 1fr; gap: 12px; }
          .lv-card-right { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; margin-top: 2px; }
          .lv-emp-name { font-size: 14px; }
          .lv-summary { gap: 8px; }
        }
        @media (max-width: 380px) {
          .lv-date-row { grid-template-columns: 1fr; }
          .lv-topbar h1 { font-size: 18px; }
          .lv-apply-btn { font-size: 13px; padding: 9px 14px; }
          .lv-halfday-options { flex-direction: column; gap: 8px; }
        }
      `}</style>

      <div className="lv-root">

        {/* ── Topbar ── */}
        <div className="lv-topbar">
          <h1>Leave Management</h1>
          <button className="lv-apply-btn" onClick={() => setShowForm(true)}>
            + Apply Leave
          </button>
        </div>

        {/* ── Summary chips ── */}
        {!loading && leaves.length > 0 && (
          <div className="lv-summary">
            {[
              { key: 'pending',  label: 'Pending'  },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
            ].map(({ key, label }) => (
              <div key={key} className="lv-chip">
                <span className="lv-chip-dot" style={{ background: STATUS_META[key].dot }} />
                <span className="lv-chip-label">{label}</span>
                <span className="lv-chip-val">{counts[key] || 0}</span>
              </div>
            ))}
            <div className="lv-chip">
              <span className="lv-chip-dot" style={{ background: '#475569' }} />
              <span className="lv-chip-label">Total</span>
              <span className="lv-chip-val">{leaves.length}</span>
            </div>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0,1,2,3].map(i => (
              <div key={i} className="lv-skel" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="skel" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ width: '40%', height: 13, marginBottom: 8 }} />
                  <div className="skel" style={{ width: '65%', height: 10 }} />
                </div>
                <div className="skel" style={{ width: 60, height: 22, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && leaves.length === 0 && (
          <div className="lv-empty">
            <div className="lv-empty-icon">🌿</div>
            <div className="lv-empty-title">No leave requests yet</div>
            <div className="lv-empty-sub">Apply for leave using the button above</div>
          </div>
        )}

        {/* ── Leave cards ── */}
        {!loading && leaves.length > 0 && (
          <div className="lv-list">
            {leaves.map((l, idx) => {
              const sm = STATUS_META[l.status] || STATUS_META.cancelled;
              const tm = TYPE_META[l.leaveType] || { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc' };
              const isHalfDayLeave = l.leaveType === 'HD';
              return (
                <div key={l._id} className="lv-card" style={{ animationDelay: `${idx * 40}ms` }}>

                  {/* Left */}
                  <div className="lv-card-left">
                    <span className="lv-type-badge" style={{ background: tm.bg, color: tm.text }}>
                      {l.leaveType}
                    </span>
                    <span className="lv-days-pill">{l.totalDays}d</span>
                  </div>

                  {/* Mid */}
                  <div className="lv-card-mid">
                    <div className="lv-emp-name">{l.employee?.name || 'Employee'}</div>
                    <div className="lv-date-range">
                      {isHalfDayLeave ? (
                        <>Half Day on {fmt(l.startDate)}</>
                      ) : (
                        <>{fmt(l.startDate)} → {fmt(l.endDate)}</>
                      )}
                    </div>
                    {isHalfDayLeave && l.halfDayOption && (
                      <div className="lv-halfday-info">
                        {l.halfDayOption === 'first_half' ? 'First Half' : 'Second Half'}
                      </div>
                    )}
                    <div className="lv-reason">{l.reason}</div>
                  </div>

                  {/* Right */}
                  <div className="lv-card-right">
                    <span className="lv-status-badge" style={{ background: sm.bg, color: sm.text }}>
                      <span className="lv-status-dot" style={{ background: sm.dot }} />
                      {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                    </span>
                    {(isAdmin || isHR) && l.status === 'pending' && (
                      <div className="lv-action-row">
                        <button className="lv-btn-approve" onClick={() => handleReview(l._id, 'approved')}>Approve</button>
                        <button className="lv-btn-reject"  onClick={() => handleReview(l._id, 'rejected')}>Reject</button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Apply Leave Modal ── */}
      {showForm && (
        <div className="lv-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="lv-sheet">
            <div className="lv-sheet-handle" />
            <div className="lv-sheet-header">
              <div className="lv-sheet-title">Apply for Leave</div>
              <button className="lv-sheet-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleApply}>
              <div className="lv-sheet-body">

                {/* Leave type */}
                <div className="lv-field">
                  <label className="lv-label">Leave Type</label>
                  <select
                    className="lv-select"
                    value={form.leaveType}
                    onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} ({t.short})</option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="lv-field">
                  <label className="lv-label">Duration</label>
                  <div className="lv-date-row">
                    <input
                      type="date" className="lv-input"
                      value={form.startDate} required
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                    {!isHalfDay && (
                      <input
                        type="date" className="lv-input"
                        value={form.endDate} required
                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      />
                    )}
                    {isHalfDay && (
                      <input
                        type="date" className="lv-input"
                        value={form.endDate || form.startDate}
                        disabled
                        style={{ opacity: 0.6 }}
                      />
                    )}
                  </div>
                  {previewDays > 0 && (
                    <div className="lv-days-preview">
                      {isHalfDay ? '0.5 day (Half Day) selected' : `${previewDays} day${previewDays !== 1 ? 's' : ''} selected`}
                    </div>
                  )}
                </div>

                {/* Half Day Options */}
                {isHalfDay && (
                  <div className="lv-field">
                    <label className="lv-label">Half Day Option</label>
                    <div className="lv-halfday-options">
                      <label className="lv-radio-option">
                        <input
                          type="radio"
                          name="halfDayOption"
                          value="first_half"
                          checked={form.halfDayOption === 'first_half'}
                          onChange={(e) => setForm({ ...form, halfDayOption: e.target.value })}
                        />
                        <span className="lv-radio-label">First Half (9:00 AM - 1:00 PM)</span>
                      </label>
                      <label className="lv-radio-option">
                        <input
                          type="radio"
                          name="halfDayOption"
                          value="second_half"
                          checked={form.halfDayOption === 'second_half'}
                          onChange={(e) => setForm({ ...form, halfDayOption: e.target.value })}
                        />
                        <span className="lv-radio-label">Second Half (2:00 PM - 6:00 PM)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="lv-field">
                  <label className="lv-label">Reason</label>
                  <textarea
                    className="lv-textarea"
                    value={form.reason} required rows={3}
                    placeholder="Briefly describe your reason..."
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>

                {/* Actions */}
                <div className="lv-form-actions">
                  <button type="submit" className="lv-submit-btn" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                  <button type="button" className="lv-cancel-btn" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
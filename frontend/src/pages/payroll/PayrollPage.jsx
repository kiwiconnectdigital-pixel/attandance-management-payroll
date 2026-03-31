import { useState, useEffect } from 'react';
import { payrollAPI, employeeAPI, payslipAPI } from '../../services/api';
import toast from 'react-hot-toast';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('default', { month: 'long' }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatINR(n) {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

function periodLabel(month, year) {
  return `${new Date(2000, month - 1).toLocaleString('default', { month: 'short' })} ${year}`;
}

// ── Statutory deduction calculator (no LOP, no overtime, no 12.5%) ──
// PF  : 12% of Basic only (employee share, capped at ₹1,800)
// ESIC: 0.75% of Gross   (applicable only if gross ≤ ₹21,000)
// PT  : slab-based Professional Tax (standard Indian slabs)
function calcDeductions(basic = 0, gross = 0) {
  // PF — 12% of basic, capped at ₹1,800/month
  const pf = Math.min(Math.round(basic * 0.12), 1800);

  // ESIC — 0.75% of gross, only if gross ≤ ₹21,000
  const esic = gross <= 21000 ? Math.round(gross * 0.0075) : 0;

  // Professional Tax slabs (most Indian states)
  let pt = 0;
  if      (gross > 15000) pt = 200;
  else if (gross > 10000) pt = 150;
  else if (gross > 7500)  pt = 100;
  else if (gross > 5000)  pt = 50;

  const total = pf + esic + pt;
  return { pf, esic, pt, total };
}

const STATUS_META = {
  paid:      { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', dot: '#22c55e' },
  processed: { bg: 'rgba(79,142,255,0.12)',  text: '#93c5fd', dot: '#4f8eff' },
  draft:     { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', dot: '#64748b' },
};

export default function PayrollPage() {
  const [payrolls,   setPayrolls]   = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [processing, setProcessing] = useState(false);
  const [genLoading, setGenLoading] = useState(null);

  // ── form: removed otherDeductions ──
  const [form, setForm] = useState({
    employeeId: '',
    month:      new Date().getMonth() + 1,
    year:       CURRENT_YEAR,
    bonus:      0,
  });

  // live preview for the selected employee
  const [preview, setPreview] = useState(null);

  const fetchPayrolls = () =>
    payrollAPI.getAll().then((r) => setPayrolls(r.data.data));

  useEffect(() => {
    fetchPayrolls();
    employeeAPI.getAll().then((r) => setEmployees(r.data.data.employees));
  }, []);

  // Recompute preview whenever employee or bonus changes
  useEffect(() => {
    if (!form.employeeId) { setPreview(null); return; }
    const emp = employees.find((e) => e._id === form.employeeId);
    if (!emp?.salary) { setPreview(null); return; }

    const s     = emp.salary;
    const gross = (s.basic||0) + (s.hra||0) + (s.da||0) + (s.ta||0) + (s.other||0);
    const bonus = parseFloat(form.bonus) || 0;
    const { pf, esic, pt, total } = calcDeductions(s.basic || 0, gross);
    const net   = gross + bonus - total;

    setPreview({ gross, bonus, pf, esic, pt, totalDed: total, net });
  }, [form.employeeId, form.bonus, employees]);

  const handleProcess = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      // Only send fields backend needs; LOP / overtime removed
      await payrollAPI.process({
        employeeId: form.employeeId,
        month:      form.month,
        year:       form.year,
        bonus:      parseFloat(form.bonus) || 0,
      });
      toast.success('Payroll processed!');
      fetchPayrolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await payrollAPI.markPaid(id);
      toast.success('Marked as paid');
      fetchPayrolls();
    } catch {
      toast.error('Failed to mark paid');
    }
  };

  const handleGeneratePayslip = async (payrollId) => {
    setGenLoading(payrollId);
    try {
      const res = await payslipAPI.generate(payrollId);
      toast.success('Payslip generated!');
      window.open(`${import.meta.env.VITE_UPLOAD_BASE_URL}${res.data.data.pdfUrl}`, '_blank');
    } catch {
      toast.error('Failed to generate payslip');
    } finally {
      setGenLoading(null);
    }
  };

  // Summary totals
  const totalGross = payrolls.reduce((s, p) => s + (p.grossSalary  || 0), 0);
  const totalNet   = payrolls.reduce((s, p) => s + (p.netSalary    || 0), 0);
  const paidCount  = payrolls.filter((p) => p.status === 'paid').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .pr-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623; color: #f0f4ff;
          min-height: 100vh; padding: 28px 20px 100px;
          -webkit-font-smoothing: antialiased;
        }
        .pr-root *, .pr-root *::before, .pr-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .pr-header { margin-bottom: 24px; }
        .pr-header h1 { font-size: clamp(20px, 4vw, 26px); font-weight: 700; letter-spacing: -0.4px; }
        .pr-header p  { font-size: 13px; color: #5a6a85; margin-top: 5px; }

        .pr-section-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.28);
          margin-bottom: 12px;
        }

        .pr-summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
        .pr-chip {
          display: flex; flex-direction: column; gap: 2px;
          padding: 10px 16px; border-radius: 12px;
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          flex: 1; min-width: 120px;
        }
        .pr-chip-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #5a6a85; }
        .pr-chip-val { font-family: 'DM Mono', monospace; font-size: 17px; font-weight: 500; color: #f0f4ff; }
        .pr-chip-val.green { color: #4ade80; }
        .pr-chip-val.blue  { color: #93c5fd; }

        /* ── Form card ── */
        .pr-form-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; padding: 22px; margin-bottom: 28px;
        }
        .pr-form-card-title {
          font-size: 15px; font-weight: 600; color: #f0f4ff;
          margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
        }
        .pr-form-card-title span {
          font-size: 11px; font-weight: 500; color: #5a6a85;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 2px 9px;
        }

        /* 2-col grid (was 3-col) */
        .pr-form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .pr-field { display: flex; flex-direction: column; gap: 6px; }
        .pr-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.07em; color: rgba(255,255,255,0.3);
        }
        .pr-select, .pr-input {
          width: 100%; padding: 10px 14px;
          background: rgba(15,22,35,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #f0f4ff;
          font-size: 14px; font-family: 'DM Sans', system-ui, sans-serif;
          outline: none; -webkit-appearance: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .pr-select:focus, .pr-input:focus {
          border-color: rgba(79,142,255,0.5);
          box-shadow: 0 0 0 3px rgba(79,142,255,0.1);
        }
        .pr-select option { background: #1a2336; }

        .pr-submit-btn {
          width: 100%; padding: 11px 16px;
          background: linear-gradient(135deg, #3b5bdb, #4f8eff);
          border: none; border-radius: 10px;
          color: #fff; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 4px 16px rgba(79,142,255,0.25);
          align-self: flex-end;
        }
        .pr-submit-btn:hover:not(:disabled) { opacity: 0.9; }
        .pr-submit-btn:active:not(:disabled) { transform: scale(0.97); }
        .pr-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Salary preview panel ── */
        .pr-preview {
          margin-top: 18px;
          background: rgba(15,22,35,0.6);
          border: 1px solid rgba(79,142,255,0.15);
          border-radius: 12px; padding: 16px 18px;
          animation: prFadeUp 0.25s ease both;
        }
        .pr-preview-title {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #4f8eff; margin-bottom: 12px;
        }
        .pr-preview-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 10px; margin-bottom: 12px;
        }
        .pr-prev-item { display: flex; flex-direction: column; gap: 3px; }
        .pr-prev-label { font-size: 10px; color: #5a6a85; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .pr-prev-val   { font-family: 'DM Mono', monospace; font-size: 13px; color: #f0f4ff; }
        .pr-prev-val.green  { color: #4ade80; }
        .pr-prev-val.red    { color: #f87171; }
        .pr-prev-val.blue   { color: #93c5fd; }
        .pr-prev-val.amber  { color: #fbbf24; }
        .pr-preview-net {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);
        }
        .pr-preview-net-label { font-size: 12px; font-weight: 600; color: #8b9ab5; }
        .pr-preview-net-val   { font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 600; color: #93c5fd; }

        /* ── Payroll record cards ── */
        .pr-list { display: flex; flex-direction: column; gap: 10px; }
        .pr-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 16px 18px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center; gap: 16px;
          transition: border-color 0.18s, background 0.15s;
          animation: prFadeUp 0.35s ease both;
        }
        .pr-card:hover { border-color: rgba(79,142,255,0.2); background: rgba(30,45,69,0.9); }
        @keyframes prFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .pr-card-left { min-width: 0; }
        .pr-emp-name  { font-size: 15px; font-weight: 600; color: #f0f4ff; margin-bottom: 4px; }
        .pr-period    { font-size: 12px; color: #8b9ab5; font-family: 'DM Mono', monospace; }

        /* salary columns — removed Deductions column */
        .pr-salary-cols { display: flex; gap: 20px; flex-shrink: 0; }
        .pr-sal-item    { display: flex; flex-direction: column; gap: 2px; text-align: right; }
        .pr-sal-label   { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #5a6a85; }
        .pr-sal-val     { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; }
        .pr-sal-val.gross { color: #4ade80; }
        .pr-sal-val.net   { color: #93c5fd; font-size: 15px; }
        .pr-sal-val.bonus { color: #fbbf24; }

        .pr-card-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .pr-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
          padding: 3px 10px; border-radius: 20px;
          letter-spacing: 0.2px; white-space: nowrap;
        }
        .pr-status-dot { width: 5px; height: 5px; border-radius: 50%; }
        .pr-actions     { display: flex; gap: 6px; }
        .pr-btn {
          font-size: 11px; font-weight: 600;
          padding: 5px 10px; border-radius: 7px;
          border: none; cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          transition: opacity 0.15s, transform 0.1s; white-space: nowrap;
        }
        .pr-btn:active            { transform: scale(0.96); }
        .pr-btn:disabled          { opacity: 0.5; cursor: not-allowed; }
        .pr-btn.green             { background: rgba(34,197,94,0.12);  color: #4ade80; }
        .pr-btn.green:hover:not(:disabled) { background: rgba(34,197,94,0.22); }
        .pr-btn.blue              { background: rgba(79,142,255,0.12); color: #93c5fd; }
        .pr-btn.blue:hover:not(:disabled)  { background: rgba(79,142,255,0.22); }

        .pr-empty {
          background: rgba(26,35,54,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; padding: 56px 24px; text-align: center;
        }
        .pr-empty-icon  { font-size: 36px; margin-bottom: 12px; }
        .pr-empty-title { font-size: 15px; font-weight: 600; color: #f0f4ff; margin-bottom: 5px; }
        .pr-empty-sub   { font-size: 13px; color: #5a6a85; }

        /* ── Responsive ── */
        @media (max-width: 860px) {
          .pr-salary-cols { gap: 14px; }
          .pr-preview-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .pr-form-grid { grid-template-columns: 1fr; }
          .pr-card {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
          }
          .pr-salary-cols {
            grid-column: 1 / -1; justify-content: flex-start;
            gap: 16px; padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.06);
          }
          .pr-sal-item    { text-align: left; }
          .pr-card-right  { grid-row: 1; grid-column: 2; }
          .pr-summary     { gap: 8px; }
          .pr-chip        { min-width: calc(50% - 4px); }
        }
        @media (max-width: 480px) {
          .pr-root        { padding: 20px 14px 100px; }
          .pr-form-card   { padding: 18px 16px; }
          .pr-card        { padding: 14px 16px; }
          .pr-emp-name    { font-size: 14px; }
          .pr-preview-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 360px) {
          .pr-chip        { min-width: 100%; }
          .pr-actions     { flex-direction: column; gap: 4px; }
        }
      `}</style>

      <div className="pr-root">

        {/* ── Header — unchanged ── */}
        <div className="pr-header">
          <h1>Payroll Processing</h1>
          <p>Manage salary processing and generate payslips for employees.</p>
        </div>

        {/* ── Summary chips — unchanged ── */}
        {payrolls.length > 0 && (
          <>
            <div className="pr-section-label">Overview</div>
            <div className="pr-summary">
              <div className="pr-chip">
                <span className="pr-chip-label">Total Records</span>
                <span className="pr-chip-val">{payrolls.length}</span>
              </div>
              <div className="pr-chip">
                <span className="pr-chip-label">Total Gross</span>
                <span className="pr-chip-val green">{formatINR(totalGross)}</span>
              </div>
              <div className="pr-chip">
                <span className="pr-chip-label">Total Net</span>
                <span className="pr-chip-val blue">{formatINR(totalNet)}</span>
              </div>
              <div className="pr-chip">
                <span className="pr-chip-label">Paid</span>
                <span className="pr-chip-val">{paidCount} / {payrolls.length}</span>
              </div>
            </div>
          </>
        )}

        {/* ── Process form ── */}
        <div className="pr-section-label">Process Payroll</div>
        <div className="pr-form-card">
          <div className="pr-form-card-title">
            New Payroll Entry
            <span>Statutory deductions auto-calculated</span>
          </div>

          <form onSubmit={handleProcess}>
            <div className="pr-form-grid">

              {/* Employee */}
              <div className="pr-field">
                <label className="pr-label">Employee</label>
                <select
                  className="pr-select"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  required
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bonus */}
              <div className="pr-field">
                <label className="pr-label">Bonus (₹)</label>
                <input
                  type="number" min={0}
                  className="pr-input"
                  value={form.bonus}
                  onChange={(e) => setForm({ ...form, bonus: e.target.value })}
                  placeholder="0"
                />
              </div>

              {/* Month */}
              <div className="pr-field">
                <label className="pr-label">Month</label>
                <select
                  className="pr-select"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="pr-field">
                <label className="pr-label">Year</label>
                <select
                  className="pr-select"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Submit — full width */}
              <div className="pr-field" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button type="submit" className="pr-submit-btn" disabled={processing}>
                  {processing ? 'Processing…' : '⚡ Process Payroll'}
                </button>
              </div>

            </div>
          </form>

          {/* ── Live salary preview ── */}
          {preview && (
            <div className="pr-preview">
              <div className="pr-preview-title">
                Salary Preview · {employees.find(e => e._id === form.employeeId)?.name}
              </div>
              <div className="pr-preview-grid">
                <div className="pr-prev-item">
                  <span className="pr-prev-label">Gross Salary</span>
                  <span className="pr-prev-val green">{formatINR(preview.gross)}</span>
                </div>
                {preview.bonus > 0 && (
                  <div className="pr-prev-item">
                    <span className="pr-prev-label">Bonus</span>
                    <span className="pr-prev-val amber">+{formatINR(preview.bonus)}</span>
                  </div>
                )}
                <div className="pr-prev-item">
                  <span className="pr-prev-label">PF (12% basic)</span>
                  <span className="pr-prev-val red">−{formatINR(preview.pf)}</span>
                </div>
                <div className="pr-prev-item">
                  <span className="pr-prev-label">ESIC {preview.esic === 0 ? '(N/A)' : '(0.75%)'}</span>
                  <span className="pr-prev-val red">
                    {preview.esic === 0 ? '—' : `−${formatINR(preview.esic)}`}
                  </span>
                </div>
                <div className="pr-prev-item">
                  <span className="pr-prev-label">Prof. Tax</span>
                  <span className="pr-prev-val red">
                    {preview.pt === 0 ? '—' : `−${formatINR(preview.pt)}`}
                  </span>
                </div>
                <div className="pr-prev-item">
                  <span className="pr-prev-label">Total Deductions</span>
                  <span className="pr-prev-val red">−{formatINR(preview.totalDed)}</span>
                </div>
              </div>
              <div className="pr-preview-net">
                <span className="pr-preview-net-label">Estimated Net Pay</span>
                <span className="pr-preview-net-val">{formatINR(preview.net)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Payroll records ── */}
        <div className="pr-section-label">Payroll Records</div>

        {payrolls.length === 0 ? (
          <div className="pr-empty">
            <div className="pr-empty-icon">💳</div>
            <div className="pr-empty-title">No payroll records yet</div>
            <div className="pr-empty-sub">Process a payroll above to see records here</div>
          </div>
        ) : (
          <div className="pr-list">
            {payrolls.map((p, idx) => {
              const sm = STATUS_META[p.status] || STATUS_META.draft;
              return (
                <div
                  key={p._id}
                  className="pr-card"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Left: name + period — unchanged */}
                  <div className="pr-card-left">
                    <div className="pr-emp-name">{p.employee?.name || '—'}</div>
                    <div className="pr-period">{periodLabel(p.month, p.year)}</div>
                  </div>

                  {/* Middle: Gross · Bonus · Net  (Deductions column removed) */}
                  <div className="pr-salary-cols">
                    <div className="pr-sal-item">
                      <span className="pr-sal-label">Gross</span>
                      <span className="pr-sal-val gross">{formatINR(p.grossSalary)}</span>
                    </div>
                    {p.bonus > 0 && (
                      <div className="pr-sal-item">
                        <span className="pr-sal-label">Bonus</span>
                        <span className="pr-sal-val bonus">{formatINR(p.bonus)}</span>
                      </div>
                    )}
                    <div className="pr-sal-item">
                      <span className="pr-sal-label">Net Pay</span>
                      <span className="pr-sal-val net">{formatINR(p.netSalary)}</span>
                    </div>
                  </div>

                  {/* Right: status + actions — unchanged */}
                  <div className="pr-card-right">
                    <span
                      className="pr-status-badge"
                      style={{ background: sm.bg, color: sm.text }}
                    >
                      <span className="pr-status-dot" style={{ background: sm.dot }} />
                      {p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                    </span>
                    <div className="pr-actions">
                      {p.status === 'processed' && (
                        <button className="pr-btn green" onClick={() => handleMarkPaid(p._id)}>
                          Mark Paid
                        </button>
                      )}
                      <button
                        className="pr-btn blue"
                        disabled={genLoading === p._id}
                        onClick={() => handleGeneratePayslip(p._id)}
                      >
                        {genLoading === p._id ? 'Generating…' : 'Payslip PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

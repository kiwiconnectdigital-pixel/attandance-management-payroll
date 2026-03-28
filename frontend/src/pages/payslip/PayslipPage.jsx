import { useState, useEffect } from 'react';
import { payslipAPI } from '../../services/api';
import { formatDate, formatINR } from '../../utils/helpers';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function PayslipPage() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    payslipAPI.getAll()
      .then((r) => setPayslips(r.data.data))
      .catch(() => toast.error('Failed to load payslips'))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = (pdfPath, filename) => {
    const url = `${import.meta.env.VITE_UPLOAD_BASE_URL}/${pdfPath}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .pay-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          min-height: 100vh;
          padding: 28px 20px 100px;
          -webkit-font-smoothing: antialiased;
          box-sizing: border-box;
        }
        .pay-root *, .pay-root *::before, .pay-root *::after { box-sizing: border-box; }

        /* ── Top bar ── */
        .pay-topbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          margin-bottom: 28px;
        }
        .pay-topbar h1 {
          font-size: clamp(20px, 4vw, 26px);
          font-weight: 700; letter-spacing: -0.4px; margin: 0;
        }
        .pay-count-chip {
          font-size: 12px; color: #8b9ab5;
          background: #1e2d45; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 5px 12px;
          font-family: 'DM Mono', monospace;
        }

        /* ── Grid ── */
        .pay-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        /* ── Card ── */
        .pay-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 20px;
          display: flex; flex-direction: column;
          transition: border-color 0.2s, transform 0.15s;
          position: relative; overflow: hidden;
          animation: payFadeUp 0.4s ease both;
        }
        .pay-card::before {
          content: '';
          position: absolute; top: -30px; right: -30px;
          width: 90px; height: 90px; border-radius: 50%;
          background: radial-gradient(circle, rgba(79,142,255,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .pay-card:hover {
          border-color: rgba(79,142,255,0.35);
          transform: translateY(-2px);
        }
        @keyframes payFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Card header ── */
        .pay-card-head {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 10px;
          margin-bottom: 16px;
        }
        .pay-month {
          font-size: 16px; font-weight: 600; color: #f0f4ff;
          letter-spacing: -0.2px;
        }
        .pay-generated {
          font-size: 11px; color: #5a6a85; margin-top: 3px;
        }
        .pay-icon-box {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(79,142,255,0.1);
          border: 1px solid rgba(79,142,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; flex-shrink: 0;
        }

        /* ── Salary rows ── */
        .pay-salary-block {
          flex: 1;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 14px;
          margin-bottom: 16px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .pay-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }
        .pay-row-label { font-size: 12px; color: #5a6a85; font-weight: 500; }
        .pay-row-val {
          font-family: 'DM Mono', monospace;
          font-size: 13px; font-weight: 500; color: #f0f4ff;
        }
        .pay-row-val.deduct { color: #f87171; }

        .pay-net-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 10px; margin-top: 2px;
        }
        .pay-net-label { font-size: 13px; font-weight: 600; color: #f0f4ff; }
        .pay-net-val {
          font-family: 'DM Mono', monospace;
          font-size: 15px; font-weight: 600; color: #4f8eff;
        }

        /* ── Download button ── */
        .pay-dl-btn {
          width: 100%; display: flex; align-items: center;
          justify-content: center; gap: 7px;
          padding: 11px 16px;
          background: rgba(79,142,255,0.08);
          border: 1px solid rgba(79,142,255,0.25);
          border-radius: 10px;
          color: #6aa3ff; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer;
          transition: background 0.18s, border-color 0.18s, transform 0.1s;
          margin-top: auto;
        }
        .pay-dl-btn:hover {
          background: rgba(79,142,255,0.16);
          border-color: rgba(79,142,255,0.45);
        }
        .pay-dl-btn:active { transform: scale(0.97); }
        .pay-dl-icon { width: 15px; height: 15px; flex-shrink: 0; }

        /* ── Skeleton loader ── */
        .pay-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .pay-skeleton {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px; padding: 20px;
          height: 200px;
        }
        .skel-line {
          background: rgba(255,255,255,0.06);
          border-radius: 6px;
          animation: skelShim 1.4s ease infinite;
        }
        @keyframes skelShim {
          0%,100% { opacity: 0.5; } 50% { opacity: 1; }
        }

        /* ── Empty state ── */
        .pay-empty {
          background: rgba(26,35,54,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 64px 24px;
          text-align: center;
        }
        .pay-empty-icon { font-size: 42px; margin-bottom: 14px; }
        .pay-empty-title { font-size: 16px; font-weight: 600; color: #f0f4ff; margin-bottom: 6px; }
        .pay-empty-sub { font-size: 13px; color: #5a6a85; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .pay-grid, .pay-skeleton-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .pay-root { padding: 20px 14px 100px; }
          .pay-grid, .pay-skeleton-grid { grid-template-columns: 1fr; gap: 12px; }
          .pay-card { padding: 18px 16px; }
        }
        @media (max-width: 380px) {
          .pay-topbar h1 { font-size: 18px; }
        }
      `}</style>

      <div className="pay-root">

        {/* ── Top bar ── */}
        <div className="pay-topbar">
          <h1>My Payslips</h1>
          {!loading && payslips.length > 0 && (
            <div className="pay-count-chip">{payslips.length} payslip{payslips.length !== 1 ? 's' : ''}</div>
          )}
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="pay-skeleton-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="pay-skeleton" style={{ animationDelay: `${i * 60}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="skel-line" style={{ width: 110, height: 14, marginBottom: 8 }} />
                    <div className="skel-line" style={{ width: 80, height: 10 }} />
                  </div>
                  <div className="skel-line" style={{ width: 38, height: 38, borderRadius: 10 }} />
                </div>
                <div className="skel-line" style={{ width: '100%', height: 1, marginBottom: 14 }} />
                {[1, 2, 3].map((j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div className="skel-line" style={{ width: 60, height: 11 }} />
                    <div className="skel-line" style={{ width: 80, height: 11 }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && payslips.length === 0 && (
          <div className="pay-empty">
            <div className="pay-empty-icon">📄</div>
            <div className="pay-empty-title">No payslips yet</div>
            <div className="pay-empty-sub">Your payslips will appear here once HR processes your salary</div>
          </div>
        )}

        {/* ── Payslip cards ── */}
        {!loading && payslips.length > 0 && (
          <div className="pay-grid">
            {payslips.map((ps, idx) => {
              const monthName = new Date(2000, ps.month - 1).toLocaleString('default', { month: 'long' });
              return (
                <div
                  key={ps._id}
                  className="pay-card"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Header */}
                  <div className="pay-card-head">
                    <div>
                      <div className="pay-month">{monthName} {ps.year}</div>
                      <div className="pay-generated">Generated {formatDate(ps.generatedOn)}</div>
                    </div>
                    <div className="pay-icon-box">📄</div>
                  </div>

                  {/* Salary breakdown */}
                  {ps.payroll && (
                    <div className="pay-salary-block">
                      <div className="pay-row">
                        <span className="pay-row-label">Gross Salary</span>
                        <span className="pay-row-val">{formatINR(ps.payroll.grossSalary)}</span>
                      </div>
                      <div className="pay-row">
                        <span className="pay-row-label">Deductions</span>
                        <span className="pay-row-val deduct">− {formatINR(ps.payroll.totalDeductions)}</span>
                      </div>
                      <div className="pay-net-row">
                        <span className="pay-net-label">Net Pay</span>
                        <span className="pay-net-val">{formatINR(ps.payroll.netSalary)}</span>
                      </div>
                    </div>
                  )}

                  {/* Download */}
                  {ps.pdfPath && (
                    <button
                      className="pay-dl-btn"
                      onClick={() => handleDownload(ps.pdfPath, `payslip_${monthName}_${ps.year}.pdf`)}
                    >
                      <ArrowDownTrayIcon className="pay-dl-icon" />
                      Download PDF
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
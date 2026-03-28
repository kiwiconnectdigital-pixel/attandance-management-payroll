import { useState } from 'react';
import { ArrowDownTrayIcon, DocumentChartBarIcon, BanknotesIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getMonthOptions } from '../../utils/helpers';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function ReportsPage() {
  const [params, setParams] = useState({
    month: new Date().getMonth() + 1,
    year: CURRENT_YEAR,
  });
  const [downloading, setDownloading] = useState(null);

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
      title: 'Workforce Attendance',
      description: 'Comprehensive log of check-ins, late marks, and overtime hours across all departments.',
      type: 'attendance',
      formats: [
        { id: 'pdf',   label: 'Export PDF',   accent: '#f87171', accentBg: 'rgba(239,68,68,0.1)',   accentBorder: 'rgba(239,68,68,0.25)'  },
        { id: 'excel', label: 'Export Excel', accent: '#4ade80', accentBg: 'rgba(34,197,94,0.1)',   accentBorder: 'rgba(34,197,94,0.25)'  },
      ],
      Icon: DocumentChartBarIcon,
      iconBg: 'rgba(99,102,241,0.12)',
      iconBorder: 'rgba(99,102,241,0.25)',
      iconColor: '#a5b4fc',
      glowColor: 'rgba(99,102,241,0.15)',
    },
    {
      title: 'Financial Payroll',
      description: 'Granular breakdown of earnings, statutory deductions, and net disbursements.',
      type: 'payroll',
      formats: [
        { id: 'pdf', label: 'Export PDF', accent: '#f87171', accentBg: 'rgba(239,68,68,0.1)', accentBorder: 'rgba(239,68,68,0.25)' },
      ],
      Icon: BanknotesIcon,
      iconBg: 'rgba(34,197,94,0.12)',
      iconBorder: 'rgba(34,197,94,0.25)',
      iconColor: '#4ade80',
      glowColor: 'rgba(34,197,94,0.12)',
    },
  ];

  const scopeLabel = new Date(params.year, params.month - 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .rp-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          min-height: 100vh;
          padding: 28px 20px 100px;
          -webkit-font-smoothing: antialiased;
        }
        .rp-root *, .rp-root *::before, .rp-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Header ── */
        .rp-header { margin-bottom: 28px; }
        .rp-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 5vw, 30px);
          font-weight: 800; letter-spacing: -0.03em; line-height: 1.1;
        }
        .rp-title-accent { color: #818cf8; }
        .rp-subtitle { font-size: 14px; color: #5a6a85; margin-top: 6px; }

        /* ── Section label ── */
        .rp-section-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.28);
          margin-bottom: 12px;
        }

        /* ── Config bar ── */
        .rp-config {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 18px 20px;
          margin-bottom: 28px;
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
        }
        .rp-selects { display: flex; gap: 12px; flex: 1; min-width: 200px; }
        .rp-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .rp-field-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: rgba(255,255,255,0.3);
        }
        .rp-select {
          width: 100%; padding: 10px 14px;
          background: rgba(15,22,35,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #f0f4ff;
          font-size: 14px; font-family: 'DM Sans', system-ui, sans-serif;
          outline: none; -webkit-appearance: none;
          transition: border-color 0.15s;
          cursor: pointer;
        }
        .rp-select:focus { border-color: rgba(79,142,255,0.5); box-shadow: 0 0 0 3px rgba(79,142,255,0.1); }
        .rp-select option { background: #1a2336; }

        .rp-scope {
          display: flex; flex-direction: column; gap: 3px;
          padding: 10px 16px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .rp-scope-label { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .rp-scope-val {
          font-family: 'DM Mono', monospace;
          font-size: 14px; font-weight: 500; color: #818cf8;
        }

        /* ── Report cards grid ── */
        .rp-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        /* ── Report card ── */
        .rp-card {
          background: rgba(26,35,54,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 22px;
          position: relative; overflow: hidden;
          transition: border-color 0.2s, transform 0.18s;
          display: flex; flex-direction: column; gap: 18px;
          animation: rpFadeUp 0.4s ease both;
        }
        .rp-card:hover {
          border-color: rgba(255,255,255,0.14);
          transform: translateY(-2px);
        }
        @keyframes rpFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rp-card-glow {
          position: absolute; top: -30px; right: -30px;
          width: 110px; height: 110px; border-radius: 50%;
          filter: blur(40px); pointer-events: none;
        }

        .rp-card-head { display: flex; align-items: flex-start; gap: 14px; }
        .rp-icon-box {
          width: 42px; height: 42px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .rp-icon-box svg { width: 20px; height: 20px; }
        .rp-card-info { flex: 1; min-width: 0; }
        .rp-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700; color: #f0f4ff;
          letter-spacing: -0.2px; margin-bottom: 5px;
        }
        .rp-card-desc { font-size: 12px; color: #5a6a85; line-height: 1.55; }

        /* ── Format buttons ── */
        .rp-formats { display: flex; flex-wrap: wrap; gap: 8px; }
        .rp-fmt-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 14px; border-radius: 9px;
          font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer; border: 1px solid;
          transition: opacity 0.15s, transform 0.1s, background 0.15s;
          white-space: nowrap;
        }
        .rp-fmt-btn:hover:not(:disabled) { opacity: 0.85; }
        .rp-fmt-btn:active:not(:disabled) { transform: scale(0.96); }
        .rp-fmt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .rp-fmt-btn svg { width: 13px; height: 13px; flex-shrink: 0; }

        @keyframes rpPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .rp-fmt-btn.loading { animation: rpPulse 1.2s infinite; }

        /* ── Info banner ── */
        .rp-info {
          display: flex; align-items: flex-start; gap: 12px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 12px; padding: 14px 16px;
        }
        .rp-info svg { width: 16px; height: 16px; color: #818cf8; flex-shrink: 0; margin-top: 1px; }
        .rp-info p { font-size: 12px; color: rgba(165,180,252,0.8); line-height: 1.55; }
        .rp-info strong { color: #a5b4fc; }

        /* ── Responsive ── */
        @media (max-width: 700px) {
          .rp-grid { grid-template-columns: 1fr; }
          .rp-config { padding: 16px; gap: 12px; }
          .rp-scope { width: 100%; }
        }
        @media (max-width: 480px) {
          .rp-root { padding: 20px 14px 100px; }
          .rp-selects { gap: 8px; }
          .rp-card { padding: 18px 16px; }
          .rp-card-title { font-size: 15px; }
        }
        @media (max-width: 360px) {
          .rp-selects { flex-direction: column; }
          .rp-fmt-btn { font-size: 11px; padding: 8px 12px; }
        }
      `}</style>

      <div className="rp-root">

        {/* ── Header ── */}
        <div className="rp-header">
          <h1 className="rp-title">
            Report <span className="rp-title-accent">Vault</span>
          </h1>
          <p className="rp-subtitle">Generate and export certified organisational records.</p>
        </div>

        {/* ── Config bar ── */}
        <div className="rp-section-label">Export Configuration</div>
        <div className="rp-config">
          <div className="rp-selects">
            <div className="rp-field">
              <label className="rp-field-label">Month</label>
              <select
                className="rp-select"
                value={params.month}
                onChange={(e) => setParams((p) => ({ ...p, month: parseInt(e.target.value) }))}
              >
                {getMonthOptions().map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="rp-field">
              <label className="rp-field-label">Year</label>
              <select
                className="rp-select"
                value={params.year}
                onChange={(e) => setParams((p) => ({ ...p, year: parseInt(e.target.value) }))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rp-scope">
            <span className="rp-scope-label">Scope</span>
            <span className="rp-scope-val">{scopeLabel}</span>
          </div>
        </div>

        {/* ── Report cards ── */}
        <div className="rp-section-label">Available Reports</div>
        <div className="rp-grid">
          {reportCards.map((card, idx) => (
            <div
              key={card.type}
              className="rp-card"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Glow */}
              <div className="rp-card-glow" style={{ background: card.glowColor }} />

              {/* Head */}
              <div className="rp-card-head">
                <div
                  className="rp-icon-box"
                  style={{ background: card.iconBg, border: `1px solid ${card.iconBorder}`, color: card.iconColor }}
                >
                  <card.Icon />
                </div>
                <div className="rp-card-info">
                  <div className="rp-card-title">{card.title}</div>
                  <div className="rp-card-desc">{card.description}</div>
                </div>
              </div>

              {/* Format buttons */}
              <div className="rp-formats">
                {card.formats.map((fmt) => {
                  const key = `${card.type}-${fmt.id}`;
                  const isThis = downloading === key;
                  const anyLoading = !!downloading;
                  return (
                    <button
                      key={fmt.id}
                      className={`rp-fmt-btn${isThis ? ' loading' : ''}`}
                      style={{
                        background: fmt.accentBg,
                        borderColor: fmt.accentBorder,
                        color: fmt.accent,
                      }}
                      disabled={anyLoading}
                      onClick={() => downloadReport(card.type, fmt.id)}
                    >
                      <ArrowDownTrayIcon />
                      {isThis ? 'Generating…' : fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Info banner ── */}
        <div className="rp-info">
          <InformationCircleIcon />
          <p>
            <strong>Note:</strong> Attendance logs include cross-branch data. Payroll exports reflect <strong>finalised</strong> records only.
          </p>
        </div>

      </div>
    </>
  );
}
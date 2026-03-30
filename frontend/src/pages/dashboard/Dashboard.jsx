import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI, employeeAPI } from '../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

const fmt = (n) => (n ?? 0).toString().padStart(2, '0');

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,15,20,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '10px 16px',
      color: '#fff', fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ margin: 0, opacity: 0.5, marginBottom: 2 }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{payload[0].value}</p>
    </div>
  );
};

function Counter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = Math.ceil(target / 30);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 30);
    return () => clearInterval(id);
  }, [target]);
  return <>{val}</>;
}

function MetricCard({ label, value, icon, accent, delay = 0 }) {
  const accents = {
    blue:  { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.25)' },
    green: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
    red:   { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  };
  const c = accents[accent] ?? accents.blue;
  return (
    <div className="dash-metric-card" style={{ animationDelay: `${delay}ms` }}>
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 90, height: 90, borderRadius: '50%',
        background: c.bg, filter: 'blur(24px)', pointerEvents: 'none',
      }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, borderRadius: 12,
        background: c.bg, border: `1px solid ${c.border}`,
        fontSize: 17, marginBottom: 14, flexShrink: 0,
      }}>
        {icon}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '5px 0 0', fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
        <Counter target={value ?? 0} />
      </p>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 style={{
      margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
    }}>
      {children}
    </h2>
  );
}

function ActionPill({ href, label, icon, color }) {
  const colors = {
    indigo: { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.3)',  text: '#a5b4fc', hover: 'rgba(99,102,241,0.2)' },
    green:  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)',   text: '#86efac', hover: 'rgba(34,197,94,0.2)' },
    amber:  { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#fcd34d', hover: 'rgba(245,158,11,0.2)' },
  };
  const c = colors[color];
  return (
    <a
      href={href}
      className="dash-action-pill"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
      onMouseEnter={e => { e.currentTarget.style.background = c.hover; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.bg;    e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </a>
  );
}

function AttendanceRow({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
          {value} <span style={{ color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: color, transition: 'width 1s cubic-bezier(.22,.97,.46,1)',
        }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isHR } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [summaryRes, empRes] = await Promise.all([
          attendanceAPI.getTodaySummary(),
          employeeAPI.getAll({ limit: 1 }),
        ]);
        setStats({
          ...summaryRes.data.data,
          totalEmployees: empRes.data.data.pagination.total,
        });
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    if (isAdmin || isHR) fetchStats();
    else setLoading(false);
  }, []);

  const pieData = stats ? [
    { name: 'Present', value: stats.presentToday ?? 0 },
    { name: 'Absent',  value: stats.absentToday  ?? 0 },
    { name: 'Late',    value: stats.lateToday     ?? 0 },
  ] : [];
  const total = pieData.reduce((s, d) => s + d.value, 0);

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .dash-root {
          min-height: 100vh;
          background: #0a0a0f;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          padding: 32px 20px 100px;
          position: relative;
          overflow-x: hidden;
        }
        .dash-root::before {
          content: '';
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none; z-index: 0;
        }
        .dash-content { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; }

        /* ── Header ── */
        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 40px;
        }
        .dash-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(24px, 5vw, 34px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
        }
        .dash-title-accent {
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .dash-clock-box {
          padding: 12px 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          text-align: right;
          flex-shrink: 0;
        }
        .dash-clock-time {
          font-family: 'Syne', sans-serif;
          font-size: clamp(18px, 3.5vw, 26px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
          margin: 0;
        }
        .dash-clock-live {
          margin: 3px 0 0;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.06em;
        }

        /* ── Section gap ── */
        .dash-section { margin-bottom: 32px; }
        .dash-section-head { margin-bottom: 12px; }

        /* ── Metric grid ── */
        .dash-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .dash-metric-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px;
          padding: 20px 20px 18px;
          position: relative;
          overflow: hidden;
          animation: dashFadeUp 0.5s ease both;
        }
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Charts row ── */
        .dash-charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .dash-chart-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 24px;
        }
        .dash-chart-title {
          margin: 0 0 18px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: #fff;
        }
        .dash-pie-inner {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        /* ── Progress card ── */
        .dash-progress-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 24px;
        }

        /* ── Quick actions ── */
        .dash-actions-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
        }
        .dash-pills-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .dash-action-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s, transform 0.15s;
          white-space: nowrap;
        }

        /* recharts */
        .recharts-cartesian-axis-tick text { fill: rgba(255,255,255,0.35) !important; font-size: 11px !important; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line { stroke: rgba(255,255,255,0.05) !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        /* ── Tablet (≤ 900px) ── */
        @media (max-width: 900px) {
          .dash-root { padding: 24px 16px 100px; }
          .dash-metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .dash-charts-row { grid-template-columns: 1fr; }
        }

        /* ── Mobile (≤ 600px) ── */
        @media (max-width: 600px) {
          .dash-root { padding: 20px 14px 100px; }
          .dash-header { margin-bottom: 28px; }
          .dash-clock-box { width: 100%; text-align: left; }
          .dash-clock-time { font-size: 22px; }
          .dash-metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .dash-metric-card { padding: 16px 14px; border-radius: 14px; }
          .dash-chart-card { padding: 18px 16px; }
          .dash-progress-card { padding: 18px 16px; }
          .dash-actions-card { padding: 16px 18px; flex-direction: column; align-items: flex-start; }
          .dash-pie-inner { gap: 14px; }
          .dash-section { margin-bottom: 24px; }
        }

        /* ── Small phones (≤ 380px) ── */
        @media (max-width: 380px) {
          .dash-metrics-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .dash-metric-card { padding: 14px 12px; }
          .dash-action-pill { font-size: 12px; padding: 9px 13px; }
        }
      `}</style>

      <div className="dash-root">
        <div className="dash-content">

          {/* ── HEADER ── */}
          <div className="dash-header">
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {dateStr}
              </p>
              <h1 className="dash-title">
                {getGreeting()},&nbsp;
                <span className="dash-title-accent">
                  {user?.name?.split(' ')[0] ?? 'there'}
                </span>
              </h1>
              <p style={{ margin: '7px 0 0', color: 'rgba(255,255,255,0.32)', fontSize: 14 }}>
                Here's your workforce snapshot for today.
              </p>
            </div>
            <div className="dash-clock-box">
              <p className="dash-clock-time">{timeStr}</p>
              <p className="dash-clock-live">LIVE</p>
            </div>
          </div>

          {/* ── METRICS ── */}
          {(isAdmin || isHR) && !loading && stats && (
            <>
              <div className="dash-section">
                <div className="dash-section-head"><SectionHeading>Today's overview</SectionHeading></div>
                <div className="dash-metrics-grid">
                  <MetricCard label="Total Employees" value={stats.totalEmployees} icon="👥" accent="blue"  delay={0}   />
                  <MetricCard label="Present Today"   value={stats.presentToday}   icon="✅" accent="green" delay={80}  />
                  <MetricCard label="Absent Today"    value={stats.absentToday}    icon="❌" accent="red"   delay={160} />
                  <MetricCard label="Late Arrivals"   value={stats.lateToday}      icon="⏰" accent="amber" delay={240} />
                </div>
              </div>

              {/* ── CHARTS ── */}
              <div className="dash-section">
                <div className="dash-section-head"><SectionHeading>Attendance breakdown</SectionHeading></div>
                <div className="dash-charts-row">

                  {/* Pie */}
                  <div className="dash-chart-card">
                    <p className="dash-chart-title">Distribution</p>
                    <div className="dash-pie-inner">
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={64}
                            dataKey="value" strokeWidth={0}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1, minWidth: 100 }}>
                        {pieData.map((d, i) => (
                          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', flex: 1 }}>{d.name}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="dash-chart-card">
                    <p className="dash-chart-title">Bar View</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={pieData} barSize={28}>
                        <CartesianGrid strokeDasharray="0" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── PROGRESS ── */}
              <div className="dash-section">
                <div className="dash-section-head"><SectionHeading>Attendance rate</SectionHeading></div>
                <div className="dash-progress-card">
                  <AttendanceRow label="Present" value={stats.presentToday ?? 0} total={total} color="linear-gradient(90deg,#22c55e,#4ade80)" />
                  <AttendanceRow label="Absent"  value={stats.absentToday  ?? 0} total={total} color="linear-gradient(90deg,#ef4444,#f87171)" />
                  <AttendanceRow label="Late"    value={stats.lateToday    ?? 0} total={total} color="linear-gradient(90deg,#f59e0b,#fbbf24)" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
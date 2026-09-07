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

// ── Helper: get today's date string in local time (YYYY-MM-DD) ──
const getTodayLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ── Helper: resolve a date value that may be a MongoDB {$date:...} object or plain string/ISO ──
const resolveDate = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val.$date) return new Date(val.$date);
  return new Date(val);
};

// ── Helper: get today's date string in local time (YYYY-MM-DD) ──
const toLocalDateStr = (dateVal) => {
  const d = resolveDate(dateVal);
  if (!d || isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ── Helper: check if a record belongs to today ──
const isToday = (record) => {
  const todayStr = getTodayLocal();
  if (record.date) return toLocalDateStr(record.date) === todayStr;
  const firstCheckIn = record.checkIns?.[0]?.time;
  if (firstCheckIn) return toLocalDateStr(firstCheckIn) === todayStr;
  return false;
};

// ── Helper: derive display status from actual schema ──
const getDisplayStatus = (record) => {
  const rawStatus = record.status?.toLowerCase().trim();
  if (rawStatus === 'present') {
    return record.checkIns?.[0]?.isLate ? 'late' : 'present';
  }
  if (rawStatus === 'absent') return 'absent';
  return 'absent';
};

// ── Helper: get first check-in time ──
const getFirstCheckInTime = (record) => {
  const t = record.checkIns?.[0]?.time;
  return t ? resolveDate(t) : null;
};

// ── Helper: get late minutes ──
const getLateMinutes = (record) => {
  return record.checkIns?.[0]?.lateByMinutes ?? record.lateByMinutes ?? null;
};

// ── Helper: get last check-out time ──
// Handles both a dedicated checkOuts[] array and checkIns[n].checkOut nested structure
const getLastCheckOutTime = (record) => {
  // Option A: dedicated top-level checkOuts array with { time: ... }
  if (record.checkOuts?.length) {
    const last = record.checkOuts[record.checkOuts.length - 1];
    const t = last?.time ?? last;
    return t ? resolveDate(t) : null;
  }
  // Option B: checkOut nested inside each checkIn entry
  const times = record.checkIns
    ?.map(ci => ci.checkOut)
    .filter(Boolean);
  if (times?.length) return resolveDate(times[times.length - 1]);
  return null;
};

// ── Helper: format total working hours ──
const getWorkingHours = (record) => {
  // Prefer explicit totalMinutes / totalHours if backend sends them
  if (record.totalMinutes != null) {
    const h = Math.floor(record.totalMinutes / 60);
    const m = record.totalMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  if (record.totalHours != null) {
    const h = Math.floor(record.totalHours);
    const m = Math.round((record.totalHours - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  // Derive from first check-in → last check-out
  const inTime  = getFirstCheckInTime(record);
  const outTime = getLastCheckOutTime(record);
  if (!inTime || !outTime) return null;
  const diffMs = outTime - inTime;
  if (diffMs <= 0) return null;
  const totalMins = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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

const STATUS_TABS = [
  { key: 'present', label: 'Present', icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)'  },
  { key: 'absent',  label: 'Absent',  icon: '❌', color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)'  },
  { key: 'late',    label: 'Late',    icon: '⏰', color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
];

function EmployeeStatusPanel({ todayRecords, loadingRecords }) {
  const [activeTab, setActiveTab] = useState('present');

  const todayOnly = todayRecords.filter(isToday);

  const byStatus = todayOnly.filter((r) => {
    const hasCheckIn = r.checkIns?.length > 0;
    if (activeTab === 'present') return hasCheckIn && !r.isLate;
    if (activeTab === 'late')    return hasCheckIn && r.isLate === true;
    if (activeTab === 'absent')  return !hasCheckIn;
    return false;
  });

  const counts = {
    present: todayOnly.filter(r => r.checkIns?.length > 0 && !r.isLate).length,
    late:    todayOnly.filter(r => r.checkIns?.length > 0 && r.isLate === true).length,
    absent:  todayOnly.filter(r => !r.checkIns?.length).length,
  };

  const activeConf = STATUS_TABS.find(t => t.key === activeTab);

  const fmtTime = (dateVal) => {
    const d = resolveDate(dateVal);
    if (!d || isNaN(d)) return '—';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '4px 4px 0',
        gap: 2,
      }}>
        {STATUS_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '11px 10px',
                background: isActive ? tab.bg : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                borderRadius: isActive ? '10px 10px 0 0' : '10px 10px 0 0',
                color: isActive ? tab.color : 'rgba(255,255,255,0.35)',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
              <span style={{
                padding: '1px 7px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: isActive ? `${tab.color}22` : 'rgba(255,255,255,0.06)',
                color: isActive ? tab.color : 'rgba(255,255,255,0.3)',
                border: `1px solid ${isActive ? tab.color + '44' : 'transparent'}`,
              }}>
                {counts[tab.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Employee list */}
      <div style={{ padding: '8px 0', minHeight: 180 }}>
        {loadingRecords ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Loading…
          </div>
        ) : byStatus.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
              No {activeTab} employees today
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {byStatus.map((record, idx) => (
              <div
                key={record._id ?? idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 18px',
                  borderBottom: idx < byStatus.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: `${activeConf.color}18`,
                  border: `1px solid ${activeConf.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: activeConf.color,
                  fontFamily: "'Syne', sans-serif",
                }}>
                  {record.employee?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>

                {/* Name + dept */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {record.employee?.name ?? '—'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {record.employee?.department ?? '—'}
                  </p>
                </div>

                {/* Times + hours */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>

                  {/* Check-in */}
                  {getFirstCheckInTime(record) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>IN</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: activeTab === 'late' ? '#fbbf24' : '#4ade80',
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {fmtTime(getFirstCheckInTime(record))}
                      </span>
                      {activeTab === 'late' && getLateMinutes(record) ? (
                        <span style={{
                          padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                          background: 'rgba(245,158,11,0.1)', color: '#fbbf24',
                          border: '1px solid rgba(245,158,11,0.2)',
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          +{getLateMinutes(record)}m
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Check-out */}
                  {getLastCheckOutTime(record) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>OUT</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: '#818cf8',
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {fmtTime(getLastCheckOutTime(record))}
                      </span>
                    </div>
                  ) : getFirstCheckInTime(record) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>OUT</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>—</span>
                  )}

                  {/* Working hours */}
                  {getWorkingHours(record) && (
                    <span style={{
                      padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {getWorkingHours(record)}
                    </span>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isHR } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [todayRecords, setTodayRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

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

  useEffect(() => {
    if (!(isAdmin || isHR)) return;
    const fetchTodayRecords = async () => {
      setLoadingRecords(true);
      try {
        const todayStr = getTodayLocal();
        const res = await attendanceAPI.getAll({ date: todayStr, limit: 500 });
        const raw = res.data.data?.records ?? res.data.data ?? [];
        const filtered = raw.filter(isToday);
        setTodayRecords(filtered);
      } catch {
        // silently fail — non-critical
      } finally {
        setLoadingRecords(false);
      }
    };
    fetchTodayRecords();
  }, [isAdmin, isHR]);

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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');

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

        .dash-header {
          display: flex; justify-content: space-between;
          align-items: flex-start; flex-wrap: wrap;
          gap: 16px; margin-bottom: 40px;
        }
        .dash-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(24px, 5vw, 34px);
          font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; margin: 0;
        }
        .dash-title-accent {
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .dash-clock-box {
          padding: 12px 18px; border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          text-align: right; flex-shrink: 0;
        }
        .dash-clock-time {
          font-family: 'Syne', sans-serif;
          font-size: clamp(18px, 3.5vw, 26px);
          font-weight: 800; letter-spacing: -0.02em; color: #fff; margin: 0;
        }
        .dash-clock-live { margin: 3px 0 0; font-size: 10px; color: rgba(255,255,255,0.3); letter-spacing: 0.06em; }

        .dash-section { margin-bottom: 32px; }
        .dash-section-head { margin-bottom: 12px; }

        .dash-metrics-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
        }
        .dash-metric-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 18px; padding: 20px 20px 18px;
          position: relative; overflow: hidden;
          animation: dashFadeUp 0.5s ease both;
        }
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .dash-charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .dash-chart-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 24px;
        }
        .dash-chart-title { margin: 0 0 18px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: #fff; }
        .dash-pie-inner { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }

        .dash-progress-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 24px;
        }

        .dash-actions-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px; padding: 20px 24px;
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 14px;
        }
        .dash-pills-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .dash-action-pill {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 16px; border-radius: 999px;
          text-decoration: none; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.2s, transform 0.15s; white-space: nowrap;
        }

        .recharts-cartesian-axis-tick text { fill: rgba(255,255,255,0.35) !important; font-size: 11px !important; }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line { stroke: rgba(255,255,255,0.05) !important; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        @media (max-width: 900px) {
          .dash-root { padding: 24px 16px 100px; }
          .dash-metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .dash-charts-row { grid-template-columns: 1fr; }
        }
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
                {getGreeting()}&nbsp;
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
                  <div className="dash-chart-card">
                    <p className="dash-chart-title">Distribution</p>
                    <div className="dash-pie-inner">
                     // ✅ FIX: Make it responsive with a parent container
<div style={{ width: '100%', height: '100%', minHeight: 200 }}>
  <ResponsiveContainer>
    <PieChart>
      <Pie 
        data={pieData} 
        cx="50%" 
        cy="50%" 
        innerRadius={42} 
        outerRadius={64}
        dataKey="value" 
        strokeWidth={0}
      >
        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
      </Pie>
      <Tooltip content={<CustomTooltip />} />
    </PieChart>
  </ResponsiveContainer>
</div>
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

              {/* ── EMPLOYEE STATUS BREAKDOWN ── */}
              <div className="dash-section">
                <div className="dash-section-head"><SectionHeading>Who's present · absent · late</SectionHeading></div>
                <EmployeeStatusPanel
                  todayRecords={todayRecords}
                  loadingRecords={loadingRecords}
                />
              </div>
            </>
          )}

          {/* ── QUICK ACTIONS ── */}
          <div className="dash-section">
            <div className="dash-section-head"><SectionHeading>Quick actions</SectionHeading></div>
            <div className="dash-actions-card">
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.38)' }}>
                Jump to a section
              </p>
              <div className="dash-pills-row">
                <ActionPill href="/attendance" label="Mark Attendance" icon="🗓️" color="indigo" />
                <ActionPill href="/leaves"     label="Apply Leave"     icon="🌿" color="green"  />
                <ActionPill href="/payslips"   label="View Payslips"   icon="💳" color="amber"  />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
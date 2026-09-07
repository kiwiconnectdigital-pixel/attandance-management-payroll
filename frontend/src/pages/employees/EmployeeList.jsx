import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll({ search });
      setEmployees(res.data.data.employees);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEmployees(); }, [search]);

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this employee?')) return;
    try {
      await employeeAPI.delete(id);
      toast.success('Employee deactivated');
      fetchEmployees();
    } catch { toast.error('Failed to deactivate'); }
  };

 // ✅ FIX: Add safety checks for salary
const totalSalary = (emp) => {
  const salary = emp.salary || {};
  return (salary.basic || 0) + 
         (salary.hra || 0) + 
         (salary.da || 0) + 
         (salary.ta || 0) + 
         (salary.other || 0);
};

  const activeCount = employees.filter(e => e.isActive).length;
  const inactiveCount = employees.length - activeCount;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        .emp-root * { box-sizing: border-box; margin: 0; padding: 0; }

        .emp-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          min-height: 100vh;
          padding-bottom: 60px;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Top Bar ── */
        .emp-topbar {
          position: sticky; top: 0; z-index: 40;
          background: rgba(15,22,35,0.88);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 14px 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .emp-topbar h1 {
          font-size: 18px; font-weight: 600; letter-spacing: -0.3px;
        }
        .emp-add-btn {
          display: flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, #2563eb, #4f8eff);
          border: none; border-radius: 10px;
          padding: 9px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px; font-weight: 600; color: #fff;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(79,142,255,0.28);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .emp-add-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(79,142,255,0.38);
        }
        .emp-add-btn:active { transform: scale(0.97); }
        .emp-add-btn svg { width: 15px; height: 15px; }

        /* ── Page ── */
        .emp-page { padding: 20px; max-width: 1100px; margin: 0 auto; }

        /* ── Stats Row ── */
        .emp-stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; margin-bottom: 20px;
        }
        .emp-stat-card {
          background: linear-gradient(135deg, #1a2336 0%, #1e2d45 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 16px 18px;
          position: relative; overflow: hidden;
        }
        .emp-stat-card::after {
          content: '';
          position: absolute; bottom: -20px; right: -20px;
          width: 70px; height: 70px;
          border-radius: 50%;
          pointer-events: none;
        }
        .emp-stat-card.total::after { background: radial-gradient(circle, rgba(79,142,255,0.18) 0%, transparent 70%); }
        .emp-stat-card.active-card::after { background: radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 70%); }
        .emp-stat-card.inactive-card::after { background: radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%); }

        .emp-stat-label {
          font-size: 10px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.9px; color: #5a6a85; margin-bottom: 6px;
        }
        .emp-stat-val {
          font-family: 'DM Mono', monospace;
          font-size: 30px; font-weight: 400; line-height: 1;
        }
        .emp-stat-val.blue { color: #4f8eff; }
        .emp-stat-val.green { color: #22c55e; }
        .emp-stat-val.red { color: #ef4444; }
        .emp-stat-sub { font-size: 11px; color: #5a6a85; margin-top: 4px; }

        /* ── Search ── */
        .emp-search-wrap {
          position: relative; margin-bottom: 20px;
        }
        .emp-search-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          width: 15px; height: 15px; color: #5a6a85; pointer-events: none;
        }
        .emp-search-input {
          width: 100%;
          background: #1a2336;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 12px 16px 12px 42px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; color: #f0f4ff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .emp-search-input::placeholder { color: #5a6a85; }
        .emp-search-input:focus {
          border-color: rgba(79,142,255,0.4);
          box-shadow: 0 0 0 3px rgba(79,142,255,0.08);
        }

        /* ── Section title ── */
        .emp-section-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 1px; color: #8b9ab5;
          margin-bottom: 12px; padding: 0 2px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .emp-section-count {
          font-size: 11px; color: #4f8eff; font-weight: 500;
          text-transform: none; letter-spacing: 0;
          background: rgba(79,142,255,0.1);
          border: 1px solid rgba(79,142,255,0.15);
          border-radius: 20px; padding: 2px 10px;
        }

        /* ── Employee Cards ── */
        .emp-list { display: flex; flex-direction: column; gap: 8px; }

        .emp-card {
          background: rgba(26,35,54,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          display: grid;
          grid-template-columns: 44px 1fr auto auto auto auto;
          align-items: center;
          gap: 0;
          padding: 0;
          overflow: hidden;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          animation: emp-fadeIn 0.3s ease both;
        }
        .emp-card:hover {
          background: #1a2336;
          border-color: rgba(79,142,255,0.2);
          transform: translateX(2px);
        }

        @keyframes emp-fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* stagger animation */
        .emp-card:nth-child(1) { animation-delay: 0.04s; }
        .emp-card:nth-child(2) { animation-delay: 0.08s; }
        .emp-card:nth-child(3) { animation-delay: 0.12s; }
        .emp-card:nth-child(4) { animation-delay: 0.16s; }
        .emp-card:nth-child(5) { animation-delay: 0.20s; }

        /* left accent bar */
        .emp-card-accent {
          width: 4px; height: 100%; align-self: stretch;
          background: linear-gradient(180deg, #2563eb, #4f8eff);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .emp-card:hover .emp-card-accent { opacity: 1; }

        .emp-card-main {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px 14px 12px;
          min-width: 0;
        }

        .emp-avatar {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600; color: #f0f4ff;
          background: linear-gradient(135deg, #1e3a5f, #2563eb);
          border: 1px solid rgba(79,142,255,0.25);
          letter-spacing: -0.5px;
        }

        .emp-name-block { min-width: 0; }
        .emp-name {
          font-size: 14px; font-weight: 600; color: #f0f4ff;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .emp-email {
          font-size: 11px; color: #5a6a85; margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .emp-code-pill {
          font-family: 'DM Mono', monospace;
          font-size: 11px; font-weight: 500; color: #4f8eff;
          background: rgba(79,142,255,0.1);
          border: 1px solid rgba(79,142,255,0.15);
          border-radius: 6px; padding: 2px 8px;
          margin-top: 4px; display: inline-block;
        }

        .emp-cell {
          padding: 14px 18px;
          border-left: 1px solid rgba(255,255,255,0.05);
          min-width: 0;
        }
        .emp-cell-label {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px;
          color: #5a6a85; font-weight: 600; margin-bottom: 3px;
        }
        .emp-cell-val {
          font-size: 13px; color: #c4cfe8; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .emp-cell-val.salary {
          font-family: 'DM Mono', monospace;
          font-size: 13px; color: #f0f4ff;
        }

        .emp-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
          padding: 3px 10px; border-radius: 20px;
        }
        .emp-status-badge.active { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
        .emp-status-badge.inactive { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
        .emp-status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .emp-status-dot.active { background: #22c55e; animation: emp-pulse 2s infinite; }
        .emp-status-dot.inactive { background: #ef4444; }
        @keyframes emp-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

        .emp-actions {
          display: flex; align-items: center; gap: 4px;
          padding: 14px 14px 14px 10px;
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .emp-icon-btn {
          width: 30px; height: 30px; border-radius: 8px;
          border: 1px solid transparent;
          background: transparent; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #5a6a85;
          transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
        }
        .emp-icon-btn svg { width: 15px; height: 15px; }
        .emp-icon-btn:active { transform: scale(0.9); }

        .emp-icon-btn.view:hover {
          background: rgba(79,142,255,0.12); color: #4f8eff;
          border-color: rgba(79,142,255,0.2);
        }
        .emp-icon-btn.edit:hover {
          background: rgba(245,158,11,0.12); color: #f59e0b;
          border-color: rgba(245,158,11,0.2);
        }
        .emp-icon-btn.del:hover {
          background: rgba(239,68,68,0.12); color: #ef4444;
          border-color: rgba(239,68,68,0.2);
        }

        /* ── Loading skeleton ── */
        .emp-skeleton {
          background: rgba(26,35,54,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 16px 20px;
          display: flex; align-items: center; gap: 14px;
        }
        .emp-skel-circle {
          width: 40px; height: 40px; border-radius: 12px;
          background: #243047;
          animation: emp-shimmer 1.5s infinite;
          flex-shrink: 0;
        }
        .emp-skel-lines { flex: 1; display: flex; flex-direction: column; gap: 7px; }
        .emp-skel-line {
          height: 10px; border-radius: 6px;
          background: #243047;
          animation: emp-shimmer 1.5s infinite;
        }
        .emp-skel-line.short { width: 40%; }
        @keyframes emp-shimmer {
          0%,100% { opacity: 0.5; } 50% { opacity: 1; }
        }

        /* ── Empty ── */
        .emp-empty {
          text-align: center; padding: 60px 20px;
          color: #5a6a85; font-size: 14px;
        }
        .emp-empty-icon {
          font-size: 40px; margin-bottom: 12px; opacity: 0.4;
        }

        /* ── Column header row (desktop) ── */
        .emp-col-header {
          display: grid;
          grid-template-columns: 44px 1fr auto auto auto auto;
          padding: 0;
          margin-bottom: 6px;
        }
        .emp-col-h {
          font-size: 9px; font-weight: 700; letter-spacing: 1px;
          text-transform: uppercase; color: #3d4f6a;
          padding: 0 18px;
        }
        .emp-col-h.first { padding-left: 60px; }

        /* ── Responsive ── */
        @media (max-width: 860px) {
          .emp-card {
            grid-template-columns: 4px 1fr;
            display: flex; flex-wrap: wrap;
          }
          .emp-card-accent { width: 4px; min-height: 100%; border-radius: 0; flex-shrink: 0; align-self: stretch; }
          .emp-card-main { flex: 1; min-width: 0; }
          .emp-cell { border-left: none; border-top: 1px solid rgba(255,255,255,0.05); flex: 1; min-width: 120px; }
          .emp-actions { border-left: none; border-top: 1px solid rgba(255,255,255,0.05); width: 100%; justify-content: flex-end; padding: 10px 14px; }
          .emp-col-header { display: none; }
          .emp-stats-row { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 480px) {
          .emp-stats-row { grid-template-columns: 1fr 1fr; }
          .emp-stat-card:last-child { grid-column: span 2; }
          .emp-topbar h1 { font-size: 16px; }
          .emp-add-btn span { display: none; }
          .emp-add-btn { padding: 9px 12px; }
        }
      `}</style>

      <div className="emp-root">
        {/* ── Top Bar ── */}
        <div className="emp-topbar">
          <h1>Employees</h1>
          <button className="emp-add-btn" onClick={() => navigate('/employees/new')}>
            <PlusIcon />
            <span>Add Employee</span>
          </button>
        </div>

        <div className="emp-page">

          {/* ── Stats ── */}
          <div className="emp-stats-row">
            <div className="emp-stat-card total">
              <div className="emp-stat-label">Total</div>
              <div className="emp-stat-val blue">{String(employees.length).padStart(2,'0')}</div>
              <div className="emp-stat-sub">All employees</div>
            </div>
            <div className="emp-stat-card active-card">
              <div className="emp-stat-label">Active</div>
              <div className="emp-stat-val green">{String(activeCount).padStart(2,'0')}</div>
              <div className="emp-stat-sub">Currently working</div>
            </div>
            <div className="emp-stat-card inactive-card">
              <div className="emp-stat-label">Inactive</div>
              <div className="emp-stat-val red">{String(inactiveCount).padStart(2,'0')}</div>
              <div className="emp-stat-sub">Deactivated</div>
            </div>
          </div>

          {/* ── Search ── */}
          <div className="emp-search-wrap">
            <MagnifyingGlassIcon className="emp-search-icon" />
            <input
              className="emp-search-input"
              placeholder="Search by name, email, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* ── Section title ── */}
          <div className="emp-section-title">
            All Employees
            <span className="emp-section-count">{employees.length} records</span>
          </div>

          {/* ── Column headers (desktop) ── */}
          <div className="emp-col-header">
            <div />
            <div className="emp-col-h first">Name / Code</div>
            <div className="emp-col-h">Department</div>
            <div className="emp-col-h">Branch</div>
            <div className="emp-col-h">Salary</div>
            <div className="emp-col-h">Status</div>
          </div>

          {/* ── List ── */}
          <div className="emp-list">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="emp-skeleton" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="emp-skel-circle" />
                  <div className="emp-skel-lines">
                    <div className="emp-skel-line" />
                    <div className="emp-skel-line short" />
                  </div>
                </div>
              ))
            ) : employees.length === 0 ? (
              <div className="emp-empty">
                <div className="emp-empty-icon">👥</div>
                No employees found
              </div>
            ) : (
              employees.map((emp) => {
                const initials = emp.name.split(' ').map(n => n[0]).slice(0, 2).join('');
                const sal = totalSalary(emp);
                return (
                  <div key={emp._id} className="emp-card">
                    <div className="emp-card-accent" />

                    {/* Name + Code */}
                    <div className="emp-card-main">
                      <div className="emp-avatar">{initials}</div>
                      <div className="emp-name-block">
                        <div className="emp-name">{emp.name}</div>
                        <div className="emp-email">{emp.email}</div>
                        <span className="emp-code-pill">{emp.employeeCode}</span>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="emp-cell">
                      <div className="emp-cell-label">Dept</div>
                      <div className="emp-cell-val">{emp.department}</div>
                    </div>

                    {/* Branch */}
                    <div className="emp-cell">
                      <div className="emp-cell-label">Branch</div>
                      <div className="emp-cell-val">{emp.branch?.name || '—'}</div>
                    </div>

                    {/* Salary */}
                    <div className="emp-cell">
                      <div className="emp-cell-label">Salary</div>
                      <div className="emp-cell-val salary">₹{sal.toLocaleString('en-IN')}</div>
                    </div>

                    {/* Status */}
                    <div className="emp-cell">
                      <div className="emp-cell-label">Status</div>
                      <span className={`emp-status-badge ${emp.isActive ? 'active' : 'inactive'}`}>
                        <span className={`emp-status-dot ${emp.isActive ? 'active' : 'inactive'}`} />
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="emp-actions">
                      <button className="emp-icon-btn view" title="View" onClick={() => navigate(`/employees/${emp._id}`)}>
                        <EyeIcon />
                      </button>
                      <button className="emp-icon-btn edit" title="Edit" onClick={() => navigate(`/employees/${emp._id}/edit`)}>
                        <PencilIcon />
                      </button>
                      <button className="emp-icon-btn del" title="Deactivate" onClick={() => handleDelete(emp._id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
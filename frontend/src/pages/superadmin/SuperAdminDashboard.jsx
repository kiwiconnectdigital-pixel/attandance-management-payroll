import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { companyAPI, branchAPI, userAPI, employeeAPI } from "../../services/api";
import {
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  UsersIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

.sad-root * { box-sizing: border-box; margin: 0; padding: 0; }

.sad-root {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #0f1623;
  color: #f0f4ff;
  min-height: 100vh;
  padding-bottom: 90px;
  -webkit-font-smoothing: antialiased;
}

.sad-topbar {
  position: sticky; top: 0; z-index: 40;
  background: rgba(15,22,35,0.88);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 14px 20px;
}
.sad-topbar h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
.sad-topbar p { font-size: 12px; color: #5a6a85; margin-top: 2px; }

.sad-page { padding: 20px; max-width: 1100px; margin: 0 auto; }

.sad-stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;
}
@media (max-width: 800px) { .sad-stats-grid { grid-template-columns: 1fr 1fr; } }

.sad-stat-card {
  background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px; padding: 18px;
  display: flex; flex-direction: column; gap: 10px;
  position: relative; overflow: hidden;
}
.sad-stat-icon {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(79,142,255,0.12); color: #4f8eff;
}
.sad-stat-icon svg { width: 18px; height: 18px; }
.sad-stat-val { font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 500; color: #f0f4ff; line-height: 1; }
.sad-stat-label { font-size: 12px; color: #8b9ab5; }

.sad-section-title {
  font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
  color: #8b9ab5; margin-bottom: 12px;
}

.sad-quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 24px; }
@media (max-width: 600px) { .sad-quick-grid { grid-template-columns: 1fr; } }

.sad-quick-card {
  background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 20px;
  display: flex; align-items: center; justify-content: space-between;
  text-decoration: none; color: inherit;
  transition: border-color 0.2s, transform 0.15s;
}
.sad-quick-card:hover { border-color: rgba(79,142,255,0.3); transform: translateY(-1px); }
.sad-quick-left { display: flex; align-items: center; gap: 14px; }
.sad-quick-icon {
  width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(79,142,255,0.12); color: #4f8eff; flex-shrink: 0;
}
.sad-quick-icon svg { width: 20px; height: 20px; }
.sad-quick-title { font-size: 14px; font-weight: 600; color: #f0f4ff; }
.sad-quick-sub { font-size: 12px; color: #5a6a85; margin-top: 2px; }
.sad-quick-arrow { color: #5a6a85; flex-shrink: 0; }
.sad-quick-arrow svg { width: 16px; height: 16px; }

.sad-list-wrap {
  background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; overflow: hidden;
}
.sad-list-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.sad-list-row:last-child { border-bottom: none; }
.sad-list-name { font-size: 13px; font-weight: 600; color: #f0f4ff; }
.sad-list-sub { font-size: 11.5px; color: #5a6a85; margin-top: 2px; }
.sad-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
.sad-pill.active { background: rgba(34,197,94,0.12); color: #22c55e; }
.sad-pill.inactive { background: rgba(239,68,68,0.1); color: #f87171; }

.sad-empty { text-align: center; padding: 40px 20px; color: #5a6a85; font-size: 13px; }
`;

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    companies: 0,
    activeCompanies: 0,
    branches: 0,
    accounts: 0,
    employees: 0,
  });
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        companyAPI.getAll(),
        branchAPI.getAll(),
        userAPI.getAll({ role: "admin,hr" }),
        employeeAPI.getAll(),
      ]);

      const companies =
        results[0].status === "fulfilled" ? results[0].value.data?.data || [] : [];
      const branches =
        results[1].status === "fulfilled" ? results[1].value.data?.data || [] : [];
      const accounts =
        results[2].status === "fulfilled" ? results[2].value.data?.data || [] : [];
      const employees =
        results[3].status === "fulfilled"
          ? results[3].value.data?.data?.employees ||
            results[3].value.data?.data ||
            []
          : [];

      setStats({
        companies: companies.length,
        activeCompanies: companies.filter((c) => c.status !== "inactive").length,
        branches: branches.length,
        accounts: accounts.length,
        employees: Array.isArray(employees) ? employees.length : 0,
      });

      setRecentCompanies(
        [...companies]
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 5),
      );
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="sad-root">
      <style>{CSS}</style>

      <div className="sad-topbar">
        <h1>Super Admin</h1>
        <p>Platform-wide overview across all companies</p>
      </div>

      <div className="sad-page">
        <div className="sad-stats-grid">
          <div className="sad-stat-card">
            <div className="sad-stat-icon">
              <BuildingOffice2Icon />
            </div>
            <div className="sad-stat-val">{loading ? "—" : stats.companies}</div>
            <div className="sad-stat-label">
              Companies · {stats.activeCompanies} active
            </div>
          </div>
          <div className="sad-stat-card">
            <div className="sad-stat-icon">
              <BuildingOfficeIcon />
            </div>
            <div className="sad-stat-val">{loading ? "—" : stats.branches}</div>
            <div className="sad-stat-label">Branches</div>
          </div>
          <div className="sad-stat-card">
            <div className="sad-stat-icon">
              <ShieldCheckIcon />
            </div>
            <div className="sad-stat-val">{loading ? "—" : stats.accounts}</div>
            <div className="sad-stat-label">Admin / HR Accounts</div>
          </div>
          <div className="sad-stat-card">
            <div className="sad-stat-icon">
              <UsersIcon />
            </div>
            <div className="sad-stat-val">{loading ? "—" : stats.employees}</div>
            <div className="sad-stat-label">Employees</div>
          </div>
        </div>

        <div className="sad-section-title">Quick Actions</div>
        <div className="sad-quick-grid">
          <Link to="/super-admin/companies" className="sad-quick-card">
            <div className="sad-quick-left">
              <div className="sad-quick-icon">
                <BuildingOffice2Icon />
              </div>
              <div>
                <div className="sad-quick-title">Manage Companies</div>
                <div className="sad-quick-sub">Add, edit or deactivate companies</div>
              </div>
            </div>
            <div className="sad-quick-arrow">
              <ArrowRightIcon />
            </div>
          </Link>

          <Link to="/super-admin/accounts" className="sad-quick-card">
            <div className="sad-quick-left">
              <div className="sad-quick-icon">
                <ShieldCheckIcon />
              </div>
              <div>
                <div className="sad-quick-title">Manage Accounts</div>
                <div className="sad-quick-sub">Create Admin &amp; HR logins</div>
              </div>
            </div>
            <div className="sad-quick-arrow">
              <ArrowRightIcon />
            </div>
          </Link>
        </div>

        <div className="sad-section-title">Recently Added Companies</div>
        <div className="sad-list-wrap">
          {loading ? (
            <div className="sad-empty">Loading…</div>
          ) : recentCompanies.length === 0 ? (
            <div className="sad-empty">No companies yet.</div>
          ) : (
            recentCompanies.map((c) => (
              <div className="sad-list-row" key={c._id}>
                <div>
                  <div className="sad-list-name">{c.name}</div>
                  <div className="sad-list-sub">{c.code}</div>
                </div>
                <span
                  className={`sad-pill ${c.status === "inactive" ? "inactive" : "active"}`}
                >
                  {c.status === "inactive" ? "Inactive" : "Active"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

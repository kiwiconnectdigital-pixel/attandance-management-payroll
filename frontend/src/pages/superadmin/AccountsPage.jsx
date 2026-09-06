import { useState, useEffect } from "react";
import { userAPI, companyAPI } from "../../services/api";
import {
  PlusIcon,
  TrashIcon,
  KeyIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "admin",
  companyId: "",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

.sa-root * { box-sizing: border-box; margin: 0; padding: 0; }

.sa-root {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #0f1623;
  color: #f0f4ff;
  min-height: 100vh;
  padding-bottom: 90px;
  -webkit-font-smoothing: antialiased;
}

.sa-topbar {
  position: sticky; top: 0; z-index: 40;
  background: rgba(15,22,35,0.88);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.sa-topbar h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
.sa-topbar p { font-size: 12px; color: #5a6a85; margin-top: 2px; }

.sa-add-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 16px; border: none; cursor: pointer;
  background: #4f8eff; color: #fff;
  border-radius: 10px; font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; font-weight: 600;
  transition: background 0.15s, transform 0.1s;
}
.sa-add-btn:hover { background: #3a7aee; }
.sa-add-btn:active { transform: scale(0.97); }
.sa-add-btn svg { width: 15px; height: 15px; }

.sa-page { padding: 20px; max-width: 1100px; margin: 0 auto; }

.sa-filter-row { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.sa-filter-pill {
  padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: 1px solid rgba(255,255,255,0.08);
  background: #1a2336; color: #8b9ab5;
  transition: background 0.15s, color 0.15s;
}
.sa-filter-pill.active { background: rgba(79,142,255,0.15); color: #4f8eff; border-color: rgba(79,142,255,0.3); }

.sa-table-wrap {
  background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; overflow: hidden;
}
.sa-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sa-table thead { background: #161e2e; }
.sa-table th {
  text-align: left; padding: 12px 16px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.6px; color: #5a6a85;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.sa-table td {
  padding: 13px 16px; color: #d7e0f0; border-bottom: 1px solid rgba(255,255,255,0.05);
  vertical-align: middle;
}
.sa-table tr:last-child td { border-bottom: none; }
.sa-table tr:hover td { background: rgba(255,255,255,0.02); }

.sa-user-cell { display: flex; align-items: center; gap: 10px; }
.sa-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #4f8eff, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff;
}
.sa-user-name { font-weight: 600; color: #f0f4ff; }
.sa-user-email { font-size: 11.5px; color: #5a6a85; }

.sa-role-pill {
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
  text-transform: capitalize;
}
.sa-role-pill.admin { background: rgba(79,142,255,0.12); color: #4f8eff; }
.sa-role-pill.hr { background: rgba(168,85,247,0.12); color: #c084fc; }

.sa-status-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; cursor: pointer; }
.sa-status-pill.active { background: rgba(34,197,94,0.12); color: #22c55e; }
.sa-status-pill.inactive { background: rgba(239,68,68,0.1); color: #f87171; }

.sa-row-actions { display: flex; gap: 2px; justify-content: flex-end; }
.sa-icon-btn {
  width: 30px; height: 30px; border: none; cursor: pointer;
  background: transparent; color: #5a6a85; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.sa-icon-btn.key:hover { background: rgba(234,179,8,0.12); color: #eab308; }
.sa-icon-btn.del:hover { background: rgba(239,68,68,0.12); color: #f87171; }
.sa-icon-btn svg { width: 15px; height: 15px; }

.sa-empty { text-align: center; padding: 60px 20px; color: #5a6a85; font-size: 14px; }
.sa-empty-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.4; }

.sa-modal-body { display: flex; flex-direction: column; gap: 14px; }
.sa-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media(max-width:480px){ .sa-field-grid { grid-template-columns: 1fr; } }

.sa-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #8b9ab5; margin-bottom: 5px; }
.sa-label .req { color: #f87171; margin-left: 2px; }

.sa-input, .sa-select {
  width: 100%; background: #0f1623;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 10px 12px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; color: #f0f4ff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.sa-input::placeholder { color: #3a4a60; }
.sa-input:focus, .sa-select:focus { border-color: #4f8eff; box-shadow: 0 0 0 3px rgba(79,142,255,0.12); }
.sa-select option { background: #0f1623; }

.sa-role-toggle { display: flex; gap: 8px; }
.sa-role-btn {
  flex: 1; padding: 10px; text-align: center; border-radius: 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.1); background: #0f1623; color: #8b9ab5;
  font-size: 13px; font-weight: 600; transition: all 0.15s;
}
.sa-role-btn.selected.admin { background: rgba(79,142,255,0.15); border-color: #4f8eff; color: #4f8eff; }
.sa-role-btn.selected.hr { background: rgba(168,85,247,0.15); border-color: #a855f7; color: #c084fc; }

.sa-modal-actions { display: flex; gap: 10px; padding-top: 4px; }
.sa-btn-primary {
  flex: 1; padding: 12px; border: none; cursor: pointer;
  background: #4f8eff; color: #fff;
  border-radius: 10px; font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px; font-weight: 600;
  transition: background 0.15s, transform 0.1s;
}
.sa-btn-primary:hover { background: #3a7aee; }
.sa-btn-primary:active { transform: scale(0.98); }
.sa-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.sa-btn-secondary {
  flex: 1; padding: 12px;
  background: #243047; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; cursor: pointer;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px; font-weight: 500; color: #8b9ab5;
  transition: background 0.15s;
}
.sa-btn-secondary:hover { background: #1a2336; color: #f0f4ff; }

@media (max-width: 700px) {
  .sa-table th:nth-child(3), .sa-table td:nth-child(3) { display: none; }
  .sa-page { padding: 16px; }
}
`;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getAll({ role: "company_admin,hr,employee" });
      // ✅ FIX: Ensure accounts is always an array
      const data = res.data?.data || [];
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await companyAPI.getAll();
      // ✅ FIX: Access companies from data.companies
      const data = res.data?.data?.companies || res.data?.companies || [];
      setCompanies(Array.isArray(data) ? data : []);
    } catch {
      // If companies can't load, creation form will just show no options
      setCompanies([]);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadCompanies();
  }, []);

  const openCreate = () => {
    // ✅ FIX: Use company.id (not _id)
    setForm({ ...emptyForm, companyId: companies[0]?.id || "" });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Name, email and password are required");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await userAPI.create(form);
      toast.success(`${form.role === "admin" ? "Admin" : "HR"} account created`);
      setModalOpen(false);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (account) => {
    // ✅ FIX: Use is_active instead of status
    const next = account.is_active === false ? true : false;
    const statusText = next ? "active" : "inactive";
    try {
      await userAPI.updateStatus(account.id, next);
      toast.success(`Account marked ${statusText}`);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await userAPI.delete(deleteTarget.id);
      toast.success("Account deleted");
      setDeleteTarget(null);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete account");
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await userAPI.resetPassword(resetTarget.id, newPassword);
      toast.success("Password reset");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    }
  };

  // ✅ FIX: Safe filter with array check
  const filtered = Array.isArray(accounts) 
    ? accounts.filter((a) => roleFilter === "all" || a.role === roleFilter)
    : [];

  const initials = (name) =>
    name
      ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
      : "?";

  // ✅ FIX: Use company.id (not _id)
  const companyName = (id) =>
    Array.isArray(companies) 
      ? companies.find((c) => c.id === id)?.name || "—"
      : "—";

  return (
    <div className="sa-root">
      <style>{CSS}</style>

      <div className="sa-topbar">
        <div>
          <h1>Admin &amp; HR Accounts</h1>
          <p>Create and manage administrator and HR logins across companies</p>
        </div>
        <button className="sa-add-btn" onClick={openCreate}>
          <PlusIcon /> New Account
        </button>
      </div>

      <div className="sa-page">
        <div className="sa-filter-row">
          {["all", "admin", "hr"].map((r) => (
            <div
              key={r}
              className={`sa-filter-pill ${roleFilter === r ? "active" : ""}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === "all" ? "All" : r === "admin" ? "Admins" : "HR"}
            </div>
          ))}
        </div>

        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Company</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="sa-empty">
                    Loading accounts…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-empty">
                    <div className="sa-empty-icon">👤</div>
                    No accounts found.
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => (
                  <tr key={acc.id}>
                    <td>
                      <div className="sa-user-cell">
                        <div className="sa-avatar">{initials(acc.name)}</div>
                        <div>
                          <div className="sa-user-name">{acc.name}</div>
                          <div className="sa-user-email">{acc.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`sa-role-pill ${acc.role}`}>{acc.role}</span>
                    </td>
                    <td>{acc.companyName || companyName(acc.companyId)}</td>
                    <td>
                      <span
                        className={`sa-status-pill ${acc.is_active === false ? "inactive" : "active"}`}
                        onClick={() => handleToggleStatus(acc)}
                        title="Click to toggle"
                      >
                        {acc.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="sa-row-actions">
                        <button
                          className="sa-icon-btn key"
                          aria-label="Reset password"
                          onClick={() => setResetTarget(acc)}
                        >
                          <KeyIcon />
                        </button>
                        <button
                          className="sa-icon-btn del"
                          aria-label="Delete"
                          onClick={() => setDeleteTarget(acc)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Account"
      >
        <form className="sa-modal-body" onSubmit={handleSubmit}>
          <div>
            <label className="sa-label">Role</label>
            <div className="sa-role-toggle">
              <div
                className={`sa-role-btn admin ${form.role === "admin" ? "selected admin" : ""}`}
                onClick={() => setForm({ ...form, role: "admin" })}
              >
                Admin
              </div>
              <div
                className={`sa-role-btn hr ${form.role === "hr" ? "selected hr" : ""}`}
                onClick={() => setForm({ ...form, role: "hr" })}
              >
                HR
              </div>
            </div>
          </div>

          <div>
            <label className="sa-label">
              Full Name<span className="req">*</span>
            </label>
            <input
              className="sa-input"
              placeholder="Jane Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="sa-field-grid">
            <div>
              <label className="sa-label">
                Email<span className="req">*</span>
              </label>
              <input
                type="email"
                className="sa-input"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="sa-label">
                Temp Password<span className="req">*</span>
              </label>
              <input
                type="text"
                className="sa-input"
                placeholder="min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="sa-label">Company</label>
            <select
              className="sa-select"
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            >
              <option value="">— Select company —</option>
              {Array.isArray(companies) && companies.map((c) => (
                // ✅ FIX: Use company.id (not _id)
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sa-modal-actions">
            <button
              type="button"
              className="sa-btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="sa-btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setNewPassword("");
        }}
        title={`Reset Password — ${resetTarget?.name || ""}`}
        size="sm"
      >
        <div className="sa-modal-body">
          <div>
            <label className="sa-label">New Password</label>
            <input
              type="text"
              className="sa-input"
              placeholder="min. 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="sa-modal-actions">
            <button
              className="sa-btn-secondary"
              onClick={() => {
                setResetTarget(null);
                setNewPassword("");
              }}
            >
              Cancel
            </button>
            <button className="sa-btn-primary" onClick={handleResetPassword}>
              Reset Password
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Account"
        size="sm"
      >
        <div className="sa-modal-body">
          <p style={{ fontSize: 13, color: "#8b9ab5", lineHeight: 1.6 }}>
            Are you sure you want to delete{" "}
            <strong style={{ color: "#f0f4ff" }}>{deleteTarget?.name}</strong>?
            They will immediately lose access to the platform.
          </p>
          <div className="sa-modal-actions">
            <button className="sa-btn-secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              className="sa-btn-primary"
              style={{ background: "#ef4444" }}
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
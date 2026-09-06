import { useState, useEffect } from "react";
import { companyAPI, branchAPI } from "../../services/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";

const emptyForm = { name: "", code: "", email: "", phone: "" };

// ── Scoped CSS (mirrors the Branches page dark theme) ──────────────
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

.sa-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.sa-stat-card { background: #1a2336; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; }
.sa-stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; color: #5a6a85; margin-bottom: 4px; }
.sa-stat-val { font-family: 'DM Mono', monospace; font-size: 26px; font-weight: 500; color: #f0f4ff; line-height: 1; }

.sa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

.sa-card {
  background: #1a2336; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 18px 18px 14px;
  display: flex; flex-direction: column;
  transition: border-color 0.2s, transform 0.15s;
  position: relative; overflow: hidden;
}
.sa-card::before {
  content: ''; position: absolute; top: -30px; right: -30px;
  width: 90px; height: 90px;
  background: radial-gradient(circle, rgba(79,142,255,0.1) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.sa-card:hover { border-color: rgba(79,142,255,0.3); transform: translateY(-1px); }

.sa-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.sa-card-name { font-size: 15px; font-weight: 600; color: #f0f4ff; letter-spacing: -0.2px; }
.sa-card-code {
  font-size: 11px; font-family: 'DM Mono', monospace;
  background: #243047; color: #8b9ab5;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 2px 8px; border-radius: 6px; margin-top: 4px; display: inline-block;
}

.sa-card-actions { display: flex; gap: 2px; }
.sa-icon-btn {
  width: 30px; height: 30px; border: none; cursor: pointer;
  background: transparent; color: #5a6a85; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.sa-icon-btn.edit:hover { background: rgba(59,130,246,0.12); color: #60a5fa; }
.sa-icon-btn.del:hover { background: rgba(239,68,68,0.12); color: #f87171; }
.sa-icon-btn svg { width: 15px; height: 15px; }

.sa-card-info { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.sa-info-row { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #8b9ab5; }
.sa-info-row svg { width: 13px; height: 13px; flex-shrink: 0; }

.sa-card-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px; margin-top: auto;
  display: flex; align-items: center; justify-content: space-between;
}
.sa-branch-count { font-size: 12px; color: #5a6a85; }
.sa-branch-count strong { color: #8b9ab5; font-weight: 500; }

.sa-status-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; cursor: pointer; }
.sa-status-pill.active { background: rgba(34,197,94,0.12); color: #22c55e; }
.sa-status-pill.inactive { background: rgba(239,68,68,0.1); color: #f87171; }

.sa-empty { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #5a6a85; font-size: 14px; }
.sa-empty-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.4; }

.sa-modal-body { display: flex; flex-direction: column; gap: 14px; }
.sa-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media(max-width:480px){ .sa-field-grid { grid-template-columns: 1fr; } }

.sa-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #8b9ab5; margin-bottom: 5px; }
.sa-label .req { color: #f87171; margin-left: 2px; }

.sa-input {
  width: 100%; background: #0f1623;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 10px 12px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; color: #f0f4ff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.sa-input::placeholder { color: #3a4a60; }
.sa-input:focus { border-color: #4f8eff; box-shadow: 0 0 0 3px rgba(79,142,255,0.12); }

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

@media (max-width: 600px) {
  .sa-stats-row { grid-template-columns: 1fr 1fr 1fr; }
  .sa-stat-val { font-size: 20px; }
  .sa-page { padding: 16px; }
}
@media (max-width: 360px) {
  .sa-stats-row { grid-template-columns: 1fr; }
}
`;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [branchCounts, setBranchCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

 const loadCompanies = async () => {
  setLoading(true);
  try {
    const res = await companyAPI.getAll();
    // ✅ FIX: Access companies from data.companies (not data.data)
    const data = res.data?.data?.companies || res.data?.companies || [];
    setCompanies(Array.isArray(data) ? data : []);
  } catch (err) {
    toast.error(err.response?.data?.message || "Failed to load companies");
    setCompanies([]);
  } finally {
    setLoading(false);
  }
};

const loadBranchCounts = async () => {
  try {
    const res = await branchAPI.getAll();
    // ✅ FIX: Branches are directly in data array
    const branches = res.data?.data || [];
    const counts = {};
    if (Array.isArray(branches)) {
      branches.forEach((b) => {
        // ✅ FIX: Use company_id (not companyId or company._id)
        const cid = b.company_id || b.company?.id;
        if (cid) counts[cid] = (counts[cid] || 0) + 1;
      });
    }
    setBranchCounts(counts);
  } catch {
    // Non-critical — branch counts are a nice-to-have on this page
  }
};

  useEffect(() => {
    loadCompanies();
    loadBranchCounts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (company) => {
    setEditingId(company._id);
    setForm({
      name: company.name || "",
      code: company.code || "",
      email: company.email || "",
      phone: company.phone || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Company name and code are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await companyAPI.update(editingId, form);
        toast.success("Company updated");
      } else {
        await companyAPI.create(form);
        toast.success("Company created");
      }
      setModalOpen(false);
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (company) => {
    const next = company.status === "inactive" ? "active" : "inactive";
    try {
      await companyAPI.updateStatus(company._id, next);
      toast.success(`Company marked ${next}`);
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await companyAPI.delete(deleteTarget._id);
      toast.success("Company deleted");
      setDeleteTarget(null);
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete company");
    }
  };

  // ✅ FIX: Safe access with optional chaining and fallback
  const activeCount = Array.isArray(companies) 
    ? companies.filter((c) => c.status !== "inactive").length 
    : 0;
    
  const totalBranches = Object.values(branchCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="sa-root">
      <style>{CSS}</style>

      <div className="sa-topbar">
        <div>
          <h1>Companies</h1>
          <p>Manage every company/tenant on the platform</p>
        </div>
        <button className="sa-add-btn" onClick={openCreate}>
          <PlusIcon /> Add Company
        </button>
      </div>

      <div className="sa-page">
        <div className="sa-stats-row">
          <div className="sa-stat-card">
            <div className="sa-stat-label">Total Companies</div>
            <div className="sa-stat-val">{Array.isArray(companies) ? companies.length : 0}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Active</div>
            <div className="sa-stat-val">{activeCount}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Total Branches</div>
            <div className="sa-stat-val">{totalBranches}</div>
          </div>
        </div>

        <div className="sa-grid">
          {loading ? (
            <div className="sa-empty">Loading companies…</div>
          ) : !Array.isArray(companies) || companies.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-icon">🏢</div>
              No companies yet. Add your first one to get started.
            </div>
          ) : (
            companies.map((company) => (
              <div className="sa-card" key={company._id}>
                <div className="sa-card-top">
                  <div>
                    <div className="sa-card-name">{company.name}</div>
                    <span className="sa-card-code">{company.code}</span>
                  </div>
                  <div className="sa-card-actions">
                    <button
                      className="sa-icon-btn edit"
                      onClick={() => openEdit(company)}
                      aria-label="Edit"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className="sa-icon-btn del"
                      onClick={() => setDeleteTarget(company)}
                      aria-label="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="sa-card-info">
                  {company.email && (
                    <div className="sa-info-row">
                      <EnvelopeIcon /> {company.email}
                    </div>
                  )}
                  {company.phone && (
                    <div className="sa-info-row">
                      <PhoneIcon /> {company.phone}
                    </div>
                  )}
                </div>

                <div className="sa-card-footer">
                  <div className="sa-branch-count">
                    <strong>{branchCounts[company._id] || 0}</strong> branch
                    {(branchCounts[company._id] || 0) === 1 ? "" : "es"}
                  </div>
                  <span
                    className={`sa-status-pill ${company.status === "inactive" ? "inactive" : "active"}`}
                    onClick={() => handleToggleStatus(company)}
                    title="Click to toggle"
                  >
                    {company.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Company" : "Add Company"}
      >
        <form className="sa-modal-body" onSubmit={handleSubmit}>
          <div>
            <label className="sa-label">
              Company Name<span className="req">*</span>
            </label>
            <input
              className="sa-input"
              placeholder="Acme Corp"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="sa-field-grid">
            <div>
              <label className="sa-label">
                Company Code<span className="req">*</span>
              </label>
              <input
                className="sa-input"
                placeholder="ACME"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="sa-label">Phone</label>
              <input
                className="sa-input"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="sa-label">Contact Email</label>
            <input
              type="email"
              className="sa-input"
              placeholder="contact@acme.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Company"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Company"
        size="sm"
      >
        <div className="sa-modal-body">
          <p style={{ fontSize: 13, color: "#8b9ab5", lineHeight: 1.6 }}>
            Are you sure you want to delete{" "}
            <strong style={{ color: "#f0f4ff" }}>{deleteTarget?.name}</strong>?
            This will not affect existing employee records, but the company
            will no longer be assignable to branches or accounts.
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
import { useState, useEffect, useRef } from "react";
import { branchAPI, employeeAPI } from "../../services/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MapPinIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
};

const emptyForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
};

const emptyGeo = {
  enabled: false,
  latitude: "",
  longitude: "",
  radiusMeters: 100,
  address: "",
};

// ── Scoped CSS ──────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

.br-root * { box-sizing: border-box; margin: 0; padding: 0; }

.br-root {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #0f1623;
  color: #f0f4ff;
  min-height: 100vh;
  padding-bottom: 90px;
  -webkit-font-smoothing: antialiased;
}

/* ── Top Bar ── */
.br-topbar {
  position: sticky; top: 0; z-index: 40;
  background: rgba(15,22,35,0.88);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.br-topbar h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }

.br-add-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 16px; border: none; cursor: pointer;
  background: #4f8eff; color: #fff;
  border-radius: 10px; font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; font-weight: 600;
  transition: background 0.15s, transform 0.1s;
}
.br-add-btn:hover { background: #3a7aee; }
.br-add-btn:active { transform: scale(0.97); }
.br-add-btn svg { width: 15px; height: 15px; }

/* ── Page ── */
.br-page { padding: 20px; max-width: 1100px; margin: 0 auto; }

/* ── Stats row ── */
.br-stats-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 10px; margin-bottom: 20px;
}
.br-stat-card {
  background: #1a2336;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 14px 16px;
}
.br-stat-label { font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; color: #5a6a85; margin-bottom: 4px; }
.br-stat-val { font-family: 'DM Mono', monospace; font-size: 26px; font-weight: 500; color: #f0f4ff; line-height: 1; }

/* ── Grid ── */
.br-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

/* ── Branch Card ── */
.br-card {
  background: #1a2336;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 18px 18px 14px;
  display: flex; flex-direction: column; gap: 0;
  transition: border-color 0.2s, transform 0.15s;
  position: relative; overflow: hidden;
}
.br-card::before {
  content: '';
  position: absolute; top: -30px; right: -30px;
  width: 90px; height: 90px;
  background: radial-gradient(circle, rgba(79,142,255,0.1) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.br-card:hover { border-color: rgba(79,142,255,0.3); transform: translateY(-1px); }

.br-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.br-card-name { font-size: 15px; font-weight: 600; color: #f0f4ff; letter-spacing: -0.2px; }
.br-card-code {
  font-size: 11px; font-family: 'DM Mono', monospace;
  background: #243047; color: #8b9ab5;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 2px 8px; border-radius: 6px; margin-top: 4px; display: inline-block;
}

.br-card-actions { display: flex; gap: 2px; }
.br-icon-btn {
  width: 30px; height: 30px; border: none; cursor: pointer;
  background: transparent; color: #5a6a85; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.br-icon-btn:hover.edit { background: rgba(59,130,246,0.12); color: #60a5fa; }
.br-icon-btn:hover.geo  { background: rgba(79,142,255,0.12); color: #4f8eff; }
.br-icon-btn:hover.del  { background: rgba(239,68,68,0.12); color: #f87171; }
.br-icon-btn svg { width: 15px; height: 15px; }

.br-card-info { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.br-info-row { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; color: #8b9ab5; line-height: 1.4; }
.br-info-icon { font-size: 12px; flex-shrink: 0; margin-top: 1px; }

.br-geo-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500; color: #4f8eff;
  background: rgba(79,142,255,0.1);
  border: 1px solid rgba(79,142,255,0.2);
  padding: 3px 9px; border-radius: 20px; margin-bottom: 8px;
}
.br-geo-badge svg { width: 12px; height: 12px; }

.br-card-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px; margin-top: auto;
  display: flex; align-items: center; justify-content: space-between;
}
.br-emp-count { font-size: 12px; color: #5a6a85; }
.br-emp-count strong { color: #8b9ab5; font-weight: 500; }

.br-status-pill {
  font-size: 11px; font-weight: 600;
  padding: 3px 9px; border-radius: 20px;
}
.br-status-pill.active { background: rgba(34,197,94,0.12); color: #22c55e; }
.br-status-pill.inactive { background: rgba(239,68,68,0.1); color: #f87171; }

/* ── Empty State ── */
.br-empty {
  grid-column: 1/-1; text-align: center;
  padding: 60px 20px; color: #5a6a85; font-size: 14px;
}
.br-empty-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.4; }

/* ── Modal overrides (dark) ── */
.br-modal-body { display: flex; flex-direction: column; gap: 14px; }

.br-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media(max-width:480px){ .br-field-grid { grid-template-columns: 1fr; } }

.br-label {
  display: block; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.6px;
  color: #8b9ab5; margin-bottom: 5px;
}
.br-label .req { color: #f87171; margin-left: 2px; }

.br-input, .br-textarea {
  width: 100%;
  background: #0f1623;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 10px 12px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; color: #f0f4ff;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.br-input::placeholder, .br-textarea::placeholder { color: #3a4a60; }
.br-input:focus, .br-textarea:focus {
  border-color: #4f8eff;
  box-shadow: 0 0 0 3px rgba(79,142,255,0.12);
}
.br-textarea { resize: none; }

/* Toggle */
.br-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px;
  background: #243047;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; cursor: pointer;
}
.br-toggle-label { font-size: 14px; font-weight: 500; color: #f0f4ff; }
.br-toggle-sub { font-size: 12px; color: #8b9ab5; margin-top: 2px; }
.br-toggle-track {
  width: 44px; height: 24px; border-radius: 12px;
  position: relative; flex-shrink: 0;
  transition: background 0.2s;
}
.br-toggle-track.on { background: #4f8eff; }
.br-toggle-track.off { background: #243047; border: 1px solid rgba(255,255,255,0.1); }
.br-toggle-thumb {
  position: absolute; top: 3px; width: 18px; height: 18px;
  background: #fff; border-radius: 50%;
  transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.br-toggle-thumb.on { transform: translateX(23px); }
.br-toggle-thumb.off { transform: translateX(3px); }

/* GPS button */
.br-gps-btn {
  width: 100%; padding: 11px;
  border: 1.5px dashed rgba(79,142,255,0.4);
  background: transparent; border-radius: 12px;
  color: #4f8eff; font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 13px; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background 0.15s, border-color 0.15s;
}
.br-gps-btn:hover { background: rgba(79,142,255,0.07); border-color: rgba(79,142,255,0.6); }
.br-gps-btn svg { width: 15px; height: 15px; }

.br-location-search {
  display: flex;
  gap: 8px;
}

.br-location-search .br-input {
  flex: 1;
}

.br-geo-helper {
  margin-top: 6px;
  font-size: 11px;
  color: #5a6a85;
}

/* Map */
.br-map-wrap {
  border-radius: 12px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.07);
  height: 240px;
}
.br-map-hint { text-align: center; font-size: 11px; color: #5a6a85; margin-top: 4px; }

/* Radius slider */
.br-slider-label { font-size: 12px; color: #8b9ab5; margin-bottom: 6px; }
.br-slider-label strong { color: #4f8eff; }
.br-slider { width: 100%; accent-color: #4f8eff; }
.br-slider-ticks { display: flex; justify-content: space-between; font-size: 10px; color: #3a4a60; margin-top: 3px; }

/* Geo preview */
.br-geo-preview {
  background: rgba(79,142,255,0.07);
  border: 1px solid rgba(79,142,255,0.15);
  border-radius: 12px; padding: 12px 14px;
  font-size: 12px; color: #8b9ab5; line-height: 1.6;
}
.br-geo-preview strong { color: #f0f4ff; font-weight: 500; }
.br-geo-preview .geo-title { font-size: 13px; font-weight: 600; color: #4f8eff; margin-bottom: 4px; }

/* Modal action buttons */
.br-modal-actions { display: flex; gap: 10px; padding-top: 4px; }
.br-btn-primary {
  flex: 1; padding: 12px; border: none; cursor: pointer;
  background: #4f8eff; color: #fff;
  border-radius: 10px; font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px; font-weight: 600;
  transition: background 0.15s, transform 0.1s;
}
.br-btn-primary:hover { background: #3a7aee; }
.br-btn-primary:active { transform: scale(0.98); }
.br-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.br-btn-secondary {
  flex: 1; padding: 12px;
  background: #243047; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; cursor: pointer;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 14px; font-weight: 500; color: #8b9ab5;
  transition: background 0.15s;
}
.br-btn-secondary:hover { background: #1a2336; color: #f0f4ff; }

/* ── Responsive ── */
@media (max-width: 600px) {
  .br-stats-row { grid-template-columns: 1fr 1fr 1fr; }
  .br-stat-val { font-size: 20px; }
  .br-page { padding: 16px; }
}
@media (max-width: 360px) {
  .br-stats-row { grid-template-columns: 1fr; }
}
`;

export default function BranchPage() {
  const [branches, setBranches] = useState([]);
  const [branchStats, setBranchStats] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [geoModal, setGeoModal] = useState(false);
  const [geoTarget, setGeoTarget] = useState(null);
  const [geoForm, setGeoForm] = useState(emptyGeo);
  const [locationQuery, setLocationQuery] = useState("");
  const [geoSearchLoading, setGeoSearchLoading] = useState(false);
  const mapRef = useRef(null);

  const fetchBranches = async () => {
    try {
      const res = await branchAPI.getAll();
      setBranches(res.data.data);
      const stats = {};
      await Promise.all(
        res.data.data.map(async (b) => {
          const emp = await employeeAPI.getAll({ branch: b._id, limit: 1 });
          stats[b._id] = emp.data.data.pagination.total;
        }),
      );
      setBranchStats(stats);
    } catch {
      toast.error("Failed to load branches");
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openGeoModal = (branch) => {
    setGeoTarget(branch);
    setGeoForm({
      enabled: branch.geofence?.enabled ?? false,
      latitude: branch.geofence?.latitude ?? "",
      longitude: branch.geofence?.longitude ?? "",
      radiusMeters: branch.geofence?.radiusMeters ?? 100,
      address: branch.geofence?.address ?? "",
    });
    setLocationQuery(
      branch.geofence?.address ||
        `${branch.address || ""}, ${branch.city || ""}, ${branch.state || ""}`,
    );
    setGeoModal(true);
  };

  const handleMapClick = ({ lat, lng }) => {
    setGeoForm((f) => ({ ...f, latitude: lat, longitude: lng }));
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeoForm((f) => ({ ...f, latitude, longitude }));
        if (mapRef.current) mapRef.current.setView([latitude, longitude], 17);
        toast.success("Location captured");
      },
      () => toast.error("Location access denied"),
    );
  };

  const autoSelectLocationFromText = async () => {
    const query = locationQuery.trim();
    if (!query) {
      toast.error("Enter a location to auto-select");
      return;
    }

    setGeoSearchLoading(true);
    try {
      const normalized = query.replace(/\s+/g, " ").replace(/,+/g, ",").trim();

      const parts = normalized
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const simplified =
        parts.length > 3 ? parts.slice(0, 3).join(", ") : normalized;
      const noPincode = normalized
        .replace(/\b\d{6}\b/g, "")
        .replace(/\s+,/g, ",")
        .replace(/,+/g, ",")
        .trim();
      const trailingThree =
        parts.length >= 3 ? parts.slice(-3).join(", ") : normalized;
      const fallbackWithCountry = /india$/i.test(simplified)
        ? simplified
        : `${simplified}, India`;
      const trailingWithCountry = /india$/i.test(trailingThree)
        ? trailingThree
        : `${trailingThree}, India`;
      const noPincodeWithCountry = /india$/i.test(noPincode)
        ? noPincode
        : `${noPincode}, India`;

      const queries = [
        normalized,
        simplified,
        noPincode,
        noPincodeWithCountry,
        trailingThree,
        trailingWithCountry,
        fallbackWithCountry,
      ].filter(Boolean);
      let results = [];

      for (const q of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`,
        );

        if (!res.ok) {
          continue;
        }

        const parsed = await res.json();
        if (Array.isArray(parsed) && parsed.length > 0) {
          results = parsed;
          break;
        }
      }

      if (results.length === 0) {
        toast.error(
          "Location not found. Try shorter text like: Awadhpuri Chowk, Bhopal",
        );
        return;
      }

      const { lat, lon, display_name: displayName } = results[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        toast.error("Unable to parse location coordinates");
        return;
      }

      setGeoForm((f) => ({
        ...f,
        latitude,
        longitude,
        address: f.address || displayName || query,
      }));

      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 17);
      }

      toast.success("Location selected from text");
    } catch {
      toast.error("Failed to fetch location from text");
    } finally {
      setGeoSearchLoading(false);
    }
  };

  const handleGeoSave = async (e) => {
    e.preventDefault();
    try {
      await branchAPI.updateGeofence(geoTarget._id, geoForm);
      toast.success("Geofence saved");
      setGeoModal(false);
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save geofence");
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };
  const openEdit = (branch) => {
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      pincode: branch.pincode || "",
      phone: branch.phone || "",
      email: branch.email || "",
    });
    setEditingId(branch._id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await branchAPI.update(editingId, form);
        toast.success("Branch updated");
      } else {
        await branchAPI.create(form);
        toast.success("Branch created");
      }
      setModalOpen(false);
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save branch");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deactivate this branch?")) return;
    try {
      await branchAPI.delete(id);
      toast.success("Branch deactivated");
      fetchBranches();
    } catch {
      toast.error("Failed to deactivate branch");
    }
  };

  const mapCenter =
    geoForm.latitude && geoForm.longitude
      ? [parseFloat(geoForm.latitude), parseFloat(geoForm.longitude)]
      : [20.5937, 78.9629];

  const totalEmployees = Object.values(branchStats).reduce((a, b) => a + b, 0);
  const activeCount = branches.filter((b) => b.isActive).length;
  const geoCount = branches.filter((b) => b.geofence?.enabled).length;

  const fields = [
    {
      label: "Branch Name",
      name: "name",
      required: true,
      placeholder: "Head Office",
      col: "full",
    },
    { label: "Branch Code", name: "code", required: true, placeholder: "HQ" },
    { label: "City", name: "city", required: true, placeholder: "Mumbai" },
    {
      label: "State",
      name: "state",
      required: true,
      placeholder: "Maharashtra",
    },
    {
      label: "Pincode",
      name: "pincode",
      required: false,
      placeholder: "400001",
    },
    {
      label: "Phone",
      name: "phone",
      required: false,
      placeholder: "022-12345678",
    },
  ];

  return (
    <>
      <style>{CSS}</style>

      <div className="br-root">
        {/* ── Top Bar ── */}
        <div className="br-topbar">
          <h1>Branches</h1>
          <button className="br-add-btn" onClick={openCreate}>
            <PlusIcon />
            Add Branch
          </button>
        </div>

        <div className="br-page">
          {/* ── Stats ── */}
          <div className="br-stats-row">
            <div className="br-stat-card">
              <div className="br-stat-label">Total</div>
              <div className="br-stat-val">{branches.length}</div>
            </div>
            <div className="br-stat-card">
              <div className="br-stat-label">Employees</div>
              <div className="br-stat-val">{totalEmployees}</div>
            </div>
            <div className="br-stat-card">
              <div className="br-stat-label">Geofenced</div>
              <div className="br-stat-val">{geoCount}</div>
            </div>
          </div>

          {/* ── Branch Grid ── */}
          <div className="br-grid">
            {branches.length === 0 ? (
              <div className="br-empty">
                <div className="br-empty-icon">🏢</div>
                No branches yet. Create your first branch.
              </div>
            ) : (
              branches.map((branch) => (
                <div key={branch._id} className="br-card">
                  <div className="br-card-top">
                    <div>
                      <div className="br-card-name">{branch.name}</div>
                      <div className="br-card-code">{branch.code}</div>
                    </div>
                    <div className="br-card-actions">
                      <button
                        className="br-icon-btn edit"
                        title="Edit"
                        onClick={() => openEdit(branch)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        className="br-icon-btn geo"
                        title="Geofence"
                        onClick={() => openGeoModal(branch)}
                      >
                        <MapPinIcon />
                      </button>
                      <button
                        className="br-icon-btn del"
                        title="Deactivate"
                        onClick={() => handleDelete(branch._id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  <div className="br-card-info">
                    <div className="br-info-row">
                      <span className="br-info-icon">📍</span>
                      <span>
                        {branch.address}, {branch.city}, {branch.state}
                      </span>
                    </div>
                    {branch.phone && (
                      <div className="br-info-row">
                        <span className="br-info-icon">📞</span>
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="br-info-row">
                        <span className="br-info-icon">✉️</span>
                        <span>{branch.email}</span>
                      </div>
                    )}
                  </div>

                  {branch.geofence?.enabled && (
                    <div className="br-geo-badge">
                      <SignalIcon />
                      {branch.geofence.radiusMeters}m geofence
                    </div>
                  )}

                  <div className="br-card-footer">
                    <span className="br-emp-count">
                      <strong>{branchStats[branch._id] || 0}</strong> employees
                    </span>
                    <span
                      className={`br-status-pill ${branch.isActive ? "active" : "inactive"}`}
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Branch" : "Add New Branch"}
      >
        <form onSubmit={handleSubmit}>
          <div className="br-modal-body">
            {/* Name — full width */}
            <div>
              <label className="br-label">
                Branch Name <span className="req">*</span>
              </label>
              <input
                className="br-input"
                type="text"
                value={form.name}
                required
                placeholder="Head Office"
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="br-field-grid">
              {fields
                .filter((f) => f.col !== "full")
                .map(({ label, name, required, placeholder }) => (
                  <div key={name}>
                    <label className="br-label">
                      {label} {required && <span className="req">*</span>}
                    </label>
                    <input
                      className="br-input"
                      type="text"
                      value={form[name]}
                      required={required}
                      placeholder={placeholder}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [name]: e.target.value }))
                      }
                    />
                  </div>
                ))}
            </div>

            <div>
              <label className="br-label">
                Full Address <span className="req">*</span>
              </label>
              <textarea
                className="br-textarea"
                rows={2}
                required
                value={form.address}
                placeholder="123 Business Park, Andheri West"
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="br-label">Branch Email</label>
              <input
                className="br-input"
                type="email"
                value={form.email}
                placeholder="mumbai@company.com"
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            <div className="br-modal-actions">
              <button
                type="submit"
                className="br-btn-primary"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Branch"
                    : "Create Branch"}
              </button>
              <button
                type="button"
                className="br-btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Geofence Modal ── */}
      <Modal
        isOpen={geoModal}
        onClose={() => setGeoModal(false)}
        title={`Geofence — ${geoTarget?.name ?? ""}`}
      >
        <form onSubmit={handleGeoSave}>
          <div className="br-modal-body">
            {/* Toggle */}
            <div
              className="br-toggle-row"
              onClick={() => setGeoForm((f) => ({ ...f, enabled: !f.enabled }))}
            >
              <div>
                <div className="br-toggle-label">Enable Geofencing</div>
                <div className="br-toggle-sub">
                  Restrict attendance to office location only
                </div>
              </div>
              <div
                className={`br-toggle-track ${geoForm.enabled ? "on" : "off"}`}
              >
                <span
                  className={`br-toggle-thumb ${geoForm.enabled ? "on" : "off"}`}
                />
              </div>
            </div>

            {geoForm.enabled && (
              <>
                <div>
                  <label className="br-label">
                    Find Office Location by Text
                  </label>
                  <div className="br-location-search">
                    <input
                      className="br-input"
                      type="text"
                      value={locationQuery}
                      placeholder="e.g. 123 Business Park, Andheri West, Mumbai"
                      onChange={(e) => setLocationQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          autoSelectLocationFromText();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="br-btn-primary"
                      style={{ flex: "0 0 auto", padding: "0 14px" }}
                      onClick={autoSelectLocationFromText}
                      disabled={geoSearchLoading}
                    >
                      {geoSearchLoading ? "Locating..." : "Auto Locate"}
                    </button>
                  </div>
                  <p className="br-geo-helper">
                    Type address text and use Auto Locate to drop the pin
                    automatically.
                  </p>
                </div>

                {/* GPS */}
                <button
                  type="button"
                  className="br-gps-btn"
                  onClick={useMyLocation}
                >
                  <MapPinIcon style={{ width: 15, height: 15 }} />
                  Use My Current Location
                </button>

                {/* Map */}
                <div className="br-map-wrap">
                  <MapContainer
                    center={mapCenter}
                    zoom={geoForm.latitude ? 16 : 5}
                    style={{ height: "100%", width: "100%" }}
                    ref={mapRef}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {geoForm.latitude && geoForm.longitude && (
                      <>
                        <Marker
                          position={[
                            parseFloat(geoForm.latitude),
                            parseFloat(geoForm.longitude),
                          ]}
                        />
                        <Circle
                          center={[
                            parseFloat(geoForm.latitude),
                            parseFloat(geoForm.longitude),
                          ]}
                          radius={geoForm.radiusMeters}
                          pathOptions={{
                            color: "#4f8eff",
                            fillColor: "#4f8eff",
                            fillOpacity: 0.12,
                          }}
                        />
                      </>
                    )}
                  </MapContainer>
                </div>
                <p className="br-map-hint">
                  Tap anywhere on the map to drop the office pin
                </p>

                {/* Lat / Lng */}
                <div className="br-field-grid">
                  <div>
                    <label className="br-label">Latitude</label>
                    <input
                      className="br-input"
                      type="number"
                      step="any"
                      value={geoForm.latitude}
                      placeholder="18.5204"
                      required
                      onChange={(e) =>
                        setGeoForm((f) => ({ ...f, latitude: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="br-label">Longitude</label>
                    <input
                      className="br-input"
                      type="number"
                      step="any"
                      value={geoForm.longitude}
                      placeholder="73.8567"
                      required
                      onChange={(e) =>
                        setGeoForm((f) => ({ ...f, longitude: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <div className="br-slider-label">
                    Allowed Radius: <strong>{geoForm.radiusMeters}m</strong>
                  </div>
                  <input
                    type="range"
                    className="br-slider"
                    min="50"
                    max="1000"
                    step="50"
                    value={geoForm.radiusMeters}
                    onChange={(e) =>
                      setGeoForm((f) => ({
                        ...f,
                        radiusMeters: parseInt(e.target.value),
                      }))
                    }
                  />
                  <div className="br-slider-ticks">
                    <span>50m strict</span>
                    <span>500m</span>
                    <span>1000m loose</span>
                  </div>
                </div>

                {/* Address label */}
                <div>
                  <label className="br-label">
                    Office Address{" "}
                    <span
                      style={{
                        color: "#5a6a85",
                        textTransform: "none",
                        letterSpacing: 0,
                        fontWeight: 400,
                      }}
                    >
                      (shown in error messages)
                    </span>
                  </label>
                  <input
                    className="br-input"
                    type="text"
                    value={geoForm.address}
                    placeholder="4th Floor, Tech Park, Pune"
                    onChange={(e) =>
                      setGeoForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </div>

                {/* Preview */}
                {geoForm.latitude && geoForm.longitude && (
                  <div className="br-geo-preview">
                    <div className="geo-title">📍 Geofence Active</div>
                    <div>
                      Center:{" "}
                      <strong>
                        {parseFloat(geoForm.latitude).toFixed(5)},{" "}
                        {parseFloat(geoForm.longitude).toFixed(5)}
                      </strong>
                    </div>
                    <div>
                      Employees must check in within{" "}
                      <strong>{geoForm.radiusMeters}m</strong> of this point
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="br-modal-actions">
              <button type="submit" className="br-btn-primary">
                Save Geofence
              </button>
              <button
                type="button"
                className="br-btn-secondary"
                onClick={() => setGeoModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

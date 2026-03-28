import { useState, useEffect, useRef } from 'react';
import { branchAPI, employeeAPI } from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
};

const emptyForm = { name: '', code: '', address: '', city: '', state: '', pincode: '', phone: '', email: '' };
const emptyGeo = { enabled: false, latitude: '', longitude: '', radiusMeters: 100, address: '' };

// ── Icons as SVG strings ────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round"/>
  </svg>
);
const IconMap = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);
const IconPin = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconUsers = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconSignal = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M1.5 8.5a13 13 0 0121 0M5 12a10 10 0 0114 0M8.5 15.5a6 6 0 017 0M12 19h.01" strokeLinecap="round"/>
  </svg>
);
const IconGps = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round"/>
  </svg>
);

export default function BranchPage() {
  const [branches, setBranches] = useState([]);
  const [branchStats, setBranchStats] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [geoModal, setGeoModal] = useState(false);
  const [geoTarget, setGeoTarget] = useState(null);
  const [geoForm, setGeoForm] = useState(emptyGeo);
  const [geoLoading, setGeoLoading] = useState(false);
  const mapRef = useRef(null);

  const fetchBranches = async () => {
    try {
      const res = await branchAPI.getAll();
      setBranches(res.data.data);
      const stats = {};
      await Promise.all(
        res.data.data.map(async (b) => {
          try {
            const emp = await employeeAPI.getAll({ branch: b._id, limit: 1 });
            stats[b._id] = emp.data.data.pagination.total;
          } catch { stats[b._id] = 0; }
        })
      );
      setBranchStats(stats);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const openGeoModal = (branch) => {
    setGeoTarget(branch);
    setGeoForm({
      enabled: branch.geofence?.enabled ?? false,
      latitude: branch.geofence?.latitude ?? '',
      longitude: branch.geofence?.longitude ?? '',
      radiusMeters: branch.geofence?.radiusMeters ?? 100,
      address: branch.geofence?.address ?? '',
    });
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
        toast.success('📍 Location pinned');
      },
      () => toast.error('Location access denied')
    );
  };

  const handleGeoSave = async (e) => {
    e.preventDefault();
    setGeoLoading(true);
    try {
      await branchAPI.updateGeofence(geoTarget._id, geoForm);
      toast.success('Geofence saved successfully');
      setGeoModal(false);
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save geofence');
    } finally { setGeoLoading(false); }
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setModalOpen(true); };
  const openEdit = (branch) => {
    setForm({
      name: branch.name, code: branch.code, address: branch.address,
      city: branch.city, state: branch.state, pincode: branch.pincode || '',
      phone: branch.phone || '', email: branch.email || '',
    });
    setEditingId(branch._id);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) { await branchAPI.update(editingId, form); toast.success('Branch updated'); }
      else { await branchAPI.create(form); toast.success('Branch created'); }
      setModalOpen(false);
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branch');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this branch?')) return;
    try {
      await branchAPI.delete(id);
      toast.success('Branch deactivated');
      fetchBranches();
    } catch { toast.error('Failed to deactivate'); }
  };

  const mapCenter = geoForm.latitude && geoForm.longitude
    ? [parseFloat(geoForm.latitude), parseFloat(geoForm.longitude)]
    : [20.5937, 78.9629];

  const activeCount = branches.filter(b => b.isActive).length;
  const geoCount = branches.filter(b => b.geofence?.enabled).length;
  const totalEmployees = Object.values(branchStats).reduce((a, b) => a + b, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        .branch-page { font-family: 'DM Sans', sans-serif; }
        .branch-page h1, .branch-page .serif { font-family: 'DM Serif Display', serif; }

        .stat-card {
          background: #fff;
          border: 1px solid #f0ede8;
          border-radius: 16px;
          padding: 20px 24px;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 80px; height: 80px;
          border-radius: 0 16px 0 80px;
          opacity: 0.06;
        }
        .stat-card.amber::before { background: #d97706; }
        .stat-card.emerald::before { background: #059669; }
        .stat-card.violet::before { background: #7c3aed; }

        .branch-card {
          background: #fff;
          border: 1px solid #f0ede8;
          border-radius: 20px;
          overflow: hidden;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
          position: relative;
        }
        .branch-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
        }
        .branch-card-header {
          padding: 20px 20px 16px;
          border-bottom: 1px solid #f5f3ef;
          position: relative;
        }
        .branch-card-body { padding: 16px 20px; }
        .branch-card-footer {
          padding: 12px 20px;
          background: #faf9f7;
          border-top: 1px solid #f0ede8;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .code-badge {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          background: #fdf4e7;
          color: #b45309;
          border: 1px solid #fde68a;
          padding: 2px 8px;
          border-radius: 6px;
          letter-spacing: 0.08em;
        }

        .action-btn {
          width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid transparent;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          background: transparent;
          color: #9ca3af;
        }
        .action-btn:hover { background: #f5f3ef; border-color: #e5e0d8; color: #374151; }
        .action-btn.geo:hover { background: #ede9fe; border-color: #c4b5fd; color: #7c3aed; }
        .action-btn.delete:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

        .geo-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 500;
          background: linear-gradient(135deg, #ede9fe, #f5f3ff);
          color: #7c3aed;
          border: 1px solid #ddd6fe;
          padding: 3px 9px;
          border-radius: 20px;
          margin-top: 8px;
        }
        .geo-badge .dot {
          width: 6px; height: 6px;
          background: #7c3aed;
          border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .status-pill {
          font-size: 11px; font-weight: 600;
          padding: 3px 10px; border-radius: 20px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .status-pill.active { background: #d1fae5; color: #065f46; }
        .status-pill.inactive { background: #fee2e2; color: #991b1b; }

        .primary-btn {
          display: flex; align-items: center; gap-8px;
          gap: 8px;
          padding: 10px 20px;
          background: #1c1917;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.01em;
        }
        .primary-btn:hover { background: #292524; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

        .form-label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .form-input {
          width: 100%; padding: 10px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #111827;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none; box-sizing: border-box;
          background: #fafafa;
        }
        .form-input:focus { border-color: #1c1917; box-shadow: 0 0 0 3px rgba(28,25,23,0.06); background: #fff; }

        .toggle-track {
          width: 44px; height: 24px;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .toggle-thumb {
          position: absolute; top: 3px;
          width: 18px; height: 18px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: transform 0.2s ease;
        }

        .map-hint {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          margin-top: -4px;
          padding: 6px 12px;
          background: #faf9f7;
          border-radius: 0 0 12px 12px;
          border: 1px solid #f0ede8;
          border-top: none;
        }

        .coord-display {
          background: #1c1917;
          color: #fbbf24;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 8px 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .radius-value {
          font-size: 28px;
          font-family: 'DM Serif Display', serif;
          color: #1c1917;
          line-height: 1;
        }

        .empty-state {
          grid-column: 1 / -1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 64px 24px;
          background: #faf9f7;
          border: 2px dashed #e5e0d8;
          border-radius: 20px;
          color: #9ca3af;
        }

        .skeleton {
          background: linear-gradient(90deg, #f5f3ef 25%, #ede8e0 50%, #f5f3ef 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .info-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #6b7280; }
        .info-icon { margin-top: 1px; flex-shrink: 0; }

        .save-btn {
          flex: 1; padding: 12px;
          background: #1c1917; color: #fff;
          border: none; border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .save-btn:hover:not(:disabled) { background: #292524; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cancel-btn {
          flex: 1; padding: 12px;
          background: transparent; color: #374151;
          border: 1.5px solid #e5e7eb; border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cancel-btn:hover { background: #f9fafb; border-color: #d1d5db; }

        .gps-btn {
          width: 100%; padding: 10px;
          background: transparent;
          border: 2px dashed #c4b5fd;
          border-radius: 10px;
          color: #7c3aed;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.15s ease;
        }
        .gps-btn:hover { background: #f5f3ff; border-color: #a78bfa; }

        .page-enter { animation: fadeUp 0.4s ease forwards; opacity: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .card-enter { animation: fadeUp 0.3s ease forwards; opacity: 0; }
      `}</style>

      <div className="branch-page" style={{ padding: '0 4px' }}>

        {/* ── Page Header ── */}
        <div className="page-enter" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Office Network
            </p>
            <h1 style={{ fontSize: 32, margin: 0, color: '#1c1917', lineHeight: 1.1 }}>Branch Directory</h1>
          </div>
          <button className="primary-btn" onClick={openCreate}>
            <IconPlus /> Add Branch
          </button>
        </div>

        {/* ── Stats Row ── */}
        <div className="page-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28, animationDelay: '0.05s' }}>
          <div className="stat-card amber">
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Total Branches</p>
            <p style={{ fontSize: 36, fontFamily: 'DM Serif Display, serif', color: '#1c1917', margin: 0, lineHeight: 1 }}>{branches.length}</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{activeCount} active</p>
          </div>
          <div className="stat-card emerald">
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Total Employees</p>
            <p style={{ fontSize: 36, fontFamily: 'DM Serif Display, serif', color: '#1c1917', margin: 0, lineHeight: 1 }}>{totalEmployees}</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>across all branches</p>
          </div>
          <div className="stat-card violet">
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Geofenced</p>
            <p style={{ fontSize: 36, fontFamily: 'DM Serif Display, serif', color: '#1c1917', margin: 0, lineHeight: 1 }}>{geoCount}</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>location-enforced</p>
          </div>
        </div>

        {/* ── Branch Cards ── */}
        {pageLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#fff', border: '1px solid #f0ede8', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f5f3ef' }}>
                  <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 10 }} />
                  <div className="skeleton" style={{ height: 14, width: '30%' }} />
                </div>
                <div style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 13, width: '80%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 13, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {branches.map((branch, i) => (
              <div
                key={branch._id}
                className="branch-card card-enter"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="branch-card-header">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 600, color: '#1c1917', fontFamily: 'DM Serif Display, serif' }}>
                        {branch.name}
                      </h3>
                      <span className="code-badge">{branch.code}</span>
                      {branch.geofence?.enabled && (
                        <div className="geo-badge">
                          <span className="dot" />
                          <IconSignal /> {branch.geofence.radiusMeters}m geofence
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                      <button className="action-btn" onClick={() => openEdit(branch)} title="Edit branch">
                        <IconEdit />
                      </button>
                      <button className="action-btn geo" onClick={() => openGeoModal(branch)} title="Configure geofence">
                        <IconMap />
                      </button>
                      <button className="action-btn delete" onClick={() => handleDelete(branch._id)} title="Deactivate">
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="branch-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="info-row">
                    <span className="info-icon">📍</span>
                    <span>{branch.address}, {branch.city}, {branch.state}{branch.pincode ? ` — ${branch.pincode}` : ''}</span>
                  </div>
                  {branch.phone && (
                    <div className="info-row">
                      <span className="info-icon">📞</span>
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="info-row">
                      <span className="info-icon">✉️</span>
                      <span>{branch.email}</span>
                    </div>
                  )}
                </div>

                <div className="branch-card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: 13 }}>
                    <IconUsers />
                    <span>{branchStats[branch._id] ?? 0} employees</span>
                  </div>
                  <span className={`status-pill ${branch.isActive ? 'active' : 'inactive'}`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}

            {branches.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                <p style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, color: '#374151', margin: '0 0 6px' }}>No branches yet</p>
                <p style={{ fontSize: 14, margin: 0 }}>Create your first branch to get started</p>
              </div>
            )}
          </div>
        )}

        {/* ── Create/Edit Modal ── */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Branch' : 'New Branch'}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Branch Name', name: 'name', required: true, placeholder: 'Head Office', span: 2 },
                { label: 'Branch Code', name: 'code', required: true, placeholder: 'HQ' },
                { label: 'Phone', name: 'phone', placeholder: '022-12345678' },
                { label: 'City', name: 'city', required: true, placeholder: 'Mumbai' },
                { label: 'State', name: 'state', required: true, placeholder: 'Maharashtra' },
                { label: 'Pincode', name: 'pincode', placeholder: '400001' },
                { label: 'Email', name: 'email', placeholder: 'branch@company.com' },
              ].map(({ label, name, required, placeholder, span }) => (
                <div key={name} style={{ gridColumn: span ? `span ${span}` : undefined }}>
                  <label className="form-label">{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
                  <input
                    className="form-input" type={name === 'email' ? 'email' : 'text'}
                    value={form[name]}
                    onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                    placeholder={placeholder} required={required}
                  />
                </div>
              ))}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Full Address <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  className="form-input" value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  required rows={2} placeholder="123 Business Park, Andheri West"
                  style={{ resize: 'none' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? 'Saving…' : (editingId ? 'Update Branch' : 'Create Branch')}
              </button>
              <button type="button" className="cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>

        {/* ── Geofence Modal ── */}
        <Modal isOpen={geoModal} onClose={() => setGeoModal(false)} title={`Geofence · ${geoTarget?.name ?? ''}`}>
          <form onSubmit={handleGeoSave}>

            {/* Toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: '#faf9f7', borderRadius: 12,
              border: '1px solid #f0ede8', marginBottom: 16, cursor: 'pointer'
            }} onClick={() => setGeoForm((f) => ({ ...f, enabled: !f.enabled }))}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#1c1917' }}>Enable Geofencing</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Restrict attendance check-in to office area only</p>
              </div>
              <div
                className="toggle-track"
                style={{ background: geoForm.enabled ? '#7c3aed' : '#d1d5db' }}
              >
                <div className="toggle-thumb" style={{ transform: geoForm.enabled ? 'translateX(20px)' : 'translateX(3px)' }} />
              </div>
            </div>

            {geoForm.enabled && (
              <>
                {/* GPS Button */}
                <button type="button" className="gps-btn" onClick={useMyLocation} style={{ marginBottom: 12 }}>
                  <IconGps /> Use My Current Location
                </button>

                {/* Map */}
                <div style={{ borderRadius: '12px 12px 0 0', overflow: 'hidden', border: '1px solid #e5e7eb', borderBottom: 'none' }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={geoForm.latitude ? 16 : 5}
                    style={{ height: 260, width: '100%' }}
                    ref={mapRef}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {geoForm.latitude && geoForm.longitude && (
                      <>
                        <Marker position={[parseFloat(geoForm.latitude), parseFloat(geoForm.longitude)]} />
                        <Circle
                          center={[parseFloat(geoForm.latitude), parseFloat(geoForm.longitude)]}
                          radius={geoForm.radiusMeters}
                          pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.12, weight: 2 }}
                        />
                      </>
                    )}
                  </MapContainer>
                </div>
                <div className="map-hint">
                  <IconPin /> Click on the map to drop the office pin
                </div>

                {/* Coordinates display */}
                {geoForm.latitude && geoForm.longitude && (
                  <div className="coord-display" style={{ marginTop: 12, marginBottom: 12 }}>
                    <span>LAT <strong>{parseFloat(geoForm.latitude).toFixed(5)}</strong></span>
                    <span>LNG <strong>{parseFloat(geoForm.longitude).toFixed(5)}</strong></span>
                    <span style={{ marginLeft: 'auto', color: '#86efac', fontSize: 11 }}>✓ pin set</span>
                  </div>
                )}

                {/* Manual coordinate inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label className="form-label">Latitude</label>
                    <input className="form-input" type="number" step="any" value={geoForm.latitude}
                      onChange={(e) => setGeoForm((f) => ({ ...f, latitude: e.target.value }))}
                      placeholder="18.5204" required />
                  </div>
                  <div>
                    <label className="form-label">Longitude</label>
                    <input className="form-input" type="number" step="any" value={geoForm.longitude}
                      onChange={(e) => setGeoForm((f) => ({ ...f, longitude: e.target.value }))}
                      placeholder="73.8567" required />
                  </div>
                </div>

                {/* Radius slider */}
                <div style={{ background: '#faf9f7', border: '1px solid #f0ede8', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label className="form-label" style={{ margin: 0 }}>Allowed Radius</label>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span className="radius-value">{geoForm.radiusMeters}</span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>metres</span>
                    </div>
                  </div>
                  <input
                    type="range" min="50" max="1000" step="50"
                    value={geoForm.radiusMeters}
                    onChange={(e) => setGeoForm((f) => ({ ...f, radiusMeters: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#7c3aed' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    <span>50m — strict</span><span>500m</span><span>1000m — loose</span>
                  </div>
                </div>

                {/* Address label */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Office Address Label</label>
                  <input className="form-input" type="text" value={geoForm.address}
                    onChange={(e) => setGeoForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="4th Floor, Tech Park, Pune" />
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 0 0' }}>
                    Shown in error message when employee is out of range
                  </p>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="save-btn" disabled={geoLoading}>
                {geoLoading ? 'Saving…' : 'Save Geofence'}
              </button>
              <button type="button" className="cancel-btn" onClick={() => setGeoModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}
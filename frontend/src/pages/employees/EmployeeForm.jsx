import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeAPI, branchAPI } from '../../services/api';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['Engineering', 'HR', 'Finance', 'Sales', 'Operations', 'Marketing', 'Admin', 'IT'];

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  // ✅ Flat state matching API's snake_case shape
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    branch_id: '',
    date_of_joining: '',
    salary_basic: '',
    salary_hra: '',
    salary_da: '',
    salary_ta: '',
    salary_other: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc_code: '',
    pan_number: '',
    aadhar_number: '',
    work_start_hour: 9,
    work_start_minute: 30,
    late_threshold_minutes: 15,
    profile_image: null,
  });

  useEffect(() => {
    // ✅ Safe branch fetch
    branchAPI.getAll()
      .then((r) => {
        const list = r.data?.data || r.data?.branches || [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => setBranches([]));

    if (isEdit) {
      employeeAPI.getById(id)
        .then((r) => {
          const e = r.data?.data?.employee || r.data?.data || {};
          setForm({
            name: e.name || '',
            email: e.email || '',
            phone: e.phone || '',
            department: e.department || '',
            designation: e.designation || '',
            branch_id: e.branch_id || e.branch?.id || '',
            date_of_joining: e.date_of_joining ? String(e.date_of_joining).split('T')[0] : '',
            salary_basic: e.salary_basic ?? '',
            salary_hra:   e.salary_hra   ?? '',
            salary_da:    e.salary_da    ?? '',
            salary_ta:    e.salary_ta    ?? '',
            salary_other: e.salary_other ?? '',
            bank_account_number: e.bank_account_number || '',
            bank_name:           e.bank_name || '',
            bank_ifsc_code:      e.bank_ifsc_code || '',
            pan_number:    e.pan_number || '',
            aadhar_number: e.aadhar_number || '',
            work_start_hour:    e.work_start_hour    ?? 9,
            work_start_minute:  e.work_start_minute  ?? 30,
            late_threshold_minutes: e.late_threshold_minutes ?? 15,
            profile_image: null,
          });
        })
        .catch(() => toast.error('Failed to load employee'));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'work_start_hour' || name === 'work_start_minute' || name === 'late_threshold_minutes') {
      setForm((f) => ({ ...f, [name]: parseInt(value, 10) }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((f) => ({ ...f, profile_image: file }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ✅ Send JSON (matching what the API returns). If your backend expects
      // multipart/form-data for the photo, swap to FormData below.
      const payload = { ...form };
      delete payload.profile_image; // handled separately if using FormData
      // strip empty strings so backend doesn't reject empty numbers
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') delete payload[k];
      });

      if (isEdit) {
        await employeeAPI.update(id, payload);
        toast.success('Employee updated successfully');
      } else {
        await employeeAPI.create(payload);
        toast.success('Employee created successfully');
      }
      navigate('/employees');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Flat salary total — no Object.values on a possibly-undefined object
  const grossSalary =
    (parseFloat(form.salary_basic) || 0) +
    (parseFloat(form.salary_hra)   || 0) +
    (parseFloat(form.salary_da)    || 0) +
    (parseFloat(form.salary_ta)    || 0) +
    (parseFloat(form.salary_other) || 0);

  const initials = form.name
    ? form.name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  // ✅ Late-after math (unchanged logic, uses flat field names)
  const lateAfterTotal = (form.work_start_hour || 0) * 60 + (form.work_start_minute || 0) + (form.late_threshold_minutes || 0);
  const lateAfterH = Math.floor(lateAfterTotal / 60) % 24;
  const lateAfterM = lateAfterTotal % 60;
  const lateAfterAmpm = lateAfterH < 12 ? 'AM' : 'PM';
  const lateAfterH12 = lateAfterH % 12 || 12;
  const lateAfterLabel = `${lateAfterH12}:${String(lateAfterM).padStart(2, '0')} ${lateAfterAmpm}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

        .ef-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .ef-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623; color: #f0f4ff;
          min-height: 100vh; padding-bottom: 80px;
          -webkit-font-smoothing: antialiased;
        }
        .ef-topbar {
          position: sticky; top: 0; z-index: 40;
          background: rgba(15,22,35,0.88); backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;
        }
        .ef-topbar-left { display: flex; align-items: center; gap: 12px; }
        .ef-back-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 9px; background: #1a2336;
          border: 1px solid rgba(255,255,255,0.07); color: #8b9ab5; cursor: pointer;
          font-size: 16px; line-height: 1; transition: background 0.15s, color 0.15s;
        }
        .ef-back-btn:hover { background: #243047; color: #f0f4ff; }
        .ef-topbar h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
        .ef-mode-chip {
          font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
          padding: 3px 10px; border-radius: 20px;
          background: rgba(79,142,255,0.1); border: 1px solid rgba(79,142,255,0.2); color: #4f8eff;
        }
        .ef-page { padding: 24px 20px; max-width: 860px; margin: 0 auto; }
        .ef-section {
          background: linear-gradient(135deg, #1a2336 0%, #1e2d45 100%);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 16px;
          margin-bottom: 16px; overflow: hidden; transition: border-color 0.2s;
          animation: ef-fadeIn 0.35s ease both;
        }
        .ef-section:focus-within { border-color: rgba(79,142,255,0.25); }
        @keyframes ef-fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ef-section:nth-child(1){animation-delay:0.04s} .ef-section:nth-child(2){animation-delay:0.08s}
        .ef-section:nth-child(3){animation-delay:0.12s} .ef-section:nth-child(4){animation-delay:0.16s}
        .ef-section:nth-child(5){animation-delay:0.20s} .ef-section:nth-child(6){animation-delay:0.24s}
        .ef-section-header {
          display: flex; align-items: center; gap: 12px;
          padding: 18px 22px 0; margin-bottom: 18px;
        }
        .ef-section-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; font-size: 16px;
        }
        .ef-section-icon.person  { background: rgba(79,142,255,0.12); }
        .ef-section-icon.work    { background: rgba(139,92,246,0.12); }
        .ef-section-icon.salary  { background: rgba(34,197,94,0.12); }
        .ef-section-icon.bank    { background: rgba(245,158,11,0.12); }
        .ef-section-icon.photo   { background: rgba(236,72,153,0.12); }
        .ef-section-icon.shift   { background: rgba(20,184,166,0.12); }
        .ef-section-title-text { font-size: 14px; font-weight: 600; color: #f0f4ff; }
        .ef-section-subtitle { font-size: 11px; color: #5a6a85; margin-top: 1px; }
        .ef-section-body { padding: 0 22px 22px; }
        .ef-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .ef-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .ef-grid-3-bank { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .ef-field { display: flex; flex-direction: column; gap: 6px; }
        .ef-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #5a6a85; display: flex; align-items: center; gap: 4px;
        }
        .ef-required { color: #ef4444; font-size: 12px; }
        .ef-input, .ef-select {
          background: #0f1623; border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px; padding: 11px 14px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; color: #f0f4ff; outline: none; width: 100%;
          transition: border-color 0.2s, box-shadow 0.2s; -webkit-appearance: none;
        }
        .ef-input::placeholder { color: #3d4f6a; }
        .ef-input:focus, .ef-select:focus {
          border-color: rgba(79,142,255,0.5); box-shadow: 0 0 0 3px rgba(79,142,255,0.08);
        }
        .ef-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        .ef-input[type="number"] { font-family: 'DM Mono', monospace; }
        .ef-select { cursor: pointer; }
        .ef-select option { background: #1a2336; color: #f0f4ff; }
        .ef-gross-bar {
          margin-top: 16px; background: rgba(34,197,94,0.07);
          border: 1px solid rgba(34,197,94,0.15); border-radius: 10px;
          padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;
        }
        .ef-gross-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #5a6a85; }
        .ef-gross-val { font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 500; color: #22c55e; }
        .ef-gross-sub { font-size: 10px; color: #5a6a85; margin-top: 1px; text-align: right; }
        .ef-photo-row { display: flex; align-items: center; gap: 20px; }
        .ef-avatar-lg {
          width: 72px; height: 72px; border-radius: 20px; flex-shrink: 0;
          background: linear-gradient(135deg, #1e3a5f, #2563eb);
          border: 2px solid rgba(79,142,255,0.25);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
          font-size: 24px; font-weight: 600; color: #f0f4ff; letter-spacing: -1px;
        }
        .ef-avatar-lg img { width: 100%; height: 100%; object-fit: cover; }
        .ef-upload-label {
          display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
          background: #243047; border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px; padding: 10px 16px;
          font-size: 13px; font-weight: 500; color: #c4cfe8;
          transition: background 0.15s, border-color 0.15s;
        }
        .ef-upload-label:hover { background: #2a3a55; border-color: rgba(79,142,255,0.3); color: #f0f4ff; }
        .ef-upload-hint { font-size: 11px; color: #3d4f6a; margin-top: 4px; }

        .ef-shift-grid {
          display: grid;
          grid-template-columns: 160px 160px 160px 1fr;
          gap: 14px; align-items: end;
        }
        .ef-preview-chip {
          border-radius: 10px; padding: 11px 16px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .ef-preview-chip.teal {
          background: rgba(20,184,166,0.08); border: 1px solid rgba(20,184,166,0.2);
        }
        .ef-preview-chip.red {
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
        }
        .ef-chip-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #5a6a85;
        }
        .ef-chip-val {
          font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 500;
        }
        .ef-chip-val.teal { color: #14b8a6; }
        .ef-chip-val.red  { color: #ef4444; }
        .ef-chip-sub { font-size: 10px; color: #5a6a85; }

        .ef-submit-row {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; margin-top: 8px;
        }
        .ef-cancel-btn {
          padding: 12px 22px; border-radius: 10px; background: #1a2336;
          border: 1px solid rgba(255,255,255,0.09);
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 500; color: #8b9ab5;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .ef-cancel-btn:hover { background: #243047; color: #f0f4ff; }
        .ef-submit-btn {
          padding: 12px 28px; border-radius: 10px; border: none;
          background: linear-gradient(135deg, #2563eb, #4f8eff);
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 600; color: #fff; cursor: pointer;
          box-shadow: 0 4px 18px rgba(79,142,255,0.28);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          display: flex; align-items: center; gap: 8px;
        }
        .ef-submit-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(79,142,255,0.38); }
        .ef-submit-btn:active { transform: scale(0.97); }
        .ef-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .ef-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: ef-spin 0.6s linear infinite; display: inline-block;
        }
        @keyframes ef-spin { to { transform: rotate(360deg); } }

        @media (max-width: 700px) {
          .ef-grid-3 { grid-template-columns: 1fr 1fr; }
          .ef-grid-5 { grid-template-columns: 1fr 1fr; }
          .ef-grid-3-bank { grid-template-columns: 1fr; }
          .ef-shift-grid { grid-template-columns: 1fr 1fr; }
          .ef-section-body { padding: 0 16px 18px; }
          .ef-section-header { padding: 16px 16px 0; }
        }
        @media (max-width: 440px) {
          .ef-grid-3 { grid-template-columns: 1fr; }
          .ef-grid-5 { grid-template-columns: 1fr 1fr; }
          .ef-shift-grid { grid-template-columns: 1fr 1fr; }
          .ef-page { padding: 16px 14px; }
        }
      `}</style>

      <div className="ef-root">

        {/* ── Top Bar ── */}
        <div className="ef-topbar">
          <div className="ef-topbar-left">
            <button className="ef-back-btn" onClick={() => navigate('/employees')}>←</button>
            <h1>{isEdit ? 'Edit Employee' : 'New Employee'}</h1>
            <span className="ef-mode-chip">{isEdit ? 'Editing' : 'Creating'}</span>
          </div>
        </div>

        <div className="ef-page">
          <form onSubmit={handleSubmit}>

            {/* ── Profile Photo ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon photo">🖼️</div>
                <div>
                  <div className="ef-section-title-text">Profile Photo</div>
                  <div className="ef-section-subtitle">Upload a clear face photo for face verification</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-photo-row">
                  <div className="ef-avatar-lg">
                    {imagePreview ? <img src={imagePreview} alt="Preview" /> : initials}
                  </div>
                  <div>
                    <label className="ef-upload-label">
                      📁 &nbsp;Choose Photo
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>
                    <div className="ef-upload-hint">JPG, PNG or WEBP · Max 5MB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Personal Info ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon person">👤</div>
                <div>
                  <div className="ef-section-title-text">Personal Information</div>
                  <div className="ef-section-subtitle">Basic contact & identity details</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-grid-3">
                  {[
                    { label: 'Full Name',     name: 'name',         placeholder: 'Rahul Sharma',       required: true },
                    { label: 'Email Address', name: 'email',        type: 'email', placeholder: 'rahul@company.com', required: true },
                    { label: 'Phone Number',  name: 'phone',        placeholder: '9876543210',         required: true },
                    { label: 'PAN Number',    name: 'pan_number',    placeholder: 'ABCDE1234F' },
                    { label: 'Aadhar Number', name: 'aadhar_number', placeholder: '1234 5678 9012' },
                  ].map(({ label, name, type = 'text', placeholder, required }) => (
                    <div key={name} className="ef-field">
                      <label className="ef-label">{label}{required && <span className="ef-required">*</span>}</label>
                      <input
                        className="ef-input" type={type} name={name}
                        value={form[name] ?? ''} onChange={handleChange}
                        placeholder={placeholder} required={required}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Employment Details ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon work">💼</div>
                <div>
                  <div className="ef-section-title-text">Employment Details</div>
                  <div className="ef-section-subtitle">Role, department & branch info</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-grid-3">
                  <div className="ef-field">
                    <label className="ef-label">Department <span className="ef-required">*</span></label>
                    <select className="ef-select" name="department" value={form.department} onChange={handleChange} required>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="ef-field">
                    <label className="ef-label">Designation <span className="ef-required">*</span></label>
                    <input className="ef-input" name="designation" value={form.designation}
                      onChange={handleChange} placeholder="Software Engineer" required />
                  </div>
                  <div className="ef-field">
                    <label className="ef-label">Branch <span className="ef-required">*</span></label>
                    <select className="ef-select" name="branch_id" value={form.branch_id} onChange={handleChange} required>
                      <option value="">Select branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="ef-field">
                    <label className="ef-label">Date of Joining <span className="ef-required">*</span></label>
                    <input className="ef-input" type="date" name="date_of_joining"
                      value={form.date_of_joining} onChange={handleChange} required />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Shift Timing ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon shift">🕐</div>
                <div>
                  <div className="ef-section-title-text">Shift Timing & Late Policy</div>
                  <div className="ef-section-subtitle">Work start time and grace period before marking late</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-shift-grid">

                  <div className="ef-field">
                    <label className="ef-label">Start Hour <span className="ef-required">*</span></label>
                    <select className="ef-select" name="work_start_hour"
                      value={form.work_start_hour} onChange={handleChange}>
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2,'0')}:00 &mdash; {i < 12 ? `${i === 0 ? 12 : i} AM` : `${i === 12 ? 12 : i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">Start Minute</label>
                    <select className="ef-select" name="work_start_minute"
                      value={form.work_start_minute} onChange={handleChange}>
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2,'0')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">Grace Period</label>
                    <select className="ef-select" name="late_threshold_minutes"
                      value={form.late_threshold_minutes} onChange={handleChange}>
                      {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
                        <option key={m} value={m}>
                          {m === 0 ? 'No grace (exact)' : `${m} min grace`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="ef-preview-chip teal" style={{ flex: 1 }}>
                      <div className="ef-chip-label">Shift starts</div>
                      <div className="ef-chip-val teal">
                        {String(form.work_start_hour).padStart(2,'0')}:{String(form.work_start_minute).padStart(2,'0')}
                      </div>
                      <div className="ef-chip-sub">
                        {form.work_start_hour < 12
                          ? `${form.work_start_hour === 0 ? 12 : form.work_start_hour}:${String(form.work_start_minute).padStart(2,'0')} AM`
                          : `${form.work_start_hour === 12 ? 12 : form.work_start_hour - 12}:${String(form.work_start_minute).padStart(2,'0')} PM`}
                      </div>
                    </div>
                    <div className="ef-preview-chip red" style={{ flex: 1 }}>
                      <div className="ef-chip-label">Late after</div>
                      <div className="ef-chip-val red">
                        {String(lateAfterH).padStart(2,'0')}:{String(lateAfterM).padStart(2,'0')}
                      </div>
                      <div className="ef-chip-sub">{lateAfterLabel}</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Salary ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon salary">💰</div>
                <div>
                  <div className="ef-section-title-text">Salary Structure</div>
                  <div className="ef-section-subtitle">Monthly compensation breakdown (₹)</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-grid-5">
                  {[
                    { label: 'Basic', name: 'salary_basic', placeholder: '25000', required: true },
                    { label: 'HRA',   name: 'salary_hra',   placeholder: '10000' },
                    { label: 'DA',    name: 'salary_da',    placeholder: '5000' },
                    { label: 'TA',    name: 'salary_ta',    placeholder: '2000' },
                    { label: 'Other', name: 'salary_other', placeholder: '0' },
                  ].map(({ label, name, placeholder, required }) => (
                    <div key={name} className="ef-field">
                      <label className="ef-label">{label}{required && <span className="ef-required">*</span>}</label>
                      <input className="ef-input" type="number" name={name}
                        value={form[name] ?? ''} onChange={handleChange}
                        placeholder={placeholder} required={required} />
                    </div>
                  ))}
                </div>
                <div className="ef-gross-bar">
                  <div className="ef-gross-label">Gross Monthly</div>
                  <div>
                    <div className="ef-gross-val">₹{grossSalary.toLocaleString('en-IN')}</div>
                    <div className="ef-gross-sub">per month</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Bank Details ── */}
            <div className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon bank">🏦</div>
                <div>
                  <div className="ef-section-title-text">Bank Details</div>
                  <div className="ef-section-subtitle">For salary disbursement</div>
                </div>
              </div>
              <div className="ef-section-body">
                <div className="ef-grid-3-bank">
                  {[
                    { label: 'Account Number', name: 'bank_account_number', placeholder: '1234567890' },
                    { label: 'Bank Name',       name: 'bank_name',           placeholder: 'State Bank of India' },
                    { label: 'IFSC Code',       name: 'bank_ifsc_code',      placeholder: 'SBIN0001234' },
                  ].map(({ label, name, placeholder }) => (
                    <div key={name} className="ef-field">
                      <label className="ef-label">{label}</label>
                      <input className="ef-input" name={name}
                        value={form[name] ?? ''} onChange={handleChange} placeholder={placeholder} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Submit ── */}
            <div className="ef-submit-row">
              <button type="button" className="ef-cancel-btn" onClick={() => navigate('/employees')}>
                Cancel
              </button>
              <button type="submit" className="ef-submit-btn" disabled={loading}>
                {loading
                  ? <><span className="ef-spinner" /> Saving…</>
                  : (isEdit ? '✔ Update Employee' : '✚ Create Employee')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeAPI, branchAPI } from '../../services/api';
import toast from 'react-hot-toast';

import {
  ArrowLeftIcon,
  UserCircleIcon,
  BriefcaseIcon,
  ClockIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

const DEPARTMENTS = [
  'Engineering',
  'HR',
  'Finance',
  'Sales',
  'Operations',
  'Marketing',
  'Admin',
  'IT',
];

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

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
    branchAPI
      .getAll()
      .then((r) => {
        const list = r.data?.data || r.data?.branches || [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => setBranches([]));

    if (isEdit) {
      employeeAPI
        .getById(id)
        .then((r) => {
          const e = r.data?.data?.employee || r.data?.data || {};

          setForm({
            name: e.name || '',
            email: e.email || '',
            phone: e.phone || '',
            department: e.department || '',
            designation: e.designation || '',
            branch_id: e.branch_id || e.branch?.id || '',
            date_of_joining: e.date_of_joining
              ? String(e.date_of_joining).split('T')[0]
              : '',

            salary_basic: e.salary_basic ?? '',
            salary_hra: e.salary_hra ?? '',
            salary_da: e.salary_da ?? '',
            salary_ta: e.salary_ta ?? '',
            salary_other: e.salary_other ?? '',

            bank_account_number: e.bank_account_number || '',
            bank_name: e.bank_name || '',
            bank_ifsc_code: e.bank_ifsc_code || '',

            pan_number: e.pan_number || '',
            aadhar_number: e.aadhar_number || '',

            work_start_hour: e.work_start_hour ?? 9,
            work_start_minute: e.work_start_minute ?? 30,
            late_threshold_minutes: e.late_threshold_minutes ?? 15,

            profile_image: null,
          });

          const existingImage = e.photo || e.profile_image;

          if (existingImage) {
            const apiBase =
              import.meta.env.VITE_API_BASE_URL ||
              'http://localhost:5000/api/v1';

            const backendRoot = apiBase
              .replace(/\/api\/v1\/?$/, '')
              .replace(/\/+$/, '');

            const imageUrl = /^https?:\/\//i.test(existingImage)
              ? existingImage
              : `${backendRoot}/${existingImage.replace(/^\/+/, '')}`;

            setImagePreview(imageUrl);
          }
        })
        .catch(() => toast.error('Failed to load employee'));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (
      name === 'work_start_hour' ||
      name === 'work_start_minute' ||
      name === 'late_threshold_minutes'
    ) {
      setForm((f) => ({
        ...f,
        [name]: parseInt(value, 10),
      }));
    } else {
      setForm((f) => ({
        ...f,
        [name]: value,
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be smaller than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image');
      return;
    }

    setForm((f) => ({
      ...f,
      profile_image: file,
    }));

    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const formData = new FormData();

    Object.keys(form).forEach((key) => {
      const value = form[key];

      if (value === "" || value === null || value === undefined) {
        return;
      }

      // IMPORTANT:
      // Backend Multer expects "profileImage"
      if (key === "profile_image") {
        if (value instanceof File) {
          formData.append("profileImage", value);
        }
        return;
      }

      formData.append(key, value);
    });

    if (isEdit) {
      await employeeAPI.update(id, formData);
      toast.success("Employee updated successfully");
    } else {
      await employeeAPI.create(formData);
      toast.success("Employee created successfully");
    }

    navigate("/employees");
  } catch (err) {
    console.error("Employee save error:", err);

    toast.error(
      err.response?.data?.message ||
      err.message ||
      "Failed to save employee"
    );
  } finally {
    setLoading(false);
  }
};

  const grossSalary =
    (parseFloat(form.salary_basic) || 0) +
    (parseFloat(form.salary_hra) || 0) +
    (parseFloat(form.salary_da) || 0) +
    (parseFloat(form.salary_ta) || 0) +
    (parseFloat(form.salary_other) || 0);

  const initials = form.name
    ? form.name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const lateAfterTotal =
    (form.work_start_hour || 0) * 60 +
    (form.work_start_minute || 0) +
    (form.late_threshold_minutes || 0);

  const lateAfterH = Math.floor(lateAfterTotal / 60) % 24;
  const lateAfterM = lateAfterTotal % 60;

  const formatTime = (hour, minute) => {
    const h = Number(hour);
    const m = Number(minute);

    const period = h < 12 ? 'AM' : 'PM';
    const hour12 = h % 12 || 12;

    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const lateAfterLabel = formatTime(lateAfterH, lateAfterM);

  return (
    <>
      <style>{`
        .employee-form-root {
          --ef-bg: #f6f7f9;
          --ef-surface: #ffffff;
          --ef-surface-alt: #fafbfc;

          --ef-text: #15171c;
          --ef-secondary: #676c76;
          --ef-muted: #969ba5;

          --ef-border: #e7e9ed;
          --ef-border-strong: #dfe2e7;

          --ef-blue: #3567d6;
          --ef-blue-soft: #edf3ff;

          --ef-green: #16845b;
          --ef-green-soft: #eaf7f1;

          --ef-orange: #c97816;
          --ef-orange-soft: #fff4e5;

          --ef-red: #c94b4b;
          --ef-red-soft: #fdeeee;

          min-height: 100vh;
          background: var(--ef-bg);
          color: var(--ef-text);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding-bottom: 64px;
          -webkit-font-smoothing: antialiased;
        }

        .employee-form-root *,
        .employee-form-root *::before,
        .employee-form-root *::after {
          box-sizing: border-box;
        }

        .ef-header {
          position: sticky;
          top: 0;
          z-index: 30;
          height: 72px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--ef-border);
          display: flex;
          align-items: center;
        }

        .ef-header-inner {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .ef-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .ef-back {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border: 1px solid var(--ef-border);
          background: var(--ef-surface);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ef-secondary);
          cursor: pointer;
          transition: all .18s ease;
        }

        .ef-back:hover {
          color: var(--ef-text);
          border-color: var(--ef-border-strong);
          background: var(--ef-surface-alt);
          transform: translateX(-1px);
        }

        .ef-heading {
          min-width: 0;
        }

        .ef-heading-title {
          font-size: 18px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--ef-text);
        }

        .ef-heading-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--ef-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ef-mode {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: var(--ef-blue-soft);
          color: var(--ef-blue);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .01em;
        }

        .ef-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px;
        }

        .ef-intro {
          margin-bottom: 22px;
        }

        .ef-intro-title {
          font-size: 26px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.035em;
          color: var(--ef-text);
        }

        .ef-intro-text {
          margin-top: 7px;
          font-size: 13px;
          color: var(--ef-secondary);
        }

        .ef-section {
          background: var(--ef-surface);
          border: 1px solid var(--ef-border);
          border-radius: 16px;
          margin-bottom: 16px;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(16, 24, 40, .025),
            0 5px 18px rgba(16, 24, 40, .025);
        }

        .ef-section-header {
          padding: 19px 22px;
          border-bottom: 1px solid var(--ef-border);
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .ef-section-icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: 10px;
          background: var(--ef-blue-soft);
          color: var(--ef-blue);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ef-section-icon.green {
          background: var(--ef-green-soft);
          color: var(--ef-green);
        }

        .ef-section-icon.orange {
          background: var(--ef-orange-soft);
          color: var(--ef-orange);
        }

        .ef-section-icon.purple {
          background: #f1edff;
          color: #7357c8;
        }

        .ef-section-heading {
          min-width: 0;
        }

        .ef-section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--ef-text);
        }

        .ef-section-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--ef-muted);
        }

        .ef-section-body {
          padding: 22px;
        }

        .ef-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .ef-grid-5 {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .ef-grid-bank {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .ef-field {
          min-width: 0;
        }

        .ef-label {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 7px;
          color: var(--ef-secondary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .01em;
        }

        .ef-required {
          color: var(--ef-red);
        }

        .ef-input,
        .ef-select {
          width: 100%;
          height: 43px;
          padding: 0 13px;
          border: 1px solid var(--ef-border-strong);
          border-radius: 10px;
          outline: none;
          background: var(--ef-surface);
          color: var(--ef-text);
          font-family: inherit;
          font-size: 13px;
          transition:
            border-color .18s ease,
            box-shadow .18s ease,
            background .18s ease;
        }

        .ef-input:hover,
        .ef-select:hover {
          border-color: #cfd3da;
        }

        .ef-input:focus,
        .ef-select:focus {
          border-color: var(--ef-blue);
          box-shadow: 0 0 0 3px rgba(53, 103, 214, .10);
          background: #fff;
        }

        .ef-input::placeholder {
          color: #b0b4bc;
        }

        .ef-select {
          appearance: none;
          cursor: pointer;
          padding-right: 38px;
          background-image:
            linear-gradient(45deg, transparent 50%, #8e949e 50%),
            linear-gradient(135deg, #8e949e 50%, transparent 50%);
          background-position:
            calc(100% - 17px) 18px,
            calc(100% - 12px) 18px;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }

        .ef-input[type="number"] {
          font-variant-numeric: tabular-nums;
        }

        .ef-photo-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px;
          background: var(--ef-surface-alt);
          border: 1px solid var(--ef-border);
          border-radius: 14px;
        }

        .ef-avatar {
          width: 76px;
          height: 76px;
          flex-shrink: 0;
          border-radius: 16px;
          overflow: hidden;
          background: var(--ef-blue-soft);
          color: var(--ef-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 750;
          letter-spacing: -.03em;
        }

        .ef-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ef-photo-content {
          min-width: 0;
          flex: 1;
        }

        .ef-photo-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--ef-text);
        }

        .ef-photo-description {
          margin-top: 4px;
          color: var(--ef-muted);
          font-size: 11.5px;
          line-height: 1.5;
        }

        .ef-upload {
          margin-top: 11px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 36px;
          padding: 0 12px;
          border: 1px solid var(--ef-border-strong);
          border-radius: 9px;
          background: #fff;
          color: var(--ef-text);
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: all .18s ease;
        }

        .ef-upload:hover {
          border-color: var(--ef-blue);
          color: var(--ef-blue);
          background: var(--ef-blue-soft);
        }

        .ef-shift-layout {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1.35fr;
          gap: 14px;
          align-items: end;
        }

        .ef-preview-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .ef-preview {
          min-height: 79px;
          padding: 12px;
          border-radius: 11px;
          border: 1px solid var(--ef-border);
          background: var(--ef-surface-alt);
        }

        .ef-preview.blue {
          background: var(--ef-blue-soft);
          border-color: #dbe6ff;
        }

        .ef-preview.red {
          background: var(--ef-red-soft);
          border-color: #f5d9d9;
        }

        .ef-preview-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--ef-secondary);
        }

        .ef-preview-value {
          margin-top: 5px;
          font-size: 16px;
          line-height: 1;
          font-weight: 750;
          letter-spacing: -.02em;
        }

        .ef-preview.blue .ef-preview-value {
          color: var(--ef-blue);
        }

        .ef-preview.red .ef-preview-value {
          color: var(--ef-red);
        }

        .ef-preview-sub {
          margin-top: 5px;
          font-size: 10px;
          color: var(--ef-muted);
        }

        .ef-gross {
          margin-top: 18px;
          padding: 16px 18px;
          border-radius: 12px;
          background: var(--ef-green-soft);
          border: 1px solid #d5eee2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .ef-gross-left {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ef-gross-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          color: var(--ef-green);
        }

        .ef-gross-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--ef-green);
        }

        .ef-gross-description {
          margin-top: 2px;
          font-size: 10.5px;
          color: var(--ef-muted);
        }

        .ef-gross-value {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -.035em;
          color: var(--ef-green);
          font-variant-numeric: tabular-nums;
        }

        .ef-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding-top: 4px;
        }

        .ef-actions-note {
          color: var(--ef-muted);
          font-size: 11px;
        }

        .ef-action-buttons {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ef-cancel {
          height: 42px;
          padding: 0 18px;
          border-radius: 10px;
          border: 1px solid var(--ef-border-strong);
          background: #fff;
          color: var(--ef-secondary);
          font-family: inherit;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: all .18s ease;
        }

        .ef-cancel:hover {
          color: var(--ef-text);
          border-color: #cfd3da;
          background: var(--ef-surface-alt);
        }

        .ef-submit {
          height: 42px;
          padding: 0 19px;
          border: 0;
          border-radius: 10px;
          background: var(--ef-blue);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(53, 103, 214, .16);
          transition: all .18s ease;
        }

        .ef-submit:hover {
          background: #2f5fc9;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(53, 103, 214, .20);
        }

        .ef-submit:active {
          transform: translateY(0);
        }

        .ef-submit:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .ef-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: ef-spin .65s linear infinite;
        }

        @keyframes ef-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 950px) {
          .ef-grid-5 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .ef-shift-layout {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ef-preview-row {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .ef-header {
            height: 64px;
          }

          .ef-header-inner {
            padding: 0 16px;
          }

          .ef-mode {
            display: none;
          }

          .ef-container {
            padding: 20px 14px 50px;
          }

          .ef-intro-title {
            font-size: 23px;
          }

          .ef-grid-3,
          .ef-grid-bank {
            grid-template-columns: 1fr 1fr;
          }

          .ef-section-body {
            padding: 18px;
          }

          .ef-section-header {
            padding: 16px 18px;
          }
        }

        @media (max-width: 560px) {
          .ef-grid-3,
          .ef-grid-5,
          .ef-grid-bank,
          .ef-shift-layout {
            grid-template-columns: 1fr;
          }

          .ef-preview-row {
            grid-column: auto;
          }

          .ef-photo-card {
            align-items: flex-start;
          }

          .ef-avatar {
            width: 64px;
            height: 64px;
          }

          .ef-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .ef-action-buttons {
            width: 100%;
          }

          .ef-cancel,
          .ef-submit {
            flex: 1;
          }

          .ef-actions-note {
            display: none;
          }
        }

        @media (max-width: 400px) {
          .ef-section-body {
            padding: 15px;
          }

          .ef-section-header {
            padding: 15px;
          }

          .ef-photo-card {
            gap: 13px;
            padding: 12px;
          }

          .ef-photo-description {
            font-size: 10.5px;
          }
        }
      `}</style>

      <div className="employee-form-root">

        {/* Header */}
        <header className="ef-header">
          <div className="ef-header-inner">
            <div className="ef-header-left">
              <button
                type="button"
                className="ef-back"
                onClick={() => navigate('/employees')}
                aria-label="Back to employees"
              >
                <ArrowLeftIcon width={18} height={18} />
              </button>

              <div className="ef-heading">
                <div className="ef-heading-title">
                  {isEdit ? 'Edit employee' : 'Add employee'}
                </div>

                <div className="ef-heading-subtitle">
                  {isEdit
                    ? 'Update employee profile and employment information'
                    : 'Create a new employee profile and configure their work details'}
                </div>
              </div>
            </div>

            <div className="ef-mode">
              {isEdit ? 'Editing employee' : 'New employee'}
            </div>
          </div>
        </header>

        <main className="ef-container">

          {/* Intro */}
          <div className="ef-intro">
            <div className="ef-intro-title">
              {isEdit ? 'Employee details' : 'Create employee profile'}
            </div>

            <div className="ef-intro-text">
              Add accurate employee information for attendance, payroll,
              verification and HR management.
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Profile */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon">
                  <UserCircleIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Profile photo
                  </div>

                  <div className="ef-section-subtitle">
                    Use a clear face photo for employee identification and
                    face verification
                  </div>
                </div>
              </div>

              <div className="ef-section-body">
                <div className="ef-photo-card">

                  <div className="ef-avatar">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt={form.name || 'Employee'}
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="ef-photo-content">
                    <div className="ef-photo-title">
                      Employee profile image
                    </div>

                    <div className="ef-photo-description">
                      Upload a clear front-facing photo. JPG, PNG or WEBP,
                      maximum file size 5MB.
                    </div>

                    <label className="ef-upload">
                      <CameraIcon width={16} height={16} />
                      Choose photo

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                </div>
              </div>
            </section>

            {/* Personal Information */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon">
                  <UserCircleIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Personal information
                  </div>

                  <div className="ef-section-subtitle">
                    Basic contact and identity information
                  </div>
                </div>
              </div>

              <div className="ef-section-body">
                <div className="ef-grid-3">

                  {[
                    {
                      label: 'Full name',
                      name: 'name',
                      placeholder: 'Rahul Sharma',
                      required: true,
                    },
                    {
                      label: 'Email address',
                      name: 'email',
                      type: 'email',
                      placeholder: 'rahul@company.com',
                      required: true,
                    },
                    {
                      label: 'Phone number',
                      name: 'phone',
                      placeholder: '9876543210',
                      required: true,
                    },
                    {
                      label: 'PAN number',
                      name: 'pan_number',
                      placeholder: 'ABCDE1234F',
                    },
                    {
                      label: 'Aadhar number',
                      name: 'aadhar_number',
                      placeholder: '1234 5678 9012',
                    },
                  ].map(
                    ({
                      label,
                      name,
                      type = 'text',
                      placeholder,
                      required,
                    }) => (
                      <div className="ef-field" key={name}>
                        <label className="ef-label">
                          {label}

                          {required && (
                            <span className="ef-required">*</span>
                          )}
                        </label>

                        <input
                          className="ef-input"
                          type={type}
                          name={name}
                          value={form[name] ?? ''}
                          onChange={handleChange}
                          placeholder={placeholder}
                          required={required}
                        />
                      </div>
                    )
                  )}

                </div>
              </div>
            </section>

            {/* Employment */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon green">
                  <BriefcaseIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Employment details
                  </div>

                  <div className="ef-section-subtitle">
                    Department, designation, branch and joining information
                  </div>
                </div>
              </div>

              <div className="ef-section-body">
                <div className="ef-grid-3">

                  <div className="ef-field">
                    <label className="ef-label">
                      Department
                      <span className="ef-required">*</span>
                    </label>

                    <select
                      className="ef-select"
                      name="department"
                      value={form.department}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select department</option>

                      {DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">
                      Designation
                      <span className="ef-required">*</span>
                    </label>

                    <input
                      className="ef-input"
                      name="designation"
                      value={form.designation}
                      onChange={handleChange}
                      placeholder="Software Engineer"
                      required
                    />
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">
                      Branch
                      <span className="ef-required">*</span>
                    </label>

                    <select
                      className="ef-select"
                      name="branch_id"
                      value={form.branch_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select branch</option>

                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">
                      Date of joining
                      <span className="ef-required">*</span>
                    </label>

                    <input
                      className="ef-input"
                      type="date"
                      name="date_of_joining"
                      value={form.date_of_joining}
                      onChange={handleChange}
                      required
                    />
                  </div>

                </div>
              </div>
            </section>

            {/* Shift */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon orange">
                  <ClockIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Shift timing & late policy
                  </div>

                  <div className="ef-section-subtitle">
                    Configure work start time and grace period before an
                    employee is marked late
                  </div>
                </div>
              </div>

              <div className="ef-section-body">
                <div className="ef-shift-layout">

                  <div className="ef-field">
                    <label className="ef-label">
                      Start hour
                      <span className="ef-required">*</span>
                    </label>

                    <select
                      className="ef-select"
                      name="work_start_hour"
                      value={form.work_start_hour}
                      onChange={handleChange}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00 —{' '}
                          {i < 12
                            ? i === 0
                              ? '12 AM'
                              : `${i} AM`
                            : i === 12
                              ? '12 PM'
                              : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">
                      Start minute
                    </label>

                    <select
                      className="ef-select"
                      name="work_start_minute"
                      value={form.work_start_minute}
                      onChange={handleChange}
                    >
                      {[0, 15, 30, 45].map((minute) => (
                        <option key={minute} value={minute}>
                          {String(minute).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-field">
                    <label className="ef-label">
                      Grace period
                    </label>

                    <select
                      className="ef-select"
                      name="late_threshold_minutes"
                      value={form.late_threshold_minutes}
                      onChange={handleChange}
                    >
                      {[0, 5, 10, 15, 20, 30, 45, 60].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute === 0
                            ? 'No grace'
                            : `${minute} min grace`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ef-preview-row">

                    <div className="ef-preview blue">
                      <div className="ef-preview-label">
                        Shift starts
                      </div>

                      <div className="ef-preview-value">
                        {formatTime(
                          form.work_start_hour,
                          form.work_start_minute
                        )}
                      </div>

                      <div className="ef-preview-sub">
                        Scheduled start
                      </div>
                    </div>

                    <div className="ef-preview red">
                      <div className="ef-preview-label">
                        Late after
                      </div>

                      <div className="ef-preview-value">
                        {lateAfterLabel}
                      </div>

                      <div className="ef-preview-sub">
                        Grace period applied
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            </section>

            {/* Salary */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon green">
                  <BanknotesIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Salary structure
                  </div>

                  <div className="ef-section-subtitle">
                    Monthly compensation breakdown used for payroll
                  </div>
                </div>
              </div>

              <div className="ef-section-body">

                <div className="ef-grid-5">

                  {[
                    {
                      label: 'Basic',
                      name: 'salary_basic',
                      placeholder: '25000',
                      required: true,
                    },
                    {
                      label: 'HRA',
                      name: 'salary_hra',
                      placeholder: '10000',
                    },
                    {
                      label: 'DA',
                      name: 'salary_da',
                      placeholder: '5000',
                    },
                    {
                      label: 'TA',
                      name: 'salary_ta',
                      placeholder: '2000',
                    },
                    {
                      label: 'Other',
                      name: 'salary_other',
                      placeholder: '0',
                    },
                  ].map(
                    ({
                      label,
                      name,
                      placeholder,
                      required,
                    }) => (
                      <div className="ef-field" key={name}>
                        <label className="ef-label">
                          {label}

                          {required && (
                            <span className="ef-required">*</span>
                          )}
                        </label>

                        <input
                          className="ef-input"
                          type="number"
                          min="0"
                          name={name}
                          value={form[name] ?? ''}
                          onChange={handleChange}
                          placeholder={placeholder}
                          required={required}
                        />
                      </div>
                    )
                  )}

                </div>

                <div className="ef-gross">

                  <div className="ef-gross-left">
                    <div className="ef-gross-icon">
                      <BanknotesIcon width={18} height={18} />
                    </div>

                    <div>
                      <div className="ef-gross-title">
                        Gross monthly salary
                      </div>

                      <div className="ef-gross-description">
                        Total of basic + allowances
                      </div>
                    </div>
                  </div>

                  <div className="ef-gross-value">
                    ₹{grossSalary.toLocaleString('en-IN')}
                  </div>

                </div>
              </div>
            </section>

            {/* Bank */}
            <section className="ef-section">
              <div className="ef-section-header">
                <div className="ef-section-icon purple">
                  <BuildingLibraryIcon width={20} height={20} />
                </div>

                <div className="ef-section-heading">
                  <div className="ef-section-title">
                    Bank details
                  </div>

                  <div className="ef-section-subtitle">
                    Optional banking information for salary disbursement
                  </div>
                </div>
              </div>

              <div className="ef-section-body">

                <div className="ef-grid-bank">

                  {[
                    {
                      label: 'Account number',
                      name: 'bank_account_number',
                      placeholder: '1234567890',
                    },
                    {
                      label: 'Bank name',
                      name: 'bank_name',
                      placeholder: 'State Bank of India',
                    },
                    {
                      label: 'IFSC code',
                      name: 'bank_ifsc_code',
                      placeholder: 'SBIN0001234',
                    },
                  ].map(
                    ({
                      label,
                      name,
                      placeholder,
                    }) => (
                      <div className="ef-field" key={name}>
                        <label className="ef-label">
                          {label}
                        </label>

                        <input
                          className="ef-input"
                          name={name}
                          value={form[name] ?? ''}
                          onChange={handleChange}
                          placeholder={placeholder}
                        />
                      </div>
                    )
                  )}

                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="ef-actions">

              <div className="ef-actions-note">
                Required fields are marked with an asterisk (*)
              </div>

              <div className="ef-action-buttons">

                <button
                  type="button"
                  className="ef-cancel"
                  onClick={() => navigate('/employees')}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="ef-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="ef-spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon width={17} height={17} />
                      {isEdit
                        ? 'Update employee'
                        : 'Create employee'}
                    </>
                  )}
                </button>

              </div>
            </div>

          </form>
        </main>
      </div>
    </>
  );
}
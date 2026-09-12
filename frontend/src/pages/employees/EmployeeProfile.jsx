import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  employeeAPI,
  attendanceAPI,
  leaveAPI,
} from '../../services/api';
import { formatINR } from '../../utils/helpers';
import toast from 'react-hot-toast';

import {
  ArrowLeftIcon,
  PencilSquareIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const WEEKDAYS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

const TABS = [
  {
    key: 'overview',
    label: 'Overview',
  },
  {
    key: 'attendance',
    label: 'Attendance',
  },
  {
    key: 'leaves',
    label: 'Leaves',
  },
];

const ATT_STATUS = {
  present: {
    bg: '#EAF7F1',
    text: '#16845B',
    dot: '#16845B',
  },
  absent: {
    bg: '#FDEEEE',
    text: '#C94B4B',
    dot: '#C94B4B',
  },
  half_day: {
    bg: '#FFF4E5',
    text: '#C97816',
    dot: '#C97816',
  },
};

const LEAVE_STATUS = {
  pending: {
    bg: '#FFF4E5',
    text: '#C97816',
    dot: '#C97816',
  },
  approved: {
    bg: '#EAF7F1',
    text: '#16845B',
    dot: '#16845B',
  },
  rejected: {
    bg: '#FDEEEE',
    text: '#C94B4B',
    dot: '#C94B4B',
  },
  cancelled: {
    bg: '#F2F3F5',
    text: '#747982',
    dot: '#969BA5',
  },
};

const LEAVE_TYPE_META = {
  CL: {
    bg: '#EDF3FF',
    text: '#3567D6',
  },
  SL: {
    bg: '#FDEEEE',
    text: '#C94B4B',
  },
  PL: {
    bg: '#EAF7F1',
    text: '#16845B',
  },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  if (!dateStr) return null;

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function getInitials(name = '') {
  const value = String(name).trim();

  if (!value) return '?';

  return value
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getBackendRoot() {
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api/v1';

  return apiBase
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

function getProfileImageUrl(path) {
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${getBackendRoot()}/${String(path).replace(/^\/+/, '')}`;
}

function getWorkingHours(record) {
  const value =
    record?.workingHours ??
    record?.working_hours ??
    record?.hours_worked;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getAttendanceStatus(record) {
  return (
    record?.status ||
    record?.attendance_status ||
    'absent'
  );
}

function getLeaveType(leave) {
  return (
    leave?.leaveType ||
    leave?.leave_type ||
    'CL'
  );
}

function getLeaveStatus(leave) {
  return (
    leave?.status ||
    'cancelled'
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const now = new Date();

    Promise.all([
      employeeAPI.getById(id),
      attendanceAPI.getAll({
        employeeId: id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
      leaveAPI.getAll({
        employeeId: id,
      }),
    ])
      .then(([empRes, attRes, leaveRes]) => {
        if (!mounted) return;

        const employeeData =
          empRes.data?.data?.employee ||
          empRes.data?.data ||
          empRes.data?.employee ||
          {};

        const attendanceData =
          attRes.data?.data?.records ||
          attRes.data?.data ||
          attRes.data?.records ||
          [];

        const leaveData =
          leaveRes.data?.data?.leaves ||
          leaveRes.data?.data ||
          leaveRes.data?.leaves ||
          [];

        setEmployee(employeeData);
        setAttendance(
          Array.isArray(attendanceData)
            ? attendanceData
            : []
        );
        setLeaves(
          Array.isArray(leaveData)
            ? leaveData
            : []
        );
      })
      .catch((error) => {
        console.error('Employee profile load error:', error);
        toast.error('Failed to load employee data');
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const employeeInfo = useMemo(() => {
    if (!employee) return null;

    const salary = {
      basic:
        employee.salary?.basic ??
        employee.salary_basic ??
        0,

      hra:
        employee.salary?.hra ??
        employee.salary_hra ??
        0,

      da:
        employee.salary?.da ??
        employee.salary_da ??
        0,

      ta:
        employee.salary?.ta ??
        employee.salary_ta ??
        0,

      other:
        employee.salary?.other ??
        employee.salary_other ??
        0,
    };

    const gross =
      Number(salary.basic || 0) +
      Number(salary.hra || 0) +
      Number(salary.da || 0) +
      Number(salary.ta || 0) +
      Number(salary.other || 0);

    const branch =
      employee.branch?.name ||
      employee.branch_name ||
      null;

    const employeeCode =
      employee.employeeCode ||
      employee.employee_code ||
      `EMP-${employee.id}`;

    const isActive =
      employee.isActive ??
      employee.is_active ??
      true;

    const dateOfJoining =
      employee.dateOfJoining ||
      employee.date_of_joining;

    const image =
      employee.photo ||
      employee.profile_image ||
      employee.profileImage ||
      null;

    const leaveBalance = {
      CL:
        employee.leaveBalance?.CL ??
        employee.leave_balance_cl ??
        0,

      SL:
        employee.leaveBalance?.SL ??
        employee.leave_balance_sl ??
        0,

      PL:
        employee.leaveBalance?.PL ??
        employee.leave_balance_pl ??
        0,
    };

    const bankDetails = {
      accountNumber:
        employee.bankDetails?.accountNumber ||
        employee.bank_account_number ||
        '',

      bankName:
        employee.bankDetails?.bankName ||
        employee.bank_name ||
        '',

      ifscCode:
        employee.bankDetails?.ifscCode ||
        employee.bank_ifsc_code ||
        '',
    };

    return {
      ...employee,
      name: employee.name || 'Unnamed Employee',
      email: employee.email || '',
      phone: employee.phone || '',
      department: employee.department || '—',
      designation: employee.designation || '—',
      employeeCode,
      branch,
      isActive,
      dateOfJoining,
      image,
      salary,
      gross,
      leaveBalance,
      bankDetails,
    };
  }, [employee]);

  const presentCount = useMemo(() => {
    return attendance.filter(
      (record) =>
        getAttendanceStatus(record) === 'present'
    ).length;
  }, [attendance]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;

    return Math.round(
      (presentCount / attendance.length) * 100
    );
  }, [attendance, presentCount]);

  if (loading) {
    return (
      <>
        <style>{`
          .ep-loading-root {
            min-height: 100vh;
            background: #f6f7f9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Inter, system-ui, sans-serif;
          }

          .ep-loading-card {
            background: #fff;
            border: 1px solid #e7e9ed;
            border-radius: 16px;
            padding: 24px 30px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #676c76;
            font-size: 13px;
          }

          .ep-loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #dfe6f8;
            border-top-color: #3567d6;
            border-radius: 50%;
            animation: ep-spin .65s linear infinite;
          }

          @keyframes ep-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>

        <div className="ep-loading-root">
          <div className="ep-loading-card">
            <span className="ep-loading-spinner" />
            Loading employee profile...
          </div>
        </div>
      </>
    );
  }

  if (!employee || !employeeInfo) {
    return (
      <>
        <style>{`
          .ep-not-found {
            min-height: 100vh;
            background: #f6f7f9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Inter, system-ui, sans-serif;
            padding: 20px;
          }

          .ep-not-found-card {
            max-width: 420px;
            width: 100%;
            background: #fff;
            border: 1px solid #e7e9ed;
            border-radius: 16px;
            padding: 34px;
            text-align: center;
          }

          .ep-not-found-title {
            color: #15171c;
            font-size: 18px;
            font-weight: 700;
          }

          .ep-not-found-text {
            color: #969ba5;
            font-size: 13px;
            margin-top: 7px;
          }

          .ep-not-found-button {
            margin-top: 20px;
            height: 40px;
            padding: 0 16px;
            border: 0;
            border-radius: 9px;
            background: #3567d6;
            color: #fff;
            font-family: inherit;
            font-size: 13px;
            font-weight: 650;
            cursor: pointer;
          }
        `}</style>

        <div className="ep-not-found">
          <div className="ep-not-found-card">
            <div className="ep-not-found-title">
              Employee not found
            </div>

            <div className="ep-not-found-text">
              The employee profile could not be loaded.
            </div>

            <button
              className="ep-not-found-button"
              onClick={() => navigate('/employees')}
            >
              Back to employees
            </button>
          </div>
        </div>
      </>
    );
  }

  const initials = getInitials(employeeInfo.name);
  const imageUrl = getProfileImageUrl(employeeInfo.image);

  return (
    <>
      <style>{`
        .ep-root {
          --ep-bg: #f6f7f9;
          --ep-surface: #ffffff;
          --ep-surface-alt: #fafbfc;

          --ep-text: #15171c;
          --ep-secondary: #676c76;
          --ep-muted: #969ba5;

          --ep-border: #e7e9ed;
          --ep-border-strong: #dfe2e7;

          --ep-blue: #3567d6;
          --ep-blue-soft: #edf3ff;

          --ep-green: #16845b;
          --ep-green-soft: #eaf7f1;

          --ep-orange: #c97816;
          --ep-orange-soft: #fff4e5;

          --ep-red: #c94b4b;
          --ep-red-soft: #fdeeee;

          --ep-purple: #7357c8;
          --ep-purple-soft: #f1edff;

          min-height: 100vh;
          background: var(--ep-bg);
          color: var(--ep-text);
          padding: 26px 28px 80px;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .ep-root *,
        .ep-root *::before,
        .ep-root *::after {
          box-sizing: border-box;
        }

        .ep-container {
          max-width: 1240px;
          margin: 0 auto;
        }

        /* Header */

        .ep-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .ep-header-left {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .ep-back-button {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 10px;
          border: 1px solid var(--ep-border);
          background: var(--ep-surface);
          color: var(--ep-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all .18s ease;
        }

        .ep-back-button:hover {
          color: var(--ep-text);
          border-color: var(--ep-border-strong);
          background: var(--ep-surface-alt);
          transform: translateX(-1px);
        }

        .ep-page-title {
          font-size: 20px;
          font-weight: 750;
          letter-spacing: -.025em;
          line-height: 1.2;
        }

        .ep-page-subtitle {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ep-muted);
        }

        .ep-edit-button {
          height: 40px;
          padding: 0 15px;
          border: 0;
          border-radius: 9px;
          background: var(--ep-blue);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(53,103,214,.14);
          transition: all .18s ease;
        }

        .ep-edit-button:hover {
          background: #2f5fc9;
          transform: translateY(-1px);
          box-shadow: 0 6px 15px rgba(53,103,214,.18);
        }

        /* Hero */

        .ep-hero {
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 18px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 16px;
          box-shadow:
            0 1px 2px rgba(16,24,40,.025),
            0 6px 22px rgba(16,24,40,.025);
        }

        .ep-avatar {
          width: 78px;
          height: 78px;
          flex-shrink: 0;
          border-radius: 18px;
          overflow: hidden;
          background: var(--ep-blue-soft);
          border: 1px solid #dbe6ff;
          color: var(--ep-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.04em;
        }

        .ep-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ep-hero-info {
          flex: 1;
          min-width: 0;
        }

        .ep-name {
          font-size: 22px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -.035em;
          color: var(--ep-text);
        }

        .ep-designation {
          margin-top: 5px;
          font-size: 13px;
          color: var(--ep-secondary);
        }

        .ep-badges {
          margin-top: 11px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .ep-badge {
          height: 26px;
          padding: 0 9px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          font-weight: 700;
        }

        .ep-badge.code {
          color: var(--ep-blue);
          background: var(--ep-blue-soft);
        }

        .ep-badge.branch {
          color: var(--ep-secondary);
          background: #f3f4f6;
        }

        .ep-badge.active {
          color: var(--ep-green);
          background: var(--ep-green-soft);
        }

        .ep-badge.inactive {
          color: var(--ep-red);
          background: var(--ep-red-soft);
        }

        .ep-gross {
          flex-shrink: 0;
          text-align: right;
          padding-left: 20px;
        }

        .ep-gross-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--ep-muted);
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .ep-gross-value {
          margin-top: 5px;
          font-size: 23px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.035em;
          color: var(--ep-blue);
          font-variant-numeric: tabular-nums;
        }

        /* Stats */

        .ep-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .ep-stat {
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 13px;
          padding: 15px 17px;
          min-height: 86px;
          box-shadow: 0 1px 2px rgba(16,24,40,.02);
        }

        .ep-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .ep-stat-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: var(--ep-muted);
        }

        .ep-stat-icon {
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ep-stat-value {
          margin-top: 9px;
          font-size: 20px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -.03em;
          font-variant-numeric: tabular-nums;
        }

        .ep-stat-meta {
          margin-top: 5px;
          font-size: 10px;
          color: var(--ep-muted);
        }

        /* Tabs */

        .ep-tabs-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 16px;
        }

        .ep-tabs {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 4px;
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 11px;
        }

        .ep-tab {
          height: 34px;
          padding: 0 16px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--ep-muted);
          font-family: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: all .16s ease;
        }

        .ep-tab:hover {
          color: var(--ep-secondary);
          background: var(--ep-surface-alt);
        }

        .ep-tab.active {
          background: var(--ep-blue-soft);
          color: var(--ep-blue);
          font-weight: 750;
        }

        .ep-month-label {
          color: var(--ep-muted);
          font-size: 11px;
        }

        /* Cards */

        .ep-overview-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .ep-card {
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(16,24,40,.02);
        }

        .ep-card.full {
          grid-column: 1 / -1;
        }

        .ep-card-header {
          padding: 16px 18px;
          border-bottom: 1px solid var(--ep-border);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ep-card-icon {
          width: 31px;
          height: 31px;
          border-radius: 8px;
          background: var(--ep-blue-soft);
          color: var(--ep-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ep-card-icon.green {
          background: var(--ep-green-soft);
          color: var(--ep-green);
        }

        .ep-card-icon.orange {
          background: var(--ep-orange-soft);
          color: var(--ep-orange);
        }

        .ep-card-icon.purple {
          background: var(--ep-purple-soft);
          color: var(--ep-purple);
        }

        .ep-card-title {
          font-size: 13px;
          font-weight: 750;
          color: var(--ep-text);
        }

        .ep-card-subtitle {
          margin-top: 2px;
          font-size: 10.5px;
          color: var(--ep-muted);
        }

        .ep-card-body {
          padding: 15px 18px;
        }

        .ep-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-height: 37px;
          border-bottom: 1px solid #f0f1f3;
        }

        .ep-info-row:last-child {
          border-bottom: 0;
        }

        .ep-info-key {
          color: var(--ep-secondary);
          font-size: 11.5px;
          font-weight: 550;
          flex-shrink: 0;
        }

        .ep-info-value {
          color: var(--ep-text);
          font-size: 12px;
          font-weight: 600;
          text-align: right;
          word-break: break-word;
        }

        .ep-info-value.mono {
          font-variant-numeric: tabular-nums;
        }

        .ep-salary-total {
          margin-top: 10px;
          padding-top: 13px;
          border-top: 1px solid var(--ep-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ep-salary-total-label {
          font-size: 12px;
          font-weight: 750;
          color: var(--ep-text);
        }

        .ep-salary-total-value {
          font-size: 17px;
          font-weight: 800;
          color: var(--ep-green);
          letter-spacing: -.02em;
        }

        /* Attendance */

        .ep-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ep-list-card {
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 12px;
          padding: 12px 15px;
          display: flex;
          align-items: center;
          gap: 13px;
          transition:
            border-color .16s ease,
            box-shadow .16s ease,
            transform .16s ease;
        }

        .ep-list-card:hover {
          border-color: #d9dce2;
          box-shadow: 0 4px 14px rgba(16,24,40,.035);
          transform: translateY(-1px);
        }

        .ep-date-box {
          width: 45px;
          min-width: 45px;
          text-align: center;
          padding: 6px 0;
          border-radius: 9px;
          background: var(--ep-surface-alt);
          border: 1px solid var(--ep-border);
        }

        .ep-date-number {
          font-size: 17px;
          line-height: 1;
          font-weight: 800;
          color: var(--ep-text);
        }

        .ep-date-day {
          margin-top: 3px;
          font-size: 8px;
          font-weight: 750;
          color: var(--ep-muted);
          text-transform: uppercase;
        }

        .ep-divider {
          width: 1px;
          height: 36px;
          background: var(--ep-border);
          flex-shrink: 0;
        }

        .ep-att-body {
          flex: 1;
          min-width: 0;
        }

        .ep-att-times {
          display: flex;
          gap: 22px;
          margin-bottom: 5px;
        }

        .ep-time-item {
          display: flex;
          flex-direction: column;
        }

        .ep-time-label {
          font-size: 8px;
          font-weight: 750;
          color: var(--ep-muted);
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .ep-time-value {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
          color: var(--ep-text);
          font-variant-numeric: tabular-nums;
        }

        .ep-time-value.empty {
          color: var(--ep-muted);
        }

        .ep-att-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ep-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 9.5px;
          font-weight: 700;
        }

        .ep-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .ep-late {
          color: var(--ep-red);
          font-size: 10px;
          font-weight: 600;
        }

        .ep-hours {
          min-width: 55px;
          text-align: right;
          color: var(--ep-secondary);
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* Leaves */

        .ep-leave-type {
          width: 42px;
          min-width: 42px;
          height: 36px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
        }

        .ep-leave-body {
          flex: 1;
          min-width: 0;
        }

        .ep-leave-dates {
          font-size: 12px;
          font-weight: 700;
          color: var(--ep-text);
        }

        .ep-leave-reason {
          margin-top: 3px;
          color: var(--ep-muted);
          font-size: 10.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ep-leave-right {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 5px;
          flex-shrink: 0;
        }

        .ep-days {
          color: var(--ep-muted);
          font-size: 10px;
          font-weight: 650;
        }

        /* Empty */

        .ep-empty {
          background: var(--ep-surface);
          border: 1px solid var(--ep-border);
          border-radius: 14px;
          padding: 55px 20px;
          text-align: center;
        }

        .ep-empty-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 12px;
          border-radius: 12px;
          background: var(--ep-surface-alt);
          color: var(--ep-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ep-empty-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--ep-text);
        }

        .ep-empty-text {
          margin-top: 4px;
          font-size: 11px;
          color: var(--ep-muted);
        }

        /* Responsive */

        @media (max-width: 900px) {
          .ep-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ep-overview-grid {
            grid-template-columns: 1fr;
          }

          .ep-card.full {
            grid-column: auto;
          }
        }

        @media (max-width: 680px) {
          .ep-root {
            padding: 20px 15px 70px;
          }

          .ep-page-header {
            align-items: flex-start;
          }

          .ep-hero {
            padding: 18px;
            align-items: flex-start;
          }

          .ep-avatar {
            width: 65px;
            height: 65px;
            border-radius: 15px;
            font-size: 20px;
          }

          .ep-name {
            font-size: 19px;
          }

          .ep-gross {
            width: 100%;
            padding: 12px 0 0;
            border-top: 1px solid var(--ep-border);
            text-align: left;
          }

          .ep-gross-value {
            font-size: 20px;
          }

          .ep-tabs-wrap {
            flex-direction: column;
            align-items: stretch;
          }

          .ep-tabs {
            width: 100%;
          }

          .ep-tab {
            flex: 1;
          }

          .ep-month-label {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .ep-page-header {
            gap: 12px;
          }

          .ep-page-subtitle {
            display: none;
          }

          .ep-edit-button {
            padding: 0 11px;
          }

          .ep-stats {
            gap: 8px;
          }

          .ep-stat {
            padding: 12px;
          }

          .ep-stat-value {
            font-size: 17px;
          }

          .ep-list-card {
            align-items: flex-start;
          }

          .ep-att-times {
            gap: 12px;
          }

          .ep-hours {
            min-width: 45px;
          }
        }
      `}</style>

      <div className="ep-root">
        <div className="ep-container">

          {/* Header */}
          <div className="ep-page-header">
            <div className="ep-header-left">

              <button
                className="ep-back-button"
                onClick={() => navigate('/employees')}
                aria-label="Back"
              >
                <ArrowLeftIcon width={18} height={18} />
              </button>

              <div>
                <div className="ep-page-title">
                  Employee profile
                </div>

                <div className="ep-page-subtitle">
                  View employee information, attendance and leave history
                </div>
              </div>
            </div>

            <button
              className="ep-edit-button"
              onClick={() =>
                navigate(`/employees/${id}/edit`)
              }
            >
              <PencilSquareIcon width={16} height={16} />
              Edit employee
            </button>
          </div>

          {/* Hero */}
          <div className="ep-hero">

            <div className="ep-avatar">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={employeeInfo.name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                initials
              )}
            </div>

            <div className="ep-hero-info">

              <div className="ep-name">
                {employeeInfo.name}
              </div>

              <div className="ep-designation">
                {employeeInfo.designation}
                {' · '}
                {employeeInfo.department}
              </div>

              <div className="ep-badges">

                <span className="ep-badge code">
                  {employeeInfo.employeeCode}
                </span>

                {employeeInfo.branch && (
                  <span className="ep-badge branch">
                    <BuildingOffice2Icon
                      width={12}
                      height={12}
                    />
                    {employeeInfo.branch}
                  </span>
                )}

                <span
                  className={`ep-badge ${
                    employeeInfo.isActive
                      ? 'active'
                      : 'inactive'
                  }`}
                >
                  {employeeInfo.isActive ? (
                    <CheckCircleIcon
                      width={12}
                      height={12}
                    />
                  ) : (
                    <XCircleIcon
                      width={12}
                      height={12}
                    />
                  )}

                  {employeeInfo.isActive
                    ? 'Active'
                    : 'Inactive'}
                </span>

              </div>
            </div>

            <div className="ep-gross">

              <div className="ep-gross-label">
                Gross / month
              </div>

              <div className="ep-gross-value">
                {formatINR(employeeInfo.gross)}
              </div>

            </div>
          </div>

          {/* Stats */}
          <div className="ep-stats">

            <div className="ep-stat">
              <div className="ep-stat-top">
                <div className="ep-stat-label">
                  Present this month
                </div>

                <div
                  className="ep-stat-icon"
                  style={{
                    background: '#EAF7F1',
                    color: '#16845B',
                  }}
                >
                  <CheckCircleIcon
                    width={15}
                    height={15}
                  />
                </div>
              </div>

              <div
                className="ep-stat-value"
                style={{ color: '#16845B' }}
              >
                {presentCount}
              </div>

              <div className="ep-stat-meta">
                {attendance.length
                  ? `${attendanceRate}% attendance rate`
                  : 'No records this month'}
              </div>
            </div>

            <div className="ep-stat">
              <div className="ep-stat-top">
                <div className="ep-stat-label">
                  CL balance
                </div>

                <div
                  className="ep-stat-icon"
                  style={{
                    background: '#EDF3FF',
                    color: '#3567D6',
                  }}
                >
                  <CalendarDaysIcon
                    width={15}
                    height={15}
                  />
                </div>
              </div>

              <div
                className="ep-stat-value"
                style={{ color: '#3567D6' }}
              >
                {employeeInfo.leaveBalance.CL}d
              </div>

              <div className="ep-stat-meta">
                Casual leave
              </div>
            </div>

            <div className="ep-stat">
              <div className="ep-stat-top">
                <div className="ep-stat-label">
                  SL balance
                </div>

                <div
                  className="ep-stat-icon"
                  style={{
                    background: '#FDEEEE',
                    color: '#C94B4B',
                  }}
                >
                  <ExclamationTriangleIcon
                    width={15}
                    height={15}
                  />
                </div>
              </div>

              <div
                className="ep-stat-value"
                style={{ color: '#C94B4B' }}
              >
                {employeeInfo.leaveBalance.SL}d
              </div>

              <div className="ep-stat-meta">
                Sick leave
              </div>
            </div>

            <div className="ep-stat">
              <div className="ep-stat-top">
                <div className="ep-stat-label">
                  PL balance
                </div>

                <div
                  className="ep-stat-icon"
                  style={{
                    background: '#F1EDFF',
                    color: '#7357C8',
                  }}
                >
                  <CalendarDaysIcon
                    width={15}
                    height={15}
                  />
                </div>
              </div>

              <div
                className="ep-stat-value"
                style={{ color: '#7357C8' }}
              >
                {employeeInfo.leaveBalance.PL}d
              </div>

              <div className="ep-stat-meta">
                Privilege leave
              </div>
            </div>

          </div>

          {/* Tabs */}
          <div className="ep-tabs-wrap">

            <div className="ep-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`ep-tab ${
                    activeTab === tab.key
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setActiveTab(tab.key)
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'attendance' && (
              <div className="ep-month-label">
                Current month attendance
              </div>
            )}

          </div>

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="ep-overview-grid">

              {/* Contact */}
              <div className="ep-card">
                <div className="ep-card-header">

                  <div className="ep-card-icon">
                    <UserCircleIcon
                      width={17}
                      height={17}
                    />
                  </div>

                  <div>
                    <div className="ep-card-title">
                      Contact information
                    </div>

                    <div className="ep-card-subtitle">
                      Employee communication details
                    </div>
                  </div>

                </div>

                <div className="ep-card-body">

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Email
                    </span>

                    <span className="ep-info-value">
                      {employeeInfo.email || '—'}
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Phone
                    </span>

                    <span className="ep-info-value">
                      {employeeInfo.phone || '—'}
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Joining date
                    </span>

                    <span className="ep-info-value">
                      {formatDate(
                        employeeInfo.dateOfJoining
                      )}
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Department
                    </span>

                    <span className="ep-info-value">
                      {employeeInfo.department}
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Designation
                    </span>

                    <span className="ep-info-value">
                      {employeeInfo.designation}
                    </span>
                  </div>

                </div>
              </div>

              {/* Salary */}
              <div className="ep-card">
                <div className="ep-card-header">

                  <div className="ep-card-icon green">
                    <BanknotesIcon
                      width={17}
                      height={17}
                    />
                  </div>

                  <div>
                    <div className="ep-card-title">
                      Salary breakdown
                    </div>

                    <div className="ep-card-subtitle">
                      Monthly compensation structure
                    </div>
                  </div>

                </div>

                <div className="ep-card-body">

                  {[
                    ['Basic', employeeInfo.salary.basic],
                    ['HRA', employeeInfo.salary.hra],
                    ['DA', employeeInfo.salary.da],
                    ['TA', employeeInfo.salary.ta],
                    ['Other', employeeInfo.salary.other],
                  ].map(([label, value]) => (
                    <div
                      className="ep-info-row"
                      key={label}
                    >
                      <span className="ep-info-key">
                        {label}
                      </span>

                      <span className="ep-info-value">
                        {formatINR(value)}
                      </span>
                    </div>
                  ))}

                  <div className="ep-salary-total">
                    <span className="ep-salary-total-label">
                      Gross total
                    </span>

                    <span className="ep-salary-total-value">
                      {formatINR(employeeInfo.gross)}
                    </span>
                  </div>

                </div>
              </div>

              {/* Work schedule */}
              <div className="ep-card">

                <div className="ep-card-header">

                  <div className="ep-card-icon orange">
                    <ClockIcon
                      width={17}
                      height={17}
                    />
                  </div>

                  <div>
                    <div className="ep-card-title">
                      Work schedule
                    </div>

                    <div className="ep-card-subtitle">
                      Attendance timing and late policy
                    </div>
                  </div>

                </div>

                <div className="ep-card-body">

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Shift starts
                    </span>

                    <span className="ep-info-value">
                      {formatTimeFromMinutes(
                        Number(
                          employeeInfo.work_start_hour ??
                          employeeInfo.workStartHour ??
                          9
                        ) *
                          60 +
                          Number(
                            employeeInfo.work_start_minute ??
                            employeeInfo.workStartMinute ??
                            30
                          )
                      )}
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Grace period
                    </span>

                    <span className="ep-info-value">
                      {Number(
                        employeeInfo.late_threshold_minutes ??
                        employeeInfo.lateThresholdMinutes ??
                        15
                      )}{' '}
                      minutes
                    </span>
                  </div>

                  <div className="ep-info-row">
                    <span className="ep-info-key">
                      Branch
                    </span>

                    <span className="ep-info-value">
                      {employeeInfo.branch || 'Not assigned'}
                    </span>
                  </div>

                </div>
              </div>

              {/* Bank */}
              <div className="ep-card">

                <div className="ep-card-header">

                  <div className="ep-card-icon purple">
                    <BriefcaseIcon
                      width={17}
                      height={17}
                    />
                  </div>

                  <div>
                    <div className="ep-card-title">
                      Bank details
                    </div>

                    <div className="ep-card-subtitle">
                      Salary disbursement information
                    </div>
                  </div>

                </div>

                <div className="ep-card-body">

                  {employeeInfo.bankDetails.accountNumber ||
                  employeeInfo.bankDetails.bankName ||
                  employeeInfo.bankDetails.ifscCode ? (
                    <>
                      <div className="ep-info-row">
                        <span className="ep-info-key">
                          Account number
                        </span>

                        <span className="ep-info-value mono">
                          {employeeInfo.bankDetails
                            .accountNumber || '—'}
                        </span>
                      </div>

                      <div className="ep-info-row">
                        <span className="ep-info-key">
                          Bank
                        </span>

                        <span className="ep-info-value">
                          {employeeInfo.bankDetails
                            .bankName || '—'}
                        </span>
                      </div>

                      <div className="ep-info-row">
                        <span className="ep-info-key">
                          IFSC
                        </span>

                        <span className="ep-info-value mono">
                          {employeeInfo.bankDetails
                            .ifscCode || '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        padding: '18px 0',
                        color: '#969ba5',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    >
                      No bank details added
                    </div>
                  )}

                </div>
              </div>

            </div>
          )}

          {/* Attendance */}
          {activeTab === 'attendance' && (
            attendance.length === 0 ? (
              <div className="ep-empty">

                <div className="ep-empty-icon">
                  <ClockIcon
                    width={22}
                    height={22}
                  />
                </div>

                <div className="ep-empty-title">
                  No attendance records
                </div>

                <div className="ep-empty-text">
                  No attendance records were found for this month.
                </div>

              </div>
            ) : (
              <div className="ep-list">

                {attendance.map((record, index) => {
                  const date = new Date(
                    record.date ||
                    record.attendance_date ||
                    record.createdAt
                  );

                  const status =
                    getAttendanceStatus(record);

                  const statusMeta =
                    ATT_STATUS[status] ||
                    ATT_STATUS.absent;

                  const checkIn =
                    record.checkIn?.time ||
                    record.check_in ||
                    record.check_in_time ||
                    null;

                  const checkOut =
                    record.checkOut?.time ||
                    record.check_out ||
                    record.check_out_time ||
                    null;

                  const checkInTime =
                    formatTime(checkIn);

                  const checkOutTime =
                    formatTime(checkOut);

                  const late =
                    record.isLate ??
                    record.is_late ??
                    false;

                  const lateMinutes =
                    record.lateByMinutes ??
                    record.late_by_minutes ??
                    0;

                  const hours =
                    getWorkingHours(record);

                  let statusLabel = status;

                  if (status === 'half_day') {
                    statusLabel = 'Half day';
                  } else if (status) {
                    statusLabel =
                      status.charAt(0).toUpperCase() +
                      status.slice(1);
                  }

                  return (
                    <div
                      className="ep-list-card"
                      key={
                        record._id ||
                        record.id ||
                        `${record.date}-${index}`
                      }
                    >

                      <div className="ep-date-box">
                        <div className="ep-date-number">
                          {pad(date.getDate())}
                        </div>

                        <div className="ep-date-day">
                          {WEEKDAYS[date.getDay()]}
                        </div>
                      </div>

                      <div className="ep-divider" />

                      <div className="ep-att-body">

                        <div className="ep-att-times">

                          <div className="ep-time-item">
                            <span className="ep-time-label">
                              Check in
                            </span>

                            <span
                              className={`ep-time-value ${
                                checkInTime
                                  ? ''
                                  : 'empty'
                              }`}
                            >
                              {checkInTime || '—'}
                            </span>
                          </div>

                          <div className="ep-time-item">
                            <span className="ep-time-label">
                              Check out
                            </span>

                            <span
                              className={`ep-time-value ${
                                checkOutTime
                                  ? ''
                                  : 'empty'
                              }`}
                            >
                              {checkOutTime || '—'}
                            </span>
                          </div>

                        </div>

                        <div className="ep-att-meta">

                          <span
                            className="ep-status"
                            style={{
                              background:
                                statusMeta.bg,
                              color:
                                statusMeta.text,
                            }}
                          >
                            <span
                              className="ep-status-dot"
                              style={{
                                background:
                                  statusMeta.dot,
                              }}
                            />

                            {statusLabel}
                          </span>

                          {late && (
                            <span className="ep-late">
                              Late +{lateMinutes}m
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="ep-hours">
                        {hours !== null
                          ? `${hours.toFixed(1)}h`
                          : '—'}
                      </div>

                    </div>
                  );
                })}

              </div>
            )
          )}

          {/* Leaves */}
          {activeTab === 'leaves' && (
            leaves.length === 0 ? (
              <div className="ep-empty">

                <div className="ep-empty-icon">
                  <DocumentTextIcon
                    width={22}
                    height={22}
                  />
                </div>

                <div className="ep-empty-title">
                  No leave records
                </div>

                <div className="ep-empty-text">
                  No leave applications were found for this employee.
                </div>

              </div>
            ) : (
              <div className="ep-list">

                {leaves.map((leave, index) => {
                  const leaveType =
                    getLeaveType(leave);

                  const leaveStatus =
                    getLeaveStatus(leave);

                  const typeMeta =
                    LEAVE_TYPE_META[leaveType] ||
                    LEAVE_TYPE_META.CL;

                  const statusMeta =
                    LEAVE_STATUS[leaveStatus] ||
                    LEAVE_STATUS.cancelled;

                  const startDate =
                    leave.startDate ||
                    leave.start_date;

                  const endDate =
                    leave.endDate ||
                    leave.end_date;

                  const reason =
                    leave.reason ||
                    leave.remarks ||
                    'No reason provided';

                  const totalDays =
                    leave.totalDays ??
                    leave.total_days ??
                    0;

                  return (
                    <div
                      className="ep-list-card"
                      key={
                        leave._id ||
                        leave.id ||
                        `${leaveType}-${startDate}-${index}`
                      }
                    >

                      <div
                        className="ep-leave-type"
                        style={{
                          background: typeMeta.bg,
                          color: typeMeta.text,
                        }}
                      >
                        {leaveType}
                      </div>

                      <div className="ep-leave-body">

                        <div className="ep-leave-dates">
                          {formatDate(startDate)}
                          {' → '}
                          {formatDate(endDate)}
                        </div>

                        <div className="ep-leave-reason">
                          {reason}
                        </div>

                      </div>

                      <div className="ep-leave-right">

                        <span
                          className="ep-status"
                          style={{
                            background:
                              statusMeta.bg,
                            color:
                              statusMeta.text,
                          }}
                        >
                          <span
                            className="ep-status-dot"
                            style={{
                              background:
                                statusMeta.dot,
                            }}
                          />

                          {leaveStatus
                            .charAt(0)
                            .toUpperCase() +
                            leaveStatus.slice(1)}
                        </span>

                        <span className="ep-days">
                          {totalDays} day
                          {Number(totalDays) === 1
                            ? ''
                            : 's'}
                        </span>

                      </div>

                    </div>
                  );
                })}

              </div>
            )
          )}

        </div>
      </div>
    </>
  );
}

function formatTimeFromMinutes(totalMinutes) {
  const minutes = Number(totalMinutes);

  if (!Number.isFinite(minutes)) {
    return '—';
  }

  const normalized =
    ((minutes % 1440) + 1440) % 1440;

  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 || 12;

  return `${hour12}:${String(minute).padStart(
    2,
    '0'
  )} ${period}`;
}
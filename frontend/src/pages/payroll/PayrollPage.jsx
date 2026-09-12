import { useEffect, useMemo, useState } from 'react';
import { payrollAPI, employeeAPI, payslipAPI } from '../../services/api';
import toast from 'react-hot-toast';

import {
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  PlusIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString('default', {
    month: 'long',
  }),
}));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function formatINR(value) {
  if (value == null || value === '') return '—';

  const number = Number(value);

  if (!Number.isFinite(number)) return '₹0';

  return `₹${number.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function periodLabel(month, year) {
  return `${new Date(2000, Number(month) - 1).toLocaleString('default', {
    month: 'short',
  })} ${year}`;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// PF      : 12% of Basic capped at ₹1,800
// ESIC    : 0.75% of Gross if Gross <= ₹21,000
// PT      : slab based
function calcDeductions(basic = 0, gross = 0, advance = 0) {
  const pf = Math.min(Math.round(number(basic) * 0.12), 1800);

  const esic =
    number(gross) <= 21000
      ? Math.round(number(gross) * 0.0075)
      : 0;

  let pt = 0;

  if (gross > 15000) pt = 200;
  else if (gross > 10000) pt = 150;
  else if (gross > 7500) pt = 100;
  else if (gross > 5000) pt = 50;

  const adv = Math.round(number(advance));

  return {
    pf,
    esic,
    pt,
    advance: adv,
    total: pf + esic + pt + adv,
  };
}

const STATUS_META = {
  paid: {
    label: 'Paid',
    bg: '#EAF7F1',
    text: '#16845B',
    dot: '#16845B',
  },
  processed: {
    label: 'Processed',
    bg: '#EDF3FF',
    text: '#3567D6',
    dot: '#3567D6',
  },
  draft: {
    label: 'Draft',
    bg: '#F1F2F4',
    text: '#676C76',
    dot: '#969BA5',
  },
};

function getEmployeeName(employee) {
  return employee?.name || employee?.employee_name || 'Unknown employee';
}

function getEmployeeCode(employee) {
  return (
    employee?.employeeCode ||
    employee?.employee_code ||
    employee?.code ||
    '—'
  );
}

function getSalary(employee) {
  if (!employee) {
    return {
      basic: 0,
      hra: 0,
      da: 0,
      ta: 0,
      other: 0,
    };
  }

  const salary = employee.salary || {};

  return {
    basic: number(
      salary.basic ??
        salary.salary_basic ??
        employee.salary_basic
    ),
    hra: number(
      salary.hra ??
        salary.salary_hra ??
        employee.salary_hra
    ),
    da: number(
      salary.da ??
        salary.salary_da ??
        employee.salary_da
    ),
    ta: number(
      salary.ta ??
        salary.salary_ta ??
        employee.salary_ta
    ),
    other: number(
      salary.other ??
        salary.salary_other ??
        employee.salary_other
    ),
  };
}

function EmployeeAvatar({ employee, size = 42 }) {
  const name = getEmployeeName(employee);

  const image =
    employee?.profileImage ||
    employee?.profile_image ||
    employee?.photo;

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000/api/v1';

  const backendRoot = apiBase
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/+$/, '');

  const imageUrl = image
    ? /^https?:\/\//i.test(image)
      ? image
      : `${backendRoot}/${String(image).replace(/^\/+/, '')}`
    : null;

  return (
    <div
      className="payroll-avatar"
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: Math.max(10, size * 0.28),
      }}
    >
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setFailed(true)}
        />
      ) : (
        initials || '?'
      )}
    </div>
  );
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [processing, setProcessing] = useState(false);
  const [genLoading, setGenLoading] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    year: CURRENT_YEAR,
    bonus: 0,
    advance: 0,
    otherDeductions: 0,
  });

  const [preview, setPreview] = useState(null);

  const fetchPayrolls = async () => {
    try {
      const response = await payrollAPI.getAll();

      const records =
        response?.data?.data?.payrolls ||
        response?.data?.data ||
        [];

      setPayrolls(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error('Failed to fetch payrolls:', error);
      toast.error('Failed to load payroll records');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();

      const records =
        response?.data?.data?.employees ||
        response?.data?.data ||
        [];

      setEmployees(Array.isArray(records) ? records : []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast.error('Failed to load employees');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      await Promise.all([
        fetchPayrolls(),
        fetchEmployees(),
      ]);

      setLoading(false);
    };

    load();
  }, []);

  const selectedEmployee = useMemo(() => {
    return employees.find(
      (employee) =>
        String(employee.id) === String(form.employeeId)
    );
  }, [employees, form.employeeId]);

  useEffect(() => {
    if (!selectedEmployee) {
      setPreview(null);
      return;
    }

    const salary = getSalary(selectedEmployee);

    const gross =
      salary.basic +
      salary.hra +
      salary.da +
      salary.ta +
      salary.other;

    const bonus = number(form.bonus);
    const advance = number(form.advance);
    const otherDed = number(form.otherDeductions);

    const deductions = calcDeductions(
      salary.basic,
      gross,
      advance
    );

    // Current payroll logic intentionally uses:
    // ESIC + advance + other deductions.
    const totalDed =
      deductions.esic +
      deductions.advance +
      otherDed;

    const net = gross + bonus - totalDed;

    setPreview({
      gross,
      bonus,
      esic: deductions.esic,
      advance: deductions.advance,
      otherDed,
      totalDed,
      net,
    });
  }, [
    selectedEmployee,
    form.bonus,
    form.advance,
    form.otherDeductions,
  ]);

  const setField = (field) => (event) => {
    setForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handleProcess = async (event) => {
    event.preventDefault();

    if (!form.employeeId) {
      toast.error('Please select an employee');
      return;
    }

    setProcessing(true);

    try {
      await payrollAPI.process({
        employeeId: parseInt(form.employeeId, 10),
        month: parseInt(form.month, 10),
        year: parseInt(form.year, 10),
        bonus: parseFloat(form.bonus) || 0,
        advance: parseFloat(form.advance) || 0,
        otherDeductions:
          parseFloat(form.otherDeductions) || 0,
      });

      toast.success('Payroll processed successfully');

      await fetchPayrolls();

      setForm((previous) => ({
        ...previous,
        employeeId: '',
        bonus: 0,
        advance: 0,
        otherDeductions: 0,
      }));
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          'Payroll processing failed'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await payrollAPI.markPaid(id);

      toast.success('Payroll marked as paid');

      await fetchPayrolls();
    } catch (error) {
      toast.error('Failed to mark payroll as paid');
    }
  };

  const handleGeneratePayslip = async (payrollId) => {
    setGenLoading(payrollId);

    try {
      const response =
        await payslipAPI.generate(payrollId);

      toast.success('Payslip generated successfully');

      const pdfUrl =
        response?.data?.data?.pdfUrl ||
        response?.data?.pdfUrl;

      if (!pdfUrl) {
        toast.error('Payslip URL was not returned');
        return;
      }

      const uploadBase =
        import.meta.env.VITE_UPLOAD_BASE_URL || '';

      window.open(
        `${uploadBase}${pdfUrl}`,
        '_blank',
        'noopener,noreferrer'
      );
    } catch (error) {
      toast.error('Failed to generate payslip');
    } finally {
      setGenLoading(null);
    }
  };

  const totalGross = payrolls.reduce(
    (sum, payroll) =>
      sum + number(payroll.grossSalary ?? payroll.gross_salary),
    0
  );

  const totalNet = payrolls.reduce(
    (sum, payroll) =>
      sum + number(payroll.netSalary ?? payroll.net_salary),
    0
  );

  const paidCount = payrolls.filter(
    (payroll) => payroll.status === 'paid'
  ).length;

  const processedCount = payrolls.filter(
    (payroll) => payroll.status === 'processed'
  ).length;

  const employeeCount = new Set(
    payrolls.map(
      (payroll) =>
        payroll.employee?.id ||
        payroll.employee_id ||
        payroll.employeeId
    )
  ).size;

  return (
    <>
      <style>{`
        .payroll-page {
          --bg: #F6F7F9;
          --surface: #FFFFFF;
          --surface-alt: #FAFBFC;
          --text: #15171C;
          --secondary: #676C76;
          --muted: #969BA5;
          --border: #E7E9ED;

          --blue: #3567D6;
          --blue-soft: #EDF3FF;

          --green: #16845B;
          --green-soft: #EAF7F1;

          --orange: #C97816;
          --orange-soft: #FFF4E5;

          --red: #C94B4B;
          --red-soft: #FDEEEE;

          --purple: #7357C8;
          --purple-soft: #F1EDFF;

          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          padding: 28px 28px 80px;
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

        .payroll-page *,
        .payroll-page *::before,
        .payroll-page *::after {
          box-sizing: border-box;
        }

        .payroll-container {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
        }

        /* Header */

        .payroll-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
        }

        .payroll-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
          color: var(--blue);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        .payroll-eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
        }

        .payroll-title {
          margin: 0;
          color: var(--text);
          font-size: clamp(25px, 3vw, 32px);
          line-height: 1.12;
          font-weight: 750;
          letter-spacing: -.035em;
        }

        .payroll-subtitle {
          margin: 7px 0 0;
          color: var(--secondary);
          font-size: 14px;
          line-height: 1.55;
        }

        .payroll-header-meta {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          color: var(--secondary);
          font-size: 12px;
          white-space: nowrap;
        }

        /* KPI */

        .payroll-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 25px;
        }

        .payroll-kpi {
          min-width: 0;
          padding: 17px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
          box-shadow: 0 1px 2px rgba(15, 23, 42, .025);
        }

        .payroll-kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 15px;
        }

        .payroll-kpi-icon {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
        }

        .payroll-kpi-label {
          color: var(--secondary);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: .025em;
        }

        .payroll-kpi-value {
          margin-top: 4px;
          color: var(--text);
          font-size: 22px;
          line-height: 1.1;
          font-weight: 750;
          letter-spacing: -.025em;
        }

        .payroll-kpi-caption {
          margin-top: 7px;
          color: var(--muted);
          font-size: 11px;
        }

        /* Layout */

        .payroll-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(400px, .95fr);
          gap: 18px;
          align-items: start;
          margin-bottom: 26px;
        }

        .payroll-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          box-shadow: 0 1px 2px rgba(15, 23, 42, .025);
          overflow: hidden;
        }

        .payroll-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          padding: 20px 21px 17px;
          border-bottom: 1px solid var(--border);
        }

        .payroll-card-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .payroll-card-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 9px;
          background: var(--blue-soft);
          color: var(--blue);
        }

        .payroll-card-title {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.01em;
        }

        .payroll-card-description {
          margin: 3px 0 0 44px;
          color: var(--secondary);
          font-size: 11px;
          line-height: 1.45;
        }

        .payroll-auto-badge {
          padding: 5px 9px;
          border-radius: 999px;
          background: var(--green-soft);
          color: var(--green);
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        /* Form */

        .payroll-form {
          padding: 20px 21px 21px;
        }

        .payroll-section {
          margin-bottom: 21px;
        }

        .payroll-section:last-child {
          margin-bottom: 0;
        }

        .payroll-section-label {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 11px;
          color: var(--muted);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .payroll-section-label::after {
          content: "";
          height: 1px;
          flex: 1;
          background: var(--border);
        }

        .payroll-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .payroll-field {
          min-width: 0;
        }

        .payroll-field.full {
          grid-column: 1 / -1;
        }

        .payroll-label {
          display: block;
          margin-bottom: 6px;
          color: var(--secondary);
          font-size: 11px;
          font-weight: 650;
        }

        .payroll-input-wrap {
          position: relative;
        }

        .payroll-input,
        .payroll-select {
          width: 100%;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 9px;
          outline: none;
          background: var(--surface);
          color: var(--text);
          font: inherit;
          font-size: 13px;
          transition:
            border-color .15s ease,
            box-shadow .15s ease,
            background .15s ease;
        }

        .payroll-select {
          appearance: none;
          padding-right: 38px;
        }

        .payroll-select-wrap::after {
          content: "";
          position: absolute;
          top: 50%;
          right: 12px;
          width: 16px;
          height: 16px;
          transform: translateY(-50%);
          pointer-events: none;
          background: var(--secondary);
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m19 9-7 7-7-7'/%3E%3C/svg%3E") center / contain no-repeat;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m19 9-7 7-7-7'/%3E%3C/svg%3E") center / contain no-repeat;
        }

        .payroll-input:focus,
        .payroll-select:focus {
          border-color: rgba(53, 103, 214, .55);
          box-shadow: 0 0 0 3px rgba(53, 103, 214, .09);
        }

        .payroll-input.earning {
          background: #FCFEFD;
        }

        .payroll-input.deduction {
          background: #FFFCF8;
        }

        .payroll-input-hint {
          display: block;
          margin-top: 5px;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.4;
        }

        /* Selected employee */

        .payroll-selected-employee {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 9px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-alt);
        }

        .payroll-avatar {
          display: grid;
          place-items: center;
          overflow: hidden;
          background: var(--blue-soft);
          color: var(--blue);
          font-size: 12px;
          font-weight: 750;
          flex-shrink: 0;
        }

        .payroll-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .payroll-selected-name {
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        .payroll-selected-meta {
          margin-top: 2px;
          color: var(--secondary);
          font-size: 10px;
        }

        /* Submit */

        .payroll-submit {
          width: 100%;
          min-height: 44px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          border: 0;
          border-radius: 9px;
          background: var(--blue);
          color: white;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(53, 103, 214, .16);
          transition:
            background .15s ease,
            transform .1s ease,
            box-shadow .15s ease;
        }

        .payroll-submit:hover:not(:disabled) {
          background: #2F5DC4;
          box-shadow: 0 7px 18px rgba(53, 103, 214, .2);
        }

        .payroll-submit:active:not(:disabled) {
          transform: translateY(1px);
        }

        .payroll-submit:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        /* Preview */

        .payroll-preview {
          padding: 18px;
          border-top: 1px solid var(--border);
          background: #FBFCFE;
        }

        .payroll-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 15px;
        }

        .payroll-preview-title {
          color: var(--text);
          font-size: 12px;
          font-weight: 750;
        }

        .payroll-preview-period {
          color: var(--secondary);
          font-size: 10px;
          font-weight: 600;
        }

        .payroll-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .payroll-preview-item {
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface);
        }

        .payroll-preview-label {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .045em;
          text-transform: uppercase;
        }

        .payroll-preview-value {
          display: block;
          margin-top: 5px;
          color: var(--text);
          font-size: 13px;
          font-weight: 750;
        }

        .payroll-preview-value.green {
          color: var(--green);
        }

        .payroll-preview-value.red {
          color: var(--red);
        }

        .payroll-preview-value.orange {
          color: var(--orange);
        }

        .payroll-net {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 10px;
          padding: 13px 14px;
          border: 1px solid #DCE7FF;
          border-radius: 10px;
          background: var(--blue-soft);
        }

        .payroll-net-label {
          color: var(--secondary);
          font-size: 11px;
          font-weight: 700;
        }

        .payroll-net-value {
          color: var(--blue);
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -.025em;
        }

        /* Employee salary card */

        .salary-card-body {
          padding: 20px;
        }

        .salary-employee {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 17px;
          border-bottom: 1px solid var(--border);
        }

        .salary-employee-name {
          color: var(--text);
          font-size: 14px;
          font-weight: 750;
        }

        .salary-employee-meta {
          margin-top: 3px;
          color: var(--secondary);
          font-size: 11px;
        }

        .salary-breakdown {
          margin-top: 17px;
        }

        .salary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 10px 0;
          border-bottom: 1px solid #F0F1F3;
        }

        .salary-row:last-child {
          border-bottom: 0;
        }

        .salary-row-label {
          color: var(--secondary);
          font-size: 12px;
        }

        .salary-row-value {
          color: var(--text);
          font-size: 12px;
          font-weight: 700;
        }

        .salary-row.total {
          margin-top: 4px;
          padding: 13px 0 0;
          border-top: 1px solid var(--border);
          border-bottom: 0;
        }

        .salary-row.total .salary-row-label {
          color: var(--text);
          font-weight: 750;
        }

        .salary-row.total .salary-row-value {
          color: var(--green);
          font-size: 16px;
        }

        .salary-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
          margin-top: 17px;
        }

        .salary-info-item {
          padding: 10px;
          border-radius: 9px;
          background: var(--surface-alt);
        }

        .salary-info-label {
          color: var(--muted);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .05em;
        }

        .salary-info-value {
          margin-top: 4px;
          color: var(--text);
          font-size: 11px;
          font-weight: 700;
        }

        /* Records */

        .payroll-records {
          margin-top: 5px;
        }

        .payroll-records-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .025);
        }

        .records-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
        }

        .records-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .records-title-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--purple-soft);
          color: var(--purple);
        }

        .records-title {
          color: var(--text);
          font-size: 14px;
          font-weight: 750;
        }

        .records-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 25px;
          height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          background: #F1F2F4;
          color: var(--secondary);
          font-size: 10px;
          font-weight: 750;
        }

        .records-summary {
          color: var(--secondary);
          font-size: 11px;
        }

        .records-list {
          display: flex;
          flex-direction: column;
        }

        .payroll-record {
          display: grid;
          grid-template-columns: minmax(210px, 1.3fr) minmax(280px, 1fr) auto;
          align-items: center;
          gap: 20px;
          padding: 16px 20px;
          border-bottom: 1px solid #F0F1F3;
          transition: background .15s ease;
        }

        .payroll-record:last-child {
          border-bottom: 0;
        }

        .payroll-record:hover {
          background: #FBFCFE;
        }

        .record-employee {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .record-employee-info {
          min-width: 0;
        }

        .record-name {
          overflow: hidden;
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .record-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 3px;
          color: var(--secondary);
          font-size: 10px;
        }

        .record-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #B7BBC2;
        }

        .record-financials {
          display: grid;
          grid-template-columns: repeat(3, minmax(70px, 1fr));
          gap: 15px;
        }

        .record-financial {
          min-width: 0;
        }

        .record-financial-label {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .045em;
          text-transform: uppercase;
        }

        .record-financial-value {
          display: block;
          margin-top: 3px;
          color: var(--text);
          font-size: 12px;
          font-weight: 750;
          white-space: nowrap;
        }

        .record-financial-value.gross {
          color: var(--green);
        }

        .record-financial-value.bonus {
          color: var(--orange);
        }

        .record-financial-value.net {
          color: var(--blue);
          font-size: 13px;
        }

        .record-right {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 9px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 750;
        }

        .status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .record-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .record-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 29px;
          padding: 0 9px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface);
          color: var(--secondary);
          font: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition:
            border-color .15s ease,
            background .15s ease,
            color .15s ease;
        }

        .record-button:hover:not(:disabled) {
          border-color: #C9D0DC;
          background: #F8F9FB;
          color: var(--text);
        }

        .record-button.pay {
          border-color: #CFEBDD;
          background: var(--green-soft);
          color: var(--green);
        }

        .record-button.pay:hover:not(:disabled) {
          background: #DFF3E9;
          border-color: #B9E1CE;
        }

        .record-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        /* Empty */

        .payroll-empty {
          padding: 65px 20px;
          text-align: center;
        }

        .payroll-empty-icon {
          display: grid;
          place-items: center;
          width: 50px;
          height: 50px;
          margin: 0 auto 13px;
          border-radius: 13px;
          background: var(--purple-soft);
          color: var(--purple);
        }

        .payroll-empty-title {
          color: var(--text);
          font-size: 14px;
          font-weight: 750;
        }

        .payroll-empty-text {
          max-width: 340px;
          margin: 5px auto 0;
          color: var(--secondary);
          font-size: 11px;
          line-height: 1.5;
        }

        /* Loading */

        .payroll-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 360px;
        }

        .payroll-spinner {
          width: 27px;
          height: 27px;
          border: 3px solid #E1E5EB;
          border-top-color: var(--blue);
          border-radius: 50%;
          animation: payrollSpin .7s linear infinite;
        }

        @keyframes payrollSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Responsive */

        @media (max-width: 1100px) {
          .payroll-main-grid {
            grid-template-columns: 1fr;
          }

          .payroll-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .payroll-record {
            grid-template-columns: 1fr auto;
          }

          .record-financials {
            grid-column: 1 / -1;
            grid-row: 2;
            padding-top: 13px;
            border-top: 1px solid #F0F1F3;
          }

          .record-right {
            grid-column: 2;
            grid-row: 1;
          }
        }

        @media (max-width: 680px) {
          .payroll-page {
            padding: 20px 15px 60px;
          }

          .payroll-header {
            flex-direction: column;
          }

          .payroll-header-meta {
            width: 100%;
          }

          .payroll-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .payroll-form-grid {
            grid-template-columns: 1fr;
          }

          .payroll-field.full {
            grid-column: auto;
          }

          .payroll-preview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .payroll-card-header,
          .records-header {
            padding: 16px;
          }

          .payroll-form,
          .salary-card-body {
            padding: 17px 16px;
          }

          .payroll-record {
            padding: 15px 16px;
          }

          .records-summary {
            display: none;
          }
        }

        @media (max-width: 460px) {
          .payroll-kpis {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .payroll-kpi {
            padding: 13px;
          }

          .payroll-kpi-value {
            font-size: 18px;
          }

          .payroll-kpi-caption {
            font-size: 10px;
          }

          .payroll-preview-grid {
            grid-template-columns: 1fr 1fr;
          }

          .record-financials {
            grid-template-columns: repeat(2, 1fr);
            row-gap: 11px;
          }

          .record-right {
            align-items: flex-end;
          }

          .record-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .record-button {
            min-width: 90px;
          }
        }
      `}</style>

      <div className="payroll-page">
        <div className="payroll-container">

          {/* HEADER */}
          <header className="payroll-header">
            <div>
              <div className="payroll-eyebrow">
                <span className="payroll-eyebrow-dot" />
                Payroll management
              </div>

              <h1 className="payroll-title">
                Payroll Processing
              </h1>

              <p className="payroll-subtitle">
                Process employee salaries, manage deductions and
                generate professional payslips.
              </p>
            </div>

            <div className="payroll-header-meta">
              <CalendarDaysIcon width={15} height={15} />
              {periodLabel(
                new Date().getMonth() + 1,
                CURRENT_YEAR
              )}
            </div>
          </header>

          {/* KPI CARDS */}
          <section className="payroll-kpis">

            <div className="payroll-kpi">
              <div className="payroll-kpi-top">
                <span className="payroll-kpi-label">
                  Payroll records
                </span>

                <div
                  className="payroll-kpi-icon"
                  style={{
                    background: '#F1EDFF',
                    color: '#7357C8',
                  }}
                >
                  <DocumentTextIcon width={18} />
                </div>
              </div>

              <div className="payroll-kpi-value">
                {payrolls.length}
              </div>

              <div className="payroll-kpi-caption">
                Total processed records
              </div>
            </div>

            <div className="payroll-kpi">
              <div className="payroll-kpi-top">
                <span className="payroll-kpi-label">
                  Gross payroll
                </span>

                <div
                  className="payroll-kpi-icon"
                  style={{
                    background: '#EAF7F1',
                    color: '#16845B',
                  }}
                >
                  <CurrencyRupeeIcon width={18} />
                </div>
              </div>

              <div className="payroll-kpi-value">
                {formatINR(totalGross)}
              </div>

              <div className="payroll-kpi-caption">
                Total gross salary
              </div>
            </div>

            <div className="payroll-kpi">
              <div className="payroll-kpi-top">
                <span className="payroll-kpi-label">
                  Net payroll
                </span>

                <div
                  className="payroll-kpi-icon"
                  style={{
                    background: '#EDF3FF',
                    color: '#3567D6',
                  }}
                >
                  <BanknotesIcon width={18} />
                </div>
              </div>

              <div className="payroll-kpi-value">
                {formatINR(totalNet)}
              </div>

              <div className="payroll-kpi-caption">
                Employee take-home total
              </div>
            </div>

            <div className="payroll-kpi">
              <div className="payroll-kpi-top">
                <span className="payroll-kpi-label">
                  Payment status
                </span>

                <div
                  className="payroll-kpi-icon"
                  style={{
                    background: '#FFF4E5',
                    color: '#C97816',
                  }}
                >
                  <CheckCircleIcon width={18} />
                </div>
              </div>

              <div className="payroll-kpi-value">
                {paidCount}
                <span
                  style={{
                    color: '#969BA5',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {' '}
                  / {payrolls.length}
                </span>
              </div>

              <div className="payroll-kpi-caption">
                {processedCount} awaiting payment
              </div>
            </div>

          </section>

          {/* MAIN */}
          <div className="payroll-main-grid">

            {/* PROCESS FORM */}
            <section className="payroll-card">

              <div className="payroll-card-header">
                <div>
                  <div className="payroll-card-title-row">
                    <div className="payroll-card-icon">
                      <BanknotesIcon width={18} />
                    </div>

                    <h2 className="payroll-card-title">
                      New payroll entry
                    </h2>
                  </div>

                  <p className="payroll-card-description">
                    Create and process salary for an employee.
                  </p>
                </div>

                <span className="payroll-auto-badge">
                  Auto calculated
                </span>
              </div>

              <form
                className="payroll-form"
                onSubmit={handleProcess}
              >

                {/* PERIOD */}
                <div className="payroll-section">
                  <div className="payroll-section-label">
                    Payroll period
                  </div>

                  <div className="payroll-form-grid">

                    <div className="payroll-field">
                      <label className="payroll-label">
                        Month
                      </label>

                      <div className="payroll-input-wrap payroll-select-wrap">
                        <select
                          className="payroll-select"
                          value={form.month}
                          onChange={setField('month')}
                        >
                          {MONTHS.map((month) => (
                            <option
                              key={month.value}
                              value={month.value}
                            >
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="payroll-field">
                      <label className="payroll-label">
                        Year
                      </label>

                      <div className="payroll-input-wrap payroll-select-wrap">
                        <select
                          className="payroll-select"
                          value={form.year}
                          onChange={setField('year')}
                        >
                          {YEARS.map((year) => (
                            <option
                              key={year}
                              value={year}
                            >
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>
                </div>

                {/* EMPLOYEE */}
                <div className="payroll-section">
                  <div className="payroll-section-label">
                    Employee
                  </div>

                  <div className="payroll-field">
                    <label className="payroll-label">
                      Select employee
                    </label>

                    <div className="payroll-input-wrap payroll-select-wrap">
                      <select
                        className="payroll-select"
                        value={form.employeeId}
                        onChange={setField('employeeId')}
                        required
                      >
                        <option value="">
                          Select employee
                        </option>

                        {employees.map((employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {getEmployeeName(employee)} (
                            {getEmployeeCode(employee)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedEmployee && (
                      <div className="payroll-selected-employee">
                        <EmployeeAvatar
                          employee={selectedEmployee}
                          size={38}
                        />

                        <div>
                          <div className="payroll-selected-name">
                            {getEmployeeName(selectedEmployee)}
                          </div>

                          <div className="payroll-selected-meta">
                            {getEmployeeCode(selectedEmployee)}
                            {selectedEmployee.designation
                              ? ` · ${selectedEmployee.designation}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ADDITIONS */}
                <div className="payroll-section">
                  <div className="payroll-section-label">
                    Earnings
                  </div>

                  <div className="payroll-form-grid">

                    <div className="payroll-field">
                      <label className="payroll-label">
                        Bonus / incentive
                      </label>

                      <input
                        type="number"
                        min="0"
                        className="payroll-input earning"
                        value={form.bonus}
                        onChange={setField('bonus')}
                        placeholder="0"
                      />

                      <span className="payroll-input-hint">
                        One-time bonus added to salary.
                      </span>
                    </div>

                  </div>
                </div>

                {/* DEDUCTIONS */}
                <div className="payroll-section">
                  <div className="payroll-section-label">
                    Additional deductions
                  </div>

                  <div className="payroll-form-grid">

                    <div className="payroll-field">
                      <label className="payroll-label">
                        Advance recovery
                      </label>

                      <input
                        type="number"
                        min="0"
                        className="payroll-input deduction"
                        value={form.advance}
                        onChange={setField('advance')}
                        placeholder="0"
                      />

                      <span className="payroll-input-hint">
                        Recovery of previously issued advance.
                      </span>
                    </div>

                    <div className="payroll-field">
                      <label className="payroll-label">
                        Other deductions
                      </label>

                      <input
                        type="number"
                        min="0"
                        className="payroll-input deduction"
                        value={form.otherDeductions}
                        onChange={setField('otherDeductions')}
                        placeholder="0"
                      />

                      <span className="payroll-input-hint">
                        Miscellaneous payroll deductions.
                      </span>
                    </div>

                  </div>
                </div>

                <button
                  type="submit"
                  className="payroll-submit"
                  disabled={
                    processing || !form.employeeId
                  }
                >
                  <CheckCircleIcon width={17} />

                  {processing
                    ? 'Processing payroll...'
                    : 'Process payroll'}
                </button>

              </form>

              {/* PREVIEW */}
              {preview && (
                <div className="payroll-preview">

                  <div className="payroll-preview-header">
                    <div className="payroll-preview-title">
                      Salary preview
                    </div>

                    <div className="payroll-preview-period">
                      {periodLabel(
                        form.month,
                        form.year
                      )}
                    </div>
                  </div>

                  <div className="payroll-preview-grid">

                    <div className="payroll-preview-item">
                      <span className="payroll-preview-label">
                        Gross salary
                      </span>

                      <span className="payroll-preview-value green">
                        {formatINR(preview.gross)}
                      </span>
                    </div>

                    {preview.bonus > 0 && (
                      <div className="payroll-preview-item">
                        <span className="payroll-preview-label">
                          Bonus
                        </span>

                        <span className="payroll-preview-value orange">
                          +{formatINR(preview.bonus)}
                        </span>
                      </div>
                    )}

                    <div className="payroll-preview-item">
                      <span className="payroll-preview-label">
                        ESIC
                      </span>

                      <span className="payroll-preview-value red">
                        {preview.esic > 0
                          ? `−${formatINR(preview.esic)}`
                          : '—'}
                      </span>
                    </div>

                    {preview.advance > 0 && (
                      <div className="payroll-preview-item">
                        <span className="payroll-preview-label">
                          Advance
                        </span>

                        <span className="payroll-preview-value red">
                          −{formatINR(preview.advance)}
                        </span>
                      </div>
                    )}

                    {preview.otherDed > 0 && (
                      <div className="payroll-preview-item">
                        <span className="payroll-preview-label">
                          Other deductions
                        </span>

                        <span className="payroll-preview-value red">
                          −{formatINR(preview.otherDed)}
                        </span>
                      </div>
                    )}

                    <div className="payroll-preview-item">
                      <span className="payroll-preview-label">
                        Total deductions
                      </span>

                      <span className="payroll-preview-value red">
                        −{formatINR(preview.totalDed)}
                      </span>
                    </div>

                  </div>

                  <div className="payroll-net">
                    <span className="payroll-net-label">
                      Estimated net pay
                    </span>

                    <span className="payroll-net-value">
                      {formatINR(preview.net)}
                    </span>
                  </div>

                </div>
              )}

            </section>

            {/* EMPLOYEE SALARY */}
            <section className="payroll-card">

              <div className="payroll-card-header">
                <div>
                  <div className="payroll-card-title-row">
                    <div
                      className="payroll-card-icon"
                      style={{
                        background: '#EAF7F1',
                        color: '#16845B',
                      }}
                    >
                      <CurrencyRupeeIcon width={18} />
                    </div>

                    <h2 className="payroll-card-title">
                      Salary structure
                    </h2>
                  </div>

                  <p className="payroll-card-description">
                    Current salary components for the selected
                    employee.
                  </p>
                </div>
              </div>

              {selectedEmployee ? (
                <div className="salary-card-body">

                  <div className="salary-employee">
                    <EmployeeAvatar
                      employee={selectedEmployee}
                      size={46}
                    />

                    <div>
                      <div className="salary-employee-name">
                        {getEmployeeName(selectedEmployee)}
                      </div>

                      <div className="salary-employee-meta">
                        {getEmployeeCode(selectedEmployee)}
                        {selectedEmployee.department
                          ? ` · ${selectedEmployee.department}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const salary =
                      getSalary(selectedEmployee);

                    const gross =
                      salary.basic +
                      salary.hra +
                      salary.da +
                      salary.ta +
                      salary.other;

                    return (
                      <>
                        <div className="salary-breakdown">

                          <div className="salary-row">
                            <span className="salary-row-label">
                              Basic salary
                            </span>

                            <span className="salary-row-value">
                              {formatINR(salary.basic)}
                            </span>
                          </div>

                          <div className="salary-row">
                            <span className="salary-row-label">
                              HRA
                            </span>

                            <span className="salary-row-value">
                              {formatINR(salary.hra)}
                            </span>
                          </div>

                          <div className="salary-row">
                            <span className="salary-row-label">
                              DA
                            </span>

                            <span className="salary-row-value">
                              {formatINR(salary.da)}
                            </span>
                          </div>

                          <div className="salary-row">
                            <span className="salary-row-label">
                              TA
                            </span>

                            <span className="salary-row-value">
                              {formatINR(salary.ta)}
                            </span>
                          </div>

                          <div className="salary-row">
                            <span className="salary-row-label">
                              Other
                            </span>

                            <span className="salary-row-value">
                              {formatINR(salary.other)}
                            </span>
                          </div>

                          <div className="salary-row total">
                            <span className="salary-row-label">
                              Monthly gross
                            </span>

                            <span className="salary-row-value">
                              {formatINR(gross)}
                            </span>
                          </div>

                        </div>

                        <div className="salary-info">

                          <div className="salary-info-item">
                            <div className="salary-info-label">
                              Payroll month
                            </div>

                            <div className="salary-info-value">
                              {periodLabel(
                                form.month,
                                form.year
                              )}
                            </div>
                          </div>

                          <div className="salary-info-item">
                            <div className="salary-info-label">
                              Employee ID
                            </div>

                            <div className="salary-info-value">
                              {getEmployeeCode(
                                selectedEmployee
                              )}
                            </div>
                          </div>

                        </div>
                      </>
                    );
                  })()}

                </div>
              ) : (
                <div className="payroll-empty">
                  <div className="payroll-empty-icon">
                    <UserCircleIcon width={25} />
                  </div>

                  <div className="payroll-empty-title">
                    Select an employee
                  </div>

                  <div className="payroll-empty-text">
                    Choose an employee from the payroll form
                    to view their current salary structure.
                  </div>
                </div>
              )}

            </section>

          </div>

          {/* PAYROLL RECORDS */}
          <section className="payroll-records">

            <div className="payroll-records-card">

              <div className="records-header">
                <div className="records-title-wrap">

                  <div className="records-title-icon">
                    <DocumentTextIcon width={18} />
                  </div>

                  <div>
                    <div className="records-title">
                      Payroll records
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 3,
                      }}
                    >
                      <span className="records-count">
                        {payrolls.length}
                      </span>

                      <span
                        style={{
                          color: '#969BA5',
                          fontSize: 10,
                        }}
                      >
                        salary records
                      </span>
                    </div>
                  </div>

                </div>

                {payrolls.length > 0 && (
                  <div className="records-summary">
                    {employeeCount} employee
                    {employeeCount === 1 ? '' : 's'} ·{' '}
                    {paidCount} paid
                  </div>
                )}
              </div>

              {loading ? (
                <div className="payroll-loading">
                  <div className="payroll-spinner" />
                </div>
              ) : payrolls.length === 0 ? (
                <div className="payroll-empty">

                  <div className="payroll-empty-icon">
                    <BanknotesIcon width={25} />
                  </div>

                  <div className="payroll-empty-title">
                    No payroll records yet
                  </div>

                  <div className="payroll-empty-text">
                    Process your first employee payroll above
                    and the generated record will appear here.
                  </div>

                </div>
              ) : (
                <div className="records-list">

                  {payrolls.map((payroll) => {
                    const status =
                      STATUS_META[payroll.status] ||
                      STATUS_META.draft;

                    const employee =
                      payroll.employee || {};

                    const gross =
                      payroll.grossSalary ??
                      payroll.gross_salary;

                    const net =
                      payroll.netSalary ??
                      payroll.net_salary;

                    const bonus =
                      payroll.earnings?.bonus ??
                      payroll.bonus ??
                      0;

                    const advance =
                      payroll.deductions?.advance ??
                      payroll.advance ??
                      0;

                    return (
                      <div
                        className="payroll-record"
                        key={payroll.id}
                      >

                        {/* EMPLOYEE */}
                        <div className="record-employee">

                          <EmployeeAvatar
                            employee={employee}
                            size={42}
                          />

                          <div className="record-employee-info">

                            <div className="record-name">
                              {getEmployeeName(employee)}
                            </div>

                            <div className="record-meta">

                              <span>
                                {periodLabel(
                                  payroll.month,
                                  payroll.year
                                )}
                              </span>

                              {getEmployeeCode(
                                employee
                              ) !== '—' && (
                                <>
                                  <span className="record-dot" />

                                  <span>
                                    {getEmployeeCode(
                                      employee
                                    )}
                                  </span>
                                </>
                              )}

                            </div>

                          </div>

                        </div>

                        {/* FINANCIALS */}
                        <div className="record-financials">

                          <div className="record-financial">
                            <span className="record-financial-label">
                              Gross
                            </span>

                            <span className="record-financial-value gross">
                              {formatINR(gross)}
                            </span>
                          </div>

                          {number(bonus) > 0 ? (
                            <div className="record-financial">
                              <span className="record-financial-label">
                                Bonus
                              </span>

                              <span className="record-financial-value bonus">
                                {formatINR(bonus)}
                              </span>
                            </div>
                          ) : (
                            <div className="record-financial">
                              <span className="record-financial-label">
                                Advance
                              </span>

                              <span className="record-financial-value">
                                {number(advance) > 0
                                  ? `−${formatINR(advance)}`
                                  : '—'}
                              </span>
                            </div>
                          )}

                          <div className="record-financial">
                            <span className="record-financial-label">
                              Net pay
                            </span>

                            <span className="record-financial-value net">
                              {formatINR(net)}
                            </span>
                          </div>

                        </div>

                        {/* STATUS + ACTIONS */}
                        <div className="record-right">

                          <span
                            className="status-badge"
                            style={{
                              background: status.bg,
                              color: status.text,
                            }}
                          >
                            <span
                              className="status-dot"
                              style={{
                                background: status.dot,
                              }}
                            />

                            {status.label}
                          </span>

                          <div className="record-actions">

                            {payroll.status ===
                              'processed' && (
                              <button
                                type="button"
                                className="record-button pay"
                                onClick={() =>
                                  handleMarkPaid(
                                    payroll.id
                                  )
                                }
                              >
                                <CheckCircleIcon
                                  width={13}
                                />
                                Mark paid
                              </button>
                            )}

                            <button
                              type="button"
                              className="record-button"
                              disabled={
                                genLoading ===
                                payroll.id
                              }
                              onClick={() =>
                                handleGeneratePayslip(
                                  payroll.id
                                )
                              }
                            >
                              <DocumentArrowDownIcon
                                width={13}
                              />

                              {genLoading === payroll.id
                                ? 'Generating...'
                                : 'Payslip PDF'}
                            </button>

                          </div>

                        </div>

                      </div>
                    );
                  })}

                </div>
              )}

            </div>

          </section>

        </div>
      </div>
    </>
  );
}
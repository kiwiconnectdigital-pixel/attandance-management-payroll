import { useState, useEffect, useCallback } from "react";
import { holidayAPI } from "../../services/api";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  BuildingOffice2Icon,
  GlobeAltIcon,
  MapPinIcon,
  SparklesIcon,
  BriefcaseIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

// ─────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFBFC",
  text: "#15171C",
  secondary: "#676C76",
  muted: "#969BA5",
  border: "#E7E9ED",

  blue: "#3567D6",
  blueSoft: "#EDF3FF",

  green: "#16845B",
  greenSoft: "#EAF7F1",

  orange: "#C97816",
  orangeSoft: "#FFF4E5",

  red: "#C94B4B",
  redSoft: "#FDEEEE",

  purple: "#7357C8",
  purpleSoft: "#F1EDFF",
};

const TYPES = ["national", "regional", "optional", "company"];

const TYPE_META = {
  national: {
    label: "National",
    color: COLORS.blue,
    bg: COLORS.blueSoft,
    dot: COLORS.blue,
    icon: GlobeAltIcon,
  },

  regional: {
    label: "Regional",
    color: COLORS.green,
    bg: COLORS.greenSoft,
    dot: COLORS.green,
    icon: MapPinIcon,
  },

  optional: {
    label: "Optional",
    color: COLORS.orange,
    bg: COLORS.orangeSoft,
    dot: COLORS.orange,
    icon: SparklesIcon,
  },

  company: {
    label: "Company",
    color: COLORS.purple,
    bg: COLORS.purpleSoft,
    dot: COLORS.purple,
    icon: BriefcaseIcon,
  },
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm = {
  name: "",
  date: "",
  type: "national",
  description: "",
  branch: "",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSunday(year, month, day) {
  return new Date(year, month, day).getDay() === 0;
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function errMsg(e) {
  return e?.response?.data?.message || e?.message || "Something went wrong";
}

function getHolidayId(holiday) {
  return holiday?._id ?? holiday?.id;
}

function getHolidayDate(holiday) {
  if (!holiday?.date) return null;

  const raw = String(holiday.date);

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getHolidayDay(holiday) {
  const value = getHolidayDate(holiday);

  if (!value) return null;

  return Number(value.slice(8, 10));
}

function formatReadableDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function HolidayManager() {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const [filterType, setFilterType] = useState("all");

  const [toast, setToast] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  // ─────────────────────────────────────────────────────────────
  // Toast
  // ─────────────────────────────────────────────────────────────

  function showToast(message, ok = true) {
    setToast({
      msg: message,
      ok,
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch Holidays
  // ─────────────────────────────────────────────────────────────

  const fetchHolidays = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        year,
        month: month + 1,
      };

      if (filterType !== "all") {
        params.type = filterType;
      }

      const res = await holidayAPI.getAll(params);

      const data = res.data?.data;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.holidays)
          ? data.holidays
          : [];

      setHolidays(list);
    } catch (e) {
      showToast(errMsg(e), false);
    } finally {
      setLoading(false);
    }
  }, [year, month, filterType]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // ─────────────────────────────────────────────────────────────
  // Calendar
  // ─────────────────────────────────────────────────────────────

  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);

  const weekdayCount = Array.from(
    { length: totalDays },
    (_, index) => index + 1,
  ).filter((day) => !isSunday(year, month, day)).length;

  const holidayOnWeekday = holidays.filter((holiday) => {
    const day = getHolidayDay(holiday);

    if (!day) return false;

    return !isSunday(year, month, day);
  }).length;

  const workingDays = Math.max(weekdayCount - holidayOnWeekday, 0);

  const holidayMap = {};

  holidays.forEach((holiday) => {
    const day = getHolidayDay(holiday);

    if (!day) return;

    if (!holidayMap[day]) {
      holidayMap[day] = [];
    }

    holidayMap[day].push(holiday);
  });

  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day++) {
    cells.push(day);
  }

  // ─────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────

  function openAdd(prefillDate = "") {
    setEditId(null);

    setForm({
      ...emptyForm,
      date: prefillDate,
    });

    setShowForm(true);
  }

  function openEdit(holiday) {
    setEditId(getHolidayId(holiday));

    setForm({
      name: holiday?.name || "",
      date: getHolidayDate(holiday) || "",
      type: holiday?.type || "national",
      description: holiday?.description || "",
      branch: holiday?.branch || "",
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.name.trim() || !form.date) {
      showToast("Holiday name and date are required", false);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        date: form.date,
        type: form.type,
        description: form.description.trim(),
        branch: form.branch.trim() || null,
      };

      if (editId) {
        await holidayAPI.update(editId, payload);

        showToast("Holiday updated successfully");
      } else {
        await holidayAPI.create(payload);

        showToast("Holiday created successfully");
      }

      closeForm();
      await fetchHolidays();
    } catch (e) {
      showToast(errMsg(e), false);
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    if (!id) return;

    try {
      await holidayAPI.delete(id);

      showToast("Holiday deleted successfully");

      setDeleteId(null);

      await fetchHolidays();
    } catch (e) {
      showToast(errMsg(e), false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Month Navigation
  // ─────────────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((current) => current - 1);
    } else {
      setMonth((current) => current - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((current) => current + 1);
    } else {
      setMonth((current) => current + 1);
    }
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .holiday-manager {
          min-height: 100vh;
          background: ${COLORS.bg};
          color: ${COLORS.text};
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 28px;
          box-sizing: border-box;
        }

        .holiday-shell {
          max-width: 1500px;
          margin: 0 auto;
        }

        .holiday-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .holiday-title-wrap {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .holiday-title-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          flex-shrink: 0;
        }

        .holiday-title-icon svg {
          width: 23px;
          height: 23px;
        }

        .holiday-title {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.4px;
        }

        .holiday-subtitle {
          margin: 7px 0 0;
          color: ${COLORS.secondary};
          font-size: 14px;
          line-height: 1.5;
        }

        .primary-button {
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border: 1px solid ${COLORS.blue};
          border-radius: 10px;
          background: ${COLORS.blue};
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all .18s ease;
          box-shadow: 0 5px 14px rgba(53, 103, 214, .16);
        }

        .primary-button:hover {
          background: #2f5dc4;
          transform: translateY(-1px);
        }

        .primary-button svg {
          width: 18px;
          height: 18px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 15px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, .035);
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .stat-label {
          color: ${COLORS.secondary};
          font-size: 12px;
          font-weight: 600;
        }

        .stat-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon svg {
          width: 18px;
          height: 18px;
        }

        .stat-value {
          margin-top: 14px;
          font-size: 25px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -.4px;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 370px;
          gap: 20px;
          align-items: start;
        }

        .panel {
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(16, 24, 40, .035);
        }

        .calendar-panel {
          padding: 20px;
        }

        .calendar-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 18px;
          border-bottom: 1px solid ${COLORS.border};
          margin-bottom: 18px;
        }

        .calendar-month-title {
          min-width: 170px;
        }

        .calendar-month-name {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -.2px;
        }

        .calendar-month-caption {
          margin-top: 4px;
          color: ${COLORS.muted};
          font-size: 12px;
        }

        .month-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-button {
          width: 38px;
          height: 38px;
          border: 1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all .18s ease;
        }

        .icon-button:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
          border-color: #D7DAE0;
        }

        .icon-button svg {
          width: 18px;
          height: 18px;
        }

        .today-button {
          height: 38px;
          padding: 0 12px;
          border: 1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .today-button:hover {
          color: ${COLORS.blue};
          border-color: #C8D6F7;
          background: ${COLORS.blueSoft};
        }

        .calendar-selects {
          display: flex;
          gap: 8px;
        }

        .calendar-select,
        .filter-select {
          height: 38px;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: ${COLORS.surface};
          color: ${COLORS.text};
          padding: 0 11px;
          font-size: 12px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
        }

        .calendar-select:focus,
        .filter-select:focus,
        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #AFC2EF;
          box-shadow: 0 0 0 3px ${COLORS.blueSoft};
        }

        .weekday-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 8px;
        }

        .weekday {
          text-align: center;
          padding: 6px 0;
          color: ${COLORS.muted};
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .35px;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }

        .calendar-cell {
          position: relative;
          min-height: 92px;
          padding: 10px;
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          background: ${COLORS.surface};
          cursor: pointer;
          transition: all .18s ease;
          overflow: hidden;
        }

        .calendar-cell:hover {
          border-color: #C9D5EE;
          background: #FCFDFF;
          box-shadow: 0 4px 12px rgba(16, 24, 40, .05);
          transform: translateY(-1px);
        }

        .calendar-cell.sunday {
          background: #FAFAFB;
        }

        .calendar-cell.today {
          border-color: #AFC2EF;
          box-shadow: inset 0 0 0 1px #AFC2EF;
        }

        .calendar-cell.has-holiday {
          background: #FCFDFF;
        }

        .day-number-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .day-number {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: ${COLORS.text};
        }

        .today .day-number {
          background: ${COLORS.blue};
          color: #fff;
        }

        .sunday .day-number {
          color: ${COLORS.muted};
        }

        .holiday-marker {
          margin-top: 8px;
          border-radius: 8px;
          padding: 6px 7px;
          overflow: hidden;
        }

        .holiday-marker-name {
          font-size: 11px;
          font-weight: 600;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .holiday-marker-type {
          margin-top: 2px;
          font-size: 9px;
          opacity: .8;
        }

        .calendar-more {
          margin-top: 5px;
          color: ${COLORS.muted};
          font-size: 9px;
          font-weight: 600;
        }

        .legend {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          padding-top: 18px;
          margin-top: 18px;
          border-top: 1px solid ${COLORS.border};
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: ${COLORS.secondary};
          font-size: 11px;
          font-weight: 500;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-panel {
          padding: 18px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .panel-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .panel-subtitle {
          margin: 4px 0 0;
          color: ${COLORS.muted};
          font-size: 11px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: 1px solid ${COLORS.border};
          border-radius: 9px;
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .close-button:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .close-button svg {
          width: 16px;
          height: 16px;
        }

        .form-group {
          margin-bottom: 13px;
        }

        .form-label {
          display: block;
          margin-bottom: 6px;
          color: ${COLORS.secondary};
          font-size: 11px;
          font-weight: 600;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: ${COLORS.surface};
          color: ${COLORS.text};
          outline: none;
          font-family: inherit;
          font-size: 12px;
          padding: 10px 11px;
          transition: all .18s ease;
        }

        .form-textarea {
          min-height: 74px;
          resize: vertical;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          margin-top: 17px;
        }

        .form-submit {
          flex: 1;
          height: 40px;
          border: 1px solid ${COLORS.blue};
          border-radius: 10px;
          background: ${COLORS.blue};
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .form-submit:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .form-cancel {
          height: 40px;
          padding: 0 14px;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .form-cancel:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .holiday-list-panel {
          padding: 18px;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .list-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .list-count {
          margin-top: 4px;
          color: ${COLORS.muted};
          font-size: 11px;
        }

        .holiday-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .holiday-item {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px;
          border: 1px solid ${COLORS.border};
          border-radius: 12px;
          background: ${COLORS.surface};
          transition: all .18s ease;
        }

        .holiday-item:hover {
          border-color: #D7DAE0;
          background: ${COLORS.surfaceAlt};
        }

        .holiday-date {
          width: 43px;
          height: 43px;
          border-radius: 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .holiday-date-number {
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
        }

        .holiday-date-day {
          margin-top: 3px;
          font-size: 9px;
          font-weight: 600;
          opacity: .8;
        }

        .holiday-info {
          min-width: 0;
          flex: 1;
        }

        .holiday-name {
          color: ${COLORS.text};
          font-size: 12px;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .holiday-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 5px;
          min-width: 0;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          white-space: nowrap;
        }

        .branch-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .holiday-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .small-action {
          width: 31px;
          height: 31px;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${COLORS.surface};
          cursor: pointer;
          transition: all .18s ease;
        }

        .small-action svg {
          width: 15px;
          height: 15px;
        }

        .small-action.edit {
          color: ${COLORS.blue};
        }

        .small-action.edit:hover {
          background: ${COLORS.blueSoft};
          border-color: #C8D6F7;
        }

        .small-action.delete {
          color: ${COLORS.red};
        }

        .small-action.delete:hover {
          background: ${COLORS.redSoft};
          border-color: #F0CACA;
        }

        .empty-state {
          padding: 38px 18px;
          text-align: center;
          color: ${COLORS.secondary};
        }

        .empty-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${COLORS.surfaceAlt};
          border: 1px solid ${COLORS.border};
          color: ${COLORS.muted};
        }

        .empty-icon svg {
          width: 22px;
          height: 22px;
        }

        .empty-title {
          color: ${COLORS.text};
          font-size: 13px;
          font-weight: 650;
        }

        .empty-text {
          margin-top: 5px;
          color: ${COLORS.muted};
          font-size: 11px;
        }

        .loading-state {
          padding: 38px 18px;
          text-align: center;
          color: ${COLORS.secondary};
          font-size: 12px;
        }

        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2000;
          min-width: 260px;
          max-width: 380px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid;
          border-radius: 11px;
          background: ${COLORS.surface};
          box-shadow: 0 12px 35px rgba(16, 24, 40, .12);
          font-size: 12px;
          font-weight: 600;
        }

        .toast-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .toast-icon svg {
          width: 15px;
          height: 15px;
        }

        .delete-overlay {
          position: fixed;
          inset: 0;
          z-index: 1900;
          background: rgba(15, 23, 42, .25);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .delete-modal {
          width: 100%;
          max-width: 390px;
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, .18);
        }

        .delete-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${COLORS.redSoft};
          color: ${COLORS.red};
          margin-bottom: 14px;
        }

        .delete-icon svg {
          width: 21px;
          height: 21px;
        }

        .delete-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }

        .delete-text {
          margin: 7px 0 0;
          color: ${COLORS.secondary};
          font-size: 12px;
          line-height: 1.5;
        }

        .delete-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 20px;
        }

        .delete-cancel,
        .delete-confirm {
          height: 38px;
          padding: 0 14px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .delete-cancel {
          border: 1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
        }

        .delete-confirm {
          border: 1px solid ${COLORS.red};
          background: ${COLORS.red};
          color: #fff;
        }

        @media (max-width: 1150px) {
          .workspace {
            grid-template-columns: minmax(0, 1fr) 330px;
          }

          .calendar-cell {
            min-height: 82px;
          }
        }

        @media (max-width: 950px) {
          .holiday-manager {
            padding: 20px;
          }

          .workspace {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .holiday-manager {
            padding: 14px;
          }

          .holiday-header {
            flex-direction: column;
          }

          .primary-button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .stat-card {
            padding: 14px;
          }

          .stat-value {
            font-size: 22px;
          }

          .calendar-panel {
            padding: 13px;
          }

          .calendar-toolbar {
            flex-wrap: wrap;
          }

          .calendar-month-title {
            order: 1;
            width: 100%;
          }

          .month-actions {
            order: 2;
          }

          .calendar-selects {
            order: 3;
            margin-left: auto;
          }

          .calendar-cell {
            min-height: 68px;
            padding: 7px;
            border-radius: 9px;
          }

          .weekday-grid,
          .calendar-grid {
            gap: 5px;
          }

          .holiday-marker {
            margin-top: 4px;
            padding: 4px;
          }

          .holiday-marker-type {
            display: none;
          }

          .holiday-marker-name {
            font-size: 9px;
          }

          .sidebar {
            display: flex;
          }
        }

        @media (max-width: 480px) {
          .holiday-title {
            font-size: 23px;
          }

          .holiday-subtitle {
            font-size: 12px;
          }

          .calendar-selects {
            width: 100%;
          }

          .calendar-select {
            flex: 1;
          }

          .today-button {
            display: none;
          }

          .calendar-cell {
            min-height: 60px;
          }

          .day-number {
            width: 23px;
            height: 23px;
            font-size: 10px;
          }

          .holiday-marker-name {
            font-size: 8px;
          }

          .holiday-actions {
            flex-direction: column;
          }

          .holiday-item {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="holiday-manager">
        <div className="holiday-shell">
          {/* ───────────────────────────────────────────── */}
          {/* Header */}
          {/* ───────────────────────────────────────────── */}

          <div className="holiday-header">
            <div className="holiday-title-wrap">
              <div className="holiday-title-icon">
                <CalendarDaysIcon />
              </div>

              <div>
                <h1 className="holiday-title">Holiday Calendar</h1>

                <p className="holiday-subtitle">
                  Manage public, regional and company holidays across your
                  workforce.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => openAdd()}
            >
              <PlusIcon />
              Add holiday
            </button>
          </div>

          {/* ───────────────────────────────────────────── */}
          {/* KPI Cards */}
          {/* ───────────────────────────────────────────── */}

          <div className="stats-grid">
            <StatCard
              label="Calendar days"
              value={totalDays}
              icon={CalendarDaysIcon}
              color={COLORS.blue}
              bg={COLORS.blueSoft}
              loading={loading}
            />

            <StatCard
              label="Working weekdays"
              value={weekdayCount}
              icon={BuildingOffice2Icon}
              color={COLORS.green}
              bg={COLORS.greenSoft}
              loading={loading}
            />

            <StatCard
              label="Holidays"
              value={holidayOnWeekday}
              icon={GlobeAltIcon}
              color={COLORS.orange}
              bg={COLORS.orangeSoft}
              loading={loading}
            />

            <StatCard
              label="Effective working days"
              value={workingDays}
              icon={CheckIcon}
              color={COLORS.purple}
              bg={COLORS.purpleSoft}
              loading={loading}
            />
          </div>

          {/* ───────────────────────────────────────────── */}
          {/* Main Workspace */}
          {/* ───────────────────────────────────────────── */}

          <div className="workspace">
            {/* Calendar */}
            <section className="panel calendar-panel">
              <div className="calendar-toolbar">
                <div className="calendar-month-title">
                  <div className="calendar-month-name">
                    {MONTHS[month]} {year}
                  </div>

                  <div className="calendar-month-caption">
                    {holidays.length} scheduled{" "}
                    {holidays.length === 1 ? "holiday" : "holidays"}
                  </div>
                </div>

                <div className="month-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={prevMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeftIcon />
                  </button>

                  <button
                    type="button"
                    className="today-button"
                    onClick={goToToday}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={nextMonth}
                    aria-label="Next month"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>

                <div className="calendar-selects">
                  <select
                    className="calendar-select"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((name, index) => (
                      <option key={name} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="calendar-select"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {Array.from(
                      { length: 8 },
                      (_, index) => today.getFullYear() - 2 + index,
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="weekday-grid">
                {WEEKDAYS.map((day) => (
                  <div className="weekday" key={day}>
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-grid">
                {cells.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} />;
                  }

                  const sunday = isSunday(year, month, day);
                  const dayHolidays = holidayMap[day] || [];
                  const firstHoliday = dayHolidays[0];

                  const isToday =
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === day;

                  const meta = firstHoliday
                    ? TYPE_META[firstHoliday.type] || TYPE_META.company
                    : null;

                  return (
                    <div
                      key={day}
                      className={[
                        "calendar-cell",
                        sunday ? "sunday" : "",
                        isToday ? "today" : "",
                        firstHoliday ? "has-holiday" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() =>
                        openAdd(formatDate(year, month, day))
                      }
                    >
                      <div className="day-number-row">
                        <div className="day-number">{day}</div>
                      </div>

                      {firstHoliday && meta && (
                        <>
                          <div
                            className="holiday-marker"
                            style={{
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            <div className="holiday-marker-name">
                              {firstHoliday.name}
                            </div>

                            <div className="holiday-marker-type">
                              {meta.label}
                            </div>
                          </div>

                          {dayHolidays.length > 1 && (
                            <div className="calendar-more">
                              +{dayHolidays.length - 1} more
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="legend">
                {TYPES.map((type) => {
                  const meta = TYPE_META[type];

                  return (
                    <div className="legend-item" key={type}>
                      <span
                        className="legend-dot"
                        style={{ background: meta.dot }}
                      />

                      {meta.label}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Sidebar */}
            <aside className="sidebar">
              {/* Form */}
              {showForm && (
                <section className="panel form-panel">
                  <div className="panel-heading">
                    <div>
                      <h2 className="panel-title">
                        {editId ? "Edit holiday" : "Add holiday"}
                      </h2>

                      <p className="panel-subtitle">
                        {editId
                          ? "Update the holiday details."
                          : "Add a holiday to the company calendar."}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="close-button"
                      onClick={closeForm}
                      aria-label="Close"
                    >
                      <XMarkIcon />
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Holiday name</label>

                    <input
                      className="form-input"
                      placeholder="e.g. Independence Day"
                      value={form.name}
                      onChange={(e) =>
                        updateForm("name", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date</label>

                    <input
                      type="date"
                      className="form-input"
                      value={form.date}
                      onChange={(e) =>
                        updateForm("date", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Holiday type</label>

                    <select
                      className="form-select"
                      value={form.type}
                      onChange={(e) =>
                        updateForm("type", e.target.value)
                      }
                    >
                      {TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_META[type].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>

                    <textarea
                      className="form-textarea"
                      placeholder="Optional holiday description"
                      value={form.description}
                      onChange={(e) =>
                        updateForm("description", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Branch</label>

                    <input
                      className="form-input"
                      placeholder="Optional branch"
                      value={form.branch}
                      onChange={(e) =>
                        updateForm("branch", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="form-submit"
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting
                        ? "Saving..."
                        : editId
                          ? "Update holiday"
                          : "Create holiday"}
                    </button>

                    <button
                      type="button"
                      className="form-cancel"
                      onClick={closeForm}
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              {/* Holiday List */}
              <section className="panel holiday-list-panel">
                <div className="list-header">
                  <div>
                    <h2 className="list-title">
                      {MONTHS[month]} holidays
                    </h2>

                    <div className="list-count">
                      {holidays.length}{" "}
                      {holidays.length === 1
                        ? "holiday"
                        : "holidays"}{" "}
                      scheduled
                    </div>
                  </div>

                  <select
                    className="filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All types</option>

                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_META[type].label}
                      </option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <div className="loading-state">
                    Loading holiday calendar...
                  </div>
                ) : holidays.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <CalendarDaysIcon />
                    </div>

                    <div className="empty-title">
                      No holidays scheduled
                    </div>

                    <div className="empty-text">
                      Add a holiday to this month's calendar.
                    </div>
                  </div>
                ) : (
                  <div className="holiday-list">
                    {holidays.map((holiday) => {
                      const meta =
                        TYPE_META[holiday.type] || TYPE_META.company;

                      const Icon = meta.icon;

                      const dateValue = getHolidayDate(holiday);

                      const date = dateValue
                        ? new Date(`${dateValue}T00:00:00`)
                        : null;

                      const id = getHolidayId(holiday);

                      return (
                        <div className="holiday-item" key={id}>
                          <div
                            className="holiday-date"
                            style={{
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            <div className="holiday-date-number">
                              {date
                                ? date.getDate()
                                : "--"}
                            </div>

                            <div className="holiday-date-day">
                              {date
                                ? WEEKDAYS[date.getDay()]
                                : ""}
                            </div>
                          </div>

                          <div className="holiday-info">
                            <div className="holiday-name">
                              {holiday.name}
                            </div>

                            <div className="holiday-meta">
                              <span
                                className="type-badge"
                                style={{
                                  background: meta.bg,
                                  color: meta.color,
                                }}
                              >
                                <Icon
                                  style={{
                                    width: 11,
                                    height: 11,
                                  }}
                                />

                                {meta.label}
                              </span>

                              {holiday.branch && (
                                <span className="branch-text">
                                  {holiday.branch}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="holiday-actions">
                            <button
                              type="button"
                              className="small-action edit"
                              onClick={() => openEdit(holiday)}
                              aria-label={`Edit ${holiday.name}`}
                              title="Edit holiday"
                            >
                              <PencilSquareIcon />
                            </button>

                            <button
                              type="button"
                              className="small-action delete"
                              onClick={() => setDeleteId(id)}
                              aria-label={`Delete ${holiday.name}`}
                              title="Delete holiday"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* Toast */}
      {/* ───────────────────────────────────────────── */}

      {toast && (
        <div
          className="toast"
          style={{
            borderColor: toast.ok
              ? "#C7E9DB"
              : "#F1CACA",
            color: toast.ok ? COLORS.green : COLORS.red,
          }}
        >
          <div
            className="toast-icon"
            style={{
              background: toast.ok
                ? COLORS.greenSoft
                : COLORS.redSoft,
            }}
          >
            {toast.ok ? <CheckIcon /> : <InformationCircleIcon />}
          </div>

          {toast.msg}
        </div>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* Delete Confirmation */}
      {/* ───────────────────────────────────────────── */}

      {deleteId && (
        <div className="delete-overlay">
          <div className="delete-modal">
            <div className="delete-icon">
              <TrashIcon />
            </div>

            <h3 className="delete-title">
              Delete holiday?
            </h3>

            <p className="delete-text">
              This holiday will be removed from the company
              calendar. This action cannot be undone.
            </p>

            <div className="delete-actions">
              <button
                type="button"
                className="delete-cancel"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-confirm"
                onClick={() => handleDelete(deleteId)}
              >
                Delete holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  loading,
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-label">{label}</div>

        <div
          className="stat-icon"
          style={{
            color,
            background: bg,
          }}
        >
          <Icon />
        </div>
      </div>

      <div className="stat-value">
        {loading ? "—" : value}
      </div>
    </div>
  );
}
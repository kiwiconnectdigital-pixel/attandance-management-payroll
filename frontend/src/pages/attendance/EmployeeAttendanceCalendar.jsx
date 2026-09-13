import React, { useState, useEffect } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  PencilSquareIcon,
  UserIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from "date-fns";

import {
  attendanceAPI,
  employeeAPI,
} from "../../services/api";

import toast, { Toaster } from "react-hot-toast";

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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const getEmployeeId = (employee) =>
  employee?.id ?? employee?._id ?? "";

const getEmployeeCode = (employee) =>
  employee?.employeeCode ??
  employee?.employee_code ??
  "";

const getEmployeeName = (employee) =>
  employee?.name ??
  employee?.fullName ??
  "Employee";

const getRecordId = (record) =>
  record?.id ??
  record?._id ??
  "";

const getWorkingHours = (record) =>
  Number(
    record?.workingHours ??
      record?.working_hours ??
      0
  );

const getLateMinutes = (record) =>
  Number(
    record?.lateByMinutes ??
      record?.late_by_minutes ??
      0
  );

const getCheckIn = (record) =>
  record?.checkIns?.[0]?.time ??
  record?.check_in ??
  record?.check_in_time ??
  null;

const getCheckOut = (record) =>
  record?.checkOuts?.[0]?.time ??
  record?.check_out ??
  record?.check_out_time ??
  null;

const getStatus = (record) =>
  record?.status ??
  record?.attendance_status ??
  "present";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const EmployeeAttendanceCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(
    new Date()
  );

  const [attendanceData, setAttendanceData] = useState({});
  const [employees, setEmployees] = useState([]);

  const [selectedEmployee, setSelectedEmployee] =
    useState("");

  const [loading, setLoading] = useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [
    selectedAttendanceRecord,
    setSelectedAttendanceRecord,
  ] = useState(null);

  const [
    selectedDateForModal,
    setSelectedDateForModal,
  ] = useState(null);

  const [editFormData, setEditFormData] = useState({
    status: "present",
    workingHours: 8,
    lateByMinutes: 0,
    checkInTime: "09:00",
    checkOutTime: "17:00",
    remarks: "",
  });

  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
  });

  // ─────────────────────────────────────────────────────────────
  // Fetch Employees
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchAttendance();
    }
  }, [currentMonth, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();

      const employeesData =
        response?.data?.data?.employees ||
        response?.data?.employees ||
        response?.data?.data ||
        [];

      const list = Array.isArray(employeesData)
        ? employeesData
        : [];

      setEmployees(list);

      if (
        list.length > 0 &&
        !selectedEmployee
      ) {
        setSelectedEmployee(
          String(getEmployeeId(list[0]))
        );
      }
    } catch (error) {
      console.error(error);

      toast.error(
        "Failed to fetch employees"
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Fetch Attendance
  // ─────────────────────────────────────────────────────────────

  const fetchAttendance = async () => {
    if (!selectedEmployee) return;

    try {
      setLoading(true);

      const month = format(
        currentMonth,
        "MM"
      );

      const year = format(
        currentMonth,
        "yyyy"
      );

      const response =
        await attendanceAPI.getAll({
          month,
          year,
          employeeId: selectedEmployee,
        });

      const records =
        response?.data?.data?.records ||
        response?.data?.records ||
        [];

      const attendanceMap = {};

      let present = 0;
      let absent = 0;
      let late = 0;
      let halfDay = 0;

      records.forEach((record) => {
        const rawDate =
          record?.date ||
          record?.attendance_date;

        if (!rawDate) return;

        const dateKey = format(
          new Date(rawDate),
          "yyyy-MM-dd"
        );

        const status = getStatus(record);

        let calendarStatus = "present";

        if (status === "absent") {
          calendarStatus = "absent";
          absent++;
        } else if (
          status === "half-day" ||
          status === "half_day"
        ) {
          calendarStatus = "half-day";
          halfDay++;
        } else if (
          record?.isLate ??
          record?.is_late ??
          false
        ) {
          calendarStatus = "late";
          late++;
        } else {
          calendarStatus = "present";
          present++;
        }

        attendanceMap[dateKey] = {
          ...record,
          calendarStatus,
        };
      });

      setAttendanceData(
        attendanceMap
      );

      setSummary({
        present,
        absent,
        late,
        halfDay,
      });
    } catch (error) {
      console.error(error);

      toast.error(
        "Failed to fetch attendance data"
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Calendar
  // ─────────────────────────────────────────────────────────────

  const generateCalendarDays = () => {
    const monthStart =
      startOfMonth(currentMonth);

    const monthEnd =
      endOfMonth(currentMonth);

    const startDate =
      startOfWeek(monthStart, {
        weekStartsOn: 0,
      });

    const endDate =
      endOfWeek(monthEnd, {
        weekStartsOn: 0,
      });

    const days = [];

    let day = startDate;

    while (day <= endDate) {
      days.push(day);

      day = addDays(day, 1);
    }

    return days;
  };

  const calendarDays =
    generateCalendarDays();

  const weekDays = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  // ─────────────────────────────────────────────────────────────
  // Selected Employee
  // ─────────────────────────────────────────────────────────────

  const selectedEmployeeData =
    employees.find(
      (employee) =>
        String(getEmployeeId(employee)) ===
        String(selectedEmployee)
    );

  // ─────────────────────────────────────────────────────────────
  // Date Click
  // ─────────────────────────────────────────────────────────────

  const handleDateClick = (
    day,
    attendance
  ) => {
    setSelectedDateForModal(day);

    if (attendance) {
      setSelectedAttendanceRecord(
        attendance
      );

      const checkIn = getCheckIn(
        attendance
      );

      const checkOut = getCheckOut(
        attendance
      );

      setEditFormData({
        status:
          getStatus(attendance),

        workingHours:
          getWorkingHours(attendance),

        lateByMinutes:
          getLateMinutes(attendance),

        checkInTime: checkIn
          ? format(
              new Date(checkIn),
              "HH:mm"
            )
          : "",

        checkOutTime: checkOut
          ? format(
              new Date(checkOut),
              "HH:mm"
            )
          : "",

        remarks:
          attendance?.remarks || "",
      });
    } else {
      setSelectedAttendanceRecord(
        null
      );

      setEditFormData({
        status: "present",
        workingHours: 8,
        lateByMinutes: 0,
        checkInTime: "09:00",
        checkOutTime: "17:00",
        remarks: "",
      });
    }

    setShowEditModal(true);
  };

  // ─────────────────────────────────────────────────────────────
  // Save Attendance
  // ─────────────────────────────────────────────────────────────

  const saveAttendance = async () => {
    const toastId =
      toast.loading(
        selectedAttendanceRecord
          ? "Updating attendance..."
          : "Saving attendance..."
      );

    try {
      const date =
        selectedAttendanceRecord?.date ||
        format(
          selectedDateForModal,
          "yyyy-MM-dd"
        );

      const lateMinutes =
        parseInt(
          editFormData.lateByMinutes,
          10
        ) || 0;

      const payload = {
        employeeId: selectedEmployee,

        date,

        status:
          editFormData.status,

        workingHours:
          parseFloat(
            editFormData.workingHours
          ) || 0,

        lateByMinutes:
          lateMinutes,

        isLate:
          lateMinutes > 0,

        checkInTime:
          editFormData.checkInTime
            ? `${editFormData.checkInTime}:00`
            : null,

        checkOutTime:
          editFormData.checkOutTime
            ? `${editFormData.checkOutTime}:00`
            : null,

        remarks:
          editFormData.remarks,
      };

      let response;

      if (selectedAttendanceRecord) {
        response =
          await attendanceAPI.update(
            getRecordId(
              selectedAttendanceRecord
            ),
            payload
          );
      } else {
        response =
          await attendanceAPI.create(
            payload
          );
      }

      if (
        response?.data?.success ||
        response?.status === 200 ||
        response?.status === 201
      ) {
        await fetchAttendance();

        setShowEditModal(false);

        toast.success(
          selectedAttendanceRecord
            ? "Attendance updated successfully"
            : "Attendance saved successfully",
          {
            id: toastId,
          }
        );
      }
    } catch (error) {
      console.error(
        "Error saving attendance:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to save attendance",
        {
          id: toastId,
        }
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Delete Attendance
  // ─────────────────────────────────────────────────────────────

  const deleteAttendance = async () => {
    if (!selectedAttendanceRecord)
      return;

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this attendance record?"
      );

    if (!confirmed) return;

    const toastId =
      toast.loading(
        "Deleting attendance..."
      );

    try {
      await attendanceAPI.delete(
        getRecordId(
          selectedAttendanceRecord
        )
      );

      await fetchAttendance();

      setShowEditModal(false);

      toast.success(
        "Attendance deleted successfully",
        {
          id: toastId,
        }
      );
    } catch (error) {
      console.error(
        "Error deleting attendance:",
        error
      );

      toast.error(
        "Failed to delete attendance",
        {
          id: toastId,
        }
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Bulk Attendance
  // ─────────────────────────────────────────────────────────────

  const markBulkAttendance = async () => {
    const status =
      window.prompt(
        "Enter status for all days (present/absent/half-day):",
        "present"
      );

    if (
      !status ||
      ![
        "present",
        "absent",
        "half-day",
      ].includes(status)
    ) {
      return;
    }

    const toastId =
      toast.loading(
        `Marking all days as ${status}...`
      );

    try {
      await attendanceAPI.bulkUpdate({
        employeeId:
          selectedEmployee,

        month: format(
          currentMonth,
          "MM"
        ),

        year: format(
          currentMonth,
          "yyyy"
        ),

        status,
      });

      await fetchAttendance();

      toast.success(
        `All days marked as ${status}`,
        {
          id: toastId,
        }
      );
    } catch (error) {
      console.error(
        "Error marking bulk attendance:",
        error
      );

      toast.error(
        "Failed to update bulk attendance",
        {
          id: toastId,
        }
      );
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Status UI
  // ─────────────────────────────────────────────────────────────

  const getStatusMeta = (status) => {
    switch (status) {
      case "present":
        return {
          label: "Present",
          color: COLORS.green,
          bg: COLORS.greenSoft,
          icon: CheckCircleIcon,
        };

      case "absent":
        return {
          label: "Absent",
          color: COLORS.red,
          bg: COLORS.redSoft,
          icon: XCircleIcon,
        };

      case "late":
        return {
          label: "Late",
          color: COLORS.orange,
          bg: COLORS.orangeSoft,
          icon: ExclamationTriangleIcon,
        };

      case "half-day":
        return {
          label: "Half day",
          color: COLORS.purple,
          bg: COLORS.purpleSoft,
          icon: ClockIcon,
        };

      default:
        return {
          label: "No record",
          color: COLORS.muted,
          bg: COLORS.surfaceAlt,
          icon: CalendarDaysIcon,
        };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background:
              COLORS.surface,
            color: COLORS.text,
            border:
              `1px solid ${COLORS.border}`,
            borderRadius: "11px",
            boxShadow:
              "0 10px 30px rgba(16,24,40,.10)",
            fontSize: "12px",
            fontWeight: 600,
          },
        }}
      />

      <style>{`
        * {
          box-sizing: border-box;
        }

        .attendance-page {
          min-height: 100vh;
          background: ${COLORS.bg};
          color: ${COLORS.text};
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 28px;
        }

        .attendance-shell {
          max-width: 1500px;
          margin: 0 auto;
        }

        /* Header */

        .attendance-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .header-title-wrap {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .header-icon {
          width: 46px;
          height: 46px;
          border-radius: 13px;
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .header-icon svg {
          width: 23px;
          height: 23px;
        }

        .page-title {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -.4px;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: ${COLORS.secondary};
          font-size: 13px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .employee-select {
          height: 40px;
          min-width: 250px;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: ${COLORS.surface};
          color: ${COLORS.text};
          padding: 0 12px;
          font-size: 12px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
        }

        .employee-select:focus {
          border-color: #afc2ef;
          box-shadow:
            0 0 0 3px ${COLORS.blueSoft};
        }

        .secondary-button {
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 13px;
          border-radius: 10px;
          border: 1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: .18s ease;
        }

        .secondary-button:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
          border-color: #d5d8de;
        }

        .secondary-button svg {
          width: 16px;
          height: 16px;
        }

        /* Employee Context */

        .employee-context {
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 14px;
          padding: 13px 16px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          box-shadow:
            0 2px 8px rgba(16,24,40,.035);
        }

        .employee-info {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .employee-avatar {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .employee-avatar svg {
          width: 19px;
          height: 19px;
        }

        .employee-name {
          font-size: 13px;
          font-weight: 700;
        }

        .employee-code {
          margin-top: 3px;
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .employee-period {
          color: ${COLORS.secondary};
          font-size: 12px;
          font-weight: 600;
        }

        /* Summary */

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 14px;
          padding: 16px;
          box-shadow:
            0 2px 8px rgba(16,24,40,.035);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .summary-label {
          color: ${COLORS.secondary};
          font-size: 11px;
          font-weight: 600;
        }

        .summary-icon {
          width: 31px;
          height: 31px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-icon svg {
          width: 17px;
          height: 17px;
        }

        .summary-value {
          margin-top: 13px;
          font-size: 25px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -.4px;
        }

        /* Calendar */

        .calendar-panel {
          background: ${COLORS.surface};
          border: 1px solid ${COLORS.border};
          border-radius: 16px;
          overflow: hidden;
          box-shadow:
            0 2px 8px rgba(16,24,40,.035);
        }

        .calendar-toolbar {
          padding: 17px 19px;
          border-bottom:
            1px solid ${COLORS.border};
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .month-heading {
          min-width: 180px;
        }

        .month-title {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -.2px;
        }

        .month-subtitle {
          margin-top: 4px;
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .month-navigation {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .nav-button {
          width: 35px;
          height: 35px;
          border: 1px solid ${COLORS.border};
          border-radius: 9px;
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: .18s ease;
        }

        .nav-button:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .nav-button svg {
          width: 17px;
          height: 17px;
        }

        .calendar-grid-wrap {
          overflow-x: auto;
        }

        .week-header,
        .calendar-grid {
          min-width: 720px;
        }

        .week-header {
          display: grid;
          grid-template-columns:
            repeat(7, minmax(0, 1fr));
          background: ${COLORS.surfaceAlt};
          border-bottom:
            1px solid ${COLORS.border};
        }

        .week-header div {
          padding: 11px 8px;
          text-align: center;
          color: ${COLORS.muted};
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .45px;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns:
            repeat(7, minmax(0, 1fr));
        }

        .calendar-cell {
          position: relative;
          min-height: 128px;
          padding: 9px;
          background: ${COLORS.surface};
          border-right:
            1px solid ${COLORS.border};
          border-bottom:
            1px solid ${COLORS.border};
          cursor: pointer;
          transition: .16s ease;
        }

        .calendar-cell:nth-child(7n) {
          border-right: none;
        }

        .calendar-cell:hover {
          background: #FCFDFF;
          box-shadow:
            inset 0 0 0 1px #dce5f8;
          z-index: 2;
        }

        .calendar-cell.inactive {
          background: #FAFAFB;
        }

        .calendar-cell.inactive .date-number {
          color: #c2c5ca;
        }

        .calendar-cell.today {
          background: #F8FAFF;
          box-shadow:
            inset 0 0 0 2px ${COLORS.blue};
          z-index: 2;
        }

        .date-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .date-number {
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${COLORS.text};
          font-size: 11px;
          font-weight: 700;
        }

        .today .date-number {
          background: ${COLORS.blue};
          color: white;
        }

        .edit-indicator {
          color: #c3c7ce;
        }

        .edit-indicator svg {
          width: 14px;
          height: 14px;
        }

        .attendance-box {
          margin-top: 9px;
          border-radius: 10px;
          padding: 8px;
          min-height: 61px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }

        .attendance-status-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .attendance-status-row svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .attendance-status-label {
          font-size: 11px;
          font-weight: 700;
        }

        .attendance-time {
          color: ${COLORS.secondary};
          font-size: 9px;
          line-height: 1.4;
        }

        .late-badge {
          align-self: flex-start;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255,255,255,.7);
          font-size: 8px;
          font-weight: 700;
        }

        .empty-day {
          margin-top: 11px;
          color: #c5c8ce;
          font-size: 9px;
        }

        .loading-bar {
          padding: 11px 18px;
          border-top:
            1px solid ${COLORS.border};
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.secondary};
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .loading-bar svg {
          width: 14px;
          height: 14px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Modal */

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background:
            rgba(15,23,42,.30);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-container {
          width: 100%;
          max-width: 570px;
          max-height: 90vh;
          overflow-y: auto;
          background: ${COLORS.surface};
          border:
            1px solid ${COLORS.border};
          border-radius: 17px;
          box-shadow:
            0 25px 70px rgba(15,23,42,.18);
          animation: modalIn .2s ease;
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform:
              translateY(10px)
              scale(.985);
          }

          to {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }
        }

        .modal-header {
          padding: 17px 19px;
          border-bottom:
            1px solid ${COLORS.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .modal-title-wrap {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .modal-title-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title-icon svg {
          width: 18px;
          height: 18px;
        }

        .modal-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .modal-date {
          margin-top: 3px;
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          border:
            1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .modal-close:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .modal-close svg {
          width: 16px;
          height: 16px;
        }

        .modal-body {
          padding: 19px;
        }

        .modal-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .form-group {
          margin-bottom: 13px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          margin-bottom: 6px;
          color: ${COLORS.secondary};
          font-size: 10px;
          font-weight: 650;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          border:
            1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.text};
          border-radius: 9px;
          padding: 10px 11px;
          outline: none;
          font-family: inherit;
          font-size: 12px;
          transition: .18s ease;
        }

        .form-textarea {
          resize: vertical;
          min-height: 76px;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #afc2ef;
          box-shadow:
            0 0 0 3px ${COLORS.blueSoft};
        }

        .modal-footer {
          padding: 14px 19px;
          border-top:
            1px solid ${COLORS.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .footer-left,
        .footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn {
          height: 38px;
          border-radius: 9px;
          padding: 0 13px;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: .18s ease;
        }

        .btn svg {
          width: 15px;
          height: 15px;
        }

        .btn-cancel {
          border:
            1px solid ${COLORS.border};
          background: ${COLORS.surface};
          color: ${COLORS.secondary};
        }

        .btn-cancel:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .btn-delete {
          border:
            1px solid #edc7c7;
          background: ${COLORS.redSoft};
          color: ${COLORS.red};
        }

        .btn-delete:hover {
          background: #f9e1e1;
        }

        .btn-save {
          border:
            1px solid ${COLORS.blue};
          background: ${COLORS.blue};
          color: #fff;
          min-width: 105px;
        }

        .btn-save:hover {
          background: #2f5dc4;
        }

        /* Empty employee state */

        .no-employee {
          background: ${COLORS.surface};
          border:
            1px solid ${COLORS.border};
          border-radius: 16px;
          padding: 70px 20px;
          text-align: center;
          box-shadow:
            0 2px 8px rgba(16,24,40,.035);
        }

        .no-employee-icon {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          margin: 0 auto 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .no-employee-icon svg {
          width: 22px;
          height: 22px;
        }

        .no-employee-title {
          font-size: 14px;
          font-weight: 700;
        }

        .no-employee-text {
          margin-top: 5px;
          color: ${COLORS.muted};
          font-size: 11px;
        }

        @media (max-width: 1000px) {
          .attendance-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .employee-select {
            flex: 1;
          }
        }

        @media (max-width: 800px) {
          .attendance-page {
            padding: 16px;
          }

          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .employee-context {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 600px) {
          .attendance-page {
            padding: 12px;
          }

          .page-title {
            font-size: 22px;
          }

          .header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .employee-select,
          .secondary-button {
            width: 100%;
          }

          .calendar-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .month-heading {
            min-width: 0;
          }

          .month-navigation {
            justify-content: space-between;
          }

          .modal-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .modal-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .footer-left,
          .footer-right {
            width: 100%;
          }

          .footer-right {
            justify-content: flex-end;
          }
        }
      `}</style>

      <div className="attendance-page">
        <div className="attendance-shell">

          {/* ───────────────────────────────────────────── */}
          {/* Header */}
          {/* ───────────────────────────────────────────── */}

          <div className="attendance-header">
            <div className="header-title-wrap">
              <div className="header-icon">
                <CalendarDaysIcon />
              </div>

              <div>
                <h1 className="page-title">
                  Attendance management
                </h1>

                <p className="page-subtitle">
                  Review, edit and manage employee attendance
                  records across the monthly calendar.
                </p>
              </div>
            </div>

            <div className="header-actions">
              <select
                className="employee-select"
                value={selectedEmployee}
                onChange={(e) =>
                  setSelectedEmployee(
                    e.target.value
                  )
                }
              >
                {employees.length === 0 && (
                  <option value="">
                    No employees available
                  </option>
                )}

                {employees.map((employee) => (
                  <option
                    key={getEmployeeId(employee)}
                    value={getEmployeeId(employee)}
                  >
                    {getEmployeeName(employee)}
                    {getEmployeeCode(employee)
                      ? ` (${getEmployeeCode(employee)})`
                      : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="secondary-button"
                onClick={markBulkAttendance}
                disabled={!selectedEmployee}
              >
                <CheckIcon />
                Bulk mark
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={fetchAttendance}
                disabled={
                  loading ||
                  !selectedEmployee
                }
              >
                <ArrowPathIcon />
                Refresh
              </button>
            </div>
          </div>

          {!selectedEmployee ? (
            <div className="no-employee">
              <div className="no-employee-icon">
                <UserIcon />
              </div>

              <div className="no-employee-title">
                Select an employee
              </div>

              <div className="no-employee-text">
                Choose an employee to view and
                manage their attendance calendar.
              </div>
            </div>
          ) : (
            <>
              {/* ───────────────────────────────────────────── */}
              {/* Employee Context */}
              {/* ───────────────────────────────────────────── */}

              <div className="employee-context">
                <div className="employee-info">
                  <div className="employee-avatar">
                    <UserIcon />
                  </div>

                  <div>
                    <div className="employee-name">
                      {getEmployeeName(
                        selectedEmployeeData
                      )}
                    </div>

                    <div className="employee-code">
                      {getEmployeeCode(
                        selectedEmployeeData
                      ) || "Employee"}
                    </div>
                  </div>
                </div>

                <div className="employee-period">
                  {format(
                    currentMonth,
                    "MMMM yyyy"
                  )}
                </div>
              </div>

              {/* ───────────────────────────────────────────── */}
              {/* Summary */}
              {/* ───────────────────────────────────────────── */}

              <div className="summary-grid">
                <SummaryCard
                  label="Present"
                  value={summary.present}
                  color={COLORS.green}
                  bg={COLORS.greenSoft}
                  icon={CheckCircleIcon}
                />

                <SummaryCard
                  label="Absent"
                  value={summary.absent}
                  color={COLORS.red}
                  bg={COLORS.redSoft}
                  icon={XCircleIcon}
                />

                <SummaryCard
                  label="Late arrivals"
                  value={summary.late}
                  color={COLORS.orange}
                  bg={COLORS.orangeSoft}
                  icon={ExclamationTriangleIcon}
                />

                <SummaryCard
                  label="Half days"
                  value={summary.halfDay}
                  color={COLORS.purple}
                  bg={COLORS.purpleSoft}
                  icon={ClockIcon}
                />
              </div>

              {/* ───────────────────────────────────────────── */}
              {/* Calendar */}
              {/* ───────────────────────────────────────────── */}

              <section className="calendar-panel">
                <div className="calendar-toolbar">
                  <div className="month-heading">
                    <div className="month-title">
                      {format(
                        currentMonth,
                        "MMMM yyyy"
                      )}
                    </div>

                    <div className="month-subtitle">
                      Select any date to add or edit
                      attendance
                    </div>
                  </div>

                  <div className="month-navigation">
                    <button
                      type="button"
                      className="nav-button"
                      onClick={() =>
                        setCurrentMonth(
                          subMonths(
                            currentMonth,
                            1
                          )
                        )
                      }
                      aria-label="Previous month"
                    >
                      <ChevronLeftIcon />
                    </button>

                    <button
                      type="button"
                      className="nav-button"
                      onClick={() =>
                        setCurrentMonth(
                          addMonths(
                            currentMonth,
                            1
                          )
                        )
                      }
                      aria-label="Next month"
                    >
                      <ChevronRightIcon />
                    </button>
                  </div>
                </div>

                <div className="calendar-grid-wrap">
                  <div className="week-header">
                    {weekDays.map(
                      (day) => (
                        <div key={day}>
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div className="calendar-grid">
                    {calendarDays.map(
                      (day, index) => {
                        const dateKey =
                          format(
                            day,
                            "yyyy-MM-dd"
                          );

                        const attendance =
                          attendanceData[
                            dateKey
                          ];

                        const statusMeta =
                          attendance
                            ? getStatusMeta(
                                attendance.calendarStatus
                              )
                            : null;

                        const StatusIcon =
                          statusMeta?.icon;

                        const checkIn =
                          attendance
                            ? getCheckIn(
                                attendance
                              )
                            : null;

                        const checkOut =
                          attendance
                            ? getCheckOut(
                                attendance
                              )
                            : null;

                        return (
                          <div
                            key={`${dateKey}-${index}`}
                            className={[
                              "calendar-cell",
                              !isSameMonth(
                                day,
                                currentMonth
                              )
                                ? "inactive"
                                : "",
                              isToday(day)
                                ? "today"
                                : "",
                            ]
                              .filter(
                                Boolean
                              )
                              .join(" ")}
                            onClick={() =>
                              handleDateClick(
                                day,
                                attendance
                              )
                            }
                          >
                            <div className="date-row">
                              <div className="date-number">
                                {format(
                                  day,
                                  "dd"
                                )}
                              </div>

                              <div className="edit-indicator">
                                <PencilSquareIcon />
                              </div>
                            </div>

                            {attendance &&
                            statusMeta ? (
                              <div
                                className="attendance-box"
                                style={{
                                  background:
                                    statusMeta.bg,
                                  color:
                                    statusMeta.color,
                                }}
                              >
                                <div className="attendance-status-row">
                                  <StatusIcon />

                                  <span className="attendance-status-label">
                                    {
                                      statusMeta.label
                                    }
                                  </span>
                                </div>

                                {attendance.calendarStatus ===
                                  "late" && (
                                  <span className="late-badge">
                                    {getLateMinutes(
                                      attendance
                                    )}{" "}
                                    min late
                                  </span>
                                )}

                                {(checkIn ||
                                  checkOut) && (
                                  <div className="attendance-time">
                                    {checkIn
                                      ? format(
                                          new Date(
                                            checkIn
                                          ),
                                          "HH:mm"
                                        )
                                      : "--:--"}

                                    {" – "}

                                    {checkOut
                                      ? format(
                                          new Date(
                                            checkOut
                                          ),
                                          "HH:mm"
                                        )
                                      : "--:--"}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="empty-day">
                                No attendance record
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {loading && (
                  <div className="loading-bar">
                    <ArrowPathIcon />
                    Loading attendance records...
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* Attendance Modal */}
      {/* ───────────────────────────────────────────── */}

      {showEditModal && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowEditModal(false)
          }
        >
          <div
            className="modal-container"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-title-icon">
                  {selectedAttendanceRecord ? (
                    <PencilSquareIcon />
                  ) : (
                    <CalendarDaysIcon />
                  )}
                </div>

                <div>
                  <h3 className="modal-title">
                    {selectedAttendanceRecord
                      ? "Edit attendance"
                      : "Add attendance"}
                  </h3>

                  <div className="modal-date">
                    {selectedDateForModal
                      ? format(
                          selectedDateForModal,
                          "EEEE, dd MMMM yyyy"
                        )
                      : ""}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowEditModal(false)
                }
                aria-label="Close"
              >
                <XMarkIcon />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                <div className="form-group">
                  <label className="form-label">
                    Attendance status
                  </label>

                  <select
                    className="form-select"
                    value={
                      editFormData.status
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status:
                          e.target.value,
                      })
                    }
                  >
                    <option value="present">
                      Present
                    </option>

                    <option value="absent">
                      Absent
                    </option>

                    <option value="half-day">
                      Half day
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Working hours
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    className="form-input"
                    value={
                      editFormData.workingHours
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        workingHours:
                          e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Check-in time
                  </label>

                  <input
                    type="time"
                    className="form-input"
                    value={
                      editFormData.checkInTime
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        checkInTime:
                          e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Check-out time
                  </label>

                  <input
                    type="time"
                    className="form-input"
                    value={
                      editFormData.checkOutTime
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        checkOutTime:
                          e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Late by
                  </label>

                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={
                      editFormData.lateByMinutes
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        lateByMinutes:
                          e.target.value,
                      })
                    }
                  />

                  <div
                    style={{
                      marginTop: 4,
                      color: COLORS.muted,
                      fontSize: 9,
                    }}
                  >
                    Enter minutes after scheduled
                    start time.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Employee
                  </label>

                  <input
                    className="form-input"
                    value={
                      getEmployeeName(
                        selectedEmployeeData
                      )
                    }
                    disabled
                  />
                </div>

                <div className="form-group full">
                  <label className="form-label">
                    Remarks
                  </label>

                  <textarea
                    rows="3"
                    className="form-textarea"
                    value={
                      editFormData.remarks
                    }
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        remarks:
                          e.target.value,
                      })
                    }
                    placeholder="Add any attendance remarks..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left">
                {selectedAttendanceRecord && (
                  <button
                    type="button"
                    className="btn btn-delete"
                    onClick={
                      deleteAttendance
                    }
                  >
                    <TrashIcon />
                    Delete
                  </button>
                )}
              </div>

              <div className="footer-right">
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() =>
                    setShowEditModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-save"
                  onClick={saveAttendance}
                >
                  <CheckIcon />
                  Save attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Summary Card
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
  bg,
  icon: Icon,
}) {
  return (
    <div className="summary-card">
      <div className="summary-top">
        <div className="summary-label">
          {label}
        </div>

        <div
          className="summary-icon"
          style={{
            color,
            background: bg,
          }}
        >
          <Icon />
        </div>
      </div>

      <div
        className="summary-value"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

export default EmployeeAttendanceCalendar;
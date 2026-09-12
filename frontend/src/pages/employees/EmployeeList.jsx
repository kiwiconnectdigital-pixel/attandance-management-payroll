import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeeAPI } from "../../services/api";
import toast from "react-hot-toast";

import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  UsersIcon,
  UserGroupIcon,
  UserCircleIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  CalendarDaysIcon,
  EllipsisHorizontalIcon,
  FunnelIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

/* =========================================================
   DESIGN TOKENS
========================================================= */

const COLORS = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFBFC",

  text: "#15171C",
  textSecondary: "#676C76",
  textMuted: "#969BA5",

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

/* =========================================================
   BACKEND URL
========================================================= */

const BACKEND_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/api\/v1\/?$/, "");

/* =========================================================
   HELPERS
========================================================= */

const getProfileUrl = (image) => {
  if (!image) return null;

  if (
    image.startsWith("http://") ||
    image.startsWith("https://")
  ) {
    return image;
  }

  return `${BACKEND_URL}/${image.replace(/^\/+/, "")}`;
};

const getInitials = (name = "") => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
};

const formatDate = (date) => {
  if (!date) return "Not available";

  try {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "Not available";
  }
};

const totalSalary = (emp) => {
  if (!emp) return 0;

  return (
    Number(emp.salary_basic || 0) +
    Number(emp.salary_hra || 0) +
    Number(emp.salary_da || 0) +
    Number(emp.salary_ta || 0) +
    Number(emp.salary_other || 0)
  );
};

const formatSalary = (value) => {
  return Number(value || 0).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  );
};

/* =========================================================
   PROFILE IMAGE
========================================================= */

function EmployeeAvatar({
  employee,
  size = 52,
  large = false,
}) {
  const [imageError, setImageError] =
    useState(false);

  const image =
    employee?.profile_image ||
    employee?.photo;

  const imageUrl = getProfileUrl(image);

  const initials = getInitials(
    employee?.name || "Employee"
  );

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: large ? 18 : 14,

          background:
            "linear-gradient(135deg, #EDF3FF 0%, #F1EDFF 100%)",

          border: `1px solid ${COLORS.border}`,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          overflow: "hidden",

          color: COLORS.blue,

          fontSize: large ? 22 : 15,
          fontWeight: 750,

          letterSpacing: "-0.03em",
        }}
      >
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={employee?.name || "Employee"}
            onError={() => setImageError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          initials
        )}
      </div>

      {employee?.is_active && (
        <span
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,

            width: large ? 13 : 11,
            height: large ? 13 : 11,

            borderRadius: "50%",

            backgroundColor: COLORS.green,

            border: `2px solid ${COLORS.surface}`,
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   KPI CARD
========================================================= */

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  softColor,
}) {
  return (
    <div
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 15,
        padding: "18px 19px",

        minHeight: 120,

        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -25,
          right: -25,

          width: 80,
          height: 80,

          borderRadius: "50%",

          backgroundColor: softColor,

          opacity: 0.55,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {label}
          </span>

          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              backgroundColor: softColor,
              color,
            }}
          >
            <Icon width={18} height={18} />
          </div>
        </div>

        <div
          style={{
            marginTop: 15,

            fontSize: 28,
            lineHeight: 1,

            fontWeight: 750,
            letterSpacing: "-0.04em",

            color: COLORS.text,
          }}
        >
          {value}
        </div>

        <div
          style={{
            marginTop: 7,
            fontSize: 11,
            color: COLORS.textMuted,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,

        padding: "5px 9px",

        borderRadius: 20,

        backgroundColor: active
          ? COLORS.greenSoft
          : COLORS.redSoft,

        color: active
          ? COLORS.green
          : COLORS.red,

        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      {active ? (
        <CheckCircleIcon
          width={13}
          height={13}
          strokeWidth={2}
        />
      ) : (
        <XCircleIcon
          width={13}
          height={13}
          strokeWidth={2}
        />
      )}

      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* =========================================================
   EMPLOYEE CARD
========================================================= */

function EmployeeCard({
  employee,
  navigate,
  handleDelete,
}) {
  const salary = totalSalary(employee);

  return (
    <div
      className="employee-card"
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,

        overflow: "hidden",

        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",

        position: "relative",
      }}
    >
      {/* Top accent */}
      <div
        style={{
          height: 3,
          background: employee?.is_active
            ? "linear-gradient(90deg, #3567D6, #7357C8)"
            : "#D8DBE1",
        }}
      />

      <div
        style={{
          padding: 18,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <EmployeeAvatar
              employee={employee}
              size={56}
            />

            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 750,
                  color: COLORS.text,

                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",

                  letterSpacing: "-0.02em",
                }}
              >
                {employee?.name || "Unnamed employee"}
              </div>

              <div
                style={{
                  marginTop: 3,

                  fontSize: 11.5,
                  color: COLORS.textSecondary,

                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {employee?.designation ||
                  "Employee"}
              </div>

              <div
                style={{
                  marginTop: 5,

                  fontSize: 10,
                  fontFamily:
                    '"IBM Plex Mono", monospace',

                  color: COLORS.textMuted,
                }}
              >
                {employee?.employee_code || "—"}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="employee-more"
            title="More actions"
            onClick={() =>
              navigate(
                `/employees/${employee.id}`
              )
            }
          >
            <EllipsisHorizontalIcon
              width={18}
              height={18}
            />
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            backgroundColor: COLORS.border,
            margin: "17px 0",
          }}
        />

        {/* Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 13,
          }}
        >
          <InfoItem
            icon={BriefcaseIcon}
            label="Department"
            value={
              employee?.department || "Not assigned"
            }
          />

          <InfoItem
            icon={BuildingOffice2Icon}
            label="Branch"
            value={
              employee?.branch?.name ||
              "Head Office"
            }
          />

          <InfoItem
            icon={CalendarDaysIcon}
            label="Joined"
            value={formatDate(
              employee?.date_of_joining
            )}
          />

          <InfoItem
            icon={UserCircleIcon}
            label="Email"
            value={employee?.email || "—"}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 17,

            paddingTop: 14,

            borderTop: `1px solid ${COLORS.border}`,

            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Monthly salary
            </div>

            <div
              style={{
                marginTop: 4,

                fontSize: 14,
                fontWeight: 750,

                color: COLORS.text,

                fontVariantNumeric:
                  "tabular-nums",
              }}
            >
              ₹{formatSalary(salary)}
            </div>
          </div>

          <StatusBadge
            active={employee?.is_active}
          />
        </div>

        {/* Actions */}
        <div
          className="employee-actions"
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr 1fr",
            gap: 7,

            marginTop: 15,
          }}
        >
          <ActionButton
            icon={EyeIcon}
            label="View"
            onClick={() =>
              navigate(
                `/employees/${employee.id}`
              )
            }
          />

          <ActionButton
            icon={PencilIcon}
            label="Edit"
            onClick={() =>
              navigate(
                `/employees/${employee.id}/edit`
              )
            }
          />

          <ActionButton
            icon={TrashIcon}
            label="Deactivate"
            danger
            onClick={() =>
              handleDelete(employee.id)
            }
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,

          borderRadius: 8,

          backgroundColor: COLORS.surfaceAlt,
          border: `1px solid ${COLORS.border}`,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          color: COLORS.textMuted,

          flexShrink: 0,
        }}
      >
        <Icon
          width={14}
          height={14}
        />
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 700,
          }}
        >
          {label}
        </div>

        <div
          style={{
            marginTop: 2,

            fontSize: 11,
            fontWeight: 600,
            color: COLORS.textSecondary,

            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={value}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}) {
  return (
    <button
      type="button"
      className={
        danger
          ? "employee-action employee-action-danger"
          : "employee-action"
      }
      onClick={onClick}
      title={label}
    >
      <Icon
        width={14}
        height={14}
      />

      <span>{label}</span>
    </button>
  );
}

/* =========================================================
   SKELETON CARD
========================================================= */

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div className="employee-skeleton skeleton-avatar" />

        <div
          style={{
            flex: 1,
          }}
        >
          <div className="employee-skeleton skeleton-title" />
          <div className="employee-skeleton skeleton-line" />
          <div className="employee-skeleton skeleton-small" />
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
        }}
      >
        <div className="employee-skeleton skeleton-line" />
        <div
          className="employee-skeleton skeleton-line"
          style={{
            marginTop: 9,
          }}
        />
        <div
          className="employee-skeleton skeleton-line"
          style={{
            marginTop: 9,
            width: "65%",
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   FILTER CHIP
========================================================= */

function FilterChip({
  label,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active
          ? `1px solid ${COLORS.blue}`
          : `1px solid ${COLORS.border}`,

        backgroundColor: active
          ? COLORS.blueSoft
          : COLORS.surface,

        color: active
          ? COLORS.blue
          : COLORS.textSecondary,

        borderRadius: 20,

        padding: "7px 12px",

        fontSize: 11,
        fontWeight: 650,

        cursor: "pointer",

        transition: "all 150ms ease",
      }}
    >
      {label}
    </button>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function EmployeeList() {
  const [employees, setEmployees] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [departmentFilter, setDepartmentFilter] =
    useState("all");

  const [showFilters, setShowFilters] =
    useState(false);

  const navigate = useNavigate();

  /* =======================================================
     FETCH
  ======================================================= */

  const fetchEmployees = async () => {
    setLoading(true);

    try {
      const res =
        await employeeAPI.getAll({
          search,
        });

      const data =
        res?.data?.data?.employees ||
        res?.data?.employees ||
        [];

      setEmployees(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Employee fetch error:",
        error
      );

      toast.error(
        "Failed to load employees"
      );

      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  /* =======================================================
     DELETE / DEACTIVATE
  ======================================================= */

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Deactivate this employee?"
      )
    ) {
      return;
    }

    try {
      await employeeAPI.delete(id);

      toast.success(
        "Employee deactivated"
      );

      fetchEmployees();
    } catch (error) {
      console.error(
        "Deactivate error:",
        error
      );

      toast.error(
        "Failed to deactivate employee"
      );
    }
  };

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const total = employees.length;

    const active = employees.filter(
      (employee) =>
        employee?.is_active === true
    ).length;

    const inactive = total - active;

    const departments = new Set(
      employees
        .map(
          (employee) =>
            employee?.department
        )
        .filter(Boolean)
    );

    return {
      total,
      active,
      inactive,
      departments: departments.size,
    };
  }, [employees]);

  /* =======================================================
     DEPARTMENTS
  ======================================================= */

  const departments = useMemo(() => {
    const unique = [
      ...new Set(
        employees
          .map(
            (employee) =>
              employee?.department
          )
          .filter(Boolean)
      ),
    ];

    return unique.sort();
  }, [employees]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (
        statusFilter === "active" &&
        !employee?.is_active
      ) {
        return false;
      }

      if (
        statusFilter === "inactive" &&
        employee?.is_active
      ) {
        return false;
      }

      if (
        departmentFilter !== "all" &&
        employee?.department !==
          departmentFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    employees,
    statusFilter,
    departmentFilter,
  ]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="employee-page">
      <style>{`

        * {
          box-sizing: border-box;
        }

        .employee-page {
          min-height: 100vh;
          background: ${COLORS.bg};
          color: ${COLORS.text};

          padding: 28px;

          font-family:
            Inter,
            "DM Sans",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          -webkit-font-smoothing: antialiased;
        }

        /* =================================================
           HEADER
        ================================================= */

        .employee-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;

          margin-bottom: 24px;
        }

        .employee-header-left {
          min-width: 0;
        }

        .employee-eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;

          color: ${COLORS.blue};

          font-size: 10px;
          font-weight: 800;

          text-transform: uppercase;
          letter-spacing: 0.1em;

          margin-bottom: 7px;
        }

        .employee-eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${COLORS.blue};
        }

        .employee-title {
          margin: 0;

          color: ${COLORS.text};

          font-size: 28px;
          line-height: 1.1;

          font-weight: 780;

          letter-spacing: -0.045em;
        }

        .employee-subtitle {
          margin-top: 7px;

          color: ${COLORS.textSecondary};

          font-size: 12.5px;
          line-height: 1.5;
        }

        .employee-add {
          flex-shrink: 0;

          display: flex;
          align-items: center;
          gap: 7px;

          border: none;
          border-radius: 10px;

          background: ${COLORS.blue};
          color: white;

          padding: 11px 15px;

          font-size: 12px;
          font-weight: 700;

          cursor: pointer;

          box-shadow:
            0 5px 14px rgba(53,103,214,0.18);

          transition:
            transform 150ms ease,
            box-shadow 150ms ease,
            background 150ms ease;
        }

        .employee-add:hover {
          background: #2F5EC7;

          transform: translateY(-1px);

          box-shadow:
            0 8px 18px rgba(53,103,214,0.23);
        }

        /* =================================================
           STATS
        ================================================= */

        .employee-stats {
          display: grid;

          grid-template-columns:
            repeat(4, minmax(0, 1fr));

          gap: 12px;

          margin-bottom: 20px;
        }

        /* =================================================
           TOOLBAR
        ================================================= */

        .employee-toolbar {
          background: ${COLORS.surface};

          border: 1px solid ${COLORS.border};

          border-radius: 15px;

          padding: 11px;

          display: flex;
          align-items: center;

          gap: 10px;

          margin-bottom: 20px;
        }

        .employee-search {
          flex: 1;

          min-width: 0;

          position: relative;
        }

        .employee-search-icon {
          position: absolute;

          left: 13px;
          top: 50%;

          transform: translateY(-50%);

          width: 17px;
          height: 17px;

          color: ${COLORS.textMuted};

          pointer-events: none;
        }

        .employee-search-input {
          width: 100%;

          height: 40px;

          border: 1px solid transparent;

          border-radius: 10px;

          background: ${COLORS.surfaceAlt};

          padding:
            0 12px 0 39px;

          outline: none;

          color: ${COLORS.text};

          font-size: 12px;

          transition:
            border-color 150ms ease,
            background 150ms ease;
        }

        .employee-search-input::placeholder {
          color: ${COLORS.textMuted};
        }

        .employee-search-input:focus {
          background: ${COLORS.surface};

          border-color: #C9D7F7;
        }

        .employee-filter-button {
          height: 40px;

          display: flex;
          align-items: center;
          gap: 7px;

          padding: 0 12px;

          border: 1px solid ${COLORS.border};

          border-radius: 10px;

          background: ${COLORS.surface};

          color: ${COLORS.textSecondary};

          font-size: 11px;
          font-weight: 650;

          cursor: pointer;
        }

        .employee-filter-button:hover {
          background: ${COLORS.surfaceAlt};
          color: ${COLORS.text};
        }

        .employee-clear {
          height: 40px;

          border: none;

          background: transparent;

          color: ${COLORS.textMuted};

          padding: 0 8px;

          font-size: 11px;
          font-weight: 650;

          cursor: pointer;
        }

        /* =================================================
           FILTERS
        ================================================= */

        .employee-filters {
          display: flex;
          align-items: center;
          gap: 7px;

          padding:
            0 2px 11px;

          flex-wrap: wrap;
        }

        .employee-filter-select {
          height: 34px;

          border:
            1px solid ${COLORS.border};

          border-radius: 9px;

          background: ${COLORS.surface};

          color: ${COLORS.textSecondary};

          padding: 0 30px 0 10px;

          font-size: 11px;

          outline: none;

          cursor: pointer;
        }

        /* =================================================
           LIST HEADER
        ================================================= */

        .employee-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;

          margin-bottom: 12px;
        }

        .employee-list-title {
          font-size: 13px;
          font-weight: 750;

          color: ${COLORS.text};

          letter-spacing: -0.015em;
        }

        .employee-list-count {
          display: inline-flex;
          align-items: center;

          padding:
            5px 9px;

          border-radius: 20px;

          background: ${COLORS.blueSoft};

          color: ${COLORS.blue};

          font-size: 10px;
          font-weight: 700;
        }

        /* =================================================
           GRID
        ================================================= */

        .employee-grid {
          display: grid;

          grid-template-columns:
            repeat(3, minmax(0, 1fr));

          gap: 14px;
        }

        .employee-card:hover {
          transform: translateY(-2px);

          border-color: #D7DCE5 !important;

          box-shadow:
            0 10px 28px rgba(21,23,28,0.06);
        }

        .employee-more {
          width: 31px;
          height: 31px;

          border: 1px solid ${COLORS.border};

          border-radius: 9px;

          background: ${COLORS.surfaceAlt};

          color: ${COLORS.textMuted};

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          flex-shrink: 0;
        }

        .employee-more:hover {
          background: ${COLORS.blueSoft};
          color: ${COLORS.blue};
          border-color: #C9D7F7;
        }

        .employee-action {
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          gap: 5px;

          border:
            1px solid ${COLORS.border};

          border-radius: 8px;

          background: ${COLORS.surfaceAlt};

          color: ${COLORS.textSecondary};

          font-size: 10px;
          font-weight: 650;

          cursor: pointer;

          transition:
            background 150ms ease,
            color 150ms ease,
            border-color 150ms ease;
        }

        .employee-action:hover {
          background: ${COLORS.blueSoft};

          color: ${COLORS.blue};

          border-color: #C9D7F7;
        }

        .employee-action-danger:hover {
          background: ${COLORS.redSoft};

          color: ${COLORS.red};

          border-color: #F0CCCC;
        }

        /* =================================================
           SKELETON
        ================================================= */

        .employee-skeleton {
          background:
            linear-gradient(
              90deg,
              #F1F2F4 25%,
              #E8EAEE 50%,
              #F1F2F4 75%
            );

          background-size: 200% 100%;

          animation:
            employeeShimmer 1.5s infinite;

          border-radius: 7px;
        }

        .skeleton-avatar {
          width: 56px;
          height: 56px;
          border-radius: 15px;
          flex-shrink: 0;
        }

        .skeleton-title {
          height: 12px;
          width: 55%;
        }

        .skeleton-line {
          height: 9px;
          width: 85%;
          margin-top: 9px;
        }

        .skeleton-small {
          height: 7px;
          width: 35%;
          margin-top: 9px;
        }

        @keyframes employeeShimmer {
          0% {
            background-position: 200% 0;
          }

          100% {
            background-position: -200% 0;
          }
        }

        /* =================================================
           EMPTY
        ================================================= */

        .employee-empty {
          background: ${COLORS.surface};

          border:
            1px solid ${COLORS.border};

          border-radius: 16px;

          padding: 65px 20px;

          text-align: center;

          grid-column: 1 / -1;
        }

        .employee-empty-icon {
          width: 52px;
          height: 52px;

          margin:
            0 auto 14px;

          border-radius: 15px;

          background: ${COLORS.blueSoft};

          color: ${COLORS.blue};

          display: flex;
          align-items: center;
          justify-content: center;
        }

        .employee-empty-title {
          font-size: 14px;
          font-weight: 750;

          color: ${COLORS.text};
        }

        .employee-empty-text {
          margin-top: 5px;

          color: ${COLORS.textMuted};

          font-size: 11.5px;
        }

        /* =================================================
           RESPONSIVE
        ================================================= */

        @media (max-width: 1200px) {
          .employee-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .employee-page {
            padding: 20px;
          }

          .employee-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .employee-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .employee-page {
            padding: 15px;
          }

          .employee-header {
            align-items: stretch;
            flex-direction: column;
          }

          .employee-title {
            font-size: 24px;
          }

          .employee-add {
            justify-content: center;
          }

          .employee-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .employee-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .employee-filter-button {
            justify-content: center;
          }

          .employee-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 420px) {
          .employee-stats {
            grid-template-columns: 1fr;
          }

          .employee-card {
            border-radius: 14px !important;
          }

          .employee-action span {
            display: none;
          }

          .employee-action {
            height: 36px;
          }
        }

      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="employee-header">
        <div className="employee-header-left">
          <div className="employee-eyebrow">
            <span className="employee-eyebrow-dot" />
            Workforce
          </div>

          <h1 className="employee-title">
            Employees
          </h1>

          <p className="employee-subtitle">
            Manage your workforce, employee profiles,
            departments and employment information.
          </p>
        </div>

        <button
          type="button"
          className="employee-add"
          onClick={() =>
            navigate("/employees/new")
          }
        >
          <PlusIcon
            width={17}
            height={17}
            strokeWidth={2.2}
          />

          Add employee
        </button>
      </header>

      {/* =====================================================
          STATS
      ===================================================== */}

      <section className="employee-stats">
        <StatCard
          icon={UsersIcon}
          label="Total employees"
          value={stats.total}
          subtitle="All employees in your workforce"
          color={COLORS.blue}
          softColor={COLORS.blueSoft}
        />

        <StatCard
          icon={UserGroupIcon}
          label="Active"
          value={stats.active}
          subtitle="Currently active employees"
          color={COLORS.green}
          softColor={COLORS.greenSoft}
        />

        <StatCard
          icon={UserCircleIcon}
          label="Inactive"
          value={stats.inactive}
          subtitle="Deactivated employees"
          color={COLORS.red}
          softColor={COLORS.redSoft}
        />

        <StatCard
          icon={BuildingOffice2Icon}
          label="Departments"
          value={stats.departments}
          subtitle="Departments represented"
          color={COLORS.purple}
          softColor={COLORS.purpleSoft}
        />
      </section>

      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <section className="employee-toolbar">
        <div className="employee-search">
          <MagnifyingGlassIcon className="employee-search-icon" />

          <input
            className="employee-search-input"
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search employees by name, email or employee code..."
          />
        </div>

        <button
          type="button"
          className="employee-filter-button"
          onClick={() =>
            setShowFilters((value) => !value)
          }
        >
          <FunnelIcon
            width={15}
            height={15}
          />

          Filters

          <ChevronDownIcon
            width={14}
            height={14}
          />
        </button>

        {(search ||
          statusFilter !== "all" ||
          departmentFilter !== "all") && (
          <button
            type="button"
            className="employee-clear"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setDepartmentFilter("all");
            }}
          >
            Clear
          </button>
        )}
      </section>

      {/* =====================================================
          FILTER PANEL
      ===================================================== */}

      {showFilters && (
        <div
          style={{
            backgroundColor: COLORS.surface,

            border: `1px solid ${COLORS.border}`,

            borderRadius: 13,

            padding: 12,

            marginTop: -10,
            marginBottom: 18,

            display: "flex",
            alignItems: "center",
            gap: 8,

            flexWrap: "wrap",
          }}
        >
          <FilterChip
            label="All"
            active={statusFilter === "all"}
            onClick={() =>
              setStatusFilter("all")
            }
          />

          <FilterChip
            label="Active"
            active={statusFilter === "active"}
            onClick={() =>
              setStatusFilter("active")
            }
          />

          <FilterChip
            label="Inactive"
            active={
              statusFilter === "inactive"
            }
            onClick={() =>
              setStatusFilter("inactive")
            }
          />

          <select
            value={departmentFilter}
            onChange={(event) =>
              setDepartmentFilter(
                event.target.value
              )
            }
            className="employee-filter-select"
          >
            <option value="all">
              All departments
            </option>

            {departments.map((department) => (
              <option
                key={department}
                value={department}
              >
                {department}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              setShowFilters(false)
            }
            style={{
              marginLeft: "auto",

              width: 32,
              height: 32,

              border:
                `1px solid ${COLORS.border}`,

              borderRadius: 8,

              background: COLORS.surfaceAlt,

              color: COLORS.textMuted,

              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              cursor: "pointer",
            }}
          >
            <XMarkIcon
              width={15}
              height={15}
            />
          </button>
        </div>
      )}

      {/* =====================================================
          LIST HEADER
      ===================================================== */}

      <div className="employee-list-header">
        <div className="employee-list-title">
          Employee directory
        </div>

        <div className="employee-list-count">
          {filteredEmployees.length}{" "}
          {filteredEmployees.length === 1
            ? "employee"
            : "employees"}
        </div>
      </div>

      {/* =====================================================
          EMPLOYEE GRID
      ===================================================== */}

      <section className="employee-grid">
        {loading ? (
          Array.from({
            length: 6,
          }).map((_, index) => (
            <SkeletonCard
              key={index}
            />
          ))
        ) : filteredEmployees.length ===
          0 ? (
          <div className="employee-empty">
            <div className="employee-empty-icon">
              <UsersIcon
                width={23}
                height={23}
              />
            </div>

            <div className="employee-empty-title">
              No employees found
            </div>

            <div className="employee-empty-text">
              Try changing your search or
              filters, or add a new employee.
            </div>
          </div>
        ) : (
          filteredEmployees.map(
            (employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                navigate={navigate}
                handleDelete={
                  handleDelete
                }
              />
            )
          )
        )}
      </section>
    </div>
  );
}
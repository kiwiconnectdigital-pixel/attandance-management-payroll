import { useState, useEffect, useCallback } from "react";
import { holidayAPI } from "../../services/api";

// ─────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────
const DARK = {
  bg: "#020617",
  card: "#0f172a",
  card2: "#111827",
  border: "#1e293b",
  softBorder: "#334155",
  text: "#f8fafc",
  secondary: "#94a3b8",
  muted: "#64748b",
  hover: "#172033",
  today: "#2563eb",
};

const TYPES = ["national", "regional", "optional", "company"];

const TYPE_META = {
  national: {
    label: "National",
    color: "#60A5FA",
    bg: "rgba(59,130,246,0.18)",
    dot: "#3B82F6",
  },

  regional: {
    label: "Regional",
    color: "#34D399",
    bg: "rgba(16,185,129,0.18)",
    dot: "#10B981",
  },

  optional: {
    label: "Optional",
    color: "#FBBF24",
    bg: "rgba(245,158,11,0.18)",
    dot: "#F59E0B",
  },

  company: {
    label: "Company",
    color: "#FB7185",
    bg: "rgba(244,63,94,0.18)",
    dot: "#F43F5E",
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

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay();
}

function isWeekend(year, month, day) {
  const d = new Date(year, month, day).getDay();

  // ONLY Sunday
  return d === 0;
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

  // ─────────────────────────────────────────────────────────────
  // Inputs
  // ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%",
    background: "#020617",
    border: `1px solid ${DARK.softBorder}`,
    color: "#fff",
    borderRadius: 12,
    padding: "11px 14px",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  };

  // ─────────────────────────────────────────────────────────────
  // Toast
  // ─────────────────────────────────────────────────────────────
  function showToast(msg, ok = true) {
    setToast({ msg, ok });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  // ─────────────────────────────────────────────────────────────
  // Fetch
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

      const data = res.data.data;

      setHolidays(Array.isArray(data) ? data : data.holidays || []);
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
  // Stats
  // ─────────────────────────────────────────────────────────────
  const totalDays = getDaysInMonth(year, month);

  const firstDay = getFirstDay(year, month);

  const weekdayCount = Array.from(
    { length: totalDays },
    (_, i) => i + 1,
  ).filter((d) => !isWeekend(year, month, d)).length;

  const holidayOnWeekday = holidays.filter((h) => h.isWeekday).length;

  const workingDays = weekdayCount - holidayOnWeekday;

  const holidayMap = {};

  holidays.forEach((h) => {
    const d = new Date(h.date);

    // safer local date
    const day = d.getUTCDate();

    if (!holidayMap[day]) {
      holidayMap[day] = [];
    }

    holidayMap[day].push(h);
  });

  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  for (let d = 1; d <= totalDays; d++) {
    cells.push(d);
  }

  // ─────────────────────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────────────────────
  function openAdd(prefillDate) {
    setEditId(null);

    setForm({
      ...emptyForm,
      date: prefillDate || "",
    });

    setShowForm(true);
  }

  function openEdit(h) {
    setEditId(h._id);

    setForm({
      name: h.name,
      date: h.date.slice(0, 10),
      type: h.type,
      description: h.description || "",
      branch: h.branch || "",
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  // ─────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.name.trim() || !form.date) {
      showToast("Name and date required", false);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: form.name,
        date: form.date,
        type: form.type,
        description: form.description,
        branch: form.branch || null,
      };

      if (editId) {
        await holidayAPI.update(editId, payload);

        showToast("Holiday updated");
      } else {
        await holidayAPI.create(payload);

        showToast("Holiday created");
      }

      closeForm();

      fetchHolidays();
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
    try {
      await holidayAPI.delete(id);

      showToast("Holiday deleted");

      fetchHolidays();
    } catch (e) {
      showToast(errMsg(e), false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Month Nav
  // ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div
      style={{
        background: DARK.bg,
        minHeight: "100vh",
        padding: 24,
        color: DARK.text,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 999,
            padding: "12px 18px",
            borderRadius: 14,
            background: toast.ok
              ? "rgba(16,185,129,0.12)"
              : "rgba(244,63,94,0.12)",

            border: `1px solid ${toast.ok ? "#10B981" : "#F43F5E"}`,

            color: toast.ok ? "#34D399" : "#FB7185",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg,#0f172a 0%, #111827 100%)",
          border: `1px solid ${DARK.softBorder}`,
          borderRadius: 24,
          padding: 28,
          marginBottom: 24,

          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            Holiday Calendar
          </h1>

          <p
            style={{
              marginTop: 8,
              color: DARK.secondary,
              fontSize: 14,
            }}
          >
            Manage public, company & regional holidays
          </p>
        </div>

        <button
          onClick={() => openAdd()}
          style={{
            background: "linear-gradient(135deg,#2563eb,#3b82f6)",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
            boxShadow: "0 10px 30px rgba(37,99,235,0.25)",
          }}
        >
          + Add Holiday
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Calendar Days",
            value: totalDays,
            icon: "📅",
          },

          {
            label: "Weekdays",
            value: weekdayCount,
            icon: "🏢",
          },

          {
            label: "Holidays",
            value: holidayOnWeekday,
            icon: "🎉",
          },

          {
            label: "Working Days",
            value: workingDays,
            icon: "✅",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: DARK.card,
              border: `1px solid ${DARK.softBorder}`,
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: DARK.secondary,
                marginBottom: 12,
              }}
            >
              {s.icon} {s.label}
            </div>

            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              {loading ? "..." : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 22,
        }}
      >
        {/* Calendar */}
        <div
          style={{
            background: DARK.card,
            border: `1px solid ${DARK.softBorder}`,
            borderRadius: 24,
            padding: 24,
          }}
        >
          {/* Month Nav */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <button
              onClick={prevMonth}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: `1px solid ${DARK.softBorder}`,
                background: DARK.hover,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              ←
            </button>

            <div
              style={{
                display: "flex",
                gap: 10,
              }}
            >
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={inputStyle}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={inputStyle}
              >
                {Array.from(
                  { length: 8 },
                  (_, i) => today.getFullYear() - 2 + i,
                ).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={nextMonth}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: `1px solid ${DARK.softBorder}`,
                background: DARK.hover,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              →
            </button>
          </div>

          {/* Weekdays */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 10,
              marginBottom: 10,
            }}
          >
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  color: DARK.secondary,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 10,
            }}
          >
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={idx}></div>;
              }

             const isSunday = new Date(year, month, day).getDay() === 0;

              const dayHolidays = holidayMap[day] || [];
              const hol = dayHolidays[0];

              const isToday =
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day;

              const meta = hol ? TYPE_META[hol.type] : null;

              return (
                <div
                  key={day}
onClick={() => openAdd(formatDate(year, month, day))}
                  style={{
                    minHeight: 80,
                    borderRadius: 18,
                    padding: 12,

                    background: hol
                      ? meta.bg
                      : isToday
                        ? "rgba(37,99,235,0.18)"
                        : DARK.hover,

                    border: isToday
                      ? "1px solid #3B82F6"
                      : `1px solid ${DARK.border}`,

                    color: hol ? meta.color : DARK.text,
cursor: "pointer",

                    transition: "0.2s",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  >
                    {day}
                  </div>

                  {hol && (
                    <>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: meta.dot,
                          marginTop: 8,
                        }}
                      />

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hol.name}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 24,
              flexWrap: "wrap",
            }}
          >
            {TYPES.map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: TYPE_META[t].dot,
                  }}
                />

                <span
                  style={{
                    fontSize: 13,
                    color: DARK.secondary,
                  }}
                >
                  {TYPE_META[t].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Form */}
          {showForm && (
            <div
              style={{
                background: DARK.card,
                border: `1px solid ${DARK.softBorder}`,
                borderRadius: 24,
                padding: 22,
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 18,
                }}
              >
                {editId ? "Edit Holiday" : "Add Holiday"}
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <input
                  placeholder="Holiday name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      date: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t].label}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <input
                  placeholder="Branch"
                  value={form.branch}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      branch: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg,#2563eb,#3b82f6)",

                      color: "white",
                      border: "none",
                      borderRadius: 14,
                      padding: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {submitting ? "Saving..." : editId ? "Update" : "Create"}
                  </button>

                  <button
                    onClick={closeForm}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 14,
                      border: `1px solid ${DARK.softBorder}`,
                      background: DARK.hover,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Holiday List */}
          <div
            style={{
              background: DARK.card,
              border: `1px solid ${DARK.softBorder}`,
              borderRadius: 24,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h3
                style={{
                  margin: 0,
                }}
              >
                {MONTHS[month]} {year}
              </h3>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  ...inputStyle,
                  width: 130,
                }}
              >
                <option value="all">All</option>

                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: DARK.secondary,
                }}
              >
                Loading...
              </div>
            ) : holidays.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px 0",
                  color: DARK.secondary,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    marginBottom: 12,
                  }}
                >
                  📅
                </div>
                No holidays found
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {holidays.map((h) => {
                  const meta = TYPE_META[h.type];

                  const d = new Date(h.date);

                  return (
                    <div
                      key={h._id}
                      style={{
                        background: "#020617",
                        border: `1px solid ${DARK.softBorder}`,
                        borderRadius: 18,
                        padding: 14,

                        display: "flex",
                        alignItems: "center",
                        gap: 14,

                        transition: "0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 16,
                          background: meta.bg,

                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",

                          color: meta.color,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                          }}
                        >
                          {d.getDate()}
                        </div>

                        <div
                          style={{
                            fontSize: 10,
                          }}
                        >
                          {WEEKDAYS[d.getDay()]}
                        </div>
                      </div>

                      <div
                        style={{
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: 6,
                          }}
                        >
                          {h.name}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              background: meta.bg,
                              color: meta.color,
                              padding: "4px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {meta.label}
                          </span>

                          {h.branch && (
                            <span
                              style={{
                                color: DARK.secondary,
                                fontSize: 12,
                              }}
                            >
                              {h.branch}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <button
                          onClick={() => openEdit(h)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            border: "none",

                            background: "rgba(59,130,246,0.12)",

                            color: "#60A5FA",
                            cursor: "pointer",
                          }}
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => handleDelete(h._id)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            border: "none",

                            background: "rgba(244,63,94,0.12)",

                            color: "#FB7185",
                            cursor: "pointer",
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

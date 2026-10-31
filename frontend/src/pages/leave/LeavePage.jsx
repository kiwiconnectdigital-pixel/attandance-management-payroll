import { useEffect, useMemo, useState } from "react";
import { leaveAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  AddRounded,
  CalendarMonthRounded,
  CancelRounded,
  CheckCircleRounded,
  CheckRounded,
  CloseRounded,
  EventNoteRounded,
  HourglassTopRounded,
  RefreshRounded,
  WbSunnyRounded,
  WbTwilightRounded,
} from "@mui/icons-material";

/* -------------------------------------------------------------------------- */
/*  Theme (same tokens as the dashboard)                                      */
/* -------------------------------------------------------------------------- */

const C = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFBFC",

  text: "#15171C",
  textSecondary: "#676C76",
  textMuted: "#969BA5",

  border: "#E7E9ED",
  borderStrong: "#D9DCE2",

  black: "#111318",

  green: "#16845B",
  greenSoft: "#EAF7F1",

  orange: "#C97816",
  orangeSoft: "#FFF4E5",

  red: "#C94B4B",
  redSoft: "#FDEEEE",

  blue: "#3567D6",
  blueSoft: "#EDF3FF",

  purple: "#7357C8",
  purpleSoft: "#F1EDFF",

  shadow: "0 8px 30px rgba(20, 24, 35, 0.055)",
  shadowHover: "0 14px 36px rgba(20, 24, 35, 0.09)",
};

const LEAVE_TYPES = [
  { value: "CL", label: "Casual leave", caption: "Personal work", color: C.blue, bg: C.blueSoft },
  { value: "SL", label: "Sick leave", caption: "Health reasons", color: C.red, bg: C.redSoft },
  { value: "PL", label: "Privilege leave", caption: "Planned time off", color: C.green, bg: C.greenSoft },
  { value: "HD", label: "Half day", caption: "Morning or afternoon", color: C.orange, bg: C.orangeSoft },
];

const TYPE_BY_VALUE = Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, t]));

const STATUS_FILTERS = [
  { value: "all", label: "All requests" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

// Sequelize returns snake_case fields and `id` (not `_id`).
// Normalize once so the rest of the component can use camelCase.
const normalize = (l) => ({
  ...l,
  leaveType: l.leave_type ?? l.leaveType,
  startDate: l.start_date ?? l.startDate,
  endDate: l.end_date ?? l.endDate,
  totalDays: l.total_days ?? l.totalDays,
  halfDayOption: l.half_day_option ?? l.halfDayOption,
  reviewRemarks: l.review_remarks ?? l.reviewRemarks,
});

const parseYmd = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  const diff = Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  return diff < 0 ? 0 : diff + 1;
};

const fmtDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseYmd(value));
};

const fmtWeekday = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(
    parseYmd(value),
  );
};

const fmtDays = (n) => {
  const value = Number(n) || 0;
  return `${value} ${value === 1 ? "day" : "days"}`;
};

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const EMPTY_FORM = {
  leaveType: "CL",
  startDate: "",
  endDate: "",
  reason: "",
  halfDayOption: "first_half",
};

/* -------------------------------------------------------------------------- */
/*  Shared UI pieces                                                          */
/* -------------------------------------------------------------------------- */

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        flexWrap: "wrap",
        rowGap: 1.5,
        columnGap: 2,
        mb: 2.5,
      }}
    >
      <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
        {eyebrow && (
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.textMuted,
              mb: 0.6,
            }}
          >
            {eyebrow}
          </Typography>
        )}

        <Typography
          sx={{
            fontSize: { xs: 21, md: 24 },
            fontWeight: 800,
            letterSpacing: "-0.035em",
            color: C.text,
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography sx={{ mt: 0.5, fontSize: 13.5, color: C.textSecondary }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
}

function StatusBadge({ status }) {
  const config = {
    pending: { label: "Pending", color: C.orange, bg: C.orangeSoft },
    approved: { label: "Approved", color: C.green, bg: C.greenSoft },
    rejected: { label: "Rejected", color: C.red, bg: C.redSoft },
    cancelled: { label: "Cancelled", color: C.textSecondary, bg: "#EEF0F3" },
  };

  const item = config[status] || config.pending;

  return (
    <Chip
      size="small"
      label={item.label}
      sx={{
        height: 27,
        borderRadius: "8px",
        backgroundColor: item.bg,
        color: item.color,
        fontSize: 11.5,
        fontWeight: 800,
        flexShrink: 0,
        "& .MuiChip-label": { px: 1.2 },
      }}
    />
  );
}

function MetricCard({ label, value, caption, icon, iconBg, iconColor, progress }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        borderRadius: "18px",
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        minHeight: 148,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: "12px",
          display: "grid",
          placeItems: "center",
          background: iconBg,
          color: iconColor,
        }}
      >
        {icon}
      </Box>

      <Typography
        sx={{ mt: 2, fontSize: 12, color: C.textSecondary, fontWeight: 700 }}
      >
        {label}
      </Typography>

      <Typography
        noWrap
        sx={{
          mt: 0.25,
          fontSize: 28,
          fontWeight: 850,
          letterSpacing: "-0.045em",
          color: C.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>

      {caption && (
        <Typography noWrap sx={{ mt: 0.7, fontSize: 11.5, color: C.textMuted }}>
          {caption}
        </Typography>
      )}

      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(progress, 0), 100)}
          sx={{
            mt: 1.5,
            height: 5,
            borderRadius: 99,
            background: "#EEF0F3",
            "& .MuiLinearProgress-bar": {
              borderRadius: 99,
              background: iconColor,
            },
          }}
        />
      )}
    </Paper>
  );
}

/* -------------------------------------------------------------------------- */
/*  Leave list                                                                */
/* -------------------------------------------------------------------------- */

const ROW_COLUMNS = {
  xs: "1fr",
  lg: "minmax(0, 1.3fr) 150px minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(210px, auto)",
};

function ListHeader() {
  const label = (text, align) => (
    <Typography
      sx={{
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.textMuted,
        textAlign: align,
      }}
    >
      {text}
    </Typography>
  );

  return (
    <Box
      sx={{
        display: { xs: "none", lg: "grid" },
        gridTemplateColumns: ROW_COLUMNS,
        columnGap: 2.5,
        px: 2.2,
        py: 1.2,
        borderRadius: "12px",
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        mb: 0.5,
      }}
    >
      {label("Employee")}
      {label("Type")}
      {label("Dates")}
      {label("Reason")}
      {label("Status", "right")}
    </Box>
  );
}

function LeaveRow({ leave, canReview, reviewing, onReview, last }) {
  const type = TYPE_BY_VALUE[leave.leaveType] || LEAVE_TYPES[0];
  const isHalf = leave.leaveType === "HD";
  const name = leave.employee?.name || "Employee";
  const code = leave.employee?.employee_code || "—";
  const department = leave.employee?.department;
  const session =
    leave.halfDayOption === "second_half" ? "Second half" : "First half";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: ROW_COLUMNS,
        columnGap: 2.5,
        rowGap: 1.4,
        alignItems: "center",
        px: 2.2,
        py: 1.8,
        borderBottom: last ? "none" : `1px solid ${C.border}`,
        transition: "background .15s",
        "&:hover": { background: C.surfaceAlt },
      }}
    >
      {/* EMPLOYEE */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <Avatar
          sx={{
            width: 44,
            height: 44,
            borderRadius: "13px",
            background: "#EEF0F4",
            color: C.text,
            fontSize: 14,
            fontWeight: 800,
            border: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          {getInitials(name)}
        </Avatar>

        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 800, color: C.text }}>
            {name}
          </Typography>
          <Typography
            noWrap
            sx={{ mt: 0.2, fontSize: 11.5, color: C.textMuted, fontWeight: 600 }}
          >
            {code}
            {department ? ` · ${department}` : ""}
          </Typography>
        </Box>
      </Box>

      {/* TYPE */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.6 }}>
        <Chip
          size="small"
          label={type.label}
          sx={{
            height: 26,
            background: type.bg,
            color: type.color,
            fontWeight: 800,
            fontSize: 11,
          }}
        />
        <Typography sx={{ fontSize: 11.5, color: C.textSecondary, fontWeight: 600 }}>
          {fmtDays(leave.totalDays)}
        </Typography>
      </Box>

      {/* DATES */}
      <Box sx={{ minWidth: 0 }}>
        {isHalf ? (
          <>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: C.text }}>
              {fmtDate(leave.startDate)}
            </Typography>
            <Typography noWrap sx={{ mt: 0.2, fontSize: 11.5, color: C.textMuted }}>
              {session} · {fmtWeekday(leave.startDate)}
            </Typography>
          </>
        ) : (
          <>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: C.text }}>
              {fmtDate(leave.startDate)} – {fmtDate(leave.endDate)}
            </Typography>
            <Typography noWrap sx={{ mt: 0.2, fontSize: 11.5, color: C.textMuted }}>
              {fmtWeekday(leave.startDate)} to {fmtWeekday(leave.endDate)}
            </Typography>
          </>
        )}
      </Box>

      {/* REASON */}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12.5,
            lineHeight: 1.5,
            color: C.textSecondary,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {leave.reason || "—"}
        </Typography>

        {leave.reviewRemarks && leave.status !== "pending" && (
          <Typography
            noWrap
            sx={{ mt: 0.3, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}
          >
            Remarks: {leave.reviewRemarks}
          </Typography>
        )}
      </Box>

      {/* STATUS + ACTIONS */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: { xs: "space-between", lg: "flex-end" },
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <StatusBadge status={leave.status} />

        {canReview && leave.status === "pending" && (
          <Box sx={{ display: "flex", gap: 0.8 }}>
            <Button
              disabled={reviewing}
              onClick={() => onReview(leave.id, "approved")}
              startIcon={<CheckRounded sx={{ fontSize: 16 }} />}
              sx={{
                height: 32,
                px: 1.3,
                minWidth: 0,
                borderRadius: "9px",
                textTransform: "none",
                fontSize: 12,
                fontWeight: 800,
                color: C.green,
                background: C.greenSoft,
                "&:hover": { background: "#DDF1E8" },
              }}
            >
              Approve
            </Button>

            <Button
              disabled={reviewing}
              onClick={() => onReview(leave.id, "rejected")}
              startIcon={<CloseRounded sx={{ fontSize: 16 }} />}
              sx={{
                height: 32,
                px: 1.3,
                minWidth: 0,
                borderRadius: "9px",
                textTransform: "none",
                fontSize: 12,
                fontWeight: 800,
                color: C.red,
                background: C.redSoft,
                "&:hover": { background: "#FADBDB" },
              }}
            >
              Reject
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*  Apply dialog                                                              */
/* -------------------------------------------------------------------------- */

const fieldSx = {
  width: "100%",
  height: 46,
  px: 1.5,
  borderRadius: "12px",
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  outline: 0,
  boxSizing: "border-box",
  transition: "border-color .15s, box-shadow .15s",
  "&:focus": {
    borderColor: C.blue,
    boxShadow: `0 0 0 3px ${C.blueSoft}`,
  },
  "&:disabled": { background: C.surfaceAlt, color: C.textMuted },
};

function FieldLabel({ children }) {
  return (
    <Typography
      sx={{ mb: 0.8, fontSize: 12, fontWeight: 800, color: C.textSecondary }}
    >
      {children}
    </Typography>
  );
}

function ApplyDialog({ open, form, setForm, submitting, onClose, onSubmit }) {
  const isHalf = form.leaveType === "HD";
  const previewDays = isHalf ? 0.5 : daysBetween(form.startDate, form.endDate);

  const chooseType = (value) => {
    setForm({
      ...form,
      leaveType: value,
      halfDayOption: value === "HD" ? "first_half" : "",
    });
  };

  const onStartChange = (start) => {
    setForm({
      ...form,
      startDate: start,
      // keep the end date valid
      endDate: form.endDate && form.endDate < start ? start : form.endDate,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            borderRadius: "22px",
            boxShadow: "0 24px 60px rgba(20,24,35,.18)",
            m: 2,
            width: "calc(100% - 32px)",
          },
        },
      }}
    >
      <Box component="form" onSubmit={onSubmit}>
        {/* header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            pt: 2.5,
            pb: 2,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.textMuted,
              }}
            >
              New request
            </Typography>
            <Typography
              sx={{
                mt: 0.3,
                fontSize: 20,
                fontWeight: 850,
                letterSpacing: "-0.035em",
                color: C.text,
              }}
            >
              Apply for leave
            </Typography>
          </Box>

          <IconButton
            onClick={onClose}
            disabled={submitting}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              border: `1px solid ${C.border}`,
            }}
          >
            <CloseRounded sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* body */}
        <Box sx={{ px: 2.5, py: 2.5, display: "flex", flexDirection: "column", gap: 2.2 }}>
          {/* type */}
          <Box>
            <FieldLabel>Leave type</FieldLabel>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
              {LEAVE_TYPES.map((t) => {
                const on = form.leaveType === t.value;
                return (
                  <Box
                    key={t.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => chooseType(t.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chooseType(t.value);
                      }
                    }}
                    sx={{
                      p: 1.3,
                      borderRadius: "12px",
                      cursor: "pointer",
                      border: `1.5px solid ${on ? t.color : C.border}`,
                      background: on ? t.bg : C.surface,
                      transition: "all .15s",
                      outline: 0,
                      "&:hover": { borderColor: on ? t.color : C.borderStrong },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: on ? t.color : C.text,
                      }}
                    >
                      {t.label}
                    </Typography>
                    <Typography
                      sx={{ mt: 0.2, fontSize: 11, color: C.textMuted }}
                    >
                      {t.caption}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* dates */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isHalf ? "1fr" : "1fr 1fr",
              gap: 1.2,
            }}
          >
            <Box>
              <FieldLabel>{isHalf ? "Date" : "From"}</FieldLabel>
              <Box
                component="input"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => onStartChange(e.target.value)}
                sx={fieldSx}
              />
            </Box>

            {!isHalf && (
              <Box>
                <FieldLabel>To</FieldLabel>
                <Box
                  component="input"
                  type="date"
                  required
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  sx={fieldSx}
                />
              </Box>
            )}
          </Box>

          {previewDays > 0 && (
            <Box>
              <Chip
                icon={<CalendarMonthRounded sx={{ fontSize: 15 }} />}
                size="small"
                label={`${fmtDays(previewDays)} requested`}
                sx={{
                  height: 28,
                  background: C.blueSoft,
                  color: C.blue,
                  fontWeight: 800,
                  fontSize: 11.5,
                  "& .MuiChip-icon": { color: C.blue },
                }}
              />
            </Box>
          )}

          {/* half day option */}
          {isHalf && (
            <Box>
              <FieldLabel>Which half</FieldLabel>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                {[
                  {
                    value: "first_half",
                    label: "First half",
                    caption: "9:00 AM – 1:00 PM",
                    icon: <WbSunnyRounded sx={{ fontSize: 18 }} />,
                  },
                  {
                    value: "second_half",
                    label: "Second half",
                    caption: "2:00 PM – 6:00 PM",
                    icon: <WbTwilightRounded sx={{ fontSize: 18 }} />,
                  },
                ].map((o) => {
                  const on = form.halfDayOption === o.value;
                  return (
                    <Box
                      key={o.value}
                      role="button"
                      tabIndex={0}
                      onClick={() => setForm({ ...form, halfDayOption: o.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setForm({ ...form, halfDayOption: o.value });
                        }
                      }}
                      sx={{
                        p: 1.3,
                        borderRadius: "12px",
                        cursor: "pointer",
                        border: `1.5px solid ${on ? C.orange : C.border}`,
                        background: on ? C.orangeSoft : C.surface,
                        color: on ? C.orange : C.textSecondary,
                        outline: 0,
                      }}
                    >
                      {o.icon}
                      <Typography
                        sx={{
                          mt: 0.5,
                          fontSize: 13,
                          fontWeight: 800,
                          color: on ? C.orange : C.text,
                        }}
                      >
                        {o.label}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: C.textMuted }}>
                        {o.caption}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* reason */}
          <Box>
            <FieldLabel>Reason</FieldLabel>
            <Box
              component="textarea"
              required
              rows={3}
              value={form.reason}
              placeholder="Briefly describe your reason"
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              sx={{
                ...fieldSx,
                height: "auto",
                py: 1.3,
                resize: "vertical",
                minHeight: 84,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            />
          </Box>
        </Box>

        {/* footer */}
        <Box
          sx={{
            display: "flex",
            gap: 1.2,
            px: 2.5,
            pb: 2.5,
          }}
        >
          <Button
            type="button"
            onClick={onClose}
            disabled={submitting}
            sx={{
              height: 46,
              px: 2.5,
              borderRadius: "12px",
              textTransform: "none",
              fontSize: 13.5,
              fontWeight: 800,
              color: C.textSecondary,
              border: `1px solid ${C.border}`,
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            sx={{
              flex: 1,
              height: 46,
              borderRadius: "12px",
              textTransform: "none",
              fontSize: 13.5,
              fontWeight: 800,
              color: "#fff",
              background: C.black,
              "&:hover": { background: "#23262E" },
              "&.Mui-disabled": { background: "#9A9EA8", color: "#fff" },
            }}
          >
            {submitting ? (
              <CircularProgress size={20} sx={{ color: "#fff" }} />
            ) : (
              "Submit request"
            )}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function LeavePage() {
  const { isAdmin, isHR } = useAuth();
  const canReview = Boolean(isAdmin || isHR);

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchLeaves = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      const res = await leaveAPI.getAll();
      setLeaves((res.data.data || []).map(normalize));
    } catch {
      toast.error("Failed to load leaves");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();

    const isHalf = form.leaveType === "HD";

    if (!isHalf && form.endDate < form.startDate) {
      toast.error("End date cannot be before the start date");
      return;
    }

    setSubmitting(true);
    try {
      // totalDays is calculated by the backend, so it is not sent.
      const payload = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: isHalf ? form.startDate : form.endDate,
        reason: form.reason.trim(),
      };

      if (isHalf) {
        payload.halfDayOption = form.halfDayOption;
      }

      await leaveAPI.apply(payload);
      toast.success("Leave applied successfully");
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchLeaves(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to apply leave");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, status) => {
    setReviewingId(id);
    try {
      await leaveAPI.review(id, {
        status,
        reviewRemarks: status === "approved" ? "Approved" : "Rejected",
      });
      toast.success(`Leave ${status}`);
      fetchLeaves(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update leave");
    } finally {
      setReviewingId(null);
    }
  };

  const stats = useMemo(() => {
    const count = (status) => leaves.filter((l) => l.status === status).length;
    const total = leaves.length;
    return {
      total,
      pending: count("pending"),
      approved: count("approved"),
      rejected: count("rejected"),
    };
  }, [leaves]);

  const visible = useMemo(
    () => (filter === "all" ? leaves : leaves.filter((l) => l.status === filter)),
    [leaves, filter],
  );

  const share = (n) => (stats.total ? (n / stats.total) * 100 : 0);

  /* ---- loading ---- */
  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", background: C.bg, p: { xs: 2, md: 3.5 } }}>
        <Skeleton variant="rounded" height={100} sx={{ borderRadius: "20px", mb: 2.5 }} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
            mb: 2.5,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rounded" height={148} sx={{ borderRadius: "18px" }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: "20px" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: C.bg,
        p: { xs: 1.5, sm: 2, md: 3, lg: 3.5 },
      }}
    >
      <Box sx={{ maxWidth: 1700, mx: "auto" }}>
        {/* HEADER */}
        <Paper
          elevation={0}
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.5 },
            borderRadius: "22px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            mb: 2.5,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              gap: 2.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "16px",
                  background: C.black,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <EventNoteRounded />
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    lineHeight: 1.4,
                  }}
                >
                  Time off
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    mt: 0.3,
                    fontSize: { xs: 21, md: 25 },
                    fontWeight: 850,
                    letterSpacing: "-0.045em",
                    color: C.text,
                    lineHeight: 1.2,
                  }}
                >
                  Leave management
                </Typography>

                <Typography noWrap sx={{ mt: 0.4, fontSize: 12, color: C.textSecondary }}>
                  {canReview
                    ? "Review and track leave requests"
                    : "Apply for leave and track your requests"}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    onClick={() => fetchLeaves(true)}
                    disabled={refreshing}
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "12px",
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                    }}
                  >
                    <RefreshRounded
                      sx={{
                        animation: refreshing ? "spin 1s linear infinite" : "none",
                        "@keyframes spin": {
                          from: { transform: "rotate(0deg)" },
                          to: { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>

              {/* <Button
                onClick={() => setShowForm(true)}
                startIcon={<AddRounded />}
                sx={{
                  height: 42,
                  px: 2.2,
                  borderRadius: "12px",
                  textTransform: "none",
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: "#fff",
                  background: C.black,
                  boxShadow: "0 8px 20px rgba(17,19,24,.18)",
                  "&:hover": { background: "#23262E" },
                }}
              >
                Apply leave
              </Button> */}
            </Box>
          </Box>
        </Paper>

        {/* KPI CARDS */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: 2,
            mb: 2.5,
          }}
        >
          <MetricCard
            label="Total requests"
            value={stats.total}
            caption="All leave applications"
            icon={<EventNoteRounded />}
            iconBg={C.blueSoft}
            iconColor={C.blue}
          />

          <MetricCard
            label="Pending"
            value={stats.pending}
            caption={stats.pending ? "Waiting for review" : "Nothing waiting"}
            icon={<HourglassTopRounded />}
            iconBg={C.orangeSoft}
            iconColor={C.orange}
            progress={share(stats.pending)}
          />

          <MetricCard
            label="Approved"
            value={stats.approved}
            caption={`${Math.round(share(stats.approved))}% of requests`}
            icon={<CheckCircleRounded />}
            iconBg={C.greenSoft}
            iconColor={C.green}
            progress={share(stats.approved)}
          />

          <MetricCard
            label="Rejected"
            value={stats.rejected}
            caption={`${Math.round(share(stats.rejected))}% of requests`}
            icon={<CancelRounded />}
            iconBg={C.redSoft}
            iconColor={C.red}
            progress={share(stats.rejected)}
          />
        </Box>

        {/* REQUESTS */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: "20px",
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            minWidth: 0,
          }}
        >
          <SectionHeader
            eyebrow="Requests"
            title={canReview ? "Team leave requests" : "My leave requests"}
            subtitle={`${visible.length} request${visible.length === 1 ? "" : "s"}${
              filter === "all" ? "" : ` · ${filter}`
            }`}
            action={
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  sx={{
                    height: 38,
                    borderRadius: "10px",
                    fontSize: 12,
                    fontWeight: 700,
                    "& fieldset": { borderColor: C.border },
                  }}
                >
                  {STATUS_FILTERS.map((f) => (
                    <MenuItem key={f.value} value={f.value}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            }
          />

          {!visible.length ? (
            <Box
              sx={{
                minHeight: 260,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                borderRadius: "16px",
                border: `1px dashed ${C.borderStrong}`,
                background: C.surfaceAlt,
                px: 3,
              }}
            >
              <Box>
                <Avatar
                  sx={{
                    width: 54,
                    height: 54,
                    mx: "auto",
                    mb: 1.5,
                    background: "#EEF0F3",
                    color: C.textMuted,
                  }}
                >
                  <EventNoteRounded />
                </Avatar>

                <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                  No leave requests
                </Typography>

                <Typography sx={{ mt: 0.5, fontSize: 11.5, color: C.textMuted }}>
                  {filter === "all"
                    ? "Use “Apply leave” to create your first request."
                    : "No requests match this filter."}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box>
              <ListHeader />

              <Box>
                {visible.map((leave, index) => (
                  <LeaveRow
                    key={leave.id}
                    leave={leave}
                    canReview={canReview}
                    reviewing={reviewingId === leave.id}
                    onReview={handleReview}
                    last={index === visible.length - 1}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      <ApplyDialog
        open={showForm}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onClose={() => setShowForm(false)}
        onSubmit={handleApply}
      />
    </Box>
  );
}
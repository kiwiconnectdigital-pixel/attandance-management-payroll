import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { attendanceAPI, employeeAPI } from "../../services/api";
import toast from "react-hot-toast";

import {
  Box,
  Stack,
  Typography,
  Paper,
  Avatar,
  Chip,
  Skeleton,
  Button,
  IconButton,
  Divider,
  LinearProgress,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
} from "@mui/material";

import {
  AccessTimeRounded,
  CalendarMonthRounded,
  CheckCircleRounded,
  LoginRounded,
  LogoutRounded,
  PersonRounded,
  RefreshRounded,
  ScheduleRounded,
  ShieldRounded,
  TrendingUpRounded,
  WarningAmberRounded,
  WorkOutlineRounded,
  VerifiedRounded,
  LocationOnRounded,
  FingerprintRounded,
  PersonOffRounded,
  HowToRegRounded,
} from "@mui/icons-material";

const BACKEND_URL = "https://attendance-backend.kiwiconnectdigital.com";

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

// Dates are handled in India Standard Time to match the backend
const getTodayLocal = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

const parseYmd = (value) => {
  const [year, month, day] = String(value).split("-").map(Number);

  return new Date(year, (month || 1) - 1, day || 1);
};

const formatDate = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatShortDate = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const formatHours = (value) => {
  const hours = Number(value);

  if (!Number.isFinite(hours)) return "0h 00m";

  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);

  return `${whole}h ${String(minutes).padStart(2, "0")}m`;
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/**
 * Converts whatever is stored in the DB into a clean public URL.
 *
 * /home/ubuntu/attandance-management-payroll/uploads/selfies/a.jpg
 *   -> https://attendance-backend.kiwiconnectdigital.com/uploads/selfies/a.jpg
 */
const getUploadUrl = (path) => {
  if (!path) return null;

  const value = String(path).replace(/\\/g, "/");

  // Already a full URL (S3 / CDN etc.) -> use as is
  if (/^https?:\/\//i.test(value)) return value;

  // Keep only the part starting from "uploads/"
  const index = value.indexOf("uploads/");
  const cleanPath =
    index !== -1 ? value.slice(index) : value.replace(/^\/+/, "");

  return `${BACKEND_URL}/${cleanPath}`;
};

const getSelfieUrl = getUploadUrl;
const getProfileUrl = getUploadUrl;

const getProfileImage = (record) =>
  getProfileUrl(
    record?.employee?.profile_image ||
      record?.employee?.profileImage ||
      record?.employee?.photo ||
      record?.profile_image ||
      record?.profileImage ||
      null,
  );

const getCheckIns = (record) => {
  if (Array.isArray(record?.checkIns)) return record.checkIns;
  if (Array.isArray(record?.check_ins)) return record.check_ins;
  return [];
};

const getCheckOuts = (record) => {
  if (Array.isArray(record?.checkOuts)) return record.checkOuts;
  if (Array.isArray(record?.check_outs)) return record.check_outs;
  return [];
};

const getCheckIn = (record) => {
  const items = getCheckIns(record);

  if (!items.length) return null;

  return items[0];
};

const getCheckOut = (record) => {
  const items = getCheckOuts(record);

  if (!items.length) return null;

  return items[items.length - 1];
};

const getEmployeeName = (record) => {
  return (
    record?.employee?.name ||
    record?.employee_name ||
    record?.name ||
    "Unknown Employee"
  );
};

const getEmployeeCode = (record) => {
  return (
    record?.employee?.employee_code ||
    record?.employee?.employeeCode ||
    record?.employee_code ||
    record?.employeeCode ||
    "—"
  );
};

const getDepartment = (record) => {
  return (
    record?.employee?.department ||
    record?.department ||
    "Department not assigned"
  );
};

const getDesignation = (record) => {
  return record?.employee?.designation || record?.designation || "Employee";
};

const getLateMinutes = (record) => {
  const value =
    record?.late_by_minutes ??
    record?.lateByMinutes ??
    getCheckIn(record)?.late_by_minutes ??
    getCheckIn(record)?.lateByMinutes ??
    0;

  const minutes = Number(value);

  return Number.isFinite(minutes) ? minutes : 0;
};

const getWorkingHours = (record) => {
  const value = record?.working_hours ?? record?.workingHours ?? 0;

  const hours = Number(value);

  return Number.isFinite(hours) ? hours : 0;
};

const isLate = (record) => {
  return Boolean(
    record?.is_late ??
    record?.isLate ??
    getCheckIn(record)?.is_late ??
    getCheckIn(record)?.isLate,
  );
};

const getFaceScore = (item) => {
  if (!item) return null;

  const value = item?.face_match_score ?? item?.faceMatchScore;

  if (value === null || value === undefined) {
    return null;
  }

  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  return score;
};

const getFacePercent = (item) => {
  const score = getFaceScore(item);

  if (score === null) return null;

  return Math.round(score * 100);
};

const isFaceVerified = (item) => {
  return Boolean(item?.face_verified ?? item?.faceVerified);
};

const getLatestSelfie = (record) => {
  const checkout = getCheckOut(record);
  const checkin = getCheckIn(record);

  return (
    getSelfieUrl(checkout?.selfie) || getSelfieUrl(checkin?.selfie) || null
  );
};

const getCheckInSelfie = (record) => {
  return getSelfieUrl(getCheckIn(record)?.selfie);
};

const getCheckOutSelfie = (record) => {
  return getSelfieUrl(getCheckOut(record)?.selfie);
};

const getStatus = (record) => {
  const status = String(record?.status || "").toLowerCase();

  if (status === "present") return "present";
  if (status === "late") return "late";
  if (status === "half-day") return "half-day";
  if (status === "absent") return "absent";

  if (isLate(record)) return "late";

  if (getCheckIn(record)) return "present";

  return "absent";
};

// Minutes since midnight (India time) of the first check-in
const getCheckInMinutes = (record) => {
  const value = getCheckIn(record)?.time;

  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return (hour % 24) * 60 + minute;
};

const formatClockMinutes = (value) => {
  const total = Math.round(value);
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;

  return `${String(hour24 % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour24 >= 12 ? "pm" : "am"}`;
};

const getRecordDate = (record) => String(record?.date ?? "").slice(0, 10);

const getEmployeeId = (record) =>
  record?.employee?.id ?? record?.employee_id ?? record?.employeeId ?? null;

// Anyone who is not "absent" has checked in for the day
const isMarked = (record) => getStatus(record) !== "absent";

// One exclusive bucket per employee, used by the donut and the legend
const getDayCategory = (record) => {
  const status = getStatus(record);

  if (status === "absent") return "absent";
  if (status === "half-day") return "half-day";
  if (status === "late" || isLate(record)) return "late";

  return "present";
};

const recordScore = (record) =>
  (isMarked(record) ? 4 : 0) +
  (getCheckOut(record) ? 2 : 0) +
  (getCheckIn(record) ? 1 : 0);

// Keep a single (the most complete) record per employee
const dedupeByEmployee = (records) => {
  const best = new Map();

  records.forEach((record, index) => {
    const key = getEmployeeId(record) ?? `row-${index}`;
    const current = best.get(key);

    if (
      !current ||
      recordScore(record) > recordScore(current) ||
      (recordScore(record) === recordScore(current) &&
        Number(record?.id || 0) > Number(current?.id || 0))
    ) {
      best.set(key, record);
    }
  });

  return [...best.values()];
};

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      sx={{
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
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 13.5,
              color: C.textSecondary,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

function StatusBadge({ status }) {
  const config = {
    present: {
      label: "Present",
      color: C.green,
      bg: C.greenSoft,
    },
    late: {
      label: "Late",
      color: C.orange,
      bg: C.orangeSoft,
    },
    "half-day": {
      label: "Half day",
      color: C.red,
      bg: C.redSoft,
    },
    absent: {
      label: "Absent",
      color: C.red,
      bg: C.redSoft,
    },
  };

  const item = config[status] || config.present;

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
        "& .MuiChip-label": {
          px: 1.2,
        },
      }}
    />
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  iconBg,
  iconColor,
  progress,
}) {
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
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
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
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Stack>

      <Typography
        sx={{
          mt: 2,
          fontSize: 12,
          color: C.textSecondary,
          fontWeight: 700,
        }}
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
        <Typography
          noWrap
          sx={{
            mt: 0.7,
            fontSize: 11.5,
            color: C.textMuted,
          }}
        >
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

// Shows the profile photo first, falls back to the selfie, then to initials
function Selfie({ src, fallback, name, size = 58, verified = false }) {
  const [failed, setFailed] = useState([]);

  const candidates = [src, fallback].filter(
    (item) => item && !failed.includes(item),
  );

  const current = candidates[0];

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Avatar
        src={current || undefined}
        imgProps={{
          onError: () => setFailed((list) => [...list, current]),
        }}
        sx={{
          width: size,
          height: size,
          borderRadius: "16px",
          background: "#EEF0F4",
          color: C.text,
          fontSize: size > 55 ? 18 : 14,
          fontWeight: 800,
          border: `1px solid ${C.border}`,
        }}
      >
        {getInitials(name)}
      </Avatar>

      {verified && (
        <Box
          sx={{
            position: "absolute",
            right: -3,
            bottom: -3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: C.green,
            border: `3px solid ${C.surface}`,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            zIndex: 2,
          }}
        >
          <VerifiedRounded sx={{ fontSize: 12 }} />
        </Box>
      )}
    </Box>
  );
}

function EmployeeCard({ record }) {
  const name = getEmployeeName(record);
  const code = getEmployeeCode(record);
  const department = getDepartment(record);
  const designation = getDesignation(record);

  const checkIn = getCheckIn(record);
  const checkOut = getCheckOut(record);

  const checkInSelfie = getCheckInSelfie(record);
  const checkOutSelfie = getCheckOutSelfie(record);

  const faceVerified = isFaceVerified(checkIn) || isFaceVerified(checkOut);

  const facePercent = getFacePercent(checkOut) ?? getFacePercent(checkIn);

  const lateMinutes = getLateMinutes(record);
  const workingHours = getWorkingHours(record);
  const status = getStatus(record);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "20px",
        border: `1px solid ${C.border}`,
        background: C.surface,
        overflow: "hidden",
        transition: "all .2s ease",
        "&:hover": {
          boxShadow: C.shadowHover,
          transform: "translateY(-2px)",
        },
      }}
    >
      {/* TOP */}
      <Box sx={{ p: 2.2 }}>
        <Stack
          direction="row"
          sx={{
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            rowGap: 1,
            gap: 2,
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              gap: 1.5,
              minWidth: 0,
              flex: "1 1 220px",
            }}
          >
            <Selfie
              src={getProfileImage(record)}
              fallback={getLatestSelfie(record)}
              name={name}
              size={56}
              verified={faceVerified}
            />

            <Box
              sx={{
                minWidth: 0,
                flex: "1 1 auto",
              }}
            >
              <Typography
                noWrap
                sx={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: C.text,
                }}
              >
                {name}
              </Typography>

              <Typography
                noWrap
                sx={{
                  mt: 0.25,
                  fontSize: 11.5,
                  color: C.textMuted,
                  fontWeight: 600,
                }}
              >
                {code}
              </Typography>

              <Typography
                noWrap
                sx={{
                  mt: 0.4,
                  fontSize: 11.5,
                  color: C.textSecondary,
                }}
              >
                {designation} · {department}
              </Typography>
            </Box>
          </Stack>

          <StatusBadge status={status} />
        </Stack>

        {/* ATTENDANCE TIMES */}
        <Box
          sx={{
            mt: 2,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
          }}
        >
          <Box
            sx={{
              p: 1.4,
              borderRadius: "12px",
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                gap: 0.7,
              }}
            >
              <LoginRounded
                sx={{
                  fontSize: 16,
                  color: C.green,
                  flexShrink: 0,
                }}
              />

              <Typography
                noWrap
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: C.textMuted,
                }}
              >
                Check in
              </Typography>
            </Stack>

            <Typography
              noWrap
              sx={{
                mt: 0.6,
                fontSize: 14,
                fontWeight: 800,
                color: C.text,
              }}
            >
              {formatTime(checkIn?.time)}
            </Typography>
          </Box>

          <Box
            sx={{
              p: 1.4,
              borderRadius: "12px",
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                gap: 0.7,
              }}
            >
              <LogoutRounded
                sx={{
                  fontSize: 16,
                  color: C.red,
                  flexShrink: 0,
                }}
              />

              <Typography
                noWrap
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: C.textMuted,
                }}
              >
                Check out
              </Typography>
            </Stack>

            <Typography
              noWrap
              sx={{
                mt: 0.6,
                fontSize: 14,
                fontWeight: 800,
                color: C.text,
              }}
            >
              {formatTime(checkOut?.time)}
            </Typography>
          </Box>
        </Box>

        {/* STATS */}
        <Stack
          direction="row"
          sx={{
            gap: 1,
            mt: 1,
            flexWrap: "wrap",
          }}
        >
          <Chip
            icon={<AccessTimeRounded sx={{ fontSize: 14 }} />}
            label={formatHours(workingHours)}
            size="small"
            sx={{
              height: 27,
              background: C.blueSoft,
              color: C.blue,
              fontWeight: 700,
              fontSize: 11,
              "& .MuiChip-icon": {
                color: C.blue,
              },
            }}
          />

          {lateMinutes > 0 && (
            <Chip
              icon={<WarningAmberRounded sx={{ fontSize: 14 }} />}
              label={`${lateMinutes} min late`}
              size="small"
              sx={{
                height: 27,
                background: C.orangeSoft,
                color: C.orange,
                fontWeight: 700,
                fontSize: 11,
                "& .MuiChip-icon": {
                  color: C.orange,
                },
              }}
            />
          )}

          {faceVerified && (
            <Chip
              icon={<ShieldRounded sx={{ fontSize: 14 }} />}
              label={
                facePercent !== null ? `Face ${facePercent}%` : "Face verified"
              }
              size="small"
              sx={{
                height: 27,
                background: C.greenSoft,
                color: C.green,
                fontWeight: 700,
                fontSize: 11,
                "& .MuiChip-icon": {
                  color: C.green,
                },
              }}
            />
          )}
        </Stack>
      </Box>

      {/* SELFIES */}
      {(checkInSelfie || checkOutSelfie) && (
        <>
          <Divider />

          <Box
            sx={{
              px: 2.2,
              py: 1.4,
            }}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                rowGap: 0.5,
              }}
            >
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  gap: 0.7,
                  minWidth: 0,
                }}
              >
                <FingerprintRounded
                  sx={{
                    fontSize: 16,
                    color: C.textMuted,
                    flexShrink: 0,
                  }}
                />

                <Typography
                  noWrap
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.textSecondary,
                  }}
                >
                  Verification snapshots
                </Typography>
              </Stack>

              {faceVerified && (
                <Typography
                  noWrap
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: C.green,
                    flexShrink: 0,
                  }}
                >
                  Verified
                </Typography>
              )}
            </Stack>

            <Stack
              direction="row"
              sx={{
                gap: 1.2,
                mt: 1.2,
                flexWrap: "wrap",
              }}
            >
              {checkInSelfie && (
                <Box
                  sx={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                  }}
                >
                  <Avatar
                    src={checkInSelfie}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "11px",
                      border: `1px solid ${C.border}`,
                    }}
                  />

                  <Box
                    sx={{
                      position: "absolute",
                      left: 4,
                      bottom: 4,
                      px: 0.55,
                      py: 0.15,
                      borderRadius: "4px",
                      background: "rgba(0,0,0,.72)",
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 800,
                      zIndex: 1,
                    }}
                  >
                    IN
                  </Box>
                </Box>
              )}

              {checkOutSelfie && (
                <Box
                  sx={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                  }}
                >
                  <Avatar
                    src={checkOutSelfie}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "11px",
                      border: `1px solid ${C.border}`,
                    }}
                  />

                  <Box
                    sx={{
                      position: "absolute",
                      left: 4,
                      bottom: 4,
                      px: 0.55,
                      py: 0.15,
                      borderRadius: "4px",
                      background: "rgba(0,0,0,.72)",
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 800,
                      zIndex: 1,
                    }}
                  >
                    OUT
                  </Box>
                </Box>
              )}

              {checkIn?.latitude && (
                <Tooltip title="GPS location captured">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "11px",
                      border: `1px solid ${C.border}`,
                      background: C.surfaceAlt,
                      display: "grid",
                      placeItems: "center",
                      color: C.blue,
                      flexShrink: 0,
                    }}
                  >
                    <LocationOnRounded />
                  </Box>
                </Tooltip>
              )}
            </Stack>
          </Box>
        </>
      )}
    </Paper>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box
      sx={{
        textAlign: { xs: "left", md: "right" },
        flexShrink: 0,
      }}
    >
      <Typography
        noWrap
        sx={{
          fontSize: { xs: 22, md: 30 },
          fontWeight: 850,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          color: C.text,
        }}
      >
        {new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)}
      </Typography>

      <Typography
        noWrap
        sx={{
          mt: 0.6,
          fontSize: 11,
          color: C.textMuted,
          fontWeight: 700,
        }}
      >
        India Standard Time
      </Typography>
    </Box>
  );
}

function AttendanceDistribution({
  present,
  late,
  halfDay,
  absent,
  total,
  checkedIn,
  eyebrow,
  subtitle,
  absentLabel,
}) {
  const items = [
    { label: "Present", value: present, color: C.green },
    { label: "Late", value: late, color: C.orange },
    { label: "Half day", value: halfDay, color: C.purple },
    { label: absentLabel, value: absent, color: C.red },
  ];

  const denominator = Math.max(total, present + late + halfDay + absent, 1);

  let cursor = 0;
  const stops = [];

  items.forEach((item) => {
    if (!item.value) return;

    const start = cursor;
    cursor += (item.value / denominator) * 360;
    stops.push(`${item.color} ${start}deg ${cursor}deg`);
  });

  const ring = stops.length ? stops.join(", ") : "#EEF0F3 0deg 360deg";

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: "20px",
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SectionHeader
        eyebrow={eyebrow}
        title="Attendance health"
        subtitle={subtitle}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "160px minmax(0, 1fr)",
          },
          alignItems: "center",
          alignContent: "center",
          flex: 1,
          gap: 3,
        }}
      >
        {/* DONUT */}
        <Box
          sx={{
            width: 160,
            height: 160,
            maxWidth: "100%",
            borderRadius: "50%",
            mx: "auto",
            background: `conic-gradient(${ring})`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            sx={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              background: C.surface,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 26,
                  fontWeight: 850,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                }}
              >
                {checkedIn}/{total}
              </Typography>

              <Typography
                sx={{
                  mt: 0.6,
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Checked in
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* LEGEND */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.6,
            minWidth: 0,
          }}
        >
          {items.map((item) => {
            const percentage =
              total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <Box key={item.label}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 0.7,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: item.color,
                        flexShrink: 0,
                      }}
                    />

                    <Typography
                      noWrap
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.textSecondary,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>

                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {item.value}
                    <Box
                      component="span"
                      sx={{ ml: 0.8, fontWeight: 600, color: C.textMuted }}
                    >
                      {percentage}%
                    </Box>
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  sx={{
                    height: 5,
                    borderRadius: 99,
                    background: "#EEF0F3",
                    "& .MuiLinearProgress-bar": {
                      background: item.color,
                      borderRadius: 99,
                    },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function PulseRow({
  icon,
  iconBg,
  iconColor,
  label,
  caption,
  value,
  valueColor,
}) {
  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: "14px",
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.4,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              background: iconBg,
              color: iconColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 800 }}>
              {label}
            </Typography>

            <Typography noWrap sx={{ fontSize: 11, color: C.textMuted }}>
              {caption}
            </Typography>
          </Box>
        </Box>

        <Typography
          noWrap
          sx={{
            fontSize: 22,
            fontWeight: 850,
            color: valueColor || C.text,
            flexShrink: 0,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(getTodayLocal());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState("all");
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const requestRef = useRef(0);

  const isToday = selectedDate === getTodayLocal();
  const dayDate = parseYmd(selectedDate);
  const dayEyebrow = isToday ? "Today" : formatShortDate(dayDate);
  const dayPhrase = isToday ? "today" : `on ${formatShortDate(dayDate)}`;

  const loadDashboard = async (date = selectedDate, silent = false) => {
    const requestId = ++requestRef.current;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // The attendance endpoint filters by startDate/endDate (it ignores a
      // plain `date`), so ask for exactly one day.
      const [employeeRes, attendanceRes] = await Promise.all([
        employeeAPI.getAll({ isActive: "true", limit: 1000 }),
        attendanceAPI.getAll({
          startDate: date,
          endDate: date,
          limit: 500,
        }),
      ]);

      if (requestId !== requestRef.current) return;

      const employeeData = employeeRes?.data?.data ?? employeeRes?.data ?? {};
      const employeeList = Array.isArray(employeeData.employees)
        ? employeeData.employees
        : [];

      const activeTotal =
        Number(employeeData.pagination?.total ?? employeeList.length) || 0;

      const activeIds = new Set(employeeList.map((item) => String(item.id)));

      const rawRecords =
        attendanceRes?.data?.data?.records ??
        attendanceRes?.data?.records ??
        attendanceRes?.data?.data ??
        [];

      const dayRecords = (Array.isArray(rawRecords) ? rawRecords : [])
        // only the selected day
        .filter((record) => getRecordDate(record) === date)
        // only this company's active employees
        .filter((record) => {
          const id = getEmployeeId(record);

          if (id === null || !activeIds.size) return true;

          return activeIds.has(String(id));
        });

      const uniqueRecords = dedupeByEmployee(dayRecords);

      setTotalEmployees(Math.max(activeTotal, uniqueRecords.length));
      setRecords(uniqueRecords);
      setUpdatedAt(new Date());
    } catch (error) {
      if (requestId !== requestRef.current) return;

      console.error("Dashboard loading error:", error);

      toast.error(error?.response?.data?.message || "Unable to load dashboard");
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    setFilter("all");
    loadDashboard(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Keep today's numbers fresh
  useEffect(() => {
    if (!isToday) return undefined;

    const timer = setInterval(() => loadDashboard(selectedDate, true), 60000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isToday]);

  const dayStats = useMemo(() => {
    const marked = records.filter(isMarked);
    const checkedIn = marked.length;
    const checkedOut = marked.filter((record) => getCheckOut(record)).length;

    let present = 0;
    let late = 0;
    let halfDay = 0;

    marked.forEach((record) => {
      const category = getDayCategory(record);

      if (category === "late") late += 1;
      else if (category === "half-day") halfDay += 1;
      else present += 1;
    });

    const total = Math.max(totalEmployees, checkedIn);
    const absent = Math.max(total - checkedIn, 0);
    const rate =
      total > 0 ? Math.min(100, Math.round((checkedIn / total) * 100)) : 0;

    const completed = marked.filter((record) => getWorkingHours(record) > 0);
    const averageHours = completed.length
      ? completed.reduce((sum, record) => sum + getWorkingHours(record), 0) /
        completed.length
      : 0;

    const checkInTimes = marked
      .map(getCheckInMinutes)
      .filter((minutes) => minutes !== null);

    const averageCheckIn = checkInTimes.length
      ? checkInTimes.reduce((sum, minutes) => sum + minutes, 0) /
        checkInTimes.length
      : null;

    const onTimeRate = checkedIn ? Math.round((present / checkedIn) * 100) : 0;

    return {
      onTimeRate,
      averageCheckIn,
      checkInSamples: checkInTimes.length,
      total,
      checkedIn,
      checkedOut,
      stillWorking: Math.max(checkedIn - checkedOut, 0),
      present,
      late,
      halfDay,
      absent,
      rate,
      averageHours,
    };
  }, [records, totalEmployees]);

  const visibleRecords = useMemo(() => {
    if (filter === "all") {
      return records;
    }

    return records.filter((record) => getDayCategory(record) === filter);
  }, [records, filter]);

  const verifiedCount = useMemo(() => {
    return records.filter((record) => {
      const checkIn = getCheckIn(record);
      const checkOut = getCheckOut(record);

      return isFaceVerified(checkIn) || isFaceVerified(checkOut);
    }).length;
  }, [records]);

  const absentLabel = isToday ? "Not checked in" : "Absent";

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: C.bg,
          p: { xs: 2, md: 3.5 },
        }}
      >
        <Skeleton
          variant="rounded"
          height={100}
          sx={{
            borderRadius: "20px",
            mb: 2.5,
          }}
        />

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
          {[1, 2, 3, 4].map((item) => (
            <Skeleton
              key={item}
              variant="rounded"
              height={148}
              sx={{
                borderRadius: "18px",
              }}
            />
          ))}
        </Box>

        <Skeleton
          variant="rounded"
          height={320}
          sx={{
            borderRadius: "20px",
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: C.bg,
        p: {
          xs: 1.5,
          sm: 2,
          md: 3,
          lg: 3.5,
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1700,
          mx: "auto",
        }}
      >
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
              flexDirection: { xs: "column", lg: "row" },
              alignItems: { xs: "flex-start", lg: "center" },
              justifyContent: "space-between",
              gap: 2.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                minWidth: 0,
              }}
            >
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: "16px",
                  background: C.black,
                  color: "#fff",
                  fontWeight: 850,
                  flexShrink: 0,
                }}
              >
                {getInitials(user?.name || user?.full_name || "Admin")}
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
                  {getGreeting()}
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
                  {user?.name || user?.full_name || "Admin"}
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    mt: 0.4,
                    fontSize: 12,
                    color: C.textSecondary,
                  }}
                >
                  Workforce command center
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" },
                flexWrap: "wrap",
                gap: { xs: 2, sm: 2.5 },
              }}
            >
              {/* DAY PICKER */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  component="label"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    height: 42,
                    px: 1.5,
                    borderRadius: "12px",
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    cursor: "pointer",
                  }}
                >
                  <CalendarMonthRounded
                    sx={{ fontSize: 18, color: C.textMuted }}
                  />

                  <Box
                    component="input"
                    type="date"
                    value={selectedDate}
                    max={getTodayLocal()}
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedDate(event.target.value);
                      }
                    }}
                    sx={{
                      border: 0,
                      outline: 0,
                      background: "transparent",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      cursor: "pointer",
                    }}
                  />
                </Box>

                {!isToday && (
                  <Button
                    onClick={() => setSelectedDate(getTodayLocal())}
                    sx={{
                      height: 42,
                      px: 2,
                      borderRadius: "12px",
                      textTransform: "none",
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: C.blue,
                      background: C.blueSoft,
                      "&:hover": { background: C.blueSoft },
                    }}
                  >
                    Back to today
                  </Button>
                )}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 12,
                    color: C.textSecondary,
                    fontWeight: 700,
                  }}
                >
                  {formatDate(dayDate)}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.9,
                    mt: 0.6,
                  }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isToday ? C.green : C.orange,
                      boxShadow: `0 0 0 4px ${isToday ? C.greenSoft : C.orangeSoft}`,
                      flexShrink: 0,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: 10.5,
                      color: isToday ? C.green : C.orange,
                      fontWeight: 800,
                    }}
                  >
                    {isToday ? "System live" : "Viewing past day"}
                  </Typography>
                </Box>
              </Box>

              <LiveClock />

              <Tooltip title="Refresh dashboard">
                <span>
                  <IconButton
                    onClick={() => loadDashboard(selectedDate, true)}
                    disabled={refreshing}
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "12px",
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      flexShrink: 0,
                    }}
                  >
                    <RefreshRounded
                      sx={{
                        animation: refreshing
                          ? "spin 1s linear infinite"
                          : "none",
                        "@keyframes spin": {
                          from: { transform: "rotate(0deg)" },
                          to: { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
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
            label="Attendance rate"
            value={`${dayStats.rate}%`}
            caption={`${dayStats.checkedIn} of ${dayStats.total} employees ${isToday ? "so far" : "that day"}`}
            icon={<TrendingUpRounded />}
            iconBg={C.greenSoft}
            iconColor={C.green}
            progress={dayStats.rate}
          />

          <MetricCard
            label="On-time arrivals"
            value={`${dayStats.onTimeRate}%`}
            caption={
              dayStats.checkedIn
                ? `${dayStats.present} of ${dayStats.checkedIn} arrived on time`
                : "No check-ins yet"
            }
            icon={<HowToRegRounded />}
            iconBg={C.purpleSoft}
            iconColor={C.purple}
            progress={dayStats.onTimeRate}
          />

          <MetricCard
            label="Avg. check-in time"
            value={
              dayStats.averageCheckIn === null
                ? "--"
                : formatClockMinutes(dayStats.averageCheckIn)
            }
            caption={
              dayStats.checkInSamples
                ? `Across ${dayStats.checkInSamples} check-in${dayStats.checkInSamples === 1 ? "" : "s"}`
                : "No check-ins yet"
            }
            icon={<AccessTimeRounded />}
            iconBg={C.blueSoft}
            iconColor={C.blue}
          />

          <MetricCard
            label={absentLabel}
            value={dayStats.absent}
            caption={`of ${dayStats.total} employees`}
            icon={<PersonOffRounded />}
            iconBg={C.redSoft}
            iconColor={C.red}
            progress={
              dayStats.total ? (dayStats.absent / dayStats.total) * 100 : 0
            }
          />
        </Box>

        {/* HEALTH + PULSE */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.55fr) minmax(300px, .8fr)",
            },
            gap: 2.5,
            mb: 2.5,
            alignItems: "stretch",
          }}
        >
          <AttendanceDistribution
            present={dayStats.present}
            late={dayStats.late}
            halfDay={dayStats.halfDay}
            absent={dayStats.absent}
            total={dayStats.total}
            checkedIn={dayStats.checkedIn}
            eyebrow={dayEyebrow}
            subtitle={
              isToday ? "Live workforce distribution" : "Workforce distribution"
            }
            absentLabel={absentLabel}
          />

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
              eyebrow="Workforce"
              title={isToday ? "Today's pulse" : "Day's pulse"}
              subtitle={
                isToday
                  ? "Key operational signals"
                  : `Key signals for ${formatShortDate(dayDate)}`
              }
            />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
              <PulseRow
                icon={<CheckCircleRounded sx={{ fontSize: 20 }} />}
                iconBg={C.greenSoft}
                iconColor={C.green}
                label="Present"
                caption={`Checked in ${dayPhrase}`}
                value={dayStats.checkedIn}
              />

              <PulseRow
                icon={<ScheduleRounded sx={{ fontSize: 20 }} />}
                iconBg={C.orangeSoft}
                iconColor={C.orange}
                label="Late arrivals"
                caption={
                  dayStats.late ? "Requires attention" : "Everyone on time"
                }
                value={dayStats.late}
                valueColor={C.orange}
              />

              <PulseRow
                icon={<WorkOutlineRounded sx={{ fontSize: 20 }} />}
                iconBg={C.purpleSoft}
                iconColor={C.purple}
                label={isToday ? "Currently working" : "Did not check out"}
                caption={
                  isToday ? "Checked in, not yet out" : "No check-out recorded"
                }
                value={dayStats.stillWorking}
                valueColor={C.purple}
              />

              <PulseRow
                icon={<AccessTimeRounded sx={{ fontSize: 20 }} />}
                iconBg={C.blueSoft}
                iconColor={C.blue}
                label="Avg. working time"
                caption="Completed shifts only"
                value={formatHours(dayStats.averageHours)}
                valueColor={C.blue}
              />
            </Box>
          </Paper>
        </Box>

        {/* ACTIVITY + SECURITY */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1fr) minmax(280px, 300px)",
            },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          {/* EMPLOYEES */}
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
              eyebrow={isToday ? "Live attendance" : "Attendance"}
              title="Employee activity"
              subtitle={`${records.length} attendance record${records.length === 1 ? "" : "s"} ${isToday ? "captured today" : `for ${formatShortDate(dayDate)}`}`}
              action={
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 150,
                  }}
                >
                  <Select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    sx={{
                      height: 38,
                      borderRadius: "10px",
                      fontSize: 12,
                      fontWeight: 700,
                      "& fieldset": {
                        borderColor: C.border,
                      },
                    }}
                  >
                    <MenuItem value="all">All employees</MenuItem>

                    <MenuItem value="present">Present</MenuItem>

                    <MenuItem value="late">Late</MenuItem>

                    <MenuItem value="half-day">Half day</MenuItem>

                    <MenuItem value="absent">Absent</MenuItem>
                  </Select>
                </FormControl>
              }
            />

            {!visibleRecords.length ? (
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
                    <PersonRounded />
                  </Avatar>

                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    No attendance records
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.5,
                      fontSize: 11.5,
                      color: C.textMuted,
                    }}
                  >
                    {filter === "all"
                      ? `Nobody has checked in ${dayPhrase}.`
                      : `There are no employees matching this filter ${dayPhrase}.`}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.8,
                }}
              >
                {visibleRecords.map((record) => (
                  <EmployeeCard
                    key={
                      record.id || `${getEmployeeCode(record)}-${record.date}`
                    }
                    record={record}
                  />
                ))}
              </Box>
            )}
          </Paper>

          {/* SIDEBAR */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              minWidth: 0,
            }}
          >
            {/* SECURITY */}
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: "20px",
                border: `1px solid ${C.border}`,
                background: "linear-gradient(145deg, #111318, #1D2027)",
                color: "#fff",
                boxShadow: "0 14px 35px rgba(17,19,24,.15)",
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "12px",
                    background: "rgba(255,255,255,.09)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldRounded />
                </Box>

                <Chip
                  size="small"
                  label="SECURE"
                  sx={{
                    height: 25,
                    background: "rgba(82,214,150,.14)",
                    color: "#65D69C",
                    fontSize: 9.5,
                    fontWeight: 900,
                    letterSpacing: ".08em",
                    flexShrink: 0,
                  }}
                />
              </Box>

              <Typography
                sx={{
                  mt: 2,
                  fontSize: 15,
                  fontWeight: 850,
                }}
              >
                Biometric verification
              </Typography>

              <Typography
                sx={{
                  mt: 0.7,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,.58)",
                }}
              >
                Attendance snapshots are being validated through face
                verification.
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 0.8,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10.5,
                      color: "rgba(255,255,255,.55)",
                    }}
                  >
                    Verification coverage
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 800,
                    }}
                  >
                    {records.length
                      ? Math.round((verifiedCount / records.length) * 100)
                      : 0}
                    %
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={
                    records.length ? (verifiedCount / records.length) * 100 : 0
                  }
                  sx={{
                    height: 6,
                    borderRadius: 99,
                    background: "rgba(255,255,255,.1)",
                    "& .MuiLinearProgress-bar": {
                      background: "#65D69C",
                      borderRadius: 99,
                    },
                  }}
                />
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* FOOTER */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            flexWrap: "wrap",
            gap: 1,
            mt: 3,
            px: 0.5,
            pb: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: 10.5,
              color: C.textMuted,
            }}
          >
            Attendance Management System
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              sx={{
                fontSize: 10.5,
                color: C.textMuted,
              }}
            >
              Last updated
            </Typography>

            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 800,
                color: C.textSecondary,
              }}
            >
              {new Intl.DateTimeFormat("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              }).format(updatedAt)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
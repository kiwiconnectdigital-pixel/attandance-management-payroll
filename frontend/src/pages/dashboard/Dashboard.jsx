import { useEffect, useMemo, useState } from "react";
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
  ArrowForwardRounded,
  CalendarMonthRounded,
  CheckCircleRounded,
  ErrorOutlineRounded,
  GroupsRounded,
  LoginRounded,
  LogoutRounded,
  MoreHorizRounded,
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
} from "@mui/icons-material";

// ============================================================
// CONFIG
// ============================================================

const BACKEND_URL = "https://attendance-backend.kiwiconnectdigital.com";

// ============================================================
// DESIGN TOKENS
// ============================================================

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

// ============================================================
// HELPERS
// ============================================================

const getTodayLocal = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

const getSelfieUrl = (selfie) => {
  if (!selfie) return null;

  if (selfie.startsWith("http://") || selfie.startsWith("https://")) {
    return selfie;
  }

  return `${BACKEND_URL}/${selfie.replace(/^\/+/, "")}`;
};

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

// ============================================================
// SMALL UI COMPONENTS
// ============================================================

function SectionHeader({ eyebrow, title, subtitle, action }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      flexWrap="wrap"
      rowGap={1.5}
      columnGap={2}
      sx={{ mb: 2.5 }}
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
        justifyContent="space-between"
        alignItems="flex-start"
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

function Selfie({ src, name, size = 58, verified = false }) {
  const [failed, setFailed] = useState(false);

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
        src={src && !failed ? src : undefined}
        onError={() => setFailed(true)}
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

// ============================================================
// EMPLOYEE CARD
// ============================================================

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
          alignItems="flex-start"
          justifyContent="space-between"
          flexWrap="wrap"
          rowGap={1}
          gap={2}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={1.5}
            minWidth={0}
            sx={{ flex: "1 1 220px" }}
          >
            <Selfie
              src={getLatestSelfie(record)}
              name={name}
              size={56}
              verified={faceVerified}
            />

            <Box minWidth={0} sx={{ flex: "1 1 auto" }}>
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
            <Stack direction="row" alignItems="center" gap={0.7}>
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
            <Stack direction="row" alignItems="center" gap={0.7}>
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
          gap={1}
          sx={{
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
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              rowGap={0.5}
            >
              <Stack direction="row" alignItems="center" gap={0.7} minWidth={0}>
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

            <Stack direction="row" gap={1.2} sx={{ mt: 1.2, flexWrap: "wrap" }}>
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

// ============================================================
// LIVE CLOCK
// ============================================================

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

// ============================================================
// ATTENDANCE DISTRIBUTION
// ============================================================

function AttendanceDistribution({ present, late, halfDay, absent, total }) {
  const items = [
    {
      label: "Present",
      value: present,
      color: C.green,
      bg: C.greenSoft,
    },
    {
      label: "Late",
      value: late,
      color: C.orange,
      bg: C.orangeSoft,
    },
    {
      label: "Half day",
      value: halfDay,
      color: C.red,
      bg: C.redSoft,
    },
    {
      label: "Absent",
      value: absent,
      color: C.red,
      bg: C.redSoft,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: "20px",
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        height: "100%",
        minWidth: 0,
      }}
    >
      <SectionHeader
        eyebrow="Today"
        title="Attendance health"
        subtitle="Live workforce distribution"
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(140px, 160px) minmax(0, 1fr)",
          },
          alignItems: "center",
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
            margin: "0 auto",
            background: `conic-gradient(
              ${C.green} 0deg ${(present / Math.max(total, 1)) * 360}deg,
              ${C.orange} ${(present / Math.max(total, 1)) * 360}deg ${((present + late) / Math.max(total, 1)) * 360}deg,
              ${C.red} ${((present + late) / Math.max(total, 1)) * 360}deg 360deg
            )`,
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
                  fontSize: 29,
                  fontWeight: 850,
                  letterSpacing: "-0.05em",
                  lineHeight: 1,
                }}
              >
                {total}
              </Typography>

              <Typography
                sx={{
                  mt: 0.4,
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Records
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* LEGEND */}
        <Stack gap={1.2} minWidth={0}>
          {items.map((item) => {
            const percentage =
              total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <Box key={item.label}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.55 }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.8}
                    minWidth={0}
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
                  </Stack>

                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                      pl: 1,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Stack>

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
        </Stack>
      </Box>
    </Paper>
  );
}

// ============================================================
// QUICK ACTIONS
// ============================================================

function QuickActions() {
  const actions = [
    {
      title: "Attendance",
      description: "Review daily punches",
      icon: <AccessTimeRounded />,
      href: "/attendance",
      color: C.blue,
      bg: C.blueSoft,
    },
    {
      title: "Employees",
      description: "Manage workforce",
      icon: <GroupsRounded />,
      href: "/employees",
      color: C.purple,
      bg: C.purpleSoft,
    },
    {
      title: "Leaves",
      description: "Review leave requests",
      icon: <CalendarMonthRounded />,
      href: "/leaves",
      color: C.orange,
      bg: C.orangeSoft,
    },
    {
      title: "Payslips",
      description: "Payroll documents",
      icon: <WorkOutlineRounded />,
      href: "/payslips",
      color: C.green,
      bg: C.greenSoft,
    },
  ];

  return (
    <Stack gap={1}>
      {actions.map((action) => (
        <Button
          key={action.title}
          href={action.href}
          fullWidth
          sx={{
            p: 1.25,
            justifyContent: "flex-start",
            textTransform: "none",
            color: C.text,
            borderRadius: "13px",
            minWidth: 0,
            "&:hover": {
              background: C.surfaceAlt,
            },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "11px",
              display: "grid",
              placeItems: "center",
              background: action.bg,
              color: action.color,
              mr: 1.3,
              flexShrink: 0,
            }}
          >
            {action.icon}
          </Box>

          <Box textAlign="left" flex={1} minWidth={0}>
            <Typography
              noWrap
              sx={{
                fontSize: 12.5,
                fontWeight: 800,
              }}
            >
              {action.title}
            </Typography>

            <Typography
              noWrap
              sx={{
                fontSize: 10.5,
                color: C.textMuted,
                mt: 0.15,
              }}
            >
              {action.description}
            </Typography>
          </Box>

          <ArrowForwardRounded
            sx={{
              fontSize: 17,
              color: C.textMuted,
              flexShrink: 0,
              ml: 1,
            }}
          />
        </Button>
      ))}
    </Stack>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function Dashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    totalEmployees: 0,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
  });

  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState("all");

  // ----------------------------------------------------------
  // FETCH
  // ----------------------------------------------------------

  const loadDashboard = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const today = getTodayLocal();

      const [summaryRes, employeeRes, attendanceRes] = await Promise.all([
        attendanceAPI.getTodaySummary(),
        employeeAPI.getAll({ limit: 1 }),
        attendanceAPI.getAll({
          date: today,
          limit: 500,
        }),
      ]);

      const summary = summaryRes?.data?.data || summaryRes?.data || {};

      const totalEmployees =
        employeeRes?.data?.data?.pagination?.total ??
        employeeRes?.data?.pagination?.total ??
        0;

      const rawRecords =
        attendanceRes?.data?.data?.records ??
        attendanceRes?.data?.data ??
        attendanceRes?.data?.records ??
        [];

      const todayRecords = Array.isArray(rawRecords) ? rawRecords : [];

      setStats({
        totalEmployees: Number(totalEmployees) || 0,

        present:
          Number(
            summary.present ??
              summary.present_count ??
              summary.presentCount ??
              todayRecords.filter((record) => getStatus(record) === "present")
                .length,
          ) || 0,

        absent:
          Number(
            summary.absent ??
              summary.absent_count ??
              summary.absentCount ??
              todayRecords.filter((record) => getStatus(record) === "absent")
                .length,
          ) || 0,

        late:
          Number(
            summary.late ??
              summary.late_count ??
              summary.lateCount ??
              todayRecords.filter(isLate).length,
          ) || 0,

        halfDay:
          Number(
            summary.halfDay ??
              summary.half_day ??
              summary.half_day_count ??
              todayRecords.filter((record) => getStatus(record) === "half-day")
                .length,
          ) || 0,
      });

      setRecords(todayRecords);
    } catch (error) {
      console.error("Dashboard loading error:", error);

      toast.error(error?.response?.data?.message || "Unable to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // ----------------------------------------------------------
  // DERIVED DATA
  // ----------------------------------------------------------

  const visibleRecords = useMemo(() => {
    if (filter === "all") {
      return records;
    }

    return records.filter((record) => getStatus(record) === filter);
  }, [records, filter]);

  const attendanceRate = useMemo(() => {
    if (!stats.totalEmployees) return 0;

    return Math.round(
      ((stats.present + stats.late + stats.halfDay) / stats.totalEmployees) *
        100,
    );
  }, [stats]);

  const averageWorkingHours = useMemo(() => {
    if (!records.length) return 0;

    const total = records.reduce(
      (sum, record) => sum + getWorkingHours(record),
      0,
    );

    return total / records.length;
  }, [records]);

  const currentlyCheckedIn = useMemo(() => {
    return records.filter((record) => {
      return getCheckIn(record) && !getCheckOut(record);
    }).length;
  }, [records]);

  const verifiedCount = useMemo(() => {
    return records.filter((record) => {
      const checkIn = getCheckIn(record);
      const checkOut = getCheckOut(record);

      return isFaceVerified(checkIn) || isFaceVerified(checkOut);
    }).length;
  }, [records]);

  // ----------------------------------------------------------
  // LOADING
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

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
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

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
            overflow: "hidden",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              md: "row",
            }}
            alignItems={{
              xs: "flex-start",
              md: "center",
            }}
            justifyContent="space-between"
            flexWrap="wrap"
            rowGap={2}
            columnGap={2}
          >
            <Stack direction="row" alignItems="center" gap={1.6} minWidth={0}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "15px",
                  background: C.black,
                  color: "#fff",
                  fontWeight: 850,
                  flexShrink: 0,
                }}
              >
                {getInitials(user?.name || user?.full_name || "Admin")}
              </Avatar>

              <Box minWidth={0}>
                <Typography
                  noWrap
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  {getGreeting()}
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    mt: 0.25,
                    fontSize: {
                      xs: 21,
                      md: 25,
                    },
                    fontWeight: 850,
                    letterSpacing: "-0.045em",
                    color: C.text,
                  }}
                >
                  {user?.name || user?.full_name || "Admin"}
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    mt: 0.35,
                    fontSize: 12,
                    color: C.textSecondary,
                  }}
                >
                  Workforce command center
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              flexWrap="wrap"
              gap={1.5}
              sx={{
                width: {
                  xs: "100%",
                  md: "auto",
                },
                justifyContent: {
                  xs: "flex-start",
                  sm: "space-between",
                  md: "flex-end",
                },
              }}
            >
              <Box sx={{ minWidth: 0, flexShrink: 1 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: C.textSecondary,
                    fontWeight: 700,
                  }}
                >
                  {formatDate()}
                </Typography>

                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.7}
                  sx={{ mt: 0.4 }}
                >
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: C.green,
                      boxShadow: `0 0 0 4px ${C.greenSoft}`,
                      flexShrink: 0,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: 10.5,
                      color: C.green,
                      fontWeight: 800,
                    }}
                  >
                    System live
                  </Typography>
                </Stack>
              </Box>

              <LiveClock />

              <Tooltip title="Refresh dashboard">
                <IconButton
                  onClick={() => loadDashboard(true)}
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
                        from: {
                          transform: "rotate(0deg)",
                        },
                        to: {
                          transform: "rotate(360deg)",
                        },
                      },
                    }}
                  />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        {/* ================================================== */}
        {/* KPI GRID */}
        {/* ================================================== */}

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
            label="Total employees"
            value={stats.totalEmployees}
            caption="Active workforce"
            icon={<GroupsRounded />}
            iconBg={C.blueSoft}
            iconColor={C.blue}
          />

          <MetricCard
            label="Attendance rate"
            value={`${attendanceRate}%`}
            caption={`${stats.present + stats.late} employees marked`}
            icon={<TrendingUpRounded />}
            iconBg={C.greenSoft}
            iconColor={C.green}
            progress={attendanceRate}
          />

          <MetricCard
            label="Checked in"
            value={currentlyCheckedIn}
            caption="Currently inside / working"
            icon={<LoginRounded />}
            iconBg={C.purpleSoft}
            iconColor={C.purple}
          />

          <MetricCard
            label="Face verified"
            value={verifiedCount}
            caption={`${records.length} attendance records`}
            icon={<ShieldRounded />}
            iconBg={C.orangeSoft}
            iconColor={C.orange}
            progress={
              records.length ? (verifiedCount / records.length) * 100 : 0
            }
          />
        </Box>

        {/* ================================================== */}
        {/* MAIN ANALYTICS */}
        {/* ================================================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.55fr) minmax(300px, .8fr)",
            },
            gap: 2.5,
            mb: 2.5,
          }}
        >
          {/* LEFT */}
          <AttendanceDistribution
            present={stats.present}
            late={stats.late}
            halfDay={stats.halfDay}
            absent={stats.absent}
            total={Math.max(stats.totalEmployees, records.length)}
          />

          {/* RIGHT */}
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
              title="Today's pulse"
              subtitle="Key operational signals"
            />

            <Stack gap={1}>
              <Box
                sx={{
                  p: 1.6,
                  borderRadius: "14px",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  minWidth: 0,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    minWidth={0}
                  >
                    <Box
                      sx={{
                        width: 35,
                        height: 35,
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        background: C.greenSoft,
                        color: C.green,
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircleRounded sx={{ fontSize: 19 }} />
                    </Box>

                    <Box minWidth={0}>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Present
                      </Typography>

                      <Typography
                        noWrap
                        sx={{
                          fontSize: 10.5,
                          color: C.textMuted,
                        }}
                      >
                        Workforce active today
                      </Typography>
                    </Box>
                  </Stack>

                  <Typography
                    sx={{
                      fontSize: 22,
                      fontWeight: 850,
                      flexShrink: 0,
                    }}
                  >
                    {stats.present}
                  </Typography>
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 1.6,
                  borderRadius: "14px",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  minWidth: 0,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    minWidth={0}
                  >
                    <Box
                      sx={{
                        width: 35,
                        height: 35,
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        background: C.orangeSoft,
                        color: C.orange,
                        flexShrink: 0,
                      }}
                    >
                      <ScheduleRounded sx={{ fontSize: 19 }} />
                    </Box>

                    <Box minWidth={0}>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Late arrivals
                      </Typography>

                      <Typography
                        noWrap
                        sx={{
                          fontSize: 10.5,
                          color: C.textMuted,
                        }}
                      >
                        Requires attention
                      </Typography>
                    </Box>
                  </Stack>

                  <Typography
                    sx={{
                      fontSize: 22,
                      fontWeight: 850,
                      color: C.orange,
                      flexShrink: 0,
                    }}
                  >
                    {stats.late}
                  </Typography>
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 1.6,
                  borderRadius: "14px",
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  minWidth: 0,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    minWidth={0}
                  >
                    <Box
                      sx={{
                        width: 35,
                        height: 35,
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        background: C.blueSoft,
                        color: C.blue,
                        flexShrink: 0,
                      }}
                    >
                      <AccessTimeRounded sx={{ fontSize: 19 }} />
                    </Box>

                    <Box minWidth={0}>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Avg. working time
                      </Typography>

                      <Typography
                        noWrap
                        sx={{
                          fontSize: 10.5,
                          color: C.textMuted,
                        }}
                      >
                        Across attendance records
                      </Typography>
                    </Box>
                  </Stack>

                  <Typography
                    noWrap
                    sx={{
                      fontSize: 18,
                      fontWeight: 850,
                      color: C.blue,
                      flexShrink: 0,
                    }}
                  >
                    {formatHours(averageWorkingHours)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>

        {/* ================================================== */}
        {/* EMPLOYEE ACTIVITY */}
        {/* ================================================== */}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1fr) minmax(280px, 300px)",
            },
            gap: 2.5,
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
              eyebrow="Live attendance"
              title="Employee activity"
              subtitle={`${records.length} attendance records captured today`}
              action={
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 130,
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
                    There are no employees matching this filter today.
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
          <Stack gap={2.5} minWidth={0}>
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: "20px",
                border: `1px solid ${C.border}`,
                boxShadow: C.shadow,
                minWidth: 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: 15,
                  fontWeight: 850,
                  letterSpacing: "-0.02em",
                }}
              >
                Quick actions
              </Typography>

              <Typography
                sx={{
                  mt: 0.4,
                  mb: 1.3,
                  fontSize: 11,
                  color: C.textMuted,
                }}
              >
                Jump directly into operations
              </Typography>

              <QuickActions />
            </Paper>

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
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
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
              </Stack>

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
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.7 }}
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
                </Stack>

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
          </Stack>
        </Box>

        {/* ================================================== */}
        {/* FOOTER */}
        {/* ================================================== */}

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          alignItems={{
            xs: "flex-start",
            sm: "center",
          }}
          flexWrap="wrap"
          gap={1}
          sx={{
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

          <Stack direction="row" alignItems="center" gap={1}>
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
              }).format(new Date())}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

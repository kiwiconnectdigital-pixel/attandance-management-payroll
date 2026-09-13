// src/components/common/Sidebar.jsx

import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect } from "react";

import {
  HomeIcon,
  UsersIcon,
  ClockIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  XMarkIcon,
  Bars3Icon,
  EllipsisHorizontalIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import {
  ThemeProvider,
  createTheme,
  Box,
  Stack,
  Typography,
  Avatar,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  BottomNavigation,
  BottomNavigationAction,
} from "@mui/material";

import { companyAPI } from "../../services/api";

/* =========================================================
   THEME
========================================================= */

const theme = createTheme({
  typography: {
    fontFamily:
      '"Inter", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  palette: {
    background: {
      default: "#F6F7F9",
      paper: "#FFFFFF",
    },
  },
});

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
   NAVIGATION DATA
========================================================= */

const NAV_ITEMS = {
  superAdmin: [
    {
      label: "Dashboard",
      path: "/super-admin",
      icon: HomeIcon,
      section: "Workspace",
    },
    {
      label: "Companies",
      path: "/super-admin/companies",
      icon: BuildingOffice2Icon,
      section: "Management",
    },
    {
      label: "Accounts",
      path: "/super-admin/accounts",
      icon: CurrencyRupeeIcon,
      section: "Management",
    },
  ],

  admin: [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: HomeIcon,
      section: "Workspace",
    },
    // {
    //   label: "Attendance",
    //   path: "/attendance",
    //   icon: ClockIcon,
    //   section: "Workspace",
    // },
    // {
    //   label: "Leaves",
    //   path: "/leaves",
    //   icon: CalendarIcon,
    //   section: "Workspace",
    // },
    // {
    //   label: "Payslips",
    //   path: "/payslips",
    //   icon: CurrencyRupeeIcon,
    //   section: "Workspace",
    // },
    {
      label: "Employees",
      path: "/employees",
      icon: UsersIcon,
      section: "Management",
    },
    {
      label: "Payroll",
      path: "/payroll",
      icon: CurrencyRupeeIcon,
      section: "Management",
    },
    {
      label: "Reports",
      path: "/reports",
      icon: ChartBarIcon,
      section: "Management",
    },
    {
      label: "Branches",
      path: "/branches",
      icon: BuildingOfficeIcon,
      section: "Administration",
    },
    {
      label: "Settings",
      path: "/settings",
      icon: Cog6ToothIcon,
      section: "Administration",
    },
  ],

  hr: [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: HomeIcon,
      section: "Workspace",
    },
    {
      label: "Attendance",
      path: "/attendance",
      icon: ClockIcon,
      section: "Workspace",
    },
    {
      label: "Leaves",
      path: "/leaves",
      icon: CalendarIcon,
      section: "Workspace",
    },
    {
      label: "Payslips",
      path: "/payslips",
      icon: CurrencyRupeeIcon,
      section: "Workspace",
    },
    {
      label: "Employees",
      path: "/employees",
      icon: UsersIcon,
      section: "Management",
    },
    {
      label: "Payroll",
      path: "/payroll",
      icon: CurrencyRupeeIcon,
      section: "Management",
    },
    {
      label: "Reports",
      path: "/reports",
      icon: ChartBarIcon,
      section: "Management",
    },
  ],

  employee: [
    {
      label: "Attendance",
      path: "/attendance",
      icon: ClockIcon,
      section: "Workspace",
    },
    {
      label: "Leaves",
      path: "/leaves",
      icon: CalendarIcon,
      section: "Workspace",
    },
    {
      label: "Payslips",
      path: "/payslips",
      icon: CurrencyRupeeIcon,
      section: "Workspace",
    },
  ],
};

/* =========================================================
   HELPERS
========================================================= */

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getRoleLabel = (user, isSuperAdmin, isAdmin, isHR) => {
  if (isSuperAdmin) return "Super Administrator";
  if (isAdmin) return "Administrator";
  if (isHR) return "Human Resources";

  return user?.role
    ? String(user.role)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Employee";
};

const getLogoUrl = (logo) => {
  if (!logo) return null;

  if (logo.startsWith("http://") || logo.startsWith("https://")) {
    return logo;
  }

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api/v1";

  const root = apiBase.replace(/\/api\/v1\/?$/, "");

  return `${root}/${logo.replace(/^\/+/, "")}`;
};

/* =========================================================
   BRAND
========================================================= */

function CompanyBrand({
  company,
  logoError,
  setLogoError,
  compact = false,
}) {
  const companyName =
    company?.name ||
    company?.company_name ||
    "Attendance Management";

  const logo = getLogoUrl(
    company?.logo ||
      company?.logo_url ||
      company?.company_logo
  );

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.4}
      sx={{
        minWidth: 0,
        px: compact ? 0 : 0.5,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "11px",
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceAlt,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!logoError && logo ? (
          <Box
            component="img"
            src={logo}
            alt={companyName}
            onError={() => setLogoError(true)}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              p: 0.5,
            }}
          />
        ) : (
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 800,
              color: COLORS.blue,
              letterSpacing: "-0.02em",
            }}
          >
            {getInitials(companyName)}
          </Typography>
        )}
      </Box>

      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: 14,
              fontWeight: 750,
              lineHeight: 1.2,
              color: COLORS.text,
              letterSpacing: "-0.02em",
            }}
          >
            {companyName}
          </Typography>

          <Typography
            noWrap
            sx={{
              mt: 0.35,
              fontSize: 10.5,
              color: COLORS.textMuted,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Workforce Platform
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

/* =========================================================
   SECTION LABEL
========================================================= */

function SectionLabel({ children }) {
  return (
    <Typography
      sx={{
        px: 1.25,
        mb: 0.7,
        mt: 2.2,
        fontSize: 10,
        fontWeight: 800,
        color: COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.09em",
      }}
    >
      {children}
    </Typography>
  );
}

/* =========================================================
   NAV ITEM
========================================================= */

function SidebarNavItem({
  item,
  onNavigate,
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      {({ isActive }) => (
        <ListItemButton
          disableRipple
          sx={{
            position: "relative",
            minHeight: 44,
            px: 1.15,
            mb: 0.45,
            borderRadius: "11px",
            overflow: "hidden",

            color: isActive
              ? COLORS.blue
              : COLORS.textSecondary,

            backgroundColor: isActive
              ? COLORS.blueSoft
              : "transparent",

            transition:
              "background-color 160ms ease, color 160ms ease, transform 160ms ease",

            "&:hover": {
              backgroundColor: isActive
                ? COLORS.blueSoft
                : COLORS.surfaceAlt,

              color: isActive
                ? COLORS.blue
                : COLORS.text,

              transform: "translateX(1px)",
            },

            "&::before": isActive
              ? {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 9,
                  bottom: 9,
                  width: 3,
                  borderRadius: "0 4px 4px 0",
                  backgroundColor: COLORS.blue,
                }
              : {},
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 34,
              color: "inherit",
            }}
          >
            <Icon
              width={19}
              height={19}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
          </ListItemIcon>

          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              sx: {
                fontSize: 13,
                fontWeight: isActive ? 700 : 550,
                lineHeight: 1,
                color: "inherit",
                letterSpacing: "-0.01em",
              },
            }}
          />

          {isActive && (
            <ChevronRightIcon
              width={15}
              height={15}
              strokeWidth={2}
              style={{
                opacity: 0.7,
              }}
            />
          )}
        </ListItemButton>
      )}
    </NavLink>
  );
}

/* =========================================================
   SYSTEM STATUS
========================================================= */

function SystemStatus() {
  return (
    <Box
      sx={{
        mx: 0.5,
        mt: 1.5,
        p: 1.2,
        borderRadius: "11px",
        border: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.surfaceAlt,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
      >
        <Box
          sx={{
            width: 27,
            height: 27,
            borderRadius: "8px",
            backgroundColor: COLORS.greenSoft,
            color: COLORS.green,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircleIcon
            width={15}
            height={15}
            strokeWidth={2}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 750,
              color: COLORS.text,
              lineHeight: 1.2,
            }}
          >
            All systems operational
          </Typography>

          <Typography
            sx={{
              mt: 0.25,
              fontSize: 9.5,
              color: COLORS.textMuted,
            }}
          >
            Attendance services are running
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

/* =========================================================
   USER FOOTER
========================================================= */

function UserFooter({
  user,
  isSuperAdmin,
  isAdmin,
  isHR,
}) {
  const displayName =
    user?.name ||
    user?.full_name ||
    user?.employee?.name ||
    user?.email ||
    "User";

  const role = getRoleLabel(
    user,
    isSuperAdmin,
    isAdmin,
    isHR
  );

  const avatar =
    user?.profile_image ||
    user?.profileImage ||
    user?.avatar ||
    null;

  return (
    <Box
      sx={{
        borderTop: `1px solid ${COLORS.border}`,
        pt: 1.5,
        mt: 1.2,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.1}
        sx={{
          px: 0.5,
          py: 0.5,
        }}
      >
        <Box
          sx={{
            position: "relative",
            flexShrink: 0,
          }}
        >
          <Avatar
            src={avatar || undefined}
            sx={{
              width: 35,
              height: 35,
              fontSize: 12,
              fontWeight: 750,
              backgroundColor: COLORS.blueSoft,
              color: COLORS.blue,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {getInitials(displayName)}
          </Avatar>

          <Box
            sx={{
              position: "absolute",
              right: -1,
              bottom: -1,
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: COLORS.green,
              border: `2px solid ${COLORS.surface}`,
            }}
          />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: 1.25,
            }}
          >
            {displayName}
          </Typography>

          <Typography
            noWrap
            sx={{
              mt: 0.3,
              fontSize: 10,
              color: COLORS.textMuted,
              lineHeight: 1.2,
            }}
          >
            {role}
          </Typography>
        </Box>

        <EllipsisHorizontalIcon
          width={18}
          height={18}
          color={COLORS.textMuted}
        />
      </Stack>
    </Box>
  );
}

/* =========================================================
   DESKTOP SIDEBAR
========================================================= */

function DesktopSidebar({
  open,
  company,
  logoError,
  setLogoError,
  items,
  user,
  isSuperAdmin,
  isAdmin,
  isHR,
}) {
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }

    acc[item.section].push(item);

    return acc;
  }, {});

  return (
    <Box
      component="aside"
      sx={{
        display: {
          xs: "none",
          lg: "block",
        },

        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,

        width: 252,

        backgroundColor: COLORS.surface,

        borderRight: `1px solid ${COLORS.border}`,

        zIndex: 1200,

        transform: open
          ? "translateX(0)"
          : "translateX(-100%)",

        transition:
          "transform 220ms cubic-bezier(.2,.8,.2,1)",

        boxShadow: open
          ? "8px 0 30px rgba(21,23,28,0.03)"
          : "none",
      }}
    >
      <Stack
        sx={{
          height: "100%",
          px: 1.5,
          py: 1.6,
        }}
      >
        {/* Brand */}
        <Box
          sx={{
            px: 0.7,
            pb: 1.6,
          }}
        >
          <CompanyBrand
            company={company}
            logoError={logoError}
            setLogoError={setLogoError}
          />
        </Box>

        <Divider
          sx={{
            borderColor: COLORS.border,
            mb: 0.8,
          }}
        />

        {/* Navigation */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",

            pr: 0.35,

            "&::-webkit-scrollbar": {
              width: 4,
            },

            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#D9DDE4",
              borderRadius: 10,
            },

            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
          }}
        >
          {Object.entries(groupedItems).map(
            ([section, sectionItems]) => (
              <Box key={section}>
                <SectionLabel>
                  {section}
                </SectionLabel>

                <List
                  disablePadding
                  sx={{
                    px: 0.15,
                  }}
                >
                  {sectionItems.map((item) => (
                    <SidebarNavItem
                      key={item.path}
                      item={item}
                    />
                  ))}
                </List>
              </Box>
            )
          )}

          <SystemStatus />
        </Box>

        {/* User */}
        <UserFooter
          user={user}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
          isHR={isHR}
        />
      </Stack>
    </Box>
  );
}

/* =========================================================
   MOBILE DRAWER
========================================================= */

function MobileDrawer({
  open,
  onClose,
  company,
  logoError,
  setLogoError,
  items,
  user,
  isSuperAdmin,
  isAdmin,
  isHR,
}) {
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }

    acc[item.section].push(item);

    return acc;
  }, {});

  return (
    <>
      {/* Overlay */}
      {open && (
        <Box
          onClick={onClose}
          sx={{
            display: {
              xs: "block",
              lg: "none",
            },

            position: "fixed",
            inset: 0,

            backgroundColor:
              "rgba(21,23,28,0.32)",

            backdropFilter: "blur(2px)",

            zIndex: 1299,
          }}
        />
      )}

      {/* Drawer */}
      <Box
        component="aside"
        sx={{
          display: {
            xs: "block",
            lg: "none",
          },

          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,

          width: {
            xs: "min(300px, 86vw)",
            sm: 320,
          },

          backgroundColor: COLORS.surface,

          zIndex: 1300,

          transform: open
            ? "translateX(0)"
            : "translateX(-105%)",

          transition:
            "transform 230ms cubic-bezier(.2,.8,.2,1)",

          boxShadow:
            "18px 0 45px rgba(21,23,28,0.12)",
        }}
      >
        <Stack
          sx={{
            height: "100%",
            px: 1.5,
            py: 1.5,
          }}
        >
          {/* Mobile header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 0.7,
              pb: 1.5,
            }}
          >
            <CompanyBrand
              company={company}
              logoError={logoError}
              setLogoError={setLogoError}
            />

            <Box
              component="button"
              onClick={onClose}
              aria-label="Close menu"
              sx={{
                width: 34,
                height: 34,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "9px",
                backgroundColor: COLORS.surfaceAlt,
                color: COLORS.textSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",

                "&:hover": {
                  backgroundColor: COLORS.blueSoft,
                  color: COLORS.blue,
                },
              }}
            >
              <XMarkIcon
                width={18}
                height={18}
              />
            </Box>
          </Stack>

          <Divider
            sx={{
              borderColor: COLORS.border,
              mb: 0.7,
            }}
          />

          {/* Navigation */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",

              "&::-webkit-scrollbar": {
                width: 4,
              },

              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "#D9DDE4",
                borderRadius: 10,
              },
            }}
          >
            {Object.entries(groupedItems).map(
              ([section, sectionItems]) => (
                <Box key={section}>
                  <SectionLabel>
                    {section}
                  </SectionLabel>

                  <List
                    disablePadding
                    sx={{
                      px: 0.15,
                    }}
                  >
                    {sectionItems.map((item) => (
                      <SidebarNavItem
                        key={item.path}
                        item={item}
                        onNavigate={onClose}
                      />
                    ))}
                  </List>
                </Box>
              )
            )}

            <SystemStatus />
          </Box>

          <UserFooter
            user={user}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isHR={isHR}
          />
        </Stack>
      </Box>
    </>
  );
}

/* =========================================================
   MOBILE BOTTOM NAV
========================================================= */

function MobileBottomNav({
  items,
}) {
  const location = useLocation();

  const primaryItems = items.slice(0, 5);

  const currentIndex = Math.max(
    0,
    primaryItems.findIndex((item) => {
      if (item.path === "/dashboard") {
        return location.pathname === "/dashboard";
      }

      return (
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
      );
    })
  );

  return (
    <Box
      sx={{
        display: {
          xs: "block",
          lg: "none",
        },

        position: "fixed",
        left: 10,
        right: 10,
        bottom: 10,

        zIndex: 1200,
      }}
    >
      <BottomNavigation
        value={currentIndex}
        showLabels
        sx={{
          height: 66,

          borderRadius: "16px",

          backgroundColor:
            "rgba(255,255,255,0.96)",

          border: `1px solid ${COLORS.border}`,

          boxShadow:
            "0 10px 35px rgba(21,23,28,0.10)",

          backdropFilter: "blur(14px)",

          "& .MuiBottomNavigationAction-root": {
            minWidth: 0,
            maxWidth: "none",
            color: COLORS.textMuted,
            paddingTop: 7,
            paddingBottom: 5,
            transition: "all 160ms ease",
          },

          "& .MuiBottomNavigationAction-label": {
            fontSize: "9px",
            fontWeight: 650,
            marginTop: "3px",
          },

          "& .Mui-selected": {
            color: COLORS.blue,
          },
        }}
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <BottomNavigationAction
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              icon={
                <Icon
                  width={20}
                  height={20}
                  strokeWidth={1.9}
                />
              }
            />
          );
        })}
      </BottomNavigation>
    </Box>
  );
}

/* =========================================================
   MAIN SIDEBAR
========================================================= */

export default function Sidebar({
  open = true,
  onClose,
  onToggle,
}) {
  const {
    user,
    isSuperAdmin,
    isAdmin,
    isHR,
  } = useAuth();

  const [company, setCompany] = useState(null);
  const [logoError, setLogoError] = useState(false);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  /* -------------------------------------------------------
     Company
  ------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    const loadCompany = async () => {
      if (!user?.company_id) return;

      try {
        const response =
          await companyAPI.getById(
            user.company_id
          );

        if (!mounted) return;

        const data =
          response?.data?.data ||
          response?.data ||
          response;

        setCompany(data);
        setLogoError(false);
      } catch (error) {
        console.error(
          "Failed to load company:",
          error
        );
      }
    };

    loadCompany();

    return () => {
      mounted = false;
    };
  }, [user?.company_id]);

  /* -------------------------------------------------------
     Role based navigation
  ------------------------------------------------------- */

  const items = isSuperAdmin
    ? NAV_ITEMS.superAdmin
    : isAdmin
      ? NAV_ITEMS.admin
      : isHR
        ? NAV_ITEMS.hr
        : NAV_ITEMS.employee;

  /* -------------------------------------------------------
     Close mobile drawer on route change
  ------------------------------------------------------- */

  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);

    if (onClose) {
      onClose();
    }
  }, [location.pathname]);

  /* -------------------------------------------------------
     Body spacing helper
     
     This component does not force a margin on your page.
     Your existing layout can continue controlling content
     width/margin.
  ------------------------------------------------------- */

  const handleMobileClose = () => {
    setMobileOpen(false);

    if (onClose) {
      onClose();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      {/* =================================================
          Desktop Sidebar
      ================================================= */}

      <DesktopSidebar
        open={open}
        company={company}
        logoError={logoError}
        setLogoError={setLogoError}
        items={items}
        user={user}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        isHR={isHR}
      />

      {/* =================================================
          Mobile Drawer
      ================================================= */}

      <MobileDrawer
        open={mobileOpen}
        onClose={handleMobileClose}
        company={company}
        logoError={logoError}
        setLogoError={setLogoError}
        items={items}
        user={user}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        isHR={isHR}
      />

      {/* =================================================
          Mobile Bottom Navigation
      ================================================= */}

      <MobileBottomNav
        items={items}
      />

      {/* =================================================
          Optional Mobile Menu Trigger

          If your existing Header already has a hamburger
          button, you do not need to use this.
      ================================================= */}

      <Box
        sx={{
          display: {
            xs: "flex",
            sm: "none",
            lg: "none",
          },

          position: "fixed",
          top: 14,
          left: 14,

          zIndex: 1100,

          width: 38,
          height: 38,

          borderRadius: "10px",

          backgroundColor:
            "rgba(255,255,255,0.95)",

          border: `1px solid ${COLORS.border}`,

          boxShadow:
            "0 5px 20px rgba(21,23,28,0.07)",

          alignItems: "center",
          justifyContent: "center",

          cursor: "pointer",

          color: COLORS.text,

          "&:hover": {
            backgroundColor: COLORS.blueSoft,
            color: COLORS.blue,
          },
        }}
        component="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Bars3Icon
          width={20}
          height={20}
        />
      </Box>
    </ThemeProvider>
  );
}
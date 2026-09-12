// src/components/common/Navbar.jsx

import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { companyAPI } from "../../services/api";

/* =========================================================
   Corporate HR Design Tokens
========================================================= */

const tokens = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFBFC",

  text: "#15171C",
  secondary: "#676C76",
  muted: "#969BA5",

  border: "#E7E9ED",

  blue: "#3567D6",
  blueSoft: "#EDF3FF",

  red: "#C94B4B",
  redSoft: "#FDEEEE",
};

/* =========================================================
   Component
========================================================= */

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);

  const [confirmLogout, setConfirmLogout] =
    useState(false);

  const [companyLogo, setCompanyLogo] =
    useState(null);

  const [companyName, setCompanyName] =
    useState("KIWI");

  const [logoError, setLogoError] =
    useState(false);

  /* =========================================================
     Get full logo URL
  ========================================================= */

  const getLogoUrl = (logoPath) => {
    if (!logoPath) {
      return null;
    }

    if (
      /^https?:\/\//i.test(logoPath)
    ) {
      return logoPath;
    }

    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:5000/api/v1";

    const rootUrl = baseUrl
      .replace(/\/api\/v1\/?$/, "")
      .replace(/\/+$/, "");

    const path = String(logoPath).replace(
      /^\/+/,
      "",
    );

    return `${rootUrl}/${path}`;
  };

  /* =========================================================
     Fetch company information
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const fetchCompany = async () => {
      const companyId =
        user?.company_id;

      if (!companyId) {
        return;
      }

      try {
        const res =
          await companyAPI.getById(
            companyId,
          );

        const data =
          res.data?.data ||
          res.data?.company ||
          res.data;

        if (!mounted || !data) {
          return;
        }

        setCompanyName(
          data.name || "KIWI",
        );

        if (data.logo) {
          setCompanyLogo(
            getLogoUrl(data.logo),
          );
          setLogoError(false);
        } else {
          setCompanyLogo(null);
        }
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "Failed to fetch company information:",
          err,
        );

        setCompanyLogo(null);
      }
    };

    fetchCompany();

    return () => {
      mounted = false;
    };
  }, [user?.company_id]);

  /* =========================================================
     Live clock
  ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     Scroll shadow
  ========================================================= */

  useEffect(() => {
    const scrollElement =
      document.querySelector(
        ".dash-scroll-area",
      ) || window;

    const handleScroll = () => {
      const scrollTop =
        scrollElement === window
          ? window.scrollY
          : scrollElement.scrollTop;

      setScrolled(scrollTop > 4);
    };

    scrollElement.addEventListener(
      "scroll",
      handleScroll,
      { passive: true },
    );

    handleScroll();

    return () => {
      scrollElement.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, []);

  /* =========================================================
     Logout
  ========================================================= */

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);

      setTimeout(() => {
        setConfirmLogout(false);
      }, 3000);

      return;
    }

    logout();
    navigate("/login");
  };

  /* =========================================================
     User initials
  ========================================================= */

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";

  /* =========================================================
     Date / Time
  ========================================================= */

  const timeStr =
    now.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );

  const dateStr =
    now.toLocaleDateString(
      "en-IN",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
      },
    );

  return (
    <>
      <style>{`
        .ams-navbar {
          position: sticky;
          top: 0;
          z-index: 50;

          height: 64px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 0 24px;

          background: rgba(255, 255, 255, 0.96);

          border-bottom: 1px solid ${tokens.border};

          box-shadow: ${
            scrolled
              ? "0 4px 16px rgba(20, 24, 32, 0.07)"
              : "none"
          };

          backdrop-filter: blur(14px);

          transition:
            box-shadow 0.2s ease;

          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* ===================================================
           LEFT
        =================================================== */

        .ams-navbar-left {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 14px;
        }

        .ams-menu-button {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 0;

          border: 1px solid ${tokens.border};
          border-radius: 9px;

          background: ${tokens.bg};
          color: ${tokens.secondary};

          cursor: pointer;

          transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
        }

        .ams-menu-button:hover {
          background: ${tokens.blueSoft};
          border-color: #D7E2FA;
          color: ${tokens.blue};
        }

        .ams-menu-button svg {
          width: 18px;
          height: 18px;
        }

        /* ===================================================
           BRAND
        =================================================== */

        .ams-navbar-brand {
          min-width: 0;

          display: flex;
          align-items: center;

          gap: 10px;
        }

        .ams-navbar-logo {
          width: 36px;
          height: 36px;

          flex: 0 0 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          overflow: hidden;

          border: 1px solid ${tokens.border};
          border-radius: 9px;

          background: ${tokens.surfaceAlt};
        }

        .ams-navbar-logo img {
          width: 100%;
          height: 100%;

          padding: 5px;

          object-fit: contain;
        }

        .ams-navbar-logo-fallback {
          width: 100%;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          background: ${tokens.blueSoft};
          color: ${tokens.blue};
        }

        .ams-navbar-logo-fallback svg {
          width: 19px;
          height: 19px;
        }

        .ams-navbar-company {
          min-width: 0;
        }

        .ams-navbar-company-name {
          max-width: 240px;

          overflow: hidden;

          color: ${tokens.text};

          font-size: 14px;
          line-height: 18px;
          font-weight: 720;

          letter-spacing: -0.01em;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ams-navbar-company-label {
          margin-top: 1px;

          color: ${tokens.muted};

          font-size: 9px;
          line-height: 12px;

          font-weight: 650;

          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        /* ===================================================
           RIGHT
        =================================================== */

        .ams-navbar-right {
          display: flex;
          align-items: center;

          gap: 9px;
        }

        /* ===================================================
           CLOCK
        =================================================== */

        .ams-navbar-clock {
          height: 36px;

          display: flex;
          align-items: center;

          gap: 9px;

          padding: 0 13px;

          border: 1px solid ${tokens.border};
          border-radius: 9px;

          background: ${tokens.surfaceAlt};
        }

        .ams-navbar-time {
          color: ${tokens.text};

          font-size: 12px;
          font-weight: 720;

          font-variant-numeric:
            tabular-nums;
        }

        .ams-navbar-divider {
          width: 1px;
          height: 16px;

          background: ${tokens.border};
        }

        .ams-navbar-date {
          color: ${tokens.muted};

          font-size: 10px;
          font-weight: 550;
        }

        /* ===================================================
           USER
        =================================================== */

        .ams-navbar-user {
          height: 40px;

          display: flex;
          align-items: center;

          gap: 9px;

          padding: 3px 11px 3px 4px;

          border: 1px solid ${tokens.border};
          border-radius: 10px;

          background: ${tokens.surfaceAlt};
        }

        .ams-navbar-avatar {
          width: 32px;
          height: 32px;

          flex: 0 0 32px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 8px;

          background: ${tokens.blueSoft};
          color: ${tokens.blue};

          font-size: 10px;
          font-weight: 750;
        }

        .ams-navbar-user-info {
          min-width: 0;
        }

        .ams-navbar-user-name {
          max-width: 135px;

          overflow: hidden;

          color: ${tokens.text};

          font-size: 11px;
          line-height: 15px;
          font-weight: 680;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ams-navbar-user-role {
          max-width: 135px;

          overflow: hidden;

          margin-top: 1px;

          color: ${tokens.muted};

          font-size: 8px;
          line-height: 10px;

          font-weight: 650;

          letter-spacing: 0.05em;
          text-transform: uppercase;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ===================================================
           LOGOUT
        =================================================== */

        .ams-navbar-logout {
          height: 36px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          gap: 6px;

          padding: 0 12px;

          border: 1px solid transparent;
          border-radius: 9px;

          background: ${tokens.redSoft};
          color: ${tokens.red};

          font-family: inherit;
          font-size: 10.5px;
          font-weight: 680;

          cursor: pointer;

          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .ams-navbar-logout:hover {
          background: #FBE5E5;
        }

        .ams-navbar-logout.confirm {
          border-color: ${tokens.red};
          background: ${tokens.red};
          color: #FFFFFF;
        }

        .ams-navbar-logout.confirm:hover {
          background: #B94040;
        }

        .ams-navbar-logout svg {
          width: 15px;
          height: 15px;
        }

        /* ===================================================
           RESPONSIVE
        =================================================== */

        @media (max-width: 900px) {
          .ams-navbar {
            padding: 0 18px;
          }

          .ams-navbar-clock {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .ams-navbar {
            height: 60px;
            padding: 0 12px;
          }

          .ams-navbar-left {
            gap: 9px;
          }

          .ams-menu-button {
            width: 34px;
            height: 34px;
          }

          .ams-navbar-company-label {
            display: none;
          }

          .ams-navbar-company-name {
            max-width: 150px;
          }

          .ams-navbar-user {
            padding-right: 4px;
            border-color: transparent;
            background: transparent;
          }

          .ams-navbar-user-info {
            display: none;
          }

          .ams-navbar-logout {
            width: 34px;
            padding: 0;
          }

          .ams-navbar-logout span {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .ams-navbar-company {
            display: none;
          }

          .ams-navbar-right {
            gap: 5px;
          }

          .ams-navbar-logo {
            width: 34px;
            height: 34px;
          }

          .ams-navbar-user {
            display: none;
          }
        }
      `}</style>

      <header className="ams-navbar">

        {/* =================================================
            LEFT
        ================================================= */}

        <div className="ams-navbar-left">

          <button
            type="button"
            className="ams-menu-button"
            onClick={onMenuClick}
            aria-label="Toggle navigation menu"
          >
            <Bars3Icon />
          </button>

          <div className="ams-navbar-brand">

            <div className="ams-navbar-logo">

              {companyLogo &&
              !logoError ? (
                <img
                  src={companyLogo}
                  alt={`${companyName} logo`}
                  onError={() => {
                    setLogoError(true);
                  }}
                />
              ) : (
                <div className="ams-navbar-logo-fallback">
                  <BuildingOffice2Icon />
                </div>
              )}

            </div>

            <div className="ams-navbar-company">

              <div className="ams-navbar-company-name">
                {companyName || "KIWI"}
              </div>

              <div className="ams-navbar-company-label">
                Attendance management
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            RIGHT
        ================================================= */}

        <div className="ams-navbar-right">

          {/* Clock */}

          <div className="ams-navbar-clock">

            <span className="ams-navbar-time">
              {timeStr}
            </span>

            <span className="ams-navbar-divider" />

            <span className="ams-navbar-date">
              {dateStr}
            </span>

          </div>

          {/* User */}

          {user && (
            <div className="ams-navbar-user">

              <div className="ams-navbar-avatar">
                {initials}
              </div>

              <div className="ams-navbar-user-info">

                <div className="ams-navbar-user-name">
                  {user.name}
                </div>

                {user.role && (
                  <div className="ams-navbar-user-role">
                    {user.role}
                  </div>
                )}

              </div>

            </div>
          )}

          {/* Logout */}

          <button
            type="button"
            className={`ams-navbar-logout ${
              confirmLogout
                ? "confirm"
                : ""
            }`}
            onClick={handleLogout}
            aria-label={
              confirmLogout
                ? "Confirm logout"
                : "Logout"
            }
          >
            <ArrowRightOnRectangleIcon />

            <span>
              {confirmLogout
                ? "Confirm"
                : "Logout"}
            </span>
          </button>

        </div>

      </header>
    </>
  );
}
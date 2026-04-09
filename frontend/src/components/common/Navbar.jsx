import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoError, setLogoError] = useState(false);

  /* live clock */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* subtle scroll shadow */
  useEffect(() => {
    const el = document.querySelector(".dash-scroll-area") ?? window;
    const handler = () => setScrolled((el.scrollTop ?? window.scrollY) > 4);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 3000);
      return;
    }
    logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        .navbar-root {
          position: sticky; top: 0; z-index: 50;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px;
          background: rgba(10,10,15,0.85);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: box-shadow 0.3s ease;
          font-family: 'DM Sans', sans-serif;
        }
        .navbar-root.scrolled {
          box-shadow: 0 4px 40px rgba(0,0,0,0.5);
        }

        /* left cluster */
        .nb-left { display: flex; align-items: center; gap: 16px; }

        .nb-menu-btn {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.15s;
        }
        .nb-menu-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
          transform: scale(1.06);
        }

        /* breadcrumb / brand */
        .nb-brand {
          display: flex; align-items: center; gap: 8px;
        }
        .nb-logo {
          width: 45px;
          height: 45px;
          object-fit: contain;
        }
        .nb-logo-fallback {
          width: 45px;
          height: 45px;
          border-radius: 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 10px;
          color: #fff;
          flex-shrink: 0;
        }
        .nb-brand-name {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -0.01em;
          color: #fff;
        }

        /* divider */
        .nb-divider {
          width: 1px; height: 20px;
          background: rgba(255,255,255,0.1);
        }

        /* right cluster */
        .nb-right { display: flex; align-items: center; gap: 12px; }

        /* clock chip */
        .nb-clock {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 14px; border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .nb-time {
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 700;
          color: #fff; letter-spacing: '-0.01em';
        }
        .nb-date {
          font-size: 11px; color: rgba(255,255,255,0.35); font-weight: 500;
        }

        /* avatar + name */
        .nb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 5px 12px 5px 5px; border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          cursor: default;
        }
        .nb-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800; color: #fff; letter-spacing: '0.02em';
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
        }
        .nb-username {
          font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8);
          max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nb-role {
          font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 500;
          letter-spacing: '0.04em'; text-transform: uppercase; line-height: 1;
        }

        /* logout btn */
        .nb-logout {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 14px; border-radius: 999px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          color: rgba(239,68,68,0.7);
          font-size: 12px; font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .nb-logout:hover {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.45);
          color: #f87171;
          transform: translateY(-1px);
        }
        .nb-logout.confirming {
          background: rgba(239,68,68,0.22);
          border-color: rgba(239,68,68,0.6);
          color: #fca5a5;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          75%      { transform: translateX(4px); }
        }

        @media (max-width: 640px) {
          .nb-clock { display: none; }
          .nb-username { display: none; }
          .nb-role { display: none; }
        }
      `}</style>

      <header className={`navbar-root${scrolled ? " scrolled" : ""}`}>
        {/* LEFT */}
        <div className="nb-left">
          {/* <button className="nb-menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
            <Bars3Icon style={{ width: 16, height: 16 }} />
          </button> */}

          <div className="nb-brand">
            {logoError ? (
              <span className="nb-logo-fallback">A</span>
            ) : (
              <img
                className="nb-logo"
                src="/apex-logo.png"
                alt="APEX logo"
                onError={() => setLogoError(true)}
              />
            )}
            <span className="nb-brand-name">APEX</span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="nb-right">
          {/* clock */}
          <div className="nb-clock">
            <span className="nb-time">{timeStr}</span>
            <span className="nb-divider" />
            <span className="nb-date">{dateStr}</span>
          </div>

          {/* user chip */}
          {user && (
            <div className="nb-user">
              <div className="nb-avatar">{initials}</div>
              <div>
                <div className="nb-username">{user.name}</div>
                {user.role && <div className="nb-role">{user.role}</div>}
              </div>
            </div>
          )}

          {/* logout */}
          <button
            className={`nb-logout${confirmLogout ? " confirming" : ""}`}
            onClick={handleLogout}
          >
            <ArrowRightOnRectangleIcon style={{ width: 14, height: 14 }} />
            {confirmLogout ? "Sure?" : "Logout"}
          </button>
        </div>
      </header>
    </>
  );
}

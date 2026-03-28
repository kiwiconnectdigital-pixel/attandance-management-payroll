import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon, UsersIcon, ClockIcon, CalendarIcon,
  CurrencyRupeeIcon, DocumentTextIcon, ChartBarIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink to={to} style={{ textDecoration: 'none' }}>
    {({ isActive }) => (
      <div className={`sb-nav-item${isActive ? ' active' : ''}`}>
        <div className="sb-nav-icon">
          <Icon style={{ width: 16, height: 16 }} />
        </div>
        <span className="sb-nav-label">{label}</span>
        {isActive && <span className="sb-nav-pip" />}
      </div>
    )}
  </NavLink>
);

const BottomNavItem = ({ to, icon: Icon, label }) => (
  <NavLink to={to} style={{ textDecoration: 'none', flex: 1 }}>
    {({ isActive }) => (
      <div className={`bn-item${isActive ? ' active' : ''}`}>
        <div className="bn-icon-wrap">
          <Icon style={{ width: 20, height: 20 }} />
          {isActive && <span className="bn-blob" />}
        </div>
        <span className="bn-label">{label}</span>
      </div>
    )}
  </NavLink>
);

const SectionLabel = ({ children }) => (
  <p className="sb-section-label">{children}</p>
);

export default function Sidebar({ open }) {
  const { user, isAdmin, isHR } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const bottomNavItems = [
    { to: '/dashboard',  icon: HomeIcon,          label: 'Home'    },
    { to: '/attendance', icon: ClockIcon,         label: 'Attend'  },
    { to: '/leaves',     icon: CalendarIcon,      label: 'Leave'   },
    { to: '/payslips',   icon: DocumentTextIcon,  label: 'Payslips'},
    ...(isAdmin || isHR
      ? [{ to: '/employees', icon: UsersIcon, label: 'Team' },
    { to: '/reports',    icon: DocumentTextIcon,  label: 'Report'  },
      ]
      : []),
  ].slice(0, 6);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        /* ════════════════════════════════
           SIDEBAR  (desktop / ≥ 1025px)
        ════════════════════════════════ */
        .sb-root {
          position: fixed; left: 0; top: 0;
          height: 100vh; width: 232px;
          background: #08080d;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          z-index: 40;
          font-family: 'DM Sans', sans-serif;
          transform: translateX(${open ? '0' : '-100%'});
          transition: transform 0.28s cubic-bezier(.4,0,.2,1);
        }

        .sb-logo {
          height: 60px; flex-shrink: 0;
          display: flex; align-items: center; gap: 10px;
          padding: 0 18px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sb-logo-mark {
          width: 30px; height: 30px; border-radius: 9px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800;
          color: #fff; letter-spacing: 0.02em;
          box-shadow: 0 0 16px rgba(99,102,241,0.45);
          flex-shrink: 0;
        }
        .sb-logo-name {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 800;
          color: #fff; letter-spacing: -0.01em;
        }

        .sb-nav {
          flex: 1; overflow-y: auto;
          padding: 14px 10px;
          scrollbar-width: none;
        }
        .sb-nav::-webkit-scrollbar { display: none; }

        .sb-section-label {
          margin: 16px 0 6px 10px;
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.2);
        }

        .sb-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 10px;
          cursor: pointer; position: relative;
          transition: background 0.15s, color 0.15s;
          margin-bottom: 2px;
          color: rgba(255,255,255,0.4);
        }
        .sb-nav-item:hover {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.75);
        }
        .sb-nav-item.active {
          background: rgba(99,102,241,0.15);
          color: #a5b4fc;
        }
        .sb-nav-item.active .sb-nav-icon {
          background: rgba(99,102,241,0.25);
          border-color: rgba(99,102,241,0.35);
          color: #a5b4fc;
        }

        .sb-nav-icon {
          width: 30px; height: 30px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .sb-nav-item:hover .sb-nav-icon {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }

        .sb-nav-label {
          font-size: 13px; font-weight: 500; flex: 1;
        }

        .sb-nav-pip {
          width: 4px; height: 4px; border-radius: 50%;
          background: #818cf8;
          box-shadow: 0 0 6px #818cf8;
        }

        .sb-divider {
          height: 1px; background: rgba(255,255,255,0.05);
          margin: 4px 10px;
        }

        .sb-footer {
          flex-shrink: 0;
          padding: 12px 10px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .sb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .sb-user-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #818cf8, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 800;
          color: #fff; flex-shrink: 0;
        }
        .sb-user-name {
          font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.75);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-user-role {
          font-size: 10px; color: rgba(255,255,255,0.25);
          text-transform: capitalize; font-weight: 500;
          letter-spacing: 0.03em;
        }
        .sb-status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
          flex-shrink: 0; margin-left: auto;
        }

        /* ════════════════════════════════
           BOTTOM NAV  (mobile / tablet ≤ 1024px)
        ════════════════════════════════ */
        .bn-root {
          display: none; /* hidden on desktop */
        }

        @media (max-width: 1024px) {
          /* Hide the sidebar entirely */
          .sb-root {
            display: none !important;
          }

          /* Show bottom nav */
          .bn-root {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 64px;
            background: #08080d;
            border-top: 1px solid rgba(255,255,255,0.07);
            z-index: 50;
            align-items: stretch;
            padding-bottom: env(safe-area-inset-bottom);
            font-family: 'DM Sans', sans-serif;
            /* subtle top blur line */
            box-shadow: 0 -8px 32px rgba(0,0,0,0.45);
          }

          .bn-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            cursor: pointer;
            color: rgba(255,255,255,0.32);
            transition: color 0.18s;
            position: relative;
            padding: 6px 0;
          }
          .bn-item.active {
            color: #a5b4fc;
          }

          .bn-icon-wrap {
            position: relative;
            display: flex; align-items: center; justify-content: center;
            width: 36px; height: 36px;
            border-radius: 12px;
            transition: background 0.18s;
          }
          .bn-item.active .bn-icon-wrap {
            background: rgba(99,102,241,0.18);
          }

          /* glow blob behind active icon */
          .bn-blob {
            position: absolute;
            inset: 0; border-radius: 12px;
            background: rgba(99,102,241,0.22);
            filter: blur(6px);
            animation: bn-pop 0.22s cubic-bezier(.34,1.56,.64,1) both;
          }
          @keyframes bn-pop {
            from { transform: scale(0.4); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }

          .bn-label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.02em;
            line-height: 1;
          }

          /* Active top indicator pill */
          .bn-item.active::before {
            content: '';
            position: absolute;
            top: 0; left: 50%;
            transform: translateX(-50%);
            width: 28px; height: 2.5px;
            border-radius: 0 0 4px 4px;
            background: linear-gradient(90deg, #6366f1, #8b5cf6);
            box-shadow: 0 0 8px rgba(99,102,241,0.7);
            animation: bn-slide-in 0.2s ease both;
          }
          @keyframes bn-slide-in {
            from { width: 0; opacity: 0; }
            to   { width: 28px; opacity: 1; }
          }
        }
      `}</style>

      <aside className="sb-root">
        <div className="sb-logo">
          <div className="sb-logo-mark">AP</div>
          <span className="sb-logo-name">AttendPay</span>
        </div>

        <nav className="sb-nav">
          <NavItem to="/dashboard"  icon={HomeIcon}         label="Dashboard"  />
          <NavItem to="/attendance" icon={ClockIcon}        label="Attendance" />
          <NavItem to="/leaves"     icon={CalendarIcon}     label="Leave"      />
          <NavItem to="/payslips"   icon={DocumentTextIcon} label="My Payslips"/>

          {(isAdmin || isHR) && (
            <>
              <div className="sb-divider" />
              <SectionLabel>Management</SectionLabel>
              <NavItem to="/employees" icon={UsersIcon}         label="Employees" />
              <NavItem to="/payroll"   icon={CurrencyRupeeIcon} label="Payroll"   />
              <NavItem to="/reports"   icon={ChartBarIcon}      label="Reports"   />
            </>
          )}

          {isAdmin && (
            <>
              <div className="sb-divider" />
              <SectionLabel>Admin</SectionLabel>
              <NavItem to="/branches" icon={BuildingOfficeIcon} label="Branches" />
            </>
          )}
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-user-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-user-name">{user?.name}</div>
              <div className="sb-user-role">{user?.role}</div>
            </div>
            <div className="sb-status-dot" title="Online" />
          </div>
        </div>
      </aside>

      <nav className="bn-root">
        {bottomNavItems.map(({ to, icon, label }) => (
          <BottomNavItem key={to} to={to} icon={icon} label={label} />
        ))}
      </nav>
    </>
  );
}
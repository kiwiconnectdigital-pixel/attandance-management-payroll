import { useState, useEffect, useRef, useCallback } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { BellAlertIcon } from "@heroicons/react/24/solid";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { notificationAPI } from "../../services/api";
import { connectSocket, disconnectSocket } from "../../services/socket";

const tokens = {
  surface: "#FFFFFF",
  surfaceAlt: "#FAFBFC",
  text: "#15171C",
  secondary: "#676C76",
  muted: "#969BA5",
  border: "#E7E9ED",
  blue: "#3567D6",
  blueSoft: "#EDF3FF",
  red: "#C94B4B",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const isAdmin = user?.role === "company_admin";

  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [togglingPref, setTogglingPref] = useState(false);

  const panelRef = useRef(null);

  // Load preference + unread count on mount (admins only)
  useEffect(() => {
    if (!isAdmin) return;

    let mounted = true;

    (async () => {
      try {
        const prefRes = await notificationAPI.getPreference();
        const isEnabled = Boolean(
          prefRes.data?.data?.notifications_enabled,
        );

        if (!mounted) return;
        setEnabled(isEnabled);
        setPrefLoaded(true);

        if (isEnabled) {
          const countRes = await notificationAPI.getUnreadCount();
          if (mounted) {
            setUnreadCount(countRes.data?.data?.count || 0);
          }
        }
      } catch (err) {
        console.error("Failed to load notification preference:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  // Connect socket only while notifications are enabled
  useEffect(() => {
    if (!isAdmin || !prefLoaded || !enabled) return;

    const socket = connectSocket();
    if (!socket) return;

    const handleNew = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
      toast(notification.title, { icon: "🔔" });
    };

    socket.on("notification:new", handleNew);

    return () => {
      socket.off("notification:new", handleNew);
    };
  }, [isAdmin, prefLoaded, enabled]);

  // Disconnect entirely on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await notificationAPI.getMine();
      setNotifications(res.data?.data?.notifications || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const handleToggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && enabled) {
      loadNotifications();
    }
  };

  const handleTogglePreference = async () => {
    setTogglingPref(true);
    try {
      const nextValue = !enabled;
      await notificationAPI.updatePreference(nextValue);
      setEnabled(nextValue);

      if (nextValue) {
        toast.success("Notifications enabled");
        const countRes = await notificationAPI.getUnreadCount();
        setUnreadCount(countRes.data?.data?.count || 0);
      } else {
        toast.success("Notifications disabled");
        setUnreadCount(0);
        setNotifications([]);
        disconnectSocket();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update preference",
      );
    } finally {
      setTogglingPref(false);
    }
  };

  const handleItemClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationAPI.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }

    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      <style>{`
        .nb-wrap { position: relative; }

        .nb-button {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid ${tokens.border};
          border-radius: 9px;
          background: ${tokens.surfaceAlt};
          color: ${tokens.secondary};
          cursor: pointer;
          position: relative;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .nb-button:hover {
          background: ${tokens.blueSoft};
          border-color: #D7E2FA;
          color: ${tokens.blue};
        }
        .nb-button svg { width: 18px; height: 18px; }

        .nb-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: ${tokens.red};
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Inter, sans-serif;
        }

        .nb-panel {
          position: absolute;
          top: 44px;
          right: 0;
          width: 340px;
          max-height: 440px;
          background: ${tokens.surface};
          border: 1px solid ${tokens.border};
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(20,24,32,0.14);
          z-index: 60;
          display: flex;
          flex-direction: column;
          font-family: Inter, sans-serif;
        }

        .nb-header {
          padding: 12px 14px;
          border-bottom: 1px solid ${tokens.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .nb-title { font-size: 13px; font-weight: 700; color: ${tokens.text}; }

        .nb-pref-row {
          padding: 10px 14px;
          border-bottom: 1px solid ${tokens.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: ${tokens.surfaceAlt};
        }
        .nb-pref-label { font-size: 11.5px; color: ${tokens.secondary}; font-weight: 600; }

        .nb-switch {
          width: 34px;
          height: 20px;
          border-radius: 999px;
          border: none;
          background: ${tokens.border};
          position: relative;
          cursor: pointer;
          transition: background 0.15s ease;
          padding: 0;
          flex-shrink: 0;
        }
        .nb-switch.on { background: ${tokens.blue}; }
        .nb-switch:disabled { opacity: 0.6; cursor: not-allowed; }
        .nb-switch-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s ease;
        }
        .nb-switch.on .nb-switch-knob { transform: translateX(14px); }

        .nb-list { overflow-y: auto; flex: 1; }

        .nb-empty {
          padding: 28px 14px;
          text-align: center;
          color: ${tokens.muted};
          font-size: 12px;
        }

        .nb-item {
          padding: 10px 14px;
          border-bottom: 1px solid ${tokens.border};
          cursor: pointer;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          transition: background 0.12s ease;
        }
        .nb-item:hover { background: ${tokens.surfaceAlt}; }
        .nb-item:last-child { border-bottom: none; }

        .nb-item-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${tokens.blue};
          margin-top: 5px;
          flex-shrink: 0;
        }
        .nb-item-dot.read { background: transparent; }

        .nb-item-body { min-width: 0; }
        .nb-item-title {
          font-size: 12px;
          font-weight: 700;
          color: ${tokens.text};
          margin-bottom: 2px;
        }
        .nb-item-message {
          font-size: 11.5px;
          color: ${tokens.secondary};
          line-height: 1.4;
        }
        .nb-item-time {
          font-size: 10px;
          color: ${tokens.muted};
          margin-top: 3px;
        }

        .nb-footer {
          padding: 8px 14px;
          border-top: 1px solid ${tokens.border};
          text-align: center;
        }
        .nb-mark-all {
          background: none;
          border: none;
          color: ${tokens.blue};
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .nb-mark-all:hover { text-decoration: underline; }
      `}</style>

      <div className="nb-wrap" ref={panelRef}>
        <button
          type="button"
          className="nb-button"
          onClick={handleToggleOpen}
          aria-label="Notifications"
        >
          {unreadCount > 0 ? <BellAlertIcon /> : <BellIcon />}
          {enabled && unreadCount > 0 && (
            <span className="nb-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="nb-panel">
            <div className="nb-header">
              <span className="nb-title">Notifications</span>
            </div>

            <div className="nb-pref-row">
              <span className="nb-pref-label">
                {enabled ? "Notifications enabled" : "Enable notifications"}
              </span>
              <button
                type="button"
                className={`nb-switch ${enabled ? "on" : ""}`}
                onClick={handleTogglePreference}
                disabled={togglingPref}
                aria-label="Toggle notifications"
              >
                <span className="nb-switch-knob" />
              </button>
            </div>

            <div className="nb-list">
              {!enabled ? (
                <div className="nb-empty">
                  Turn notifications on above to start receiving updates.
                </div>
              ) : loading ? (
                <div className="nb-empty">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="nb-empty">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="nb-item"
                    onClick={() => handleItemClick(n)}
                  >
                    <span
                      className={`nb-item-dot ${n.is_read ? "read" : ""}`}
                    />
                    <div className="nb-item-body">
                      <div className="nb-item-title">{n.title}</div>
                      <div className="nb-item-message">{n.message}</div>
                      <div className="nb-item-time">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {enabled && notifications.some((n) => !n.is_read) && (
              <div className="nb-footer">
                <button
                  type="button"
                  className="nb-mark-all"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
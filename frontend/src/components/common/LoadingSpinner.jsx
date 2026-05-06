import { useEffect, useState } from "react";

export default function LoadingSpinner({ fullScreen = true }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  if (!fullScreen) return null;

  return (
    <div className="ls-root">
      <div className="ls-blob ls-blob1" />
      <div className="ls-blob ls-blob2" />

      <div className="ls-icon-wrap">
        <div className="ls-ring" />
        <div className="ls-icon-circle">
          <div className="ls-pin-head" />
          <div className="ls-pin-tip" />
        </div>
      </div>

      <h2 className="ls-title">Locating You</h2>
      <p className="ls-subtitle">Setting up your experience</p>

      <div className="ls-dots">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`ls-dot ${dots === i ? "active" : ""}`}
          />
        ))}
      </div>

      <style>{`
        .ls-root {
          position: fixed;
          inset: 0;
          background: #0b0f1a;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 9999;
        }

        /* blobs */
        .ls-blob {
          position: absolute;
          border-radius: 999px;
          opacity: 0.15;
          filter: blur(40px);
        }
        .ls-blob1 {
          width: 320px;
          height: 320px;
          background: #3b82f6;
          top: 10%;
          left: -60px;
        }
        .ls-blob2 {
          width: 260px;
          height: 260px;
          background: #6366f1;
          bottom: 15%;
          right: -40px;
        }

        /* icon */
        .ls-icon-wrap {
          position: relative;
          width: 100px;
          height: 100px;
          margin-bottom: 30px;
        }

        .ls-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          animation: ringPulse 1.6s ease-out infinite;
        }

        @keyframes ringPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          70% { opacity: 0.2; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .ls-icon-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #1e293b;
          border: 1.5px solid #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: auto;
          margin-top: 14px;
        }

        .ls-pin-head {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #3b82f6;
          margin-bottom: -4px;
        }

        .ls-pin-tip {
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 14px solid #3b82f6;
        }

        /* text */
        .ls-title {
          color: #f1f5f9;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .ls-subtitle {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 30px;
        }

        /* dots */
        .ls-dots {
          display: flex;
          gap: 10px;
        }

        .ls-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          opacity: 0.3;
          transform: translateY(0);
          transition: all 0.3s ease;
        }

        .ls-dot.active {
          opacity: 1;
          transform: translateY(-6px);
        }
      `}</style>
    </div>
  );
}
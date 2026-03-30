import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const user = await login(form.email, form.password);

    toast.success(`Welcome back, ${user.name}!`);

    // 🔥 Role-based redirect
    if (user.role === 'admin' || user.role === 'hr') {
      navigate('/dashboard');
    } else {
      navigate('/attendance');
    }

  } catch (err) {
    toast.error(err.response?.data?.message || 'Login failed');
  } finally {
    setLoading(false);
  }
};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .lgn-root * { box-sizing: border-box; margin: 0; padding: 0; }

        .lgn-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0f1623;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          -webkit-font-smoothing: antialiased;
          position: relative;
          overflow: hidden;
        }

        /* Ambient background blobs */
        .lgn-root::before {
          content: '';
          position: absolute;
          top: -120px; left: -120px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(79,142,255,0.1) 0%, transparent 65%);
          border-radius: 50%;
          pointer-events: none;
        }
        .lgn-root::after {
          content: '';
          position: absolute;
          bottom: -100px; right: -100px;
          width: 360px; height: 360px;
          background: radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 65%);
          border-radius: 50%;
          pointer-events: none;
        }

        /* Card */
        .lgn-card {
          width: 100%;
          max-width: 420px;
          background: rgba(26,35,54,0.95);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px 36px 36px;
          position: relative;
          z-index: 1;
          animation: lgn-fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        @keyframes lgn-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Logo */
        .lgn-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
        }
        .lgn-logo {
          width: 56px; height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #2563eb, #4f8eff);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(79,142,255,0.3);
        }
        .lgn-logo span {
          font-family: 'DM Mono', monospace;
          font-size: 18px; font-weight: 500;
          color: #fff; letter-spacing: 1px;
        }
        .lgn-app-name {
          font-size: 22px; font-weight: 600;
          color: #f0f4ff; letter-spacing: -0.4px;
        }
        .lgn-app-sub {
          font-size: 13px; color: #8b9ab5;
          margin-top: 4px; text-align: center;
        }

        /* Divider */
        .lgn-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin-bottom: 28px;
        }

        /* Form fields */
        .lgn-field { margin-bottom: 16px; }
        .lgn-label {
          display: block;
          font-size: 12px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.7px;
          color: #8b9ab5; margin-bottom: 7px;
        }
        .lgn-input-wrap { position: relative; }
        .lgn-input {
          width: 100%;
          background: #0f1623;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 13px 16px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; color: #f0f4ff;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
          -webkit-appearance: none;
        }
        .lgn-input::placeholder { color: #5a6a85; }
        .lgn-input:focus {
          border-color: rgba(79,142,255,0.6);
          box-shadow: 0 0 0 3px rgba(79,142,255,0.12);
        }
        .lgn-input.has-toggle { padding-right: 48px; }

        /* Password toggle */
        .lgn-eye {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #5a6a85; font-size: 16px;
          display: flex; align-items: center;
          padding: 4px;
          transition: color 0.15s;
        }
        .lgn-eye:hover { color: #8b9ab5; }

        /* Forgot */
        .lgn-forgot-row {
          display: flex; justify-content: flex-end;
          margin-top: -8px; margin-bottom: 24px;
        }
        .lgn-forgot {
          font-size: 12px; color: #4f8eff;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          padding: 0;
          transition: opacity 0.15s;
        }
        .lgn-forgot:hover { opacity: 0.75; }

        /* Submit button */
        .lgn-submit {
          width: 100%;
          border: none; cursor: pointer;
          background: linear-gradient(135deg, #1d4ed8, #4f8eff);
          color: #fff;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; font-weight: 600;
          border-radius: 10px;
          padding: 14px;
          box-shadow: 0 4px 20px rgba(79,142,255,0.3);
          transition: opacity 0.15s, transform 0.12s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .lgn-submit:hover:not(:disabled) { opacity: 0.9; }
        .lgn-submit:active:not(:disabled) { transform: scale(0.98); }
        .lgn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Spinner */
        .lgn-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lgn-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes lgn-spin { to { transform: rotate(360deg); } }

        /* Footer note */
        .lgn-footer {
          margin-top: 24px;
          text-align: center;
          font-size: 12px; color: #5a6a85;
          line-height: 1.6;
        }
        .lgn-footer strong { color: #8b9ab5; font-weight: 500; }

        /* Responsive */
        @media (max-width: 440px) {
          .lgn-card { padding: 32px 22px 28px; border-radius: 20px; }
          .lgn-app-name { font-size: 20px; }
        }
      `}</style>

      <div className="lgn-root">
        <div className="lgn-card">

          {/* Logo + Branding */}
          <div className="lgn-logo-wrap">
            <div className="lgn-logo">
              <span>AP</span>
            </div>
            <div className="lgn-app-name">AttendPay</div>
            <div className="lgn-app-sub">Attendance &amp; Payroll Management</div>
          </div>

          <div className="lgn-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="lgn-field">
              <label className="lgn-label">Email</label>
              <div className="lgn-input-wrap">
                <input
                  type="email"
                  className="lgn-input"
                  placeholder="admin@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="lgn-field">
              <label className="lgn-label">Password</label>
              <div className="lgn-input-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="lgn-input has-toggle"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lgn-eye"
                  onClick={() => setShowPass((p) => !p)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    /* eye-off */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* eye */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="lgn-forgot-row">
              <button type="button" className="lgn-forgot">Forgot password?</button>
            </div>

            <button type="submit" className="lgn-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lgn-spinner" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="lgn-footer">
            Secured by <strong>AttendPay</strong> · v2.0
          </div>
        </div>
      </div>
    </>
  );
}
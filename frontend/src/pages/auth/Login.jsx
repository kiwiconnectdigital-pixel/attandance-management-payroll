// src/pages/Login.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

import {
  BuildingOffice2Icon,
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

/* =========================================================
   Design Tokens
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
  blueDark: "#2F5FC9",
  blueSoft: "#EDF3FF",

  green: "#16845B",
  greenSoft: "#EAF7F1",

  red: "#C94B4B",
};

/* =========================================================
   Styles
========================================================= */

const CSS = `
  .login-root {
    min-height: 100vh;
    display: flex;

    background: ${tokens.bg};

    color: ${tokens.text};

    font-family:
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;

    -webkit-font-smoothing: antialiased;

    overflow: hidden;
  }

  .login-root *,
  .login-root *::before,
  .login-root *::after {
    box-sizing: border-box;
  }

  /* =======================================================
     LEFT PANEL
  ======================================================= */

  .login-brand-panel {
    position: relative;

    width: 48%;
    min-height: 100vh;

    display: flex;
    align-items: center;

    padding: 70px;

    background:
      linear-gradient(
        145deg,
        #EEF3FF 0%,
        #F6F7F9 54%,
        #F1F8F5 100%
      );

    border-right: 1px solid ${tokens.border};

    overflow: hidden;
  }

  .login-brand-panel::before {
    content: "";

    position: absolute;

    width: 520px;
    height: 520px;

    top: -230px;
    left: -170px;

    border-radius: 50%;

    background:
      radial-gradient(
        circle,
        rgba(53, 103, 214, 0.12) 0%,
        transparent 68%
      );

    pointer-events: none;
  }

  .login-brand-panel::after {
    content: "";

    position: absolute;

    width: 430px;
    height: 430px;

    right: -210px;
    bottom: -180px;

    border-radius: 50%;

    background:
      radial-gradient(
        circle,
        rgba(22, 132, 91, 0.08) 0%,
        transparent 68%
      );

    pointer-events: none;
  }

  .login-brand-content {
    position: relative;
    z-index: 1;

    width: 100%;
    max-width: 560px;

    margin: 0 auto;
  }

  .login-brand-mark {
    width: 58px;
    height: 58px;

    display: flex;
    align-items: center;
    justify-content: center;

    margin-bottom: 28px;

    border: 1px solid #D7E2FA;
    border-radius: 14px;

    background: ${tokens.surface};

    color: ${tokens.blue};

    box-shadow:
      0 7px 20px rgba(20, 24, 32, 0.05);
  }

  .login-brand-mark svg {
    width: 29px;
    height: 29px;
  }

  .login-eyebrow {
    margin-bottom: 11px;

    color: ${tokens.blue};

    font-size: 11px;
    font-weight: 750;

    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .login-brand-title {
    margin: 0;

    color: ${tokens.text};

    font-size: clamp(36px, 4vw, 54px);
    line-height: 1.05;

    font-weight: 760;

    letter-spacing: -0.045em;
  }

  .login-brand-description {
    max-width: 470px;

    margin: 18px 0 0;

    color: ${tokens.secondary};

    font-size: 15px;
    line-height: 1.65;
  }

  /* =======================================================
     FEATURES
  ======================================================= */

  .login-feature-list {
    display: grid;

    grid-template-columns:
      repeat(2, minmax(0, 1fr));

    gap: 11px;

    margin-top: 38px;
  }

  .login-feature {
    display: flex;
    align-items: center;

    gap: 10px;

    min-height: 50px;

    padding: 11px 12px;

    border: 1px solid rgba(231, 233, 237, 0.95);
    border-radius: 10px;

    background: rgba(255, 255, 255, 0.72);
  }

  .login-feature-icon {
    width: 30px;
    height: 30px;

    flex: 0 0 30px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 8px;

    background: ${tokens.blueSoft};
    color: ${tokens.blue};
  }

  .login-feature-icon.green {
    background: ${tokens.greenSoft};
    color: ${tokens.green};
  }

  .login-feature-icon svg {
    width: 16px;
    height: 16px;
  }

  .login-feature-text {
    color: #4F5560;

    font-size: 10.5px;
    line-height: 1.35;

    font-weight: 600;
  }

  /* =======================================================
     RIGHT PANEL
  ======================================================= */

  .login-form-panel {
    width: 52%;
    min-height: 100vh;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 40px;
  }

  .login-card {
    width: 100%;
    max-width: 430px;

    padding: 34px;

    border: 1px solid ${tokens.border};
    border-radius: 16px;

    background: ${tokens.surface};

    box-shadow:
      0 10px 35px rgba(20, 24, 32, 0.055);

    animation:
      login-fade-up
      0.4s
      cubic-bezier(0.34, 1.15, 0.64, 1)
      both;
  }

  @keyframes login-fade-up {
    from {
      opacity: 0;
      transform: translateY(14px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* =======================================================
     FORM HEADER
  ======================================================= */

  .login-form-header {
    margin-bottom: 27px;
  }

  .login-form-eyebrow {
    margin-bottom: 7px;

    color: ${tokens.blue};

    font-size: 10px;
    font-weight: 750;

    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .login-form-title {
    margin: 0;

    color: ${tokens.text};

    font-size: 25px;
    line-height: 1.2;

    font-weight: 750;

    letter-spacing: -0.035em;
  }

  .login-form-subtitle {
    margin: 7px 0 0;

    color: ${tokens.secondary};

    font-size: 12px;
    line-height: 1.5;
  }

  /* =======================================================
     FORM
  ======================================================= */

  .login-field {
    margin-bottom: 17px;
  }

  .login-label {
    display: block;

    margin-bottom: 7px;

    color: #555B65;

    font-size: 10px;
    font-weight: 700;

    letter-spacing: 0.035em;
  }

  .login-input-wrap {
    position: relative;
  }

  .login-input-icon {
    position: absolute;

    left: 12px;
    top: 50%;

    width: 16px;
    height: 16px;

    transform: translateY(-50%);

    color: #A2A7B0;

    pointer-events: none;
  }

  .login-input {
    width: 100%;
    height: 44px;

    padding:
      0 13px
      0 38px;

    border: 1px solid #DDE1E6;
    border-radius: 8px;

    outline: none;

    background: ${tokens.surface};

    color: ${tokens.text};

    font-family: inherit;
    font-size: 12px;

    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      background 0.15s ease;
  }

  .login-input:hover {
    border-color: #CDD2D9;
  }

  .login-input:focus {
    border-color: ${tokens.blue};

    box-shadow:
      0 0 0 3px rgba(53, 103, 214, 0.10);
  }

  .login-input::placeholder {
    color: #A5A9B1;
  }

  .login-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${tokens.surfaceAlt};
  }

  .login-input.password {
    padding-right: 43px;
  }

  /* =======================================================
     PASSWORD BUTTON
  ======================================================= */

  .login-password-toggle {
    position: absolute;

    top: 50%;
    right: 9px;

    width: 30px;
    height: 30px;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 0;

    transform: translateY(-50%);

    border: none;
    border-radius: 7px;

    background: transparent;

    color: #9298A2;

    cursor: pointer;

    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .login-password-toggle:hover {
    background: ${tokens.bg};
    color: ${tokens.blue};
  }

  .login-password-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-password-toggle svg {
    width: 16px;
    height: 16px;
  }

  /* =======================================================
     FORGOT PASSWORD
  ======================================================= */

  .login-forgot-row {
    display: flex;
    justify-content: flex-end;

    margin-top: -3px;
    margin-bottom: 21px;
  }

  .login-forgot {
    padding: 0;

    border: none;
    background: transparent;

    color: ${tokens.blue};

    font-family: inherit;
    font-size: 10.5px;
    font-weight: 650;

    cursor: pointer;
  }

  .login-forgot:hover {
    text-decoration: underline;
  }

  .login-forgot:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* =======================================================
     SUBMIT
  ======================================================= */

  .login-submit {
    width: 100%;
    height: 44px;

    display: flex;
    align-items: center;
    justify-content: center;

    gap: 8px;

    border: 1px solid ${tokens.blue};
    border-radius: 8px;

    background: ${tokens.blue};
    color: #FFFFFF;

    font-family: inherit;
    font-size: 12px;
    font-weight: 700;

    cursor: pointer;

    box-shadow:
      0 3px 9px rgba(53, 103, 214, 0.16);

    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.12s ease,
      box-shadow 0.15s ease;
  }

  .login-submit:hover:not(:disabled) {
    background: ${tokens.blueDark};
    border-color: ${tokens.blueDark};

    box-shadow:
      0 5px 14px rgba(53, 103, 214, 0.2);
  }

  .login-submit:active:not(:disabled) {
    transform: scale(0.985);
  }

  .login-submit:disabled {
    opacity: 0.58;
    cursor: not-allowed;
  }

  .login-submit-arrow {
    width: 15px;
    height: 15px;
  }

  /* =======================================================
     SPINNER
  ======================================================= */

  .login-spinner {
    width: 15px;
    height: 15px;

    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #FFFFFF;

    border-radius: 50%;

    animation:
      login-spin
      0.7s
      linear
      infinite;
  }

  @keyframes login-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* =======================================================
     SECURITY NOTE
  ======================================================= */

  .login-security {
    display: flex;
    align-items: center;
    justify-content: center;

    gap: 6px;

    margin-top: 21px;
    padding-top: 18px;

    border-top: 1px solid ${tokens.border};

    color: ${tokens.muted};

    font-size: 9.5px;
    line-height: 1.4;

    text-align: center;
  }

  .login-security svg {
    width: 14px;
    height: 14px;

    flex: 0 0 14px;

    color: ${tokens.green};
  }

  /* =======================================================
     FOOTER
  ======================================================= */

  .login-footer {
    margin-top: 16px;

    color: #A2A6AE;

    font-size: 9px;

    text-align: center;
  }

  .login-footer strong {
    color: #777D87;
    font-weight: 650;
  }

  /* =======================================================
     RESPONSIVE
  ======================================================= */

  @media (max-width: 1000px) {
    .login-brand-panel {
      width: 43%;
      padding: 45px;
    }

    .login-form-panel {
      width: 57%;
      padding: 30px;
    }

    .login-brand-title {
      font-size: 38px;
    }

    .login-feature-list {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .login-root {
      display: block;
      overflow: auto;
    }

    .login-brand-panel {
      width: 100%;
      min-height: auto;

      padding:
        32px 22px
        28px;

      border-right: none;
      border-bottom: 1px solid ${tokens.border};
    }

    .login-brand-content {
      max-width: 620px;
    }

    .login-brand-mark {
      width: 48px;
      height: 48px;

      margin-bottom: 19px;

      border-radius: 12px;
    }

    .login-brand-mark svg {
      width: 24px;
      height: 24px;
    }

    .login-brand-title {
      font-size: 31px;
    }

    .login-brand-description {
      margin-top: 12px;
      font-size: 12px;
    }

    .login-feature-list {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      margin-top: 22px;
    }

    .login-feature {
      min-height: 44px;
      padding: 8px 9px;
    }

    .login-form-panel {
      width: 100%;
      min-height: auto;

      padding:
        25px 16px
        35px;
    }

    .login-card {
      max-width: 500px;
      padding: 26px 22px;
    }
  }

  @media (max-width: 460px) {
    .login-brand-panel {
      padding:
        26px 17px
        23px;
    }

    .login-brand-title {
      font-size: 28px;
    }

    .login-brand-description {
      font-size: 11px;
    }

    .login-feature-list {
      grid-template-columns: 1fr;
    }

    .login-feature:nth-child(n + 3) {
      display: none;
    }

    .login-form-panel {
      padding:
        18px 12px
        28px;
    }

    .login-card {
      padding: 23px 18px;
      border-radius: 13px;
    }

    .login-form-title {
      font-size: 22px;
    }
  }
`;

/* =========================================================
   Component
========================================================= */

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] =
    useState(false);

  const [showPass, setShowPass] =
    useState(false);

  /* =========================================================
     Form submit
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) {
      return;
    }

    if (
      !form.email.trim() ||
      !form.password.trim()
    ) {
      toast.error(
        "Please enter both email and password",
      );
      return;
    }

    setLoading(true);

    try {
      const user = await login(
        form.email.trim(),
        form.password,
      );

      toast.success(
        `Welcome back, ${
          user?.name || "User"
        }!`,
      );

      /* ==========================================
         Role-based redirect
      ========================================== */

      const role = String(
        user?.role || "",
      )
        .trim()
        .toLowerCase();

      if (role === "super_admin") {
        navigate("/super-admin");
      } else if (
        role === "company_admin" ||
        role === "hr"
      ) {
        navigate("/dashboard");
      } else {
        navigate("/attendance");
      }
    } catch (err) {
      console.error(
        "Login error:",
        err,
      );

      const errorMessage =
        err?.message ||
        "Login failed. Please try again.";

      toast.error(errorMessage);

      setForm((prev) => ({
        ...prev,
        password: "",
      }));
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     Form change
  ========================================================= */

  const handleFormChange = (
    field,
    value,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =========================================================
     Render
  ========================================================= */

  return (
    <>
      <style>{CSS}</style>

      <main className="login-root">

        {/* =================================================
            BRAND PANEL
        ================================================= */}

        <section className="login-brand-panel">

          <div className="login-brand-content">

            <div className="login-brand-mark">
              <BuildingOffice2Icon />
            </div>

            <div className="login-eyebrow">
              Workforce management
            </div>

            <h1 className="login-brand-title">
              Kiwi Payroll
            </h1>

            <p className="login-brand-description">
              A centralized workspace for
              attendance, payroll, employee
              management and HR operations.
            </p>

            <div className="login-feature-list">

              <div className="login-feature">

                <div className="login-feature-icon">
                  <ShieldCheckIcon />
                </div>

                <div className="login-feature-text">
                  Secure employee records
                </div>

              </div>

              <div className="login-feature">

                <div className="login-feature-icon green">
                  <BuildingOffice2Icon />
                </div>

                <div className="login-feature-text">
                  Centralized HR operations
                </div>

              </div>

              <div className="login-feature">

                <div className="login-feature-icon">
                  <LockClosedIcon />
                </div>

                <div className="login-feature-text">
                  Controlled access
                </div>

              </div>

              <div className="login-feature">

                <div className="login-feature-icon green">
                  <CheckCircleIcon />
                </div>

                <div className="login-feature-text">
                  Attendance & payroll
                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            LOGIN PANEL
        ================================================= */}

        <section className="login-form-panel">

          <div className="login-card">

            <div className="login-form-header">

              <div className="login-form-eyebrow">
                Welcome back
              </div>

              <h2 className="login-form-title">
                Sign in to Kiwi Payroll
              </h2>

              <p className="login-form-subtitle">
                Enter your account credentials
                to continue to your workspace.
              </p>

            </div>

            {/* =================================================
                FORM
            ================================================= */}

            <form
              onSubmit={handleSubmit}
              noValidate
            >

              {/* Email */}

              <div className="login-field">

                <label className="login-label">
                  Email address
                </label>

                <div className="login-input-wrap">

                  <EnvelopeIcon className="login-input-icon" />

                  <input
                    type="email"
                    className="login-input"
                    placeholder="admin@company.com"
                    value={form.email}
                    onChange={(e) =>
                      handleFormChange(
                        "email",
                        e.target.value,
                      )
                    }
                    autoComplete="email"
                    disabled={loading}
                    required
                  />

                </div>

              </div>

              {/* Password */}

              <div className="login-field">

                <label className="login-label">
                  Password
                </label>

                <div className="login-input-wrap">

                  <LockClosedIcon className="login-input-icon" />

                  <input
                    type={
                      showPass
                        ? "text"
                        : "password"
                    }
                    className="login-input password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) =>
                      handleFormChange(
                        "password",
                        e.target.value,
                      )
                    }
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() =>
                      setShowPass(
                        (prev) =>
                          !prev,
                      )
                    }
                    disabled={loading}
                    aria-label={
                      showPass
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPass ? (
                      <EyeSlashIcon />
                    ) : (
                      <EyeIcon />
                    )}
                  </button>

                </div>

              </div>

              {/* Forgot */}

              <div className="login-forgot-row">

                <button
                  type="button"
                  className="login-forgot"
                  disabled={loading}
                >
                  Forgot password?
                </button>

              </div>

              {/* Submit */}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >

                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in

                    <ArrowRightIcon className="login-submit-arrow" />
                  </>
                )}

              </button>

            </form>

            {/* =================================================
                Security
            ================================================= */}

            <div className="login-security">

              <ShieldCheckIcon />

              <span>
                Your account and workforce data
                are protected with secure access.
              </span>

            </div>

            {/* =================================================
                Footer
            ================================================= */}

            <div className="login-footer">
              <strong>Kiwi Payroll</strong>
              {" "}· Attendance & Payroll Management
            </div>

          </div>

        </section>

      </main>
    </>
  );
}
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/types";
import { AuthLayout } from "../components/auth/AuthLayout";
import { appPath } from "../app/hostRouting";

type LoginStep = "email" | "password";

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return crossed ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 6 9 6a17.8 17.8 0 01-2.1 2.8M6.2 6.2C4.1 7.7 3 10 3 10s3.5 6 9 6c1 0 2-.2 2.8-.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="auth-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.3h5.9a5.1 5.1 0 01-2.2 3.3v2.8h3.6c2.1-2 3.3-4.8 3.3-8.1z" />
      <path fill="#34a853" d="M12 23c3 0 5.5-1 7.3-2.6l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-2-6.2-4.6H2.2V17A11 11 0 0012 23z" />
      <path fill="#fbbc05" d="M5.8 14.1a6.7 6.7 0 010-4.2V7.1H2.2A11 11 0 001 12c0 1.8.4 3.5 1.2 4.9l3.6-2.8z" />
      <path fill="#ea4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.1A10.6 10.6 0 0012 1a11 11 0 00-9.8 6.1l3.6 2.8c.9-2.6 3.3-4.5 6.2-4.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="auth-provider-icon auth-shield-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3z" />
      <path d="M9.5 12l1.7 1.7 3.6-4" />
    </svg>
  );
}

function AlternativeMethods() {
  return (
    <div className="auth-alternatives" aria-label="Additional sign-in methods unavailable">
      <button type="button" className="auth-provider" disabled title="Google sign-in is not supported by Horizon">
        <GoogleIcon />
        <span>Continue with Google</span>
        <small>Unavailable</small>
      </button>
      <button type="button" className="auth-provider" disabled title="Email-code sign-in is not supported by Horizon">
        <ShieldIcon />
        <span>Continue with email code</span>
        <small>Unavailable</small>
      </button>
      <p className="auth-unavailable-note">Alternative sign-in methods aren’t enabled for Horizon.</p>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (auth.user) return <Navigate to={appPath("/app")} replace />;

  function continueWithEmail(event: FormEvent) {
    event.preventDefault();
    setError("");
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setEmail(normalizedEmail);
    setStep("password");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.login(email, password);
      navigate(appPath("/app"), { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <section className="auth-card auth-card-login" aria-labelledby="login-title">
        <div className="auth-card-heading">
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in or create an account</p>
        </div>

        {step === "email" ? (
          <form className="auth-form" onSubmit={continueWithEmail} noValidate>
            <div className="auth-field auth-field-compact">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="Email address"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
              />
              {error && <p className="auth-error" id="login-error" role="alert">{error}</p>}
            </div>
            <button className="auth-primary" type="submit">Continue</button>
            <div className="auth-divider"><span>OR</span></div>
            <AlternativeMethods />
            <p className="auth-legal">By continuing, you agree to the Terms of Service and Privacy Policy.</p>
            <p className="auth-switch">Don’t have an account? <Link to="/register">Create one</Link></p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
            <button
              className="auth-account"
              type="button"
              onClick={() => {
                setStep("email");
                setPassword("");
                setError("");
              }}
              title={email}
              aria-label={`${email}. Change email address`}
            >
              <span className="auth-account-avatar" aria-hidden="true">@</span>
              <span>{email}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            {error && <p className="auth-alert" id="login-error" role="alert">{error}</p>}
            <div className="auth-field">
              <label htmlFor="password">Password <span aria-hidden="true">*</span></label>
              <div className="auth-password">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  disabled={busy}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
              <div className="auth-forgot-row">
                <button type="button" className="auth-forgot" disabled title="Password recovery is not supported by Horizon">
                  Forgot password? <small>Unavailable</small>
                </button>
              </div>
            </div>
            <button className="auth-primary" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="auth-divider"><span>OR</span></div>
            <AlternativeMethods />
            <p className="auth-switch">Don’t have an account? <Link to="/register">Create one</Link></p>
            <p className="auth-legal">By continuing, you agree to the Terms of Service and Privacy Policy.</p>
          </form>
        )}
      </section>
    </AuthLayout>
  );
}

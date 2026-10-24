import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../api/types";
import { AuthLayout } from "../components/auth/AuthLayout";
import { homePath } from "../app/hostRouting";

type LoginStep = "email" | "password";

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return crossed ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 6 9 6a17.8 17.8 0 01-2.1 2.8M6.2 6.2C4.1 7.7 3 10 3 10s3.5 6 9 6c1 0 2-.2 2.8-.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
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
  useEffect(() => { document.title = "Sign in · Horizon"; }, []);

  if (auth.user) return <Navigate to={homePath()} replace />;

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
      navigate(homePath(), { replace: true });
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
          <p>Sign in to continue to Horizon</p>
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
            <p className="auth-switch">Need access? <Link to="/register">Ask your organization administrator</Link></p>
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
              <p className="auth-unavailable-note">Password recovery is handled by your organization administrator.</p>
            </div>
            <button className="auth-primary" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="auth-switch">Need access? <Link to="/register">Ask your organization administrator</Link></p>
          </form>
        )}
      </section>
    </AuthLayout>
  );
}

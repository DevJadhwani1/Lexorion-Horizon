import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/auth/AuthLayout";
import { appPath } from "../app/hostRouting";

export function RegisterPage() {
  const auth = useAuth();
  if (auth.user) return <Navigate to={appPath("/app")} replace />;

  return (
    <AuthLayout>
      <section className="auth-card auth-card-register" aria-labelledby="register-title">
        <Link to="/login" className="auth-back">← <span>Back</span></Link>
        <div className="auth-card-heading auth-register-heading">
          <h1 id="register-title">Create your Lexorion account</h1>
          <p>Account registration is managed by your organization.</p>
        </div>
        <div className="auth-registration-notice">
          <div className="auth-registration-mark" aria-hidden="true">
            <img src="/brand-icon-onlight.svg" alt="" />
          </div>
          <div>
            <h2>Invitation required</h2>
            <p>Ask your organization administrator to provision your Horizon access. Once your account is ready, use your work email and password to sign in.</p>
          </div>
        </div>
        <div className="auth-register-actions">
          <Link className="auth-primary auth-link-button" to="/login">Return to sign in</Link>
        </div>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </AuthLayout>
  );
}

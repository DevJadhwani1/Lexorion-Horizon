import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-backdrop" aria-hidden="true" />
      <header className="auth-header">
        <Link to="/login" className="auth-brand" aria-label="Horizon">
          <img src="/brand-icon-onlight.svg" alt="" className="auth-brand-icon" />
          <span className="auth-brand-text">
            <strong className="auth-brand-name">HORIZON</strong>
          </span>
        </Link>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <div className="auth-footer-links" aria-label="Legal and support links">
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#help">Help</a>
        </div>
        <p>© {new Date().getFullYear()} Lexorion</p>
      </footer>
    </div>
  );
}

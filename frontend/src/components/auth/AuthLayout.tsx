import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-backdrop" aria-hidden="true" />
      <header className="auth-header">
        <Link to="/login" className="auth-brand" aria-label="Lexorion sign in">
          <img src="/brand-onlight.svg" alt="Lexorion" />
        </Link>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <div className="auth-footer-links" aria-label="Lexorion information">
          <span>Terms of Service</span>
          <span>Privacy</span>
          <span>Help</span>
        </div>
        <p>© {new Date().getFullYear()} Lexorion</p>
      </footer>
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { canonicalize } from "../app/hostRouting";

export function workflowLink(to: string, returnTo: string): string {
  const destination = new URL(to, window.location.origin);
  destination.searchParams.set("returnTo", returnTo);
  return destination.pathname + destination.search;
}
export function workflowReturn(search: string): string | null {
  const value = new URLSearchParams(search).get("returnTo");
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    const pathname = canonicalize(url.pathname);
    return url.origin === window.location.origin && (pathname === "/workforce" || pathname.startsWith("/workforce/") || pathname === "/payroll" || pathname.startsWith("/payroll/"))
      ? pathname + url.search : null;
  } catch { return null; }
}
/** Shown only when a task was opened from another workflow (for example a pay run), to return to it. Navigation is the sidebar's job. */
export function HorizonWorkflowNav() {
  const { pathname, search } = useLocation();
  if (!(pathname === "/workforce" || pathname.startsWith("/workforce/") || pathname === "/payroll" || pathname.startsWith("/payroll/"))) return null;
  const returnTo = workflowReturn(search);
  if (!returnTo) return null;
  return <nav className="horizon-workflow-nav" aria-label="Return to workflow">
    <Link to={returnTo}>← {returnTo.startsWith("/payroll/runs") ? "Back to pay run" : "Back to previous step"}</Link>
  </nav>;
}

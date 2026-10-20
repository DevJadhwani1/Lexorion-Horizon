import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../api/httpClient";
import { useAuth } from "../auth/AuthProvider";
import { session } from "../api/session";
import { consoleHost } from "../app/hostRouting";
import { Page, Notice } from "../components/ui/Page";

interface Preview { email: string; organizationSlug: string; organizationName: string; accountExists: boolean }
export function InvitationPage() {
  const auth = useAuth();
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  useEffect(() => {
    const changed = () => setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    setPreview(null); setError(""); setAccepted(false);
    if (!token) return;
    let active = true;
    void apiRequest<Preview>("/api/invitations/preview", { method: "POST", body: { token }, authenticated: false, organizationScoped: false })
      .then((value) => { if (active) setPreview(value); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const password = String(form.get("password") ?? "");
      if (!preview.accountExists) {
        await apiRequest("/api/invitations/register", { method: "POST", authenticated: false, organizationScoped: false,
          body: { token, firstName: form.get("firstName"), lastName: form.get("lastName"), password } });
        setAccepted(true);
        await auth.login(preview.email, password);
      } else {
        if (!auth.user) await auth.login(preview.email, password);
        await apiRequest("/api/invitations/accept", { method: "POST", body: { token }, organizationScoped: false });
        setAccepted(true);
      }
      await auth.reloadOrganizations();
      session.setOrganization(preview.organizationSlug);
      session.setWorkspace(null); session.setMode("client");
      window.location.replace(consoleHost() === "local" ? "/app" : "/");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to accept invitation. Try again."); }
    finally { setBusy(false); }
  }
  return <Page title="Accept invitation">
    {(!token || error) && <Notice>{error || "The invitation link is missing its token. Open the complete link from your email."}</Notice>}
    {accepted ? <p>Invitation accepted. <a href="/login">Sign in to access your organization.</a></p> : preview && <>
      <p>Join {preview.organizationName} ({preview.organizationSlug}) as {preview.email}.</p>
      {auth.user && auth.user.email.toLowerCase() !== preview.email.toLowerCase() ? <>
        <Notice>Sign out of the current account before accepting this invitation.</Notice>
        <button onClick={() => void auth.logout()}>Sign out</button>
      </> : <form onSubmit={(e) => void submit(e)}>
        {!preview.accountExists && <>
          <label>First name <input name="firstName" required maxLength={100} autoComplete="given-name" /></label>
          <label>Last name <input name="lastName" required maxLength={100} autoComplete="family-name" /></label>
        </>}
        {(!preview.accountExists || !auth.user) && <label>Password <input name="password" type="password" required minLength={preview.accountExists ? 1 : 12} maxLength={72} autoComplete={preview.accountExists ? "current-password" : "new-password"} /></label>}
        <button disabled={busy} type="submit">{busy ? "Accepting…" : preview.accountExists ? "Accept invitation" : "Create account and accept"}</button>
      </form>}
    </>}
  </Page>;
}

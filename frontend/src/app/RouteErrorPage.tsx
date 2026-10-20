import { appPath } from "./hostRouting";

export function RouteErrorPage() {
  return <main className="page-header">
    <section role="alert">
      <h1>This page could not be opened</h1>
      <p>Reload the page to try again, or return to the overview to continue.</p>
      <div className="toolbar">
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        <a href={appPath("/app")}>Return to overview</a>
      </div>
    </section>
  </main>;
}

// Safety guard for the browser verification scripts in this folder.
// These scripts type into real forms and press Save, so they must only ever run against an isolated
// test organization. Credentials come from the environment; nothing is hard-coded.
//
//   HORIZON_VERIFY_EMAIL, HORIZON_VERIFY_PASSWORD  test account (required)
//   HORIZON_VERIFY_BASE_URL                        default http://127.0.0.1:9000
//   HORIZON_VERIFY_ORG_PREFIX                      every reachable organization slug must start with this (default "local-verify")
//
// prepare() signs in through the API before the browser starts and aborts if the account can reach any
// organization outside the test prefix. "lexorion-client" is always refused.

const DENIED_SLUGS = new Set(["lexorion-client"]);

async function prepare() {
  const email = process.env.HORIZON_VERIFY_EMAIL;
  const password = process.env.HORIZON_VERIFY_PASSWORD;
  const baseUrl = (process.env.HORIZON_VERIFY_BASE_URL || "http://127.0.0.1:9000").replace(/\/$/, "");
  const prefix = process.env.HORIZON_VERIFY_ORG_PREFIX || "local-verify";
  if (!email || !password) {
    throw new Error("Set HORIZON_VERIFY_EMAIL and HORIZON_VERIFY_PASSWORD to an isolated test account. Refusing to run.");
  }

  const login = await fetch(`${baseUrl}/api/core/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Test account sign-in failed (${login.status}). Refusing to run.`);
  const { accessToken } = await login.json();

  const memberships = await fetch(`${baseUrl}/api/platform/me/organizations`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!memberships.ok) throw new Error(`Could not list the test account's organizations (${memberships.status}). Refusing to run.`);
  const slugs = (await memberships.json()).map((item) => item.slug);
  const unsafe = slugs.filter((slug) => DENIED_SLUGS.has(slug) || !slug.startsWith(prefix));
  if (slugs.length === 0 || unsafe.length > 0) {
    throw new Error(`Test account can reach non-test organizations (${unsafe.join(", ") || "none found"}). Refusing to run.`);
  }
  console.log(`verify-guard: ${email} limited to test organizations: ${slugs.join(", ")}`);
  return { email, password, baseUrl, slugs };
}

module.exports = { prepare };

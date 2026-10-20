# Organization invitations

Invitations use the existing `InvitationDelivery` boundary with an SMTP adapter. No email provider was present in this repository; the former adapter discarded messages.

Configure the Platform container:

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST` / `SMTP_PORT` | External relay hostname / port (default 587) |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Relay credentials, supplied by operator |
| `SMTP_AUTH` | Default true; false only for an explicitly trusted local relay |
| `SMTP_STARTTLS` | Default true and required when enabled |
| `INVITATION_FROM` | Relay-authorized sender address |
| `INVITATION_PUBLIC_ORIGIN` | Recipient-facing HTTPS Horizon organization console origin; HTTP localhost allowed for development |
| `LEXORION_INVITATION_TTL` | Default P7D, measured from creation |

For local verification only, `compose.mailpit.yml` adds a Mailpit inbox at `http://localhost:8025`. It overrides SMTP to the internal sink; messages never leave it. Do not include that override in production. Real inbox delivery, domain verification, relay availability and bounce handling remain the relay/operator's responsibility.

## Visible and recoverable delivery

Creating an invitation persists its token **hash** and then attempts SMTP submission with bounded connection/read/write timeouts. The API and admin UI show `SUBMITTED` only when SMTP accepts the message, or `FAILED` with a safe recovery message. Missing relay configuration is a visible failure. Existing records migrate to `NOT_SENT`; they are never relabelled as delivered.

Retry delivery is available for unexpired PENDING invitations. It rotates the token (invalidating prior links), keeps the original expiry and records the new result. A duplicate unexpired invitation returns conflict; retry the existing record instead. Expired or revoked invitations require a new invitation. Provider exception details, tokens and passwords are not returned or written to delivery status.

Delivery is synchronous, not a durable email queue. An SMTP timeout may mean the provider accepted a message; retry rotates its link. A process crash/database commit failure after SMTP submission can leave an unusable emailed link. The failed API request and persisted admin list are the recovery authority: create or resend as appropriate. No claim is made that SMTP submission proves inbox delivery.

## Recipient flow and access

The link is `/invitations/accept#token=...`; the fragment avoids placing the bearer token in HTTP access logs. Preview and new-account registration require a valid unexpired PENDING token. Registration derives the email from the invitation and creates the Core identity and organization membership in one transaction. It does not provide unrestricted signup or reset an existing account's password. Existing accounts must sign in as the invited email; inactive accounts must be reactivated through existing authenticated administration.

Acceptance locks the invited organization and invitation, rejects unavailable organizations, mismatched account/selected organization, expired/revoked/accepted tokens and existing memberships, then creates the membership and consumes the invitation atomically. The recipient reloads memberships and enters that organization. Invitations grant an organization role; this repository has no separate invitation-specific workspace grant. Available workspaces remain governed by the existing active organization/workspace/product/entitlement checks. Accepting an invitation does not activate a workspace, buy a plan or bypass those checks.

Relay recovery may not be instantaneous: container DNS caches and relay startup can briefly keep a retry in FAILED. Wait for relay readiness and retry the same invitation; a failed retry stays visible and recoverable. SMTP health does not gate Platform readiness, so relay outages do not disable account or tenant APIs.

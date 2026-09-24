# auth.aboutselphy.com — Project Brief

## Purpose

Standalone authentication service, extracted from the Discord bot dashboard's currently embedded BetterAuth setup. Single source of truth for admin/mod login across the Discord bot dashboard and all aboutselphy.com admin surfaces.

## Scope

In scope:

- Discord OAuth login
- Mod/admin access derived from Discord server role (same people as Twitch/Discord mods) — no separate per-project mod list to maintain
- Serves as the central session provider for:
  - Discord bot dashboard (migrate off its embedded auth instance)
  - social.aboutselphy.com admin panel (future — link management)
  - Any future aboutselphy.com admin surfaces

Out of scope:

- Viewer-facing dashboard auth (giveaways/channel points). That's a separate app with its own Twitch/YouTube OAuth per viewer — no shared session with this service.
- Root aboutselphy.com — static, no login required.

## Stack

- Next.js — API routes for auth flow, no real frontend beyond login/callback pages
- BetterAuth + Discord provider + admin plugin (same as the Discord bot dashboard's current setup — reuse that config/role-check logic rather than reimplementing)
- PostgreSQL — shared instance in the existing AboutSelphy Dokploy namespace; own schema/tables, not a new database
- Deployment: own Dokploy app, own subdomain (auth.aboutselphy.com), own Traefik-issued cert

## Requirements

1. Discord OAuth login flow.
2. Role check against the Discord server to gate mod/admin access — port the existing role-check logic from the Discord bot dashboard.
3. Session cookie set with `Domain=.aboutselphy.com`, `Secure`, and a `SameSite` value consistent across every consuming app — must be readable on any `*.aboutselphy.com` subdomain.
4. Session validation exposed to consuming apps. Default to direct Postgres reads from the shared instance (simplest, everything's on one server) unless a specific app needs to be decoupled later — in which case add a validation endpoint for that app only.
5. Migrate the Discord bot dashboard to validate against this service instead of its embedded instance, without invalidating existing user accounts/sessions during the switch.

## Constraints

- Server is resource-constrained (4-core/8GB Netcup VPS, consolidation already in progress) — this must stay a thin service. No dedicated Redis/Postgres instance; reuse what's already in the AboutSelphy namespace.
- This becomes a shared point of failure for login across multiple apps. Acceptable given everything already runs on the same VPS — not a new dependency, just a consolidated one.
- One Discord login must cover the Discord dashboard and every aboutselphy.com admin surface — no re-authenticating per app.

## Open decisions

- Session validation: confirmed as direct Postgres read by default (see Requirement 4) — revisit only if an app needs isolation from the shared DB.

## Implementation notes

See README.md for setup, routes, deployment and the dashboard migration steps.

- Next.js 16.3 (App Router), BetterAuth 1.7.5, pnpm. Next 16: `proxy.ts` replaces `middleware.ts`; `params`/`searchParams`/`headers()` are Promises.
- No Prisma: BetterAuth uses a plain `pg` Pool (Kysely adapter) with `search_path` set to `DATABASE_SCHEMA` (default `auth`). Schema changes go through `pnpm db:migrate [--dry-run]` (BetterAuth `getMigrations`), run manually — never on container boot.
- Login methods are registered in `src/lib/providers.ts` (Discord live; Twitch/YouTube `comingSoon`). Each has a `resolveRole(accessToken)`; the `session.create.before` hook in `src/lib/auth.ts` takes the highest role across the user's linked accounts. Discord's is `src/lib/discord-roles.ts` (user's own token, `guilds.members.read`) — written fresh, the Discord bot dashboard source wasn't available, so its role-check logic still needs to be compared/ported.
- Throwing an `APIError` with a `code` in that hook makes BetterAuth's OAuth callback redirect to the sign-in's `errorCallbackURL` — `/login?redirect=…&error=<code>`, rendered inline via `src/lib/errors.ts`.
- `/login` is one form with a submit button per provider; `provider-buttons.tsx` uses `useFormStatus().data` to show the pending state on the clicked one. Brand icons are inlined SVG paths (`src/lib/brand-icons.ts`, from simple-icons) to keep the service thin.
- Sign-out for consuming apps is `POST /api/sign-out` (form POST, `redirect` field, Origin must be trusted — CSRF guard), which copies `auth.api.signOut({ asResponse: true })`'s Set-Cookie headers onto a 303 redirect.
- `consumer/validate-session.ts` is the copy-into-each-app validator: verifies the `<token>.<base64 HMAC-SHA256>` cookie signature with `BETTER_AUTH_SECRET`, then queries `session` + `user`.
- `pg`, BetterAuth instance and env are all read lazily — `next build` has no runtime env in Docker.

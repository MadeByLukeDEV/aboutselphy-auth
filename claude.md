# auth.aboutselphy.com — Project Brief

## Purpose

Standalone authentication service, extracted from the Discord bot dashboard's currently embedded BetterAuth setup. Single source of truth for login across aboutselphy: staff (admin/mod) surfaces and, since 2026-09-29, the viewer-facing dashboard — one account per person, whatever platform they sign in with.

## Scope

In scope:

- Discord, Twitch and YouTube (Google OAuth, `youtube.readonly`) login
- **Staff:** Discord is the main (only) login for staff surfaces — social.aboutselphy.com admin, aboutselphy.com/admin, the Discord bot dashboard. Mod/admin access derived from Discord server role — no separate per-project mod list to maintain
- **Viewers** (Viewer Dashboard — giveaways/channel points): sign in with any one platform first, then link the others to the same account
- **No duplicate users:** a platform the person hasn't used yet must never silently create a second account (verified-email auto-link, otherwise ask "used another platform before? / new here?")
- Serves as the central session provider for:
  - Discord bot dashboard (migrate off its embedded auth instance)
  - social.aboutselphy.com admin panel
  - aboutselphy.com/admin
  - Viewer Dashboard
  - Any future aboutselphy.com surfaces

Out of scope:

- Root aboutselphy.com public pages — static, no login required (only /admin uses this service).

Decision log: viewer auth was originally out of scope ("separate app with its own Twitch/YouTube OAuth, no shared session"). On 2026-09-29 the user chose to host viewer accounts here instead, so a mod who is also a viewer has one account. Staff access stays isolated through per-session roles (below).

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
- Providers live in `src/lib/providers.ts` with an `audiences` list (staff = Discord only; viewer = all) and are only usable once their `*_CLIENT_ID`/`*_SECRET` env vars are set (else "Soon"). YouTube = BetterAuth's `google` provider with `getUserInfo` overridden in `src/lib/youtube.ts`, so `account.accountId` is the YouTube channel ID (profile `sub`), not the Google account ID.
- **Audience** is a query param: `/login?redirect=` (staff, default) vs `/login?audience=viewer&redirect=`. Carried through every form/action via `FlowFields` + `flowParams()`.
- **Roles are per session**: `session.role` / `session.loginProvider` (additionalFields, set in the `session.create.before` hook in `src/lib/auth.ts`; provider = `ctx.params.id` of `/callback/:id`). Only a Discord sign-in resolves a staff role (`src/lib/discord-roles.ts`, user's own token, `guilds.members.read`); Twitch/YouTube sessions are always `viewer`; Discord unreachable → `viewer` (fail closed, `user.role` untouched). Consumers check `coalesce(s.role, u.role)` — the fallback only covers pre-existing (all-Discord) sessions. Role-check logic was written fresh (Discord bot dashboard source wasn't available) and still needs comparing/porting.
- **No duplicate users**: `disableImplicitSignUp` on every provider + `accountLinking` (`allowDifferentEmails` for explicit links, BetterAuth's default verified-email rule for implicit ones). Unknown account → callback redirects to `errorCallbackURL` `/login?…&attempted=<p>&error=signup_disabled` (or `account_not_linked`) → `LinkOrCreate` view: "sign in with another platform, then connect" (`signin-link:<p>:<other>` → `/account?connect=<other>`) or "create account" (`signup:<p>` → `requestSignUp`).
- All sign-in/link/unlink buttons post to one server action, `src/app/actions.ts` `authAction`, dispatching on the button's `choice` value (`signin:` / `signup:` / `signin-link:` / `link:` / `unlink:`). `src/components/provider-button.tsx` uses `useFormStatus().data` to show the pending state on the clicked button. Brand icons are inlined SVG paths (`src/lib/brand-icons.ts`, from simple-icons) to keep the service thin.
- `/account` lists connected platforms (connect via `linkSocialAccount`, disconnect via `unlinkAccount` — needs a fresh session, can't remove the last one). Callback errors are rendered inline via `src/lib/errors.ts`.
- Sign-out for consuming apps is `POST /api/sign-out` (form POST, `redirect` field, Origin must be trusted — CSRF guard), which copies `auth.api.signOut({ asResponse: true })`'s Set-Cookie headers onto a 303 redirect.
- `consumer/validate-session.ts` is the copy-into-each-app validator: verifies the `<token>.<base64 HMAC-SHA256>` cookie signature with `BETTER_AUTH_SECRET`, then queries `session` + `user` (staff audience by default; `{ audience: "viewer" }` accepts any session; `linkedAccounts(userId)` returns the Twitch user ID / YouTube channel ID etc.). SocialMedia Tree carries its own copy in `src/modules/auth/session.ts`.
- `pg`, BetterAuth instance and env are all read lazily — `next build` has no runtime env in Docker.

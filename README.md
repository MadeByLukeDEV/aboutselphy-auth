# auth.aboutselphy.com

Central Discord login for aboutselphy staff (mods/admins). One sign-in sets a
session cookie on `.aboutselphy.com` that every admin surface
(Discord bot dashboard, social.aboutselphy.com admin, …) validates directly
against Postgres.

## How it works

1. A consuming app sends a signed-out user to
   `https://auth.aboutselphy.com/login?redirect=<url they wanted>`.
2. They sign in with Discord (scopes: `identify email guilds.members.read`).
3. On every sign-in, a `session.create.before` hook
   ([src/lib/auth.ts](src/lib/auth.ts)) fetches their member record on
   `DISCORD_GUILD_ID` with their own token and maps role IDs to `admin` /
   `moderator` ([src/lib/discord-roles.ts](src/lib/discord-roles.ts)). No
   staff role means no session, and they're sent to `/error`.
4. The session cookie (`__Secure-better-auth.session_token`,
   `Domain=aboutselphy.com; Secure; HttpOnly; SameSite=Lax`) is set and
   they're redirected back. The redirect target is limited to
   `TRUSTED_ORIGINS`.
5. The consuming app validates the cookie with
   [consumer/validate-session.ts](consumer/validate-session.ts). The helper
   checks the HMAC signature with the shared `BETTER_AUTH_SECRET`, then looks
   the session up in the `auth` schema.

Role changes on Discord take effect at the user's **next sign-in** (sessions
last 7 days). To lock someone out immediately, revoke their sessions or ban
them with the admin plugin's endpoints (`/api/auth/admin/*`).

## Routes

| Route | Purpose |
| --- | --- |
| `/login?redirect=` | Discord sign-in; skips straight to the redirect if already signed in |
| `/logout?redirect=` | Sign-out (POST form, so it can't be triggered cross-site) |
| `/error?error=` | `not_staff`, `not_in_guild`, `role_check_failed`, … |
| `/api/auth/*` | BetterAuth handler (OAuth callback: `/api/auth/callback/discord`) |
| `/api/health` | Health check for Dokploy (checks the Postgres connection) |

## Setup

```sh
pnpm install
cp .env.example .env        # fill in DATABASE_URL, Discord app + guild/role IDs
pnpm db:migrate --dry-run   # review the SQL
pnpm db:migrate             # creates schema "auth" + user/session/account/verification
pnpm dev
```

Register `${BETTER_AUTH_URL}/api/auth/callback/discord` as a redirect URI in
the Discord developer portal. For role IDs, turn on Discord Developer Mode,
then right-click a role and choose **Copy Role ID**.

## Deployment (Dokploy)

- Build from the `Dockerfile`. It uses `output: "standalone"` and runs
  `node server.js` on port 3000.
- Domain: `auth.aboutselphy.com`, with a Traefik/Let's Encrypt cert.
- Production env: `BETTER_AUTH_URL=https://auth.aboutselphy.com`,
  `COOKIE_DOMAIN=aboutselphy.com`, and
  `DEFAULT_REDIRECT_URL=<dashboard URL>`.
- Health check path: `/api/health`.
- Migrations don't run on boot. Run `pnpm db:migrate` from a checkout pointed
  at production.

## Integrating a consuming app

1. Copy `consumer/validate-session.ts` into the app (it needs only `pg`).
2. Set `AUTH_DATABASE_URL`, `AUTH_DATABASE_SCHEMA=auth`,
   `BETTER_AUTH_SECRET` (the same value as this service) and
   `AUTH_COOKIE_PREFIX`.
3. In `proxy.ts` or a server component:
   ```ts
   const session = await validateSession(request.headers.get("cookie"));
   if (!session) return NextResponse.redirect(
     `https://auth.aboutselphy.com/login?redirect=${encodeURIComponent(request.url)}`);
   // session.user.role is "admin" | "moderator"
   ```
4. Point the app's "sign out" link at
   `https://auth.aboutselphy.com/logout?redirect=<app url>`.

The Postgres user a consuming app connects with only needs `SELECT` on
`auth.session` and `auth."user"`.

## Migrating the Discord bot dashboard (Requirement 5)

The goal is that existing users and sessions survive the switch. The session
cookie only stays valid if the cookie name, signing secret and session rows
are all unchanged:

1. **Reuse the dashboard's secret.** Set `BETTER_AUTH_SECRET` here to the
   dashboard's current value.
2. **Reuse its tables.** Set `DATABASE_SCHEMA` to the schema that holds the
   dashboard's BetterAuth tables. Run `pnpm db:migrate --dry-run` first: it
   should only add columns the admin plugin needs (if any), never recreate
   tables.
3. **Match the cookie prefix.** `COOKIE_PREFIX` must equal the dashboard's
   `advanced.cookiePrefix` (default `better-auth`). Existing cookies are
   host-only on the dashboard's domain. They keep working there until they
   expire, and new logins set the `.aboutselphy.com` cookie.
4. Switch the dashboard to `validateSession()`, remove its embedded
   BetterAuth instance, and send its login/logout to this service.
5. Map the dashboard's existing role check onto `DISCORD_ADMIN_ROLE_IDS` /
   `DISCORD_MODERATOR_ROLE_IDS`.

If the dashboard's tables use non-default names or different column casing,
add a matching `user`/`session`/`account` `modelName`/`fields` mapping in
`authOptions()` and in the consumer query.

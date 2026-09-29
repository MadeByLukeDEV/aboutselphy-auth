# auth.aboutselphy.com

Central login for aboutselphy: one account per person, whatever platform
they sign in with.

- **Staff** (social.aboutselphy.com admin, aboutselphy.com/admin, the Discord
  bot dashboard) sign in with **Discord**. The role comes from their roles
  on the Discord server.
- **Viewers** (Viewer Dashboard) sign in with **Discord, Twitch or
  YouTube**, then connect the other platforms to the same account.

One sign-in sets a session cookie on `.aboutselphy.com`, which every app
validates directly against Postgres.

## How it works

1. A consuming app sends a signed-out user to the login page:
   - staff app: `https://auth.aboutselphy.com/login?redirect=<url>`
     (Discord only)
   - viewer app: `https://auth.aboutselphy.com/login?audience=viewer&redirect=<url>`
     (Discord, Twitch, YouTube)
2. **No duplicate accounts.** Every provider has `disableImplicitSignUp`,
   so an unknown platform account is never silently turned into a new user:
   - If its **verified** email matches an existing account (whose email is
     also verified), it's linked to that account automatically.
   - Otherwise `/login` asks: *"Used aboutselphy before? Sign in with that
     platform and we'll connect this one"* or *"New here? Create account"*.
     Only the explicit "Create account" makes a new user
     (`requestSignUp`).
3. **Roles are per session.** The `session.create.before` hook in
   [src/lib/auth.ts](src/lib/auth.ts) stores `session.role` and
   `session.loginProvider`:
   - For a **Discord** sign-in it fetches the member record on
     `DISCORD_GUILD_ID` with the user's own token and maps role IDs to
     `admin` / `moderator`, otherwise `viewer`. See
     [src/lib/discord-roles.ts](src/lib/discord-roles.ts).
   - A Twitch or YouTube sign-in is always `viewer`, even for a mod, so staff
     access always comes from a fresh Discord check.
   - If Discord can't be reached, the session falls back to `viewer`.
4. The session cookie (`__Secure-better-auth.session_token`,
   `Domain=aboutselphy.com; Secure; HttpOnly; SameSite=Lax`) is set and the
   user is redirected back. The redirect target is limited to
   `TRUSTED_ORIGINS`.
5. The consuming app validates the cookie with
   [consumer/validate-session.ts](consumer/validate-session.ts). The helper
   checks the HMAC signature with the shared `BETTER_AUTH_SECRET`, then looks
   the session up in the `auth` schema.

Role changes on Discord take effect at the user's **next Discord sign-in**
(sessions last 7 days). To lock someone out immediately, revoke their
sessions or ban them with the admin plugin's endpoints (`/api/auth/admin/*`).

**YouTube** is Google OAuth with the `youtube.readonly` scope.
[src/lib/youtube.ts](src/lib/youtube.ts) reads the user's channel, so the
account's `accountId` is the **YouTube channel ID**, and the name and avatar
come from the channel. A Google account without a channel can't sign in.
Google shows an "unverified app" warning and caps the app at 100 users until
it passes Google's OAuth verification.

## Routes

| Route | Purpose |
| --- | --- |
| `/login?redirect=[&audience=viewer]` | Provider picker: Discord only for staff; Discord/Twitch/YouTube for viewers. Skips straight through if already signed in with the needed access. Shows the "link or create" choice for unknown accounts, and `?error=` inline |
| `/account?redirect=[&audience=viewer][&connect=<provider>]` | Connected platforms: connect or disconnect Discord/Twitch/YouTube for the signed-in user. `connect=` highlights one provider (used after "sign in with X, then connect Y") |
| `POST /api/sign-out` | One-click sign-out for consuming apps: a form POST with a `redirect` field. Clears the session and 303s back. Only accepts an `Origin` in `TRUSTED_ORIGINS` |
| `/logout?redirect=` | Confirmation page for direct visits; redirects immediately if already signed out |
| `/` | `/account` when signed in, otherwise the viewer login |
| `/error?error=` | Fallback for errors outside a sign-in attempt |
| `/api/auth/*` | BetterAuth handler (OAuth callbacks: `/api/auth/callback/{discord,twitch,google}`) |
| `/api/health` | Health check for Dokploy (checks the Postgres connection) |

Providers are listed in [src/lib/providers.ts](src/lib/providers.ts). A
provider only appears as usable once its client ID and secret env vars are
set; until then it shows as "Soon".

## Setup

```sh
pnpm install
cp .env.example .env        # DATABASE_URL, Discord app + guild/role IDs, optional Twitch/Google apps
pnpm db:migrate --dry-run   # review the SQL
pnpm db:migrate             # creates/updates schema "auth"
pnpm dev
```

OAuth redirect URIs to register, one per provider:

- Discord (developer portal → OAuth2 → Redirects):
  `${BETTER_AUTH_URL}/api/auth/callback/discord`. For role IDs, turn on
  Discord Developer Mode, then right-click a role and choose
  **Copy Role ID**.
- Twitch (dev.twitch.tv/console → your app):
  `${BETTER_AUTH_URL}/api/auth/callback/twitch`
- Google/YouTube (Google Cloud console):
  1. Enable **YouTube Data API v3**.
  2. Add the scope `.../auth/youtube.readonly` to the OAuth consent screen.
  3. On the Web OAuth client, add the redirect
     `${BETTER_AUTH_URL}/api/auth/callback/google`.

## Deployment (Dokploy)

- Build from the `Dockerfile`. It uses `output: "standalone"` and runs
  `node server.js` on port 3000.
- Domain: `auth.aboutselphy.com`, with a Traefik/Let's Encrypt cert. The
  `*.aboutselphy.com` wildcard route (the linktree) outranks a plain host
  rule by default, so the auth routers need an explicit `priority` (e.g.
  `1000`) in the app's Traefik config.
- Production env:
  - `BETTER_AUTH_URL=https://auth.aboutselphy.com` (**https**; it's also the
    OAuth `redirect_uri`)
  - `COOKIE_DOMAIN=aboutselphy.com`
  - `DEFAULT_REDIRECT_URL=<main app URL>`
  - the Twitch/Google credentials once those apps exist
- Health check path: `/api/health`.
- Migrations don't run on boot. Run `pnpm db:migrate` from a checkout pointed
  at production *before* deploying code that needs new columns.

## Integrating a consuming app

1. Copy `consumer/validate-session.ts` into the app (it needs only `pg`).
2. Set `AUTH_DATABASE_URL`, `AUTH_DATABASE_SCHEMA=auth`,
   `BETTER_AUTH_SECRET` (the same value as this service) and
   `AUTH_COOKIE_PREFIX`.
3. In `proxy.ts` or a server component:
   ```ts
   // Staff app: only Discord sessions with a mod/admin role
   const session = await validateSession(request.headers.get("cookie"));
   if (!session) return NextResponse.redirect(
     `https://auth.aboutselphy.com/login?redirect=${encodeURIComponent(url)}`);

   // Viewer app: anyone signed in
   const viewer = await validateSession(cookieHeader, { audience: "viewer" });
   if (!viewer) return NextResponse.redirect(
     `https://auth.aboutselphy.com/login?audience=viewer&redirect=${encodeURIComponent(url)}`);
   const platforms = await linkedAccounts(viewer.user.id);
   // [{ providerId: "twitch", accountId: "<twitch user id>" }, { providerId: "google", accountId: "<youtube channel id>" }]
   ```
   To let viewers connect more platforms, link to
   `https://auth.aboutselphy.com/account?audience=viewer&redirect=<url>`.
   You can add `&connect=twitch` to highlight one platform.
4. For sign-out, use a form POST, not a link:
   ```html
   <form method="post" action="https://auth.aboutselphy.com/api/sign-out">
     <input type="hidden" name="redirect" value="https://<app url>" />
     <button type="submit">Sign out</button>
   </form>
   ```
   Add the app's origin to `TRUSTED_ORIGINS`, including its localhost dev
   origin (e.g. `http://localhost:3001`). Otherwise sign-out returns 403 and
   post-login redirects fall back to `DEFAULT_REDIRECT_URL`.

The Postgres user a consuming app connects with only needs `SELECT` on
`auth.session`, `auth."user"` and, for `linkedAccounts`, `auth.account`.

## Migrating the Discord bot dashboard (Requirement 5)

The goal is that existing users and sessions survive the switch. The session
cookie only stays valid if the cookie name, signing secret and session rows
are all unchanged:

1. **Reuse the dashboard's secret.** Set `BETTER_AUTH_SECRET` here to the
   dashboard's current value.
2. **Reuse its tables.** Set `DATABASE_SCHEMA` to the schema that holds the
   dashboard's BetterAuth tables. Run `pnpm db:migrate --dry-run` first: it
   should only add columns (admin plugin fields, `session.role`,
   `session.loginProvider`), never recreate tables.
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

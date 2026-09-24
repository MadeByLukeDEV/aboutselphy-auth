import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/lib/db";
import { ROLE_CHECK_FAILED } from "@/lib/discord-roles";
import { listEnv } from "@/lib/env";
import { findProvider } from "@/lib/providers";
import { ADMIN_ROLE, type StaffRole } from "@/lib/roles";

/**
 * Highest staff role across every login method linked to the user (only
 * Discord today; Twitch/YouTube slot in via LOGIN_PROVIDERS). Rethrows the
 * last provider error -- e.g. not_staff -- if none of them grants access.
 */
async function resolveStaffRole(accounts: { providerId: string; accessToken?: string | null }[]) {
  let role: StaffRole | null = null;
  let lastError: unknown = new APIError("FORBIDDEN", { code: ROLE_CHECK_FAILED, message: "No supported login linked" });

  for (const account of accounts) {
    const resolveRole = findProvider(account.providerId)?.resolveRole;
    if (!resolveRole || !account.accessToken) continue;
    try {
      role = await resolveRole(account.accessToken);
      if (role === ADMIN_ROLE) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!role) throw lastError;
  return role;
}

// Shared by the running app and scripts/migrate.ts so the migration plan
// always matches the live schema (admin plugin fields included).
export function authOptions() {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  return {
    appName: "aboutselphy",
    database: getPool(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: listEnv("TRUSTED_ORIGINS"),

    // Discord is the only way in -- staff are exactly the people holding the
    // mod/admin roles on the Discord server, so there's no separate account
    // list to maintain here.
    emailAndPassword: { enabled: false },
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID ?? "",
        clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
        scope: ["guilds.members.read"],
      },
    },

    databaseHooks: {
      session: {
        create: {
          // Every login re-derives the role from the provider (Discord server
          // roles today), so granting or removing a role takes effect on the
          // user's next sign-in. Throwing here aborts the OAuth callback
          // before any cookie is set; BetterAuth redirects to the sign-in
          // request's errorCallbackURL (/login?error=<code>) instead.
          before: async (session, ctx) => {
            if (!ctx) throw new APIError("INTERNAL_SERVER_ERROR", { code: ROLE_CHECK_FAILED });
            const accounts = await ctx.context.internalAdapter.findAccounts(session.userId);
            const role = await resolveStaffRole(accounts);
            await ctx.context.internalAdapter.updateUser(session.userId, { role });
          },
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // No cookieCache: consuming apps validate the session_token cookie
      // against Postgres directly, so there's only one cookie to agree on.
    },

    advanced: {
      cookiePrefix: process.env.COOKIE_PREFIX || "better-auth",
      // Domain=.aboutselphy.com in production: one Discord login covers every
      // *.aboutselphy.com admin surface. Unset in dev -> host-only cookie.
      crossSubDomainCookies: cookieDomain ? { enabled: true, domain: cookieDomain } : undefined,
      // Must match what every consuming app expects. Lax sends the cookie on
      // top-level navigations and on requests between *.aboutselphy.com
      // subdomains (same-site). Secure (+ __Secure- name prefix) is applied
      // automatically whenever BETTER_AUTH_URL is https.
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },

    onAPIError: {
      errorURL: "/error",
    },

    plugins: [
      // Supplies user.role / banned + admin endpoints (list/revoke sessions,
      // ban). Roles themselves are set by the session hook above.
      admin({ adminRoles: ["admin"] }),
      // Must stay last so Set-Cookie from server actions is applied.
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}

function createAuth() {
  return betterAuth(authOptions());
}

declare global {
  var _auth: ReturnType<typeof createAuth> | undefined;
}

// Constructed lazily for the same reason as the pg pool (no env at build time).
export function getAuth() {
  if (!globalThis._auth) globalThis._auth = createAuth();
  return globalThis._auth;
}

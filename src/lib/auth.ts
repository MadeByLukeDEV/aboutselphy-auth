import { betterAuth, type BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "@/lib/db";
import { fetchDiscordStaffRole } from "@/lib/discord-roles";
import { listEnv } from "@/lib/env";
import { credentials, findProvider, isConfigured } from "@/lib/providers";
import { VIEWER_ROLE, type Role } from "@/lib/roles";
import { youtubeUserInfo } from "@/lib/youtube";

type HookContext = {
  params?: Record<string, string | undefined>;
  context: {
    internalAdapter: {
      findAccounts(userId: string): Promise<{ providerId: string; accessToken?: string | null }[]>;
      updateUser(userId: string, data: Record<string, unknown>): Promise<unknown>;
    };
  };
};

/**
 * The role for a new session. Only a *Discord* sign-in can yield a staff
 * role (staff surfaces are Discord-only); Twitch/YouTube sessions are always
 * viewers, even for a mod -- they sign in with Discord for admin pages.
 *
 * user.role mirrors the last definitive Discord answer (admin plugin, info
 * only); consuming apps check the *session's* role. If Discord can't answer,
 * the session fails closed to "viewer" and user.role is left alone.
 */
async function sessionRole(userId: string, ctx: HookContext | null): Promise<Role> {
  // OAuth callback route is /callback/:id -> the provider this sign-in used.
  if (!ctx || ctx.params?.id !== "discord") return VIEWER_ROLE;

  const accounts = await ctx.context.internalAdapter.findAccounts(userId);
  const discord = accounts.find((account) => account.providerId === "discord");
  if (!discord?.accessToken) return VIEWER_ROLE;

  try {
    const role = (await fetchDiscordStaffRole(discord.accessToken)) ?? VIEWER_ROLE;
    await ctx.context.internalAdapter.updateUser(userId, { role });
    return role;
  } catch (error) {
    console.error("Discord role check failed; issuing a viewer session", error);
    return VIEWER_ROLE;
  }
}

// Shared by the running app and scripts/migrate.ts so the migration plan
// always matches the live schema (admin plugin + session.role included).
export function authOptions() {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const twitch = findProvider("twitch");
  const google = findProvider("google");

  return {
    appName: "aboutselphy",
    database: getPool(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: listEnv("TRUSTED_ORIGINS"),

    emailAndPassword: { enabled: false },

    // disableImplicitSignUp everywhere: an unknown platform account never
    // silently becomes a new user. The callback returns ?error=signup_disabled
    // instead, and /login asks "used another platform before? / new here?"
    // -- a new account only comes from an explicit requestSignUp.
    socialProviders: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID ?? "",
        clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
        scope: ["guilds.members.read"],
        disableImplicitSignUp: true,
      },
      ...(isConfigured(twitch) && {
        twitch: { ...credentials(twitch), disableImplicitSignUp: true },
      }),
      ...(isConfigured(google) && {
        // "YouTube" login: Google OAuth + youtube.readonly, keyed by channel.
        google: {
          ...credentials(google),
          scope: ["https://www.googleapis.com/auth/youtube.readonly"],
          prompt: "select_account" as const,
          getUserInfo: youtubeUserInfo,
          disableImplicitSignUp: true,
        },
      }),
    },

    account: {
      accountLinking: {
        enabled: true,
        // Signing in with a new platform whose *verified* email matches an
        // existing (verified) user links it automatically (BetterAuth's
        // default rule; no trustedProviders, so unverified emails never link).
        // Explicit linking from /account may use a different email -- the
        // user proves ownership by being signed in and completing the OAuth.
        allowDifferentEmails: true,
        // Keep the name/avatar from the first platform on link.
        updateUserInfoOnLink: false,
      },
    },

    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const hookCtx = ctx as HookContext | null;
            return {
              data: {
                ...session,
                role: await sessionRole(session.userId, hookCtx),
                loginProvider: hookCtx?.params?.id ?? null,
              },
            };
          },
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // No cookieCache: consuming apps validate the session_token cookie
      // against Postgres directly, so there's only one cookie to agree on.
      additionalFields: {
        // Per-session access level: "admin" | "moderator" (Discord sign-in
        // with a staff role) or "viewer". Consumers check this, not user.role,
        // so a Twitch/YouTube session never carries staff access.
        role: { type: "string", required: false, input: false },
        // Which platform this session signed in with ("discord" | "twitch" |
        // "google"), for messages like "admin pages need a Discord sign-in".
        loginProvider: { type: "string", required: false, input: false },
      },
    },

    advanced: {
      cookiePrefix: process.env.COOKIE_PREFIX || "better-auth",
      // Domain=.aboutselphy.com in production: one sign-in covers every
      // *.aboutselphy.com surface. Unset in dev -> host-only cookie.
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
      // ban). New users start as viewers.
      admin({ adminRoles: ["admin"], defaultRole: VIEWER_ROLE }),
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

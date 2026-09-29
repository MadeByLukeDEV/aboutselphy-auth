/**
 * Session validation for apps that consume auth.aboutselphy.com.
 *
 * Copy this file into the consuming app (it depends only on `pg`). It reads
 * the shared session cookie and validates it straight against the auth
 * service's tables in the shared Postgres instance -- no HTTP round-trip to
 * the auth service.
 *
 * Required env in the consuming app (same values as the auth service):
 *   AUTH_DATABASE_URL     connection string with read access to the schema
 *   AUTH_DATABASE_SCHEMA  default "auth"
 *   BETTER_AUTH_SECRET    verifies the cookie signature
 *   AUTH_COOKIE_PREFIX    default "better-auth"
 *
 * Staff apps (admin pages) -- only Discord sign-ins with a mod/admin role:
 *   const session = await validateSession(cookieHeader);
 *   if (!session) redirect(`https://auth.aboutselphy.com/login?redirect=${encodeURIComponent(url)}`);
 *
 * Viewer apps -- any signed-in user (Discord, Twitch or YouTube):
 *   const session = await validateSession(cookieHeader, { audience: "viewer" });
 *   if (!session) redirect(`https://auth.aboutselphy.com/login?audience=viewer&redirect=${encodeURIComponent(url)}`);
 *   const platforms = await linkedAccounts(session.user.id); // Twitch user ID, YouTube channel ID, ...
 *   // "Connect more platforms": https://auth.aboutselphy.com/account?audience=viewer&redirect=<url>
 *
 * Sign-out: a form POST to https://auth.aboutselphy.com/api/sign-out with a
 * hidden `redirect` field (the app's origin must be in TRUSTED_ORIGINS).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

export type Role = "admin" | "moderator" | "viewer";

export type AuthSession<R extends Role = Role> = {
  sessionId: string;
  expiresAt: Date;
  /** Platform this session signed in with ("discord" | "twitch" | "google"), null for older sessions. */
  loginProvider: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    /** This session's access level -- staff roles only come from a Discord sign-in. */
    role: R;
  };
};

export type StaffSession = AuthSession<"admin" | "moderator">;

export type LinkedAccount = {
  /** "discord" | "twitch" | "google" (YouTube). */
  providerId: string;
  /** Discord user ID, Twitch user ID, or YouTube channel ID. */
  accountId: string;
};

declare global {
  var _authSessionPool: Pool | undefined;
}

function pool() {
  const schema = process.env.AUTH_DATABASE_SCHEMA || "auth";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("Invalid AUTH_DATABASE_SCHEMA");
  globalThis._authSessionPool ??= new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    max: 3,
    options: `-c search_path=${schema}`,
  });
  return globalThis._authSessionPool;
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
}

/** Extracts the raw session token from BetterAuth's signed cookie ("<token>.<base64 HMAC-SHA256>"). */
export function sessionTokenFromCookies(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const prefix = process.env.AUTH_COOKIE_PREFIX || "better-auth";
  const raw =
    readCookie(cookieHeader, `__Secure-${prefix}.session_token`) ?? readCookie(cookieHeader, `${prefix}.session_token`);
  if (!raw) return null;

  const value = decodeURIComponent(raw);
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const token = value.slice(0, dot);
  const signature = Buffer.from(value.slice(dot + 1), "base64");
  const expected = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(token).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  return token;
}

function isStaff(role: string | null | undefined): role is "admin" | "moderator" {
  return role === "admin" || role === "moderator";
}

/**
 * The session for this request, or null if signed out / expired / banned --
 * or, for the default "staff" audience, not a staff session.
 */
export async function validateSession(cookieHeader: string | null | undefined): Promise<StaffSession | null>;
export async function validateSession(
  cookieHeader: string | null | undefined,
  options: { audience: "viewer" },
): Promise<AuthSession | null>;
export async function validateSession(
  cookieHeader: string | null | undefined,
  options: { audience?: "staff" | "viewer" } = {},
): Promise<AuthSession | null> {
  const token = sessionTokenFromCookies(cookieHeader);
  if (!token) return null;

  // The session's own role; sessions from before per-session roles existed
  // (all Discord sign-ins) fall back to the user's Discord-derived role.
  const { rows } = await pool().query(
    `select s.id as "sessionId", s."expiresAt", s."loginProvider",
            coalesce(s.role, u.role, 'viewer') as role,
            u.id, u.name, u.email, u.image
       from "session" s
       join "user" u on u.id = s."userId"
      where s.token = $1
        and s."expiresAt" > now()
        and not (coalesce(u.banned, false) and (u."banExpires" is null or u."banExpires" > now()))`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  const role: Role = isStaff(row.role) ? row.role : "viewer";
  if (options.audience !== "viewer" && !isStaff(role)) return null;

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    loginProvider: row.loginProvider,
    user: { id: row.id, name: row.name, email: row.email, image: row.image, role },
  };
}

/** Platforms connected to a user (one row per provider). */
export async function linkedAccounts(userId: string): Promise<LinkedAccount[]> {
  const { rows } = await pool().query(
    `select "providerId", "accountId" from "account" where "userId" = $1 order by "createdAt"`,
    [userId],
  );
  return rows;
}

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
 * Usage (Next.js server component / route handler / proxy):
 *   const session = await validateSession(request.headers.get("cookie"));
 *   if (!session) redirect(`https://auth.aboutselphy.com/login?redirect=${encodeURIComponent(url)}`);
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";

export type StaffSession = {
  sessionId: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "admin" | "moderator";
  };
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

/** Returns the staff session for this request, or null if signed out / expired / banned / not staff. */
export async function validateSession(cookieHeader: string | null | undefined): Promise<StaffSession | null> {
  const token = sessionTokenFromCookies(cookieHeader);
  if (!token) return null;

  const { rows } = await pool().query(
    `select s.id as "sessionId", s."expiresAt", u.id, u.name, u.email, u.image, u.role
       from "session" s
       join "user" u on u.id = s."userId"
      where s.token = $1
        and s."expiresAt" > now()
        and not (coalesce(u.banned, false) and (u."banExpires" is null or u."banExpires" > now()))`,
    [token],
  );
  const row = rows[0];
  if (!row || (row.role !== "admin" && row.role !== "moderator")) return null;

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: { id: row.id, name: row.name, email: row.email, image: row.image, role: row.role },
  };
}

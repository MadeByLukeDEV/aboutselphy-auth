import { Pool } from "pg";
import { databaseSchema, requireEnv } from "@/lib/env";

declare global {
  var _authPool: Pool | undefined;
}

// Small pool: this service only handles login/logout traffic, and it shares
// the Postgres instance with everything else on the VPS.
export function getPool(): Pool {
  if (!globalThis._authPool) {
    globalThis._authPool = new Pool({
      connectionString: requireEnv("DATABASE_URL"),
      max: 5,
      idleTimeoutMillis: 30_000,
      // Own schema inside the shared database: every unqualified table name
      // BetterAuth uses ("user", "session", ...) resolves inside it.
      options: `-c search_path=${databaseSchema()}`,
    });
  }
  return globalThis._authPool;
}

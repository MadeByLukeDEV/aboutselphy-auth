// Read lazily (inside functions, never at module load): `next build` imports
// these modules while collecting page data, and the Docker build has no
// runtime env available.

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function listEnv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function databaseSchema(): string {
  const schema = process.env.DATABASE_SCHEMA || "auth";
  // Interpolated into a search_path option and a CREATE SCHEMA statement.
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error(`DATABASE_SCHEMA must be a plain lowercase identifier, got "${schema}"`);
  }
  return schema;
}

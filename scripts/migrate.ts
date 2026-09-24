// Creates/updates this service's tables in DATABASE_SCHEMA.
//
//   pnpm db:migrate --dry-run   # print the SQL, touch nothing
//   pnpm db:migrate             # apply it
//
// Deliberately a manual step, not run on container boot: once the Discord bot
// dashboard's existing auth tables are adopted (DATABASE_SCHEMA pointed at
// them), schema changes to those shared tables should be reviewed first.
import "dotenv/config";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { databaseSchema } from "@/lib/env";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const schema = databaseSchema();
  const pool = getPool();

  try {
    if (!dryRun) await pool.query(`create schema if not exists "${schema}"`);

    const { toBeCreated, toBeAdded, runMigrations, compileMigrations } = await getMigrations(authOptions());
    if (toBeCreated.length === 0 && toBeAdded.length === 0) {
      console.log(`Schema "${schema}" is up to date.`);
      return;
    }

    console.log(await compileMigrations());
    if (dryRun) {
      console.log("\n--dry-run: nothing applied.");
      return;
    }
    await runMigrations();
    console.log(`Applied to schema "${schema}".`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

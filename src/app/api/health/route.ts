import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dokploy health check: fails if the shared Postgres instance is unreachable,
// since no login can succeed without it.
export async function GET() {
  try {
    await getPool().query("select 1");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}

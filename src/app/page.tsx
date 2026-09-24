import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <h1>Signed in</h1>
      <p>
        {session.user.name} · {session.user.role ?? "no role"}
      </p>
      <Link className="button secondary" href="/logout">
        Sign out
      </Link>
    </>
  );
}

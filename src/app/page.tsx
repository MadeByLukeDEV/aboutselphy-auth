import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <header className="stack">
        <span className="eyebrow">aboutselphy staff</span>
        <h1>You&apos;re signed in</h1>
        <p>
          <strong>{session.user.name}</strong> · {session.user.role ?? "no role"}
        </p>
      </header>
      <form method="post" action="/api/sign-out">
        <button className="button secondary" type="submit">
          Sign out
        </button>
      </form>
    </>
  );
}

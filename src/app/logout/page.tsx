import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { safeRedirect } from "@/lib/redirect";

export const dynamic = "force-dynamic";

// Fallback for anyone opening /logout directly. Consuming apps POST straight
// to /api/sign-out instead (one click, no stop here). Sign-out itself stays a
// POST so a stray link or <img src> can't log staff out.
export default async function LogoutPage({ searchParams }: PageProps<"/logout">) {
  const { redirect: target } = await searchParams;
  const redirectTo = typeof target === "string" ? target : undefined;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(redirectTo ? safeRedirect(redirectTo) : "/login");

  return (
    <>
      <header className="stack">
        <span className="eyebrow">aboutselphy staff</span>
        <h1>Sign out</h1>
        <p>
          Signed in as <strong>{session.user.name}</strong>. This signs you out of every aboutselphy admin page
          at once.
        </p>
      </header>
      <form method="post" action="/api/sign-out">
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        <button className="button" type="submit">
          Sign out
        </button>
      </form>
    </>
  );
}

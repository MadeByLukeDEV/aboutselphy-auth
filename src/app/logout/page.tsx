import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { safeRedirect } from "@/lib/redirect";

async function signOut(formData: FormData) {
  "use server";
  await getAuth().api.signOut({ headers: await headers() });
  const target = formData.get("redirect")?.toString();
  redirect(target ? safeRedirect(target) : "/login");
}

// Sign-out is a POST (form) rather than a plain GET so a stray link or
// <img src> on another page can't log staff out.
export default async function LogoutPage({ searchParams }: PageProps<"/logout">) {
  const { redirect: target } = await searchParams;

  return (
    <>
      <h1>Sign out</h1>
      <p>This signs you out of every aboutselphy admin page at once.</p>
      <form action={signOut}>
        {typeof target === "string" && <input type="hidden" name="redirect" value={target} />}
        <button className="button" type="submit">
          Sign out
        </button>
      </form>
    </>
  );
}

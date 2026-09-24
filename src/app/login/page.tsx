import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { safeRedirect } from "@/lib/redirect";
import { isStaff } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function signInWithDiscord(formData: FormData) {
  "use server";
  const target = safeRedirect(formData.get("redirect")?.toString());
  const { url } = await getAuth().api.signInSocial({
    body: { provider: "discord", callbackURL: target, errorCallbackURL: "/error" },
    headers: await headers(),
  });
  if (!url) throw new Error("Discord sign-in did not return an authorization URL");
  redirect(url);
}

// Consuming apps send unauthenticated users to
//   https://auth.aboutselphy.com/login?redirect=<where they were going>
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { redirect: target } = await searchParams;
  const redirectTo = typeof target === "string" ? target : undefined;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session && isStaff(session.user.role)) redirect(safeRedirect(redirectTo));

  return (
    <>
      <h1>Staff sign-in</h1>
      <p>Sign in with the Discord account that holds your moderator or admin role on the aboutselphy server.</p>
      <form action={signInWithDiscord}>
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        <button className="button" type="submit">
          Continue with Discord
        </button>
      </form>
    </>
  );
}

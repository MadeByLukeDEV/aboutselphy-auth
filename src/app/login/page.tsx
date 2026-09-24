import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { findProvider, isAvailable, LOGIN_PROVIDERS } from "@/lib/providers";
import { destinationHost, safeRedirect } from "@/lib/redirect";
import { isStaff } from "@/lib/roles";
import { ProviderButtons } from "./provider-buttons";

export const dynamic = "force-dynamic";

function loginPath(redirectTo: string | undefined) {
  return redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login";
}

async function signIn(formData: FormData) {
  "use server";
  const provider = findProvider(formData.get("provider")?.toString());
  const redirectTo = formData.get("redirect")?.toString() || undefined;
  if (!isAvailable(provider)) redirect(loginPath(redirectTo));

  const { url } = await getAuth().api.signInSocial({
    body: {
      provider: provider.id,
      callbackURL: safeRedirect(redirectTo),
      // Role-check failures come back here as ?error=<code>, shown inline
      // above the buttons so retrying is one click.
      errorCallbackURL: loginPath(redirectTo),
    },
    headers: await headers(),
  });
  if (!url) throw new Error(`${provider.label} sign-in did not return an authorization URL`);
  redirect(url);
}

// Consuming apps send signed-out users to
//   https://auth.aboutselphy.com/login?redirect=<where they were going>
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { redirect: target, error } = await searchParams;
  const redirectTo = typeof target === "string" ? target : undefined;
  const destination = destinationHost(safeRedirect(redirectTo));

  // Already signed in (e.g. from another admin page): skip straight through.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session && isStaff(session.user.role) && !error) redirect(safeRedirect(redirectTo));

  const message = errorMessage(error);
  const providers = LOGIN_PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    icon: provider.icon,
    comingSoon: !isAvailable(provider),
  }));

  return (
    <>
      <header className="stack">
        <span className="eyebrow">aboutselphy staff</span>
        <h1>Sign in</h1>
        <p>
          {destination ? (
            <>
              to continue to <strong>{destination}</strong>
            </>
          ) : (
            "Choose how you want to sign in."
          )}
        </p>
      </header>

      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}

      <form action={signIn}>
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        <ProviderButtons providers={providers} />
      </form>

      <p className="fine-print">One sign-in covers every aboutselphy admin page. Access follows your moderator role.</p>
    </>
  );
}

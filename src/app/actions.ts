"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { getAuth } from "@/lib/auth";
import { findProvider, isConfigured, parseAudience, type LoginProvider } from "@/lib/providers";
import { safeRedirect } from "@/lib/redirect";
import { authPath, flowParams } from "@/lib/urls";

// Every sign-in / link / unlink button posts here. The clicked button's
// `choice` says what to do:
//   signin:<p>              sign in with an existing account
//   signup:<p>              explicitly create a new account (after "New here?")
//   signin-link:<p>:<other> sign in with <p>, then connect <other> on /account
//   link:<p>                connect <p> to the signed-in account
//   unlink:<accountRowId>   disconnect a platform
export async function authAction(formData: FormData) {
  const audience = parseAudience(formData.get("audience")?.toString());
  const redirectTo = formData.get("redirect")?.toString() || undefined;
  const flow = flowParams(redirectTo, audience);
  const [kind, first, second] = (formData.get("choice")?.toString() ?? "").split(":");

  if (kind === "unlink") return unlink(first, flow);

  const provider = findProvider(first);
  if (!isConfigured(provider)) redirect(authPath("/login", flow));

  if (kind === "link") return link(provider, flow);

  // After an OAuth sign-in: staff go back through /login, which lets staff
  // sessions straight through and explains anything else; viewers go straight
  // to where they were headed.
  let callbackURL = audience === "staff" ? authPath("/login", flow) : safeRedirect(redirectTo);
  if (kind === "signin-link") {
    const other = findProvider(second);
    if (isConfigured(other)) callbackURL = authPath("/account", { ...flow, connect: other.id });
  }

  const { url } = await getAuth().api.signInSocial({
    body: {
      provider: provider.id,
      callbackURL,
      // Unknown account -> ?error=signup_disabled&attempted=<p> -> /login asks
      // "used another platform before? / new here?".
      errorCallbackURL: authPath("/login", { ...flow, attempted: provider.id }),
      requestSignUp: kind === "signup",
    },
    headers: await headers(),
  });
  if (!url) throw new Error(`${provider.label} sign-in did not return an authorization URL`);
  redirect(url);
}

async function link(provider: LoginProvider, flow: Record<string, string | undefined | null>) {
  const { url } = await getAuth().api.linkSocialAccount({
    body: {
      provider: provider.id,
      callbackURL: authPath("/account", { ...flow, linked: provider.id }),
      errorCallbackURL: authPath("/account", { ...flow, attempted: provider.id }),
    },
    headers: await headers(),
  });
  redirect(url);
}

async function unlink(accountRowId: string | undefined, flow: Record<string, string | undefined | null>) {
  let error: string | undefined;
  try {
    await getAuth().api.unlinkAccount({ body: { accountId: accountRowId ?? "" }, headers: await headers() });
  } catch (e) {
    error = isAPIError(e) ? String(e.body?.code ?? "unlink_failed") : "unlink_failed";
  }
  redirect(authPath("/account", { ...flow, error, unlinked: error ? undefined : "1" }));
}

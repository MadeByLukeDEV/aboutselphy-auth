import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authAction } from "@/app/actions";
import { FlowFields } from "@/components/flow-fields";
import { ProviderButton } from "@/components/provider-button";
import { getAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { findProvider, isConfigured, LOGIN_PROVIDERS, parseAudience, type Audience } from "@/lib/providers";
import { destinationHost, safeRedirect } from "@/lib/redirect";
import { isStaff } from "@/lib/roles";
import { authPath, flowParams, stringParam } from "@/lib/urls";

export const dynamic = "force-dynamic";

// Consuming apps send signed-out users here:
//   staff  (default):  /login?redirect=<url>                   -> Discord only
//   viewer:            /login?audience=viewer&redirect=<url>   -> Discord, Twitch, YouTube
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const audience = parseAudience(params.audience);
  const redirectTo = stringParam(params.redirect);
  const error = stringParam(params.error);
  const attempted = findProvider(stringParam(params.attempted));
  const target = safeRedirect(redirectTo);

  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Signed in and allowed through: skip the page entirely.
  if (session && !error && (audience === "viewer" || isStaff(session.session.role))) redirect(target);

  const heading = (
    <header className="stack">
      <span className="eyebrow">{audience === "staff" ? "aboutselphy staff" : "aboutselphy"}</span>
      <h1>{error === "signup_disabled" && attempted ? `New ${attempted.label} account` : "Sign in"}</h1>
      <p>
        to continue to <strong>{destinationHost(target) || "aboutselphy"}</strong>
      </p>
    </header>
  );

  // An unknown platform account never silently becomes a new user: ask first.
  if (attempted && (error === "signup_disabled" || error === "account_not_linked")) {
    return (
      <>
        {heading}
        <LinkOrCreate
          attempted={attempted.id}
          canCreate={error === "signup_disabled"}
          audience={audience}
          redirectTo={redirectTo}
        />
      </>
    );
  }

  // Staff page, signed in but not with staff access (viewer session).
  if (session && audience === "staff" && !error) {
    const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
    const hasDiscord = accounts.some((account) => account.providerId === "discord");
    const signedInWith = findProvider(session.session.loginProvider)?.label;
    const discord = findProvider("discord")!;

    return (
      <>
        {heading}
        <p className="alert" role="status">
          {session.session.loginProvider === "discord"
            ? "Your Discord account doesn't have a moderator or admin role on the aboutselphy server."
            : `You're signed in${signedInWith ? ` with ${signedInWith}` : ""}. Admin pages need a Discord sign-in.`}
        </p>
        <form action={authAction}>
          <FlowFields redirectTo={redirectTo} audience={audience} />
          <div className="providers">
            <ProviderButton
              choice={`${hasDiscord ? "signin" : "link"}:discord`}
              label={hasDiscord ? "Continue with Discord" : "Connect Discord"}
              pendingLabel="Redirecting to Discord…"
              icon={discord.icon}
            />
          </div>
        </form>
        <SignOut returnTo={authPath("/login", flowParams(redirectTo, audience))} name={session.user.name} />
      </>
    );
  }

  const message = errorMessage(error, attempted?.label);
  return (
    <>
      {heading}
      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      <form action={authAction}>
        <FlowFields redirectTo={redirectTo} audience={audience} />
        <div className="providers">
          {LOGIN_PROVIDERS.filter((provider) => provider.audiences.includes(audience)).map((provider) => (
            <ProviderButton
              key={provider.id}
              choice={`signin:${provider.id}`}
              label={`Continue with ${provider.label}`}
              pendingLabel={`Redirecting to ${provider.label}…`}
              icon={provider.icon}
              disabled={!isConfigured(provider)}
              badge={isConfigured(provider) ? undefined : "Soon"}
            />
          ))}
        </div>
      </form>
      <p className="fine-print">
        {audience === "staff"
          ? "One sign-in covers every aboutselphy admin page. Access follows your moderator role on Discord."
          : "Sign in with any platform. You can connect the others to the same account afterwards."}
      </p>
    </>
  );
}

function LinkOrCreate({
  attempted,
  canCreate,
  audience,
  redirectTo,
}: {
  attempted: string;
  canCreate: boolean;
  audience: Audience;
  redirectTo?: string;
}) {
  const provider = findProvider(attempted)!;
  const others = LOGIN_PROVIDERS.filter((other) => other.id !== provider.id && isConfigured(other));

  return (
    <form action={authAction} className="stack-lg">
      <FlowFields redirectTo={redirectTo} audience={audience} />
      <p>
        {canCreate
          ? `We haven't seen this ${provider.label} account before.`
          : `An account with this email already exists, but it isn't verified, so we can't connect ${provider.label} to it automatically.`}
      </p>

      {others.length > 0 && (
        <section className="stack">
          <h2>Used aboutselphy before?</h2>
          <p>Sign in with the platform you used, and we&apos;ll connect {provider.label} to that account.</p>
          <div className="providers">
            {others.map((other) => (
              <ProviderButton
                key={other.id}
                choice={`signin-link:${other.id}:${provider.id}`}
                label={`Sign in with ${other.label}`}
                pendingLabel={`Redirecting to ${other.label}…`}
                icon={other.icon}
              />
            ))}
          </div>
        </section>
      )}

      {canCreate && (
        <section className="stack">
          <h2>New here?</h2>
          <div className="providers">
            <ProviderButton
              choice={`signup:${provider.id}`}
              label={`Create account with ${provider.label}`}
              pendingLabel={`Redirecting to ${provider.label}…`}
              icon={provider.icon}
            />
          </div>
        </section>
      )}
    </form>
  );
}

function SignOut({ returnTo, name }: { returnTo: string; name: string }) {
  return (
    <form method="post" action="/api/sign-out" className="inline-form">
      <input type="hidden" name="redirect" value={returnTo} />
      <span className="fine-print">Signed in as {name}.</span>
      <button type="submit" className="link-button">
        Sign out
      </button>
    </form>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authAction } from "@/app/actions";
import { FlowFields } from "@/components/flow-fields";
import { ProviderButton } from "@/components/provider-button";
import { getAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { findProvider, isConfigured, LOGIN_PROVIDERS, parseAudience } from "@/lib/providers";
import { destinationHost, safeRedirect } from "@/lib/redirect";
import { authPath, flowParams, stringParam } from "@/lib/urls";

export const dynamic = "force-dynamic";

// Connected platforms for the signed-in user. Apps link here to let people
// connect more platforms to the SAME account:
//   /account?redirect=<back to app>[&audience=viewer][&connect=twitch]
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const params = await searchParams;
  const audience = parseAudience(params.audience);
  const redirectTo = stringParam(params.redirect);
  const flow = flowParams(redirectTo, audience);

  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    const back = authPath("/account", { ...flow, connect: stringParam(params.connect) });
    redirect(authPath("/login", { ...flowParams(back, "viewer") }));
  }

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
  const linked = new Map(accounts.map((account) => [account.providerId, account]));
  const connect = findProvider(stringParam(params.connect));
  const justLinked = findProvider(stringParam(params.linked));
  const attempted = findProvider(stringParam(params.attempted));
  const message = errorMessage(stringParam(params.error), attempted?.label);
  const signedInWith = findProvider(session.session.loginProvider)?.label;

  return (
    <>
      <header className="stack">
        <span className="eyebrow">aboutselphy</span>
        <h1>Your account</h1>
        <p>
          <strong>{session.user.name}</strong>
          {signedInWith && <> · signed in with {signedInWith}</>}
        </p>
      </header>

      {message && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      {justLinked && linked.has(justLinked.id) && (
        <p className="notice" role="status">
          {justLinked.label} is now connected to your account.
        </p>
      )}
      {stringParam(params.unlinked) && (
        <p className="notice" role="status">
          Platform disconnected.
        </p>
      )}

      {connect && isConfigured(connect) && !linked.has(connect.id) && (
        <form action={authAction} className="callout stack">
          <FlowFields redirectTo={redirectTo} audience={audience} />
          <strong>Finish connecting {connect.label}</strong>
          <p>You&apos;re signed in. Connect {connect.label} so it signs you into this same account from now on.</p>
          <div className="providers">
            <ProviderButton
              choice={`link:${connect.id}`}
              label={`Connect ${connect.label}`}
              pendingLabel={`Redirecting to ${connect.label}…`}
              icon={connect.icon}
            />
          </div>
        </form>
      )}

      <form action={authAction} className="stack">
        <FlowFields redirectTo={redirectTo} audience={audience} />
        <h2>Connected platforms</h2>
        <ul className="platforms">
          {LOGIN_PROVIDERS.map((provider) => {
            const account = linked.get(provider.id);
            const configured = isConfigured(provider);
            return (
              <li key={provider.id} className="platform">
                <svg viewBox="0 0 24 24" aria-hidden className="provider-icon" style={{ fill: provider.icon.hex }}>
                  <path d={provider.icon.path} />
                </svg>
                <span className="platform-name">
                  {provider.label}
                  <small>{account ? "Connected" : configured ? "Not connected" : "Coming soon"}</small>
                </span>
                {account ? (
                  accounts.length > 1 && (
                    <ProviderButton
                      variant="compact"
                      choice={`unlink:${account.id}`}
                      label="Disconnect"
                      pendingLabel="Disconnecting…"
                    />
                  )
                ) : (
                  <ProviderButton
                    variant="compact"
                    choice={`link:${provider.id}`}
                    label="Connect"
                    pendingLabel="Redirecting…"
                    disabled={!configured}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </form>

      <div className="actions">
        {redirectTo && (
          <Link className="button" href={safeRedirect(redirectTo)}>
            Continue to {destinationHost(safeRedirect(redirectTo))}
          </Link>
        )}
        <form method="post" action="/api/sign-out">
          <input type="hidden" name="redirect" value={authPath("/login", flow)} />
          <button type="submit" className="button secondary">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

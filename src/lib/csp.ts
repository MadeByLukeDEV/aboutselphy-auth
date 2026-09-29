import { listEnv, requireEnv } from "@/lib/env";

// Content-Security-Policy, built per request with a fresh nonce (src/proxy.ts),
// same approach as the Main app. Every page renders per request (the root
// layout calls connection()), so Next can put the nonce on its scripts.
//
// Add an origin only together with the feature that needs it, and say why.

const isDev = process.env.NODE_ENV === "development";

// Where sign-in forms may end up. Browsers check form-action against the
// redirect after a native form submit too (no JS yet / JS off): the sign-in
// action 303s to the provider's consent page.
const OAUTH_ORIGINS = [
  "https://discord.com", // Discord OAuth (staff + viewers)
  "https://id.twitch.tv", // Twitch OAuth (viewers)
  "https://accounts.google.com", // Google OAuth for YouTube (viewers)
];

/** A plain origin (wildcard subdomains allowed), nothing CSP could misread. */
const ORIGIN = /^https?:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/i;

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildCsp(nonce: string): string {
  // Sign-out forms on this service 303 back to the app the user came from,
  // which is one of TRUSTED_ORIGINS -- so those count as form targets too.
  const trusted = listEnv("TRUSTED_ORIGINS").filter((origin) => ORIGIN.test(origin));
  const self = new URL(requireEnv("BETTER_AUTH_URL")).origin;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts loaded by a nonce'd script are trusted too
    // (Next's chunk loading). Dev needs 'unsafe-eval' for React's tooling.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Inline styles stay allowed: provider buttons set a --brand custom
    // property and icon fills through `style`. A nonce here would make
    // browsers ignore 'unsafe-inline'.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Provider icons are inline SVG; nothing loads external images.
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", self, ...OAUTH_ORIGINS, ...trusted],
    // The login page must never be framed (clickjacking).
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${[...new Set(values)].join(" ")}`,
  );
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

import { listEnv, requireEnv } from "@/lib/env";

function matches(pattern: string, origin: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^./]+");
  return new RegExp(`^${escaped}$`).test(origin);
}

/** This service's own origin plus TRUSTED_ORIGINS (wildcards allowed). */
export function isTrustedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  const trusted = [new URL(requireEnv("BETTER_AUTH_URL")).origin, ...listEnv("TRUSTED_ORIGINS")];
  return trusted.some((pattern) => matches(pattern, origin));
}

/**
 * Only allow redirects back to our own origins, so ?redirect= can't be
 * abused as an open redirect. Relative paths resolve against this service.
 */
export function safeRedirect(target: string | undefined | null): string {
  const fallback = requireEnv("DEFAULT_REDIRECT_URL");
  if (!target) return fallback;
  try {
    const url = new URL(target, requireEnv("BETTER_AUTH_URL"));
    return isTrustedOrigin(url.origin) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** Human-readable destination ("social.aboutselphy.com") for the login page. */
export function destinationHost(target: string): string {
  try {
    return new URL(target).host;
  } catch {
    return "";
  }
}

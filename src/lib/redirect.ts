import { listEnv, requireEnv } from "@/lib/env";

function matches(pattern: string, origin: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^./]+");
  return new RegExp(`^${escaped}$`).test(origin);
}

/**
 * Only allow post-login redirects back to our own origins (this service plus
 * TRUSTED_ORIGINS), so /login?redirect= can't be abused as an open redirect.
 */
export function safeRedirect(target: string | undefined | null): string {
  const fallback = requireEnv("DEFAULT_REDIRECT_URL");
  if (!target) return fallback;
  try {
    const self = requireEnv("BETTER_AUTH_URL");
    const url = new URL(target, self);
    const trusted = [new URL(self).origin, ...listEnv("TRUSTED_ORIGINS")];
    return trusted.some((pattern) => matches(pattern, url.origin)) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

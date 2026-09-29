import type { Audience } from "@/lib/providers";

type Params = Record<string, string | undefined | null>;

/** Relative URL on this service with only the params that are set. */
export function authPath(path: string, params: Params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Params every page/action carries along so the user ends up back where they started. */
export function flowParams(redirectTo: string | undefined, audience: Audience): Params {
  return { redirect: redirectTo, audience: audience === "viewer" ? "viewer" : undefined };
}

export function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

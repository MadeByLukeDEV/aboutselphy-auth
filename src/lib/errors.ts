import { NOT_IN_GUILD, NOT_STAFF, ROLE_CHECK_FAILED } from "@/lib/discord-roles";

// Codes arrive as ?error=<code> from BetterAuth's OAuth callback (our own
// APIError codes from the role check, or the provider's OAuth error).
const MESSAGES: Record<string, string> = {
  [NOT_STAFF]: "Your Discord account doesn't have a moderator or admin role on the aboutselphy server.",
  [NOT_IN_GUILD]: "Your Discord account isn't a member of the aboutselphy server.",
  [ROLE_CHECK_FAILED]: "We couldn't verify your roles. Please try again in a moment.",
  access_denied: "Sign-in was cancelled.",
  state_mismatch: "Your sign-in attempt expired. Please try again.",
  please_restart_the_process: "Your sign-in attempt expired. Please try again.",
};

export function errorMessage(code: string | string[] | undefined): string | null {
  if (typeof code !== "string" || !code) return null;
  return MESSAGES[code] ?? "Something went wrong while signing in. Please try again.";
}

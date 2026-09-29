// Codes arrive as ?error=<code> from BetterAuth's OAuth callback (sign-in or
// link), or from our own server actions (unlink). `platform` is the label of
// the provider the attempt was for, when known.
export function errorMessage(code: string | string[] | undefined, platform = "that platform"): string | null {
  if (typeof code !== "string" || !code) return null;

  switch (code) {
    case "access_denied":
      return "Sign-in was cancelled.";
    case "state_mismatch":
    case "state_not_found":
    case "please_restart_the_process":
      return "That sign-in attempt expired. Please try again.";
    case "account_already_linked_to_different_user":
      return `That ${platform} account is already connected to a different aboutselphy account.`;
    case "unable_to_link_account":
      return `Couldn't connect ${platform}: its email address isn't verified there. Verify it on ${platform} and try again.`;
    case "email_not_found":
      return `${platform} didn't share an email address, which we need to set up your account.`;
    case "unable_to_get_user_info":
      return platform === "YouTube"
        ? "We couldn't find a YouTube channel on that Google account. Pick the Google account (or brand account) that owns your channel."
        : `We couldn't read your ${platform} profile. Please try again.`;
    case "FAILED_TO_UNLINK_LAST_ACCOUNT":
      return "You can't disconnect your only sign-in method. Connect another platform first.";
    case "SESSION_NOT_FRESH":
      return "For your safety, sign in again before disconnecting a platform.";
    default:
      return "Something went wrong. Please try again.";
  }
}

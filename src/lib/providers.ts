import { discordIcon, twitchIcon, youtubeIcon, type BrandIcon } from "@/lib/brand-icons";

// Every login method. A provider only works once its OAuth app credentials
// are set (see .env.example); until then it's shown as "Soon".
//
// Audiences:
//   - staff  (social.aboutselphy.com, aboutselphy.com/admin): Discord only --
//     staff roles come from the Discord server, so only a Discord sign-in
//     yields a staff session.
//   - viewer (Viewer Dashboard): any provider; the others get linked to the
//     same account afterwards from /account.
export type ProviderId = "discord" | "twitch" | "google";
export type Audience = "staff" | "viewer";

export type LoginProvider = {
  id: ProviderId;
  /** What users see. YouTube sign-in goes through Google OAuth. */
  label: string;
  icon: BrandIcon;
  clientIdEnv: string;
  clientSecretEnv: string;
  audiences: Audience[];
};

export const LOGIN_PROVIDERS: LoginProvider[] = [
  {
    id: "discord",
    label: "Discord",
    icon: discordIcon,
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    audiences: ["staff", "viewer"],
  },
  {
    id: "twitch",
    label: "Twitch",
    icon: twitchIcon,
    clientIdEnv: "TWITCH_CLIENT_ID",
    clientSecretEnv: "TWITCH_CLIENT_SECRET",
    audiences: ["viewer"],
  },
  {
    id: "google",
    label: "YouTube",
    icon: youtubeIcon,
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    audiences: ["viewer"],
  },
];

export function findProvider(id: string | null | undefined) {
  return LOGIN_PROVIDERS.find((provider) => provider.id === id);
}

export function isConfigured(provider: LoginProvider | undefined): provider is LoginProvider {
  return !!provider && !!process.env[provider.clientIdEnv] && !!process.env[provider.clientSecretEnv];
}

export function credentials(provider: LoginProvider) {
  return {
    clientId: process.env[provider.clientIdEnv] ?? "",
    clientSecret: process.env[provider.clientSecretEnv] ?? "",
  };
}

export function parseAudience(value: string | string[] | undefined | null): Audience {
  return value === "viewer" ? "viewer" : "staff";
}

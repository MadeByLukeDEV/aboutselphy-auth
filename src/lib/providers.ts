import { discordIcon, twitchIcon, youtubeIcon, type BrandIcon } from "@/lib/brand-icons";
import { resolveDiscordStaffRole } from "@/lib/discord-roles";
import type { StaffRole } from "@/lib/roles";

// Every login method the /login page offers. Adding one (e.g. Twitch) means:
//   1. add its BetterAuth socialProviders entry in src/lib/auth.ts,
//   2. give it a `resolveRole` that maps the user's token to a staff role
//      (e.g. "is this Twitch user a mod of the channel?"),
//   3. flip `comingSoon` off.
export type LoginProvider = {
  id: "discord" | "twitch" | "google";
  label: string;
  icon: BrandIcon;
  /** Shown on the page but not clickable yet. */
  comingSoon?: boolean;
  /** Derives the staff role from this provider's OAuth access token; throws an APIError when the user isn't staff. */
  resolveRole?: (accessToken: string) => Promise<StaffRole>;
};

export const LOGIN_PROVIDERS: LoginProvider[] = [
  { id: "discord", label: "Discord", icon: discordIcon, resolveRole: resolveDiscordStaffRole },
  { id: "twitch", label: "Twitch", icon: twitchIcon, comingSoon: true },
  // YouTube sign-in goes through Google OAuth.
  { id: "google", label: "YouTube", icon: youtubeIcon, comingSoon: true },
];

export function findProvider(id: string | null | undefined) {
  return LOGIN_PROVIDERS.find((provider) => provider.id === id);
}

export function isAvailable(provider: LoginProvider | undefined): provider is LoginProvider {
  return !!provider && !provider.comingSoon && !!provider.resolveRole;
}

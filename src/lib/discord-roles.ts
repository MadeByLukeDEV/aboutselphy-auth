import { APIError } from "better-auth/api";
import { listEnv, requireEnv } from "@/lib/env";
import { ADMIN_ROLE, MODERATOR_ROLE, type StaffRole } from "@/lib/roles";

// Error codes surface as ?error=<code> on the /error page.
export const NOT_IN_GUILD = "not_in_guild";
export const NOT_STAFF = "not_staff";
export const ROLE_CHECK_FAILED = "role_check_failed";

type GuildMember = { roles: string[] };

/**
 * Resolves the signed-in user's access level from their roles on the Discord
 * server, using their own OAuth access token (`guilds.members.read` scope).
 * Throws an APIError -- which BetterAuth's OAuth callback turns into a
 * redirect to the error page -- when they aren't staff.
 */
export async function resolveDiscordStaffRole(accessToken: string): Promise<StaffRole> {
  const guildId = requireEnv("DISCORD_GUILD_ID");
  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new APIError("FORBIDDEN", { code: NOT_IN_GUILD, message: "Not a member of the Discord server" });
  }
  if (!res.ok) {
    console.error(`Discord member lookup failed: ${res.status} ${await res.text()}`);
    throw new APIError("BAD_GATEWAY", { code: ROLE_CHECK_FAILED, message: "Could not verify Discord roles" });
  }

  const member = (await res.json()) as GuildMember;
  const role = staffRoleFor(member.roles);
  if (!role) {
    throw new APIError("FORBIDDEN", { code: NOT_STAFF, message: "No moderator or admin role on the Discord server" });
  }
  return role;
}

export function staffRoleFor(memberRoleIds: string[]): StaffRole | null {
  const has = (ids: string[]) => ids.some((id) => memberRoleIds.includes(id));
  if (has(listEnv("DISCORD_ADMIN_ROLE_IDS"))) return ADMIN_ROLE;
  if (has(listEnv("DISCORD_MODERATOR_ROLE_IDS"))) return MODERATOR_ROLE;
  return null;
}

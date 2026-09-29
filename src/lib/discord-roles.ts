import { listEnv, requireEnv } from "@/lib/env";
import { ADMIN_ROLE, MODERATOR_ROLE, type StaffRole } from "@/lib/roles";

type GuildMember = { roles: string[] };

/** Discord couldn't answer (outage, expired token, rate limit) -- not a verdict. */
export class DiscordRoleCheckError extends Error {}

/**
 * The user's staff role from their roles on the Discord server, using their
 * own OAuth access token (`guilds.members.read` scope). Returns null when
 * they're definitively not staff (not a member, or no mod/admin role) and
 * throws DiscordRoleCheckError when Discord couldn't give an answer.
 */
export async function fetchDiscordStaffRole(accessToken: string): Promise<StaffRole | null> {
  const guildId = requireEnv("DISCORD_GUILD_ID");
  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 404) return null; // not a member of the server
  if (!res.ok) {
    throw new DiscordRoleCheckError(`Discord member lookup failed: ${res.status} ${await res.text()}`);
  }

  const member = (await res.json()) as GuildMember;
  return staffRoleFor(member.roles);
}

export function staffRoleFor(memberRoleIds: string[]): StaffRole | null {
  const has = (ids: string[]) => ids.some((id) => memberRoleIds.includes(id));
  if (has(listEnv("DISCORD_ADMIN_ROLE_IDS"))) return ADMIN_ROLE;
  if (has(listEnv("DISCORD_MODERATOR_ROLE_IDS"))) return MODERATOR_ROLE;
  return null;
}

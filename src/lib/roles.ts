// Access levels stored in user.role (BetterAuth admin plugin field). Derived
// from Discord server roles on every sign-in -- never edited by hand.
export const ADMIN_ROLE = "admin";
export const MODERATOR_ROLE = "moderator";

export type StaffRole = typeof ADMIN_ROLE | typeof MODERATOR_ROLE;

export function isStaff(role: string | null | undefined): role is StaffRole {
  return role === ADMIN_ROLE || role === MODERATOR_ROLE;
}

export function isAdmin(role: string | null | undefined) {
  return role === ADMIN_ROLE;
}

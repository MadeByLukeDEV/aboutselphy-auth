// Access levels. Staff roles are derived from Discord server roles and only
// ever granted to a session created by a *Discord* sign-in (see the
// session.create hook in src/lib/auth.ts); every other session is "viewer".
export const ADMIN_ROLE = "admin";
export const MODERATOR_ROLE = "moderator";
export const VIEWER_ROLE = "viewer";

export type StaffRole = typeof ADMIN_ROLE | typeof MODERATOR_ROLE;
export type Role = StaffRole | typeof VIEWER_ROLE;

export function isStaff(role: string | null | undefined): role is StaffRole {
  return role === ADMIN_ROLE || role === MODERATOR_ROLE;
}

export function isAdmin(role: string | null | undefined) {
  return role === ADMIN_ROLE;
}

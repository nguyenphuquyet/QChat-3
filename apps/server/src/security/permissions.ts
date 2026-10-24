/// Admin capabilities are split into sections. A full ADMIN can do everything
/// and manage privileges; a manager (`adminPermissions`) is limited to the
/// sections granted on their account. Permissions are stored on the user and
/// read on every request, so revoking access applies immediately.
export const ADMIN_SECTIONS = [
  "users",
  "miniapps",
  "reports",
  "feedback",
  "landing",
  "audit",
  "system",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export type Manager = { role: string; permissions: string[] };

export const isAdminSection = (value: string): value is AdminSection =>
  (ADMIN_SECTIONS as readonly string[]).includes(value);

/// A manager must have at least one section; otherwise the console stays shut.
export const isManager = (auth: Manager) =>
  auth.role === "ADMIN" || auth.permissions.length > 0;

export const canManage = (auth: Manager, section: AdminSection) =>
  auth.role === "ADMIN" || auth.permissions.includes(section);

/// Only a full administrator may change roles, grant or revoke management
/// sections, delete accounts or touch another administrator.
export const isFullAdmin = (auth: Manager) => auth.role === "ADMIN";

export function normalizePermissions(values: string[]) {
  return [...new Set(values)].filter(isAdminSection);
}

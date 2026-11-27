/**
 * Permission contract. A Mini App declares the permissions it needs in its
 * manifest; the host asks the user per Mini App and also respects the operating
 * system permission. Revocation takes effect immediately.
 */

export const PERMISSIONS_VERSION = 1 as const;

export const PERMISSIONS = [
  "camera",
  "photoLibrary",
  "microphone",
  "location",
  "clipboardRead",
  "clipboardWrite",
  "scanCode",
  "fileRead",
  "fileWrite",
  "network",
  "storage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions that are granted without a prompt because they are sandboxed. */
export const IMPLICIT_PERMISSIONS: readonly Permission[] = ["network", "storage"];

/** Permissions that always require a user prompt the first time. */
export const PROMPTED_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (permission) => !IMPLICIT_PERMISSIONS.includes(permission),
);

export const PERMISSION_STATES = ["granted", "denied", "prompt", "revoked", "unsupported"] as const;
export type PermissionState = (typeof PERMISSION_STATES)[number];

export interface PermissionRequest {
  permission: Permission;
  /** Human-readable reason shown in the host prompt. */
  reason: string;
}

export interface PermissionStatus {
  permission: Permission;
  state: PermissionState;
  /** True when the operating system also has to grant it. */
  systemGated: boolean;
}

/** OS-level permission names, distinct from Mini App permissions. */
export const SYSTEM_PERMISSIONS = ["android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.ACCESS_FINE_LOCATION"] as const;
export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * The manifest may only declare known permissions. Unknown names are a manifest
 * error, never ignored, so a package cannot smuggle a future capability.
 */
export function validateDeclaredPermissions(value: unknown): { ok: true; permissions: Permission[] } | { ok: false; unknown: string[] } {
  if (value === undefined) return { ok: true, permissions: [] };
  if (!Array.isArray(value)) return { ok: false, unknown: ["<not an array>"] };
  const unknown = value.filter((item) => !isPermission(item)).map((item) => String(item));
  if (unknown.length > 0) return { ok: false, unknown };
  const permissions = Array.from(new Set(value as Permission[]));
  return { ok: true, permissions };
}

/** Map a Mini App permission to the OS permission it needs, if any. */
export const SYSTEM_PERMISSION_FOR: Partial<Record<Permission, SystemPermission>> = {
  camera: "android.permission.CAMERA",
  microphone: "android.permission.RECORD_AUDIO",
  location: "android.permission.ACCESS_FINE_LOCATION",
};

import type { PermissionInfo } from "../types";

export const PERMISSIONS: PermissionInfo[] = [
  {
    id: "toast",
    label: "Toast",
    description: "Show short native messages with showToast().",
    tone: "violet",
  },
  {
    id: "storage",
    label: "Local storage",
    description: "Persist JSON values on this device, scoped to the app.",
    tone: "mint",
  },
  {
    id: "user.profile",
    label: "User profile",
    description: "Read the signed-in QChat profile and friend list.",
    tone: "amber",
  },
  {
    id: "media.choose",
    label: "Media picker",
    description: "Let the user choose an image from their gallery.",
    tone: "rose",
  },
  {
    id: "share",
    label: "Share sheet",
    description: "Open the native QChat share sheet.",
    tone: "violet",
  },
  {
    id: "qchat.api",
    label: "QChat API",
    description: "Read conversations through the host-mediated request API.",
    tone: "amber",
  },
  {
    id: "network",
    label: "Network",
    description: "Fetch HTTPS hosts explicitly declared by this app.",
    tone: "sky",
  },
];

export const ALL_PERMISSIONS = PERMISSIONS.map((permission) => permission.id);

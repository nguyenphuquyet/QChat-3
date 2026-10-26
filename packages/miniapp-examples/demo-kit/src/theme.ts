import type { Style } from "@mna/qchat";
import type { LogTone } from "./store.js";

/** One palette for the whole app, so no screen repeats a raw hex string. */
export const colors = {
  bg: "#f4f5f7",
  surface: "#ffffff",
  soft: "#eef0f3",
  ink: "#191919",
  muted: "#6b7280",
  line: "#e5e7eb",
  brand: "#07c160",
  blue: "#168fe5",
  violet: "#7970da",
  amber: "#e8a30c",
  red: "#e5484d",
} as const;

export const toneColors: Record<LogTone, string> = {
  info: colors.blue,
  success: colors.brand,
  warn: colors.amber,
  error: colors.red,
};

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Padding and gap shared by every tab body. */
export const screenPad: Style = { padding: 16, gap: 16 };

export const card: Style = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  padding: 14,
  gap: 10,
  boxShadow: { color: "#14000000", offsetX: 0, offsetY: 3, blurRadius: 12 },
};

export const heroCard: Style = {
  borderRadius: radius.lg,
  padding: 18,
  gap: 6,
  gradient: {
    type: "linear",
    angle: 135,
    stops: [
      { offset: 0, color: colors.brand },
      { offset: 1, color: "#0f7ad6" },
    ],
  },
};

export function chipStyle(active: boolean): Style {
  return {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: active ? colors.brand : colors.surface,
    borderWidth: 1,
    borderColor: active ? colors.brand : colors.line,
  };
}

export function chipTextStyle(active: boolean): Style {
  return { fontSize: 12, color: active ? "#ffffff" : colors.muted };
}

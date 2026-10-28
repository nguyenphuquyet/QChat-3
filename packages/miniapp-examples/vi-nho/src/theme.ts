import type { Style } from "@mna/qchat";

/**
 * Ví Nhỏ — bảng màu duy nhất của cả app: nền xanh xám rất nhạt, thẻ trắng và
 * đúng xanh `#0052D9` của TDesign làm màu thương hiệu. Mọi màu nhóm chi tiêu
 * sống trong `store.ts` vì nó gắn với dữ liệu; ở đây chỉ có màu nền, chữ và
 * các sắc thái trạng thái dùng chung.
 */
export const colors = {
  bg: "#f2f5fa",
  surface: "#ffffff",
  soft: "#eef2f8",
  line: "#e3e8f0",
  ink: "#1d2129",
  muted: "#86909c",
  brand: "#0052d9",
  brandDeep: "#003ba3",
  brandSoft: "#e8f1ff",
  success: "#2ba471",
  successSoft: "#e8f8f0",
  warning: "#e37318",
  warningSoft: "#fdf2e8",
  danger: "#d54941",
  dangerSoft: "#fdeceb",
  info: "#0052d9",
  infoSoft: "#e8f1ff",
  neutral: "#86909c",
  neutralSoft: "#f2f3f5",
  white: "#ffffff",
} as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

/** Thẻ nền dùng chung: một chỗ sửa bóng, viền và bán kính. */
export const card: Style = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  padding: 14,
  gap: 10,
  borderWidth: 1,
  borderColor: colors.line,
};

/** Thân một màn hình: cùng lề và khoảng cách. */
export const screenPad: Style = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 30,
  gap: 14,
};

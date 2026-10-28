import type { Style } from "@mna/qchat";

/**
 * Sổ Việc — một bảng màu giấy ấm cho cả app: nền giấy, thẻ trắng, một xanh
 * rêu làm màu thương hiệu và một chút gạch cho việc gấp. Không màn hình nào
 * lặp lại mã hex; mọi thứ đọc từ đây.
 */
export const colors = {
  bg: "#f7f5ef",
  surface: "#ffffff",
  soft: "#f0ede4",
  line: "#e4dfd2",
  ink: "#1e2430",
  muted: "#7b8296",
  brand: "#2f6d5c",
  brandSoft: "#e4f0ea",
  accent: "#c06a2b",
  accentSoft: "#f8ecdf",
  danger: "#b8442f",
  dangerSoft: "#fbe9e5",
  gold: "#a8801f",
  goldSoft: "#f6efd8",
  blue: "#39699e",
  blueSoft: "#e8f0f8",
  white: "#ffffff",
} as const;

export const radius = { sm: 10, md: 16, lg: 20, pill: 999 } as const;

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
  paddingBottom: 28,
  gap: 14,
};

/** Chấm ưu tiên trên mỗi dòng việc. */
export function priorityColor(priority: string): string {
  if (priority === "high") return colors.danger;
  if (priority === "low") return colors.muted;
  return colors.brand;
}

export function priorityLabel(priority: string): string {
  if (priority === "high") return "Gấp";
  if (priority === "low") return "Thư thả";
  return "Bình thường";
}

/** Nhóm việc: nền nhạt và chữ đậm cùng tông. */
export function projectTone(project: string): { bg: string; fg: string } {
  switch (project) {
    case "Công việc":
      return { bg: colors.blueSoft, fg: colors.blue };
    case "Học tập":
      return { bg: colors.goldSoft, fg: colors.gold };
    case "Sức khoẻ":
      return { bg: colors.accentSoft, fg: colors.accent };
    default:
      return { bg: colors.brandSoft, fg: colors.brand };
  }
}

/** Nền nhạt cho ô biểu tượng của một thói quen, suy ra từ màu của nó. */
export function habitSoft(habit: { color: string }): string {
  if (habit.color === colors.blue) return colors.blueSoft;
  if (habit.color === colors.accent) return colors.accentSoft;
  if (habit.color === colors.gold) return colors.goldSoft;
  return colors.brandSoft;
}

import type { Style } from "@mna/qchat";

/** Một bảng màu cho cả app: không màn hình nào lặp lại mã hex. */
export const colors = {
  bg: "#f7f2ea",
  surface: "#ffffff",
  soft: "#f1e7da",
  cream: "#fff8f0",
  ink: "#241a14",
  muted: "#8a7a6d",
  line: "#ecdfd1",
  brand: "#c2703d",
  brandDark: "#8f4d26",
  green: "#4f8a5b",
  amber: "#dfa23a",
  red: "#cf5348",
} as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Thẻ trắng dùng chung: một chỗ sửa bóng và bán kính. */
export const card: Style = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  padding: 14,
  gap: 10,
  boxShadow: {
    color: "#12000000",
    offsetX: 0,
    offsetY: 4,
    blurRadius: 14,
  },
};

/** Thân một tab: cùng padding và khoảng cách. */
export const screenPad: Style = { padding: 16, gap: 18 };

export function chipStyle(active: boolean): Style {
  return {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: active ? colors.brand : colors.surface,
    borderWidth: 1,
    borderColor: active ? colors.brand : colors.line,
  };
}

export function chipTextStyle(active: boolean): Style {
  return {
    fontSize: 12,
    fontWeight: active ? "600" : "normal",
    color: active ? "#ffffff" : colors.muted,
  };
}

/** Lớp phủ tối dần ở đáy ảnh bìa để chữ trắng luôn đọc được. */
export const heroFade: Style = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 190,
  gradient: {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#00140c08" },
      { offset: 1, color: "#cc140c08" },
    ],
  },
};

import type { Style } from "@mna/qchat";

/**
 * Một bảng màu duy nhất cho cả app: phòng chiếu tối, một điểm nhấn đỏ và một
 * chút vàng cho hạng vé VIP. Không màn hình nào lặp lại mã hex.
 */
export const colors = {
  bg: "#0b0d13",
  surface: "#151a24",
  soft: "#1e2431",
  line: "#2a3140",
  ink: "#f3f5fa",
  muted: "#8d95a8",
  brand: "#ff4d67",
  brandDark: "#c22c45",
  gold: "#f4b740",
  green: "#45c48a",
  blue: "#6c93ff",
  white: "#ffffff",
} as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

/** Thẻ nền dùng chung: một chỗ sửa bóng và bán kính. */
export const card: Style = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  padding: 14,
  gap: 10,
  borderWidth: 1,
  borderColor: colors.line,
};

/** Thân một tab: cùng padding và khoảng cách. */
export const screenPad: Style = { padding: 16, gap: 18 };

/** Bảng màu poster: mỗi phim lấy một cặp, không cần ảnh thật. */
const TONES: ReadonlyArray<readonly [string, string]> = [
  ["#3b1c5c", "#8a2f6d"],
  ["#10243d", "#2f6d8f"],
  ["#2a1206", "#a4461b"],
  ["#16281d", "#3f7a52"],
  ["#2b0f14", "#8f1d2c"],
  ["#1b1b3a", "#4a4a8f"],
  ["#0e2a2a", "#2b7a72"],
  ["#301a0c", "#b5762a"],
  ["#24102b", "#6d2f8f"],
  ["#101d2e", "#3b5a86"],
  ["#2d1b12", "#7a4b2a"],
  ["#1c1c1c", "#5c5c66"],
];

export function toneAt(index: number): readonly [string, string] {
  return TONES[Math.abs(index) % TONES.length];
}

/** Nền poster: gradient chéo, đủ tối để chữ trắng luôn đọc được. */
export function posterStyle(tone: readonly [string, string]): Style {
  return {
    gradient: {
      type: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: tone[1] },
        { offset: 1, color: tone[0] },
      ],
    },
  };
}

/** Lớp phủ tối dần ở đáy poster để tiêu đề nổi lên. */
export const posterFade: Style = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 210,
  gradient: {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#000b0d13" },
      { offset: 1, color: "#e60b0d13" },
    ],
  },
};

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
    color: active ? colors.white : colors.muted,
  };
}

/** Ghế: trống, đang chọn, đã bán, và ghế VIP (viền vàng). */
export function seatStyle(
  state: "free" | "picked" | "taken",
  vip: boolean,
): Style {
  const base: Style = {
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: vip ? colors.gold : colors.line,
  };
  if (state === "picked") {
    return {
      ...base,
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    };
  }
  if (state === "taken") {
    return {
      ...base,
      backgroundColor: "#0f131b",
      borderColor: "#1d2330",
      opacity: 0.7,
    };
  }
  return { ...base, backgroundColor: colors.soft };
}

export function seatTextStyle(
  state: "free" | "picked" | "taken",
): Style {
  return {
    fontSize: 10,
    fontWeight: "600",
    color:
      state === "picked"
        ? colors.white
        : state === "taken"
          ? "#4a5162"
          : colors.ink,
  };
}

import type { QappGradient, Style } from "@mna/qchat";

/**
 * Custom Kit owns every pixel: no `NavBar`, no `TabBar`, no `Button`. The
 * palette, the radii and the text styles therefore live here, and the accent is
 * passed down from the shell so Settings can re-skin the whole app at once.
 *
 * The surfaces are dark on purpose: a hand-drawn UI shows its shadows,
 * gradients and hairlines best against one flat background.
 */
export const palette = {
  bg: "#080c12",
  surface: "#101823",
  surfaceRaised: "#16212e",
  surfaceSoft: "#1b2734",
  line: "#233240",
  lineSoft: "#18232f",
  text: "#eef4fb",
  muted: "#8ea0b5",
  faint: "#5b6b7e",
  white: "#ffffff",
  mint: "#3ce3a5",
  blue: "#6a9bff",
  violet: "#b18cff",
  amber: "#ffc86b",
  rose: "#ff7d93",
} as const;

export interface Accent {
  key: string;
  label: string;
  /** Main colour: gradients, active labels, progress fills. */
  color: string;
  /** Darker partner so a gradient always has somewhere to go. */
  deep: string;
}

export const accents: Accent[] = [
  { key: "mint", label: "Mint", color: palette.mint, deep: "#12a678" },
  { key: "blue", label: "Blue", color: palette.blue, deep: "#3b64d8" },
  { key: "violet", label: "Violet", color: palette.violet, deep: "#7a4fe0" },
  { key: "amber", label: "Amber", color: palette.amber, deep: "#dd9a2e" },
];

export function accentByKey(key: string): Accent {
  return accents.find((entry) => entry.key === key) ?? accents[0];
}

/**
 * `#rrggbb` → `#aarrggbb`. The renderer parses eight-digit colours as
 * `Color(0xAARRGGBB)`, so the alpha comes first, not last like CSS.
 */
export function tint(hex: string, alpha: number): string {
  const byte = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${byte}${hex.replace("#", "")}`;
}

export function accentGradient(accent: Accent, angle = 135): QappGradient {
  return {
    type: "linear",
    angle,
    stops: [
      { offset: 0, color: accent.color },
      { offset: 1, color: accent.deep },
    ],
  };
}

function channels(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : clean.slice(-6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Blend two `#rrggbb` colours. `amount` 0 keeps `from`, 1 keeps `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  const t = Math.max(0, Math.min(1, amount));
  const parts = a.map((value, index) =>
    Math.round(value + (b[index] - value) * t)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${parts.join("")}`;
}

/**
 * Hero panels keep white text legible on every accent: the gradient starts on a
 * dark surface and only leans towards the accent, it never becomes the accent.
 */
export function heroGradient(accent: Accent, angle = 145): QappGradient {
  return {
    type: "linear",
    angle,
    stops: [
      { offset: 0, color: mix(palette.surfaceRaised, accent.deep, 0.32) },
      { offset: 1, color: mix(palette.bg, accent.deep, 0.7) },
    ],
  };
}

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22 } as const;

/** Every text style the kit uses. A screen never invents a font size. */
export const text: Record<
  "hero" | "title" | "subtitle" | "body" | "label" | "tiny" | "button",
  Style
> = {
  hero: {
    fontSize: 32,
    fontWeight: "bold",
    color: palette.text,
    letterSpacing: -0.8,
  },
  title: { fontSize: 15, fontWeight: "bold", color: palette.text },
  subtitle: { fontSize: 12.5, color: palette.muted },
  body: { fontSize: 13, color: palette.text },
  label: { fontSize: 11.5, color: palette.muted },
  tiny: { fontSize: 10, color: palette.faint, letterSpacing: 0.2 },
  button: { fontSize: 14, fontWeight: "bold" },
};

/** The default card: one rounded surface with a hairline instead of elevation. */
export const card: Style = {
  backgroundColor: palette.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.lineSoft,
  padding: space.lg,
  gap: space.md,
};

export function hairline(color: string = palette.lineSoft): Style {
  return { height: 1, backgroundColor: color };
}

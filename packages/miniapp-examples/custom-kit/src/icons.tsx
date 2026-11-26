import { CustomPaint, Stack } from "@mna/qchat/ui";
import { n, scalePath, starPath } from "./draw.js";

/**
 * Every icon in this kit is a path on a 24×24 grid, drawn by `CustomPaint`.
 * The host has no icon font and no Material glyphs, so the app ships its own
 * geometry. One entry becomes one painter; a new `M` inside a single string
 * closes the previous subpath, so shapes that must stay open get their own
 * entry and closed shapes can share one.
 */
export type GlyphName =
  | "home"
  | "trend"
  | "grid"
  | "sliders"
  | "bell"
  | "sparkle"
  | "check"
  | "close"
  | "plus"
  | "minus"
  | "chevron"
  | "star"
  | "heart"
  | "bolt"
  | "moon"
  | "shield"
  | "clock"
  | "search"
  | "arrowUp"
  | "person"
  | "lock"
  | "play"
  | "chat"
  | "calendar";

interface GlyphPart {
  d: string;
  mode: "stroke" | "fill";
}

const STAR = starPath(12, 12.4, 9.4, 4.1);

const GLYPHS: Record<GlyphName, GlyphPart[]> = {
  home: [
    {
      mode: "stroke",
      d: "M 3.4 11.2 L 12 4 L 20.6 11.2 L 18.1 11.2 L 18.1 20 L 13.8 20 L 13.8 14.6 L 10.2 14.6 L 10.2 20 L 5.9 20 L 5.9 11.2 Z",
    },
  ],
  trend: [
    { mode: "stroke", d: "M 3.4 16.6 L 9 11 L 12.6 14.6 L 20.2 6.4" },
    { mode: "stroke", d: "M 15 6.4 L 20.2 6.4 L 20.2 11.6" },
  ],
  grid: [
    {
      mode: "stroke",
      d: "M 3.6 3.6 L 10.4 3.6 L 10.4 10.4 L 3.6 10.4 Z M 13.6 3.6 L 20.4 3.6 L 20.4 10.4 L 13.6 10.4 Z M 3.6 13.6 L 10.4 13.6 L 10.4 20.4 L 3.6 20.4 Z M 13.6 13.6 L 20.4 13.6 L 20.4 20.4 L 13.6 20.4 Z",
    },
  ],
  sliders: [
    {
      mode: "stroke",
      d: "M 3.6 7 L 20.4 7 M 3.6 12 L 20.4 12 M 3.6 17 L 20.4 17",
    },
    {
      mode: "fill",
      d: "M 8.2 7 C 8.2 5.8 9 5 10.2 5 C 11.4 5 12.2 5.8 12.2 7 C 12.2 8.2 11.4 9 10.2 9 C 9 9 8.2 8.2 8.2 7 Z M 14.8 12 C 14.8 10.8 15.6 10 16.8 10 C 18 10 18.8 10.8 18.8 12 C 18.8 13.2 18 14 16.8 14 C 15.6 14 14.8 13.2 14.8 12 Z M 6.4 17 C 6.4 15.8 7.2 15 8.4 15 C 9.6 15 10.4 15.8 10.4 17 C 10.4 18.2 9.6 19 8.4 19 C 7.2 19 6.4 18.2 6.4 17 Z",
    },
  ],
  bell: [
    {
      mode: "stroke",
      d: "M 5.2 17.6 L 6.8 15.4 L 6.8 11.2 C 6.8 7.9 9 5.6 12 5.6 C 15 5.6 17.2 7.9 17.2 11.2 L 17.2 15.4 L 18.8 17.6 Z",
    },
    {
      mode: "stroke",
      d: "M 10.2 19.4 C 10.2 20.6 11 21.4 12 21.4 C 13 21.4 13.8 20.6 13.8 19.4",
    },
  ],
  sparkle: [
    {
      mode: "fill",
      d: "M 12 2.4 C 12.7 8 15.6 10.9 21.6 12 C 15.6 13.1 12.7 16 12 21.6 C 11.3 16 8.4 13.1 2.4 12 C 8.4 10.9 11.3 8 12 2.4 Z",
    },
  ],
  check: [{ mode: "stroke", d: "M 4.8 12.6 L 9.6 17.2 L 19.2 6.8" }],
  close: [{ mode: "stroke", d: "M 6 6 L 18 18 M 18 6 L 6 18" }],
  plus: [{ mode: "stroke", d: "M 12 5 L 12 19 M 5 12 L 19 12" }],
  minus: [{ mode: "stroke", d: "M 5 12 L 19 12" }],
  chevron: [{ mode: "stroke", d: "M 9.6 5.4 L 16.2 12 L 9.6 18.6" }],
  star: [{ mode: "fill", d: STAR }],
  heart: [
    {
      mode: "fill",
      d: "M 12 20.6 C 12 20.6 3.2 15.2 3.2 9.4 C 3.2 6.5 5.4 4.4 8.1 4.4 C 10 4.4 11.3 5.4 12 6.6 C 12.7 5.4 14 4.4 15.9 4.4 C 18.6 4.4 20.8 6.5 20.8 9.4 C 20.8 15.2 12 20.6 12 20.6 Z",
    },
  ],
  bolt: [
    {
      mode: "fill",
      d: "M 13.6 2.4 L 5.8 13.4 L 10.8 13.4 L 10 21.6 L 18.2 10.6 L 13.2 10.6 Z",
    },
  ],
  moon: [
    {
      mode: "fill",
      d: "M 16.2 3.6 C 11.2 5.2 8.2 8.8 8.2 12.4 C 8.2 16 11.2 19.6 16.2 21.2 C 11.6 17.9 10.4 15.3 10.4 12.4 C 10.4 9.5 11.6 6.9 16.2 3.6 Z",
    },
  ],
  shield: [
    {
      mode: "stroke",
      d: "M 12 3 L 20 5.9 L 20 11.6 C 20 16.4 16.6 19.9 12 21.4 C 7.4 19.9 4 16.4 4 11.6 L 4 5.9 Z",
    },
  ],
  clock: [
    {
      mode: "stroke",
      d: "M 12 3.6 C 16.6 3.6 20.4 7.4 20.4 12 C 20.4 16.6 16.6 20.4 12 20.4 C 7.4 20.4 3.6 16.6 3.6 12 C 3.6 7.4 7.4 3.6 12 3.6 Z",
    },
    { mode: "stroke", d: "M 12 7 L 12 12.4 L 15.8 14.6" },
  ],
  search: [
    {
      mode: "stroke",
      d: "M 10.6 4.2 C 14.1 4.2 17 7.1 17 10.6 C 17 14.1 14.1 17 10.6 17 C 7.1 17 4.2 14.1 4.2 10.6 C 4.2 7.1 7.1 4.2 10.6 4.2 Z M 15.3 15.3 L 20.2 20.2",
    },
  ],
  arrowUp: [{ mode: "stroke", d: "M 12 19 L 12 5 M 6.4 10.6 L 12 5 L 17.6 10.6" }],
  person: [
    {
      mode: "stroke",
      d: "M 8.2 8.4 C 8.2 6.3 9.9 4.6 12 4.6 C 14.1 4.6 15.8 6.3 15.8 8.4 C 15.8 10.5 14.1 12.2 12 12.2 C 9.9 12.2 8.2 10.5 8.2 8.4 Z",
    },
    {
      mode: "stroke",
      d: "M 4.5 20 C 4.5 16 7.9 13.8 12 13.8 C 16.1 13.8 19.5 16 19.5 20",
    },
  ],
  lock: [
    {
      mode: "stroke",
      d: "M 6.5 10.5 L 6.5 19.5 L 17.5 19.5 L 17.5 10.5 Z",
    },
    {
      mode: "stroke",
      d: "M 8.8 10.5 L 8.8 8 C 8.8 6.1 10.2 4.5 12 4.5 C 13.8 4.5 15.2 6.1 15.2 8 L 15.2 10.5",
    },
  ],
  play: [{ mode: "fill", d: "M 8 5 L 19 12 L 8 19 Z" }],
  chat: [
    {
      mode: "stroke",
      d: "M 4 5.5 L 20 5.5 L 20 16 L 12.5 16 L 8 20 L 8 16 L 4 16 Z",
    },
  ],
  calendar: [
    {
      mode: "stroke",
      d: "M 4 6.5 L 20 6.5 L 20 20 L 4 20 Z M 4 10.5 L 20 10.5 M 8.5 3.5 L 8.5 7.5 M 15.5 3.5 L 15.5 7.5",
    },
  ],
};

export const glyphNames = Object.keys(GLYPHS) as GlyphName[];

export function Glyph(props: {
  name: GlyphName;
  color: string;
  size?: number;
  weight?: number;
  opacity?: number;
}) {
  const size = props.size ?? 22;
  const scale = size / 24;
  const strokeWidth = (props.weight ?? 1.8) * scale;
  return (
    <Stack
      style={{
        width: size,
        height: size,
        opacity: props.opacity ?? 1,
      }}
    >
      {GLYPHS[props.name].map((part) => (
        <CustomPaint
          width={size}
          height={size}
          draw={
            part.mode === "fill"
              ? `fill:${props.color} ${scalePath(part.d, scale)}`
              : `stroke:${props.color} strokeWidth:${n(
                  strokeWidth,
                )} ${scalePath(part.d, scale)}`
          }
        />
      ))}
    </Stack>
  );
}

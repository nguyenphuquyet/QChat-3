// Translates a qapp `Style` into CSS. The host maps the same keys to Flutter,
// so the preview keeps the SDK's semantics: logical points, Flutter-ish flex,
// AARRGGBB hex and an absolute `lineHeight`.
import type { CSSProperties } from "react";
import type { QappGradient, QappShadow, QappStyle } from "./types";

export interface QappThemeColors {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  fill: string;
  brand: string;
}

export const LIGHT_THEME: QappThemeColors = {
  background: "#f2f5fa",
  surface: "#ffffff",
  ink: "#1d2129",
  muted: "#86909c",
  line: "#e5e6eb",
  fill: "#f2f3f5",
  brand: "#0f7b45",
};

export const DARK_THEME: QappThemeColors = {
  background: "#111315",
  surface: "#1b1e22",
  ink: "#f2f3f5",
  muted: "#8f959e",
  line: "#2b2f35",
  fill: "#22262b",
  brand: "#3ecf8e",
};

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff4d4f",
  green: "#0f7b45",
  blue: "#1677ff",
  grey: "#8f959e",
  gray: "#8f959e",
  orange: "#ff9a2e",
  purple: "#8b5cf6",
  yellow: "#fadb14",
  pink: "#f759ab",
};

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** `#abc`, `#aabbcc`, `#aarrggbb` (alpha first, like the host), `rgb()`, names. */
export function qappColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "transparent" || raw === "none") return undefined;
  if (raw.startsWith("#")) {
    let hex = raw.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((part) => `${part}${part}`)
        .join("");
    }
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 8) {
      // AARRGGBB on the wire, RRGGBBAA in CSS.
      const alpha = hex.slice(0, 2);
      return `#${hex.slice(2)}${alpha}`;
    }
    return undefined;
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(raw);
  if (rgb) {
    const parts = rgb[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      const channels = parts.slice(0, 3).map((part) => {
        const percent = part.endsWith("%");
        const parsed = Number(percent ? part.slice(0, -1) : part);
        if (!Number.isFinite(parsed)) return null;
        return Math.round(Math.min(255, Math.max(0, percent ? (parsed / 100) * 255 : parsed)));
      });
      if (channels.every((channel) => channel !== null)) {
        const alphaPart = parts[3];
        if (alphaPart === undefined) return `rgb(${channels.join(", ")})`;
        const parsedAlpha = Number(alphaPart.endsWith("%") ? Number(alphaPart.slice(0, -1)) / 100 : alphaPart);
        const alpha = Number.isFinite(parsedAlpha) ? Math.min(1, Math.max(0, parsedAlpha)) : 1;
        return `rgba(${channels.join(", ")}, ${alpha})`;
      }
    }
    return undefined;
  }
  return NAMED_COLORS[raw];
}

function dimension(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) return trimmed;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? `${parsed}px` : undefined;
  }
  const parsed = number(value);
  return parsed === undefined ? undefined : `${parsed}px`;
}

/** `padding`/`paddingHorizontal`/`paddingTop`: the most specific key wins. */
function edges(
  style: QappStyle,
  all: keyof QappStyle,
  horizontal: keyof QappStyle,
  vertical: keyof QappStyle,
  top: keyof QappStyle,
  right: keyof QappStyle,
  bottom: keyof QappStyle,
  left: keyof QappStyle,
): string | undefined {
  const fallback = number(style[all]);
  const h = number(style[horizontal]) ?? fallback;
  const v = number(style[vertical]) ?? fallback;
  const sides = [
    number(style[top]) ?? v,
    number(style[right]) ?? h,
    number(style[bottom]) ?? v,
    number(style[left]) ?? h,
  ];
  if (sides.every((side) => side === undefined)) return undefined;
  return sides.map((side) => `${side ?? 0}px`).join(" ");
}

function shadows(style: QappStyle, colors: QappThemeColors): string | undefined {
  const value = style.boxShadow;
  const list: QappShadow[] = Array.isArray(value) ? value : value ? [value] : [];
  const parts = list
    .map((entry) => {
      const color = qappColor(entry.color) ?? "rgba(0, 0, 0, 0.12)";
      return `${entry.offsetX ?? 0}px ${entry.offsetY ?? 0}px ${entry.blurRadius ?? 0}px ${entry.spreadRadius ?? 0}px ${color}`;
    })
    .join(", ");
  if (parts) return parts;
  if (style.shadow === true) {
    return `0 6px 18px rgba(0, 0, 0, ${colors === DARK_THEME ? 0.5 : 0.08})`;
  }
  const elevation = number(style.elevation);
  if (elevation && elevation > 0) {
    const blur = Math.round(elevation * 3);
    const offset = Math.max(1, Math.round(elevation / 2));
    return `0 ${offset}px ${blur}px rgba(0, 0, 0, ${Math.min(0.4, elevation / 40)})`;
  }
  return undefined;
}

function gradient(value: QappGradient | undefined): string | undefined {
  if (!value || !Array.isArray(value.stops)) return undefined;
  const stops = value.stops
    .map((stop) => {
      const color = qappColor(stop.color);
      if (!color) return null;
      const offset = Math.min(1, Math.max(0, number(stop.offset) ?? 0));
      return `${color} ${Math.round(offset * 100)}%`;
    })
    .filter((entry): entry is string => entry !== null);
  if (stops.length < 2) return undefined;
  if (value.type === "radial") {
    // Flutter's RadialGradient is centred and circular; `closest-side` keeps
    // the same look inside a rounded card.
    return `radial-gradient(circle at 50% 50%, ${stops.join(", ")})`;
  }
  // Same convention as the host: 0deg up, 90deg right, 180deg down.
  return `linear-gradient(${number(value.angle) ?? 180}deg, ${stops.join(", ")})`;
}

const JUSTIFY: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
  "flex-start": "flex-start",
  "flex-end": "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly",
};

const ALIGN: Record<string, CSSProperties["alignItems"]> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
  baseline: "baseline",
  "flex-start": "flex-start",
  "flex-end": "flex-end",
  auto: undefined as unknown as CSSProperties["alignItems"],
};

const TEXT_ALIGN: Record<string, CSSProperties["textAlign"]> = {
  left: "left",
  right: "right",
  center: "center",
  justify: "justify",
  start: "left",
  end: "right",
};

const DECORATION: Record<string, string> = {
  underline: "underline",
  lineThrough: "line-through",
  "line-through": "line-through",
  none: "none",
};

export function fontWeight(value: unknown): CSSProperties["fontWeight"] {
  if (typeof value === "number") return value >= 100 && value <= 900 ? value : 400;
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (/^[1-9]00$/.test(raw)) return Number(raw) as CSSProperties["fontWeight"];
  if (raw === "bold" || raw === "bolder") return 700;
  if (raw === "normal" || raw === "lighter") return 400;
  return undefined;
}

/**
 * Box properties for a container. `flex` only becomes a flex item when the
 * parent is a flex container, which CSS already handles, so a `View` without
 * `flex` keeps its natural size.
 */
export function boxStyle(
  style: QappStyle | undefined,
  colors: QappThemeColors,
): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  const direction =
    style.flexDirection === "row" || style.flexDirection === "row-reverse"
      ? "row"
      : "column";
  css.display = "flex";
  css.flexDirection =
    style.flexDirection === "row-reverse" || style.flexDirection === "column-reverse"
      ? (`${direction}-reverse` as CSSProperties["flexDirection"])
      : direction;
  if (style.flexWrap === "wrap" || style.flexWrap === "no-wrap" || style.flexWrap === "nowrap") {
    css.flexWrap = style.flexWrap === "wrap" ? "wrap" : "nowrap";
  }
  const justify = style.justifyContent ? JUSTIFY[String(style.justifyContent)] : undefined;
  if (justify) css.justifyContent = justify;
  const align = style.alignItems ? ALIGN[String(style.alignItems)] : undefined;
  if (align) css.alignItems = align;
  const alignSelf = style.alignSelf ? ALIGN[String(style.alignSelf)] : undefined;
  if (alignSelf) css.alignSelf = alignSelf;
  if (style.alignContent && JUSTIFY[String(style.alignContent)]) {
    css.alignContent = JUSTIFY[String(style.alignContent)];
  }

  const gap = number(style.gap);
  const rowGap = number(style.rowGap) ?? gap;
  const columnGap = number(style.columnGap) ?? gap;
  if (rowGap !== undefined) css.rowGap = `${rowGap}px`;
  if (columnGap !== undefined) css.columnGap = `${columnGap}px`;

  const padding = edges(
    style,
    "padding",
    "paddingHorizontal",
    "paddingVertical",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  );
  if (padding) css.padding = padding;
  const margin = edges(
    style,
    "margin",
    "marginHorizontal",
    "marginVertical",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
  );
  if (margin) css.margin = margin;

  const width = dimension(style.width);
  if (width) css.width = width;
  const height = dimension(style.height);
  if (height) css.height = height;
  const minWidth = number(style.minWidth);
  if (minWidth !== undefined) css.minWidth = `${minWidth}px`;
  const minHeight = number(style.minHeight);
  if (minHeight !== undefined) css.minHeight = `${minHeight}px`;
  const maxWidth = number(style.maxWidth);
  if (maxWidth !== undefined) css.maxWidth = `${maxWidth}px`;
  const maxHeight = number(style.maxHeight);
  if (maxHeight !== undefined) css.maxHeight = `${maxHeight}px`;
  if (style.aspectRatio !== undefined) css.aspectRatio = String(style.aspectRatio);

  const flex = number(style.flex);
  if (flex !== undefined) {
    css.flexGrow = number(style.flexGrow) ?? flex;
    css.flexShrink = number(style.flexShrink) ?? 1;
    css.flexBasis = style.flexBasis ? dimension(style.flexBasis) : 0;
    // Without this a tall column cannot shrink below its content, so a nested
    // scroller would overflow instead of scrolling.
    if (direction === "column") css.minHeight = 0;
    else css.minWidth = 0;
  } else {
    const grow = number(style.flexGrow);
    if (grow !== undefined) css.flexGrow = grow;
    const shrink = number(style.flexShrink);
    if (shrink !== undefined) css.flexShrink = shrink;
    if (style.flexBasis !== undefined) css.flexBasis = dimension(style.flexBasis);
  }

  if (style.position === "absolute") css.position = "absolute";
  else if (style.position === "relative") css.position = "relative";
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const value = number(style[side]);
    if (value !== undefined) css[side] = `${value}px`;
  }
  if (style.zIndex !== undefined) css.zIndex = style.zIndex;
  if (style.overflow) {
    css.overflow =
      style.overflow === "visible" ? "visible" : style.overflow === "clip" ? "hidden" : "hidden";
  }

  const background = qappColor(style.backgroundColor);
  const gradientCss = gradient(style.gradient);
  if (gradientCss) css.backgroundImage = gradientCss;
  if (background) css.backgroundColor = background;

  const radius = number(style.borderRadius);
  if (radius !== undefined) css.borderRadius = `${radius}px`;
  for (const corner of [
    ["borderTopLeftRadius", "borderTopLeftRadius"],
    ["borderTopRightRadius", "borderTopRightRadius"],
    ["borderBottomLeftRadius", "borderBottomLeftRadius"],
    ["borderBottomRightRadius", "borderBottomRightRadius"],
  ] as const) {
    const value = number(style[corner[0]]);
    if (value !== undefined) css[corner[1]] = `${value}px`;
  }

  const allWidth = number(style.borderWidth);
  const sides = [
    { key: "borderTopWidth", width: number(style.borderTopWidth), color: qappColor(style.borderTopColor) },
    { key: "borderRightWidth", width: number(style.borderRightWidth), color: qappColor(style.borderRightColor) },
    { key: "borderBottomWidth", width: number(style.borderBottomWidth), color: qappColor(style.borderBottomColor) },
    { key: "borderLeftWidth", width: number(style.borderLeftWidth), color: qappColor(style.borderLeftColor) },
  ] as const;
  const lineColor = qappColor(style.borderColor) ?? colors.line;
  for (const side of sides) {
    const width = side.width ?? allWidth;
    if (!width || width <= 0) continue;
    css[side.key] =
      `${width}px solid ${side.color ?? lineColor}` as unknown as CSSProperties[typeof side.key];
  }

  if (style.opacity !== undefined) css.opacity = Math.min(1, Math.max(0, style.opacity));

  const transform: string[] = [];
  const rotate = number(style.rotate);
  if (rotate) transform.push(`rotate(${rotate}deg)`);
  const scale = number(style.scale);
  if (scale !== undefined && scale !== 1) transform.push(`scale(${scale})`);
  const translateX = number(style.translateX);
  if (translateX) transform.push(`translateX(${translateX}px)`);
  const translateY = number(style.translateY);
  if (translateY) transform.push(`translateY(${translateY}px)`);
  if (transform.length) css.transform = transform.join(" ");

  const shadow = shadows(style, colors);
  if (shadow) css.boxShadow = shadow;
  return css;
}

/** Text runs are inline, so they only carry typography. */
export function textStyle(
  style: QappStyle | undefined,
  colors: QappThemeColors,
  fallbackSize = 15,
): CSSProperties {
  const css: CSSProperties = {};
  const size = number(style?.fontSize) ?? fallbackSize;
  css.fontSize = `${size}px`;
  css.color = qappColor(style?.color) ?? colors.ink;
  const weight = fontWeight(style?.fontWeight);
  if (weight !== undefined) css.fontWeight = weight;
  if (style?.fontStyle === "italic") css.fontStyle = "italic";
  if (style?.fontFamily) css.fontFamily = style.fontFamily;
  const lineHeight = number(style?.lineHeight);
  // The host stores `lineHeight` in points and divides by the font size, so the
  // preview must do the same instead of treating it as a multiplier.
  if (lineHeight !== undefined && size > 0) {
    css.lineHeight = `${lineHeight / size}`;
  }
  const letterSpacing = number(style?.letterSpacing);
  if (letterSpacing !== undefined) css.letterSpacing = `${letterSpacing}px`;
  if (style?.textAlign && TEXT_ALIGN[String(style.textAlign)]) {
    css.textAlign = TEXT_ALIGN[String(style.textAlign)];
  }
  if (style?.textDecoration && DECORATION[String(style.textDecoration)]) {
    css.textDecoration = DECORATION[String(style.textDecoration)];
  }
  if (style?.textTransform) {
    css.textTransform = String(style.textTransform) as CSSProperties["textTransform"];
  }
  if (style?.opacity !== undefined) css.opacity = Math.min(1, Math.max(0, style.opacity));
  return css;
}

/** Truncation that matches `numberOfLines` (ellipsis, single block). */
export function clampLines(lines: number | undefined): CSSProperties {
  if (!lines || lines < 1) return {};
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: String(Math.floor(lines)),
    overflow: "hidden",
  };
}

export function textContentStyle(style: QappStyle | undefined): CSSProperties {
  const align = style?.textAlign ? TEXT_ALIGN[String(style.textAlign)] : undefined;
  const css: CSSProperties = {};
  if (align) css.textAlign = align;
  return css;
}

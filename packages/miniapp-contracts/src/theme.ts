/**
 * Theme contract (specification section 4.4).
 *
 * The Mini App developer chooses how the app handles light and dark through
 * `qxColorScheme` in `app.json` (optionally overridden per page). Nothing else
 * decides it. The host never restyles a page and never sends host theme
 * information to a page that resolves to a fixed theme.
 */

export const THEME_VERSION = 1 as const;

/** The only accepted declaration values. No other value is a valid theme. */
export const COLOR_SCHEMES = ["light", "dark", "auto"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/** The resolved theme is always one of these two, never `auto`. */
export const RESOLVED_THEMES = ["light", "dark"] as const;
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

/** Default when neither `app.json` nor `page.json` declares anything. */
export const DEFAULT_COLOR_SCHEME: ColorScheme = "light";

/** The host's effective appearance, used only for `auto`. */
export type HostTheme = ResolvedTheme;

export interface ThemeDeclaration {
  app: ColorScheme;
  page?: ColorScheme;
}

export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && (COLOR_SCHEMES as readonly string[]).includes(value);
}

export function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return value === "light" || value === "dark";
}

/**
 * Resolve the theme of one page. A fixed declaration ignores the host. `auto`
 * follows the host's effective theme.
 */
export function resolveTheme(declaration: ThemeDeclaration, host: HostTheme): ResolvedTheme {
  const declared = declaration.page ?? declaration.app;
  if (declared === "light" || declared === "dark") return declared;
  return host;
}

/** True when the page follows the host and may receive host theme events. */
export function followsHost(declaration: ThemeDeclaration): boolean {
  return (declaration.page ?? declaration.app) === "auto";
}

/**
 * What the View Runtime writes on the page root. `color-scheme` is the CSS
 * property; `data-theme` is the attribute developer WXSS selects on.
 */
export interface ThemeRootValues {
  "data-theme": ResolvedTheme;
  colorScheme: ResolvedTheme;
}

export function themeRootValues(resolved: ResolvedTheme): ThemeRootValues {
  return { "data-theme": resolved, colorScheme: resolved };
}

/**
 * Host theme event. It is allowlisted, typed, and only delivered while the page
 * resolves to `auto`. It changes the page root values only: no reload, no lost
 * state, no new `onLoad`.
 */
export const HOST_THEME_EVENT = "host.themeChange" as const;

export interface HostThemeEventPayload {
  theme: HostTheme;
}

/**
 * Guard used by the host before sending a theme event. A fixed-theme page must
 * never receive one; violating this is `THEME_EVENT_FORBIDDEN`.
 */
export function maySendHostTheme(declaration: ThemeDeclaration): boolean {
  return followsHost(declaration);
}

/**
 * WeChat theme configuration keys that this runtime does not copy. The build
 * tool reports them with a documented error code instead of ignoring them.
 */
export const UNSUPPORTED_THEME_KEYS = ["darkmode", "themeLocation"] as const;
export const UNSUPPORTED_THEME_FILES = ["theme.json"] as const;

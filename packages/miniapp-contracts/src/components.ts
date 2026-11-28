/**
 * Component contract (specification section 7).
 *
 * Every in-page component is a web component drawn by the View Runtime. The
 * registry below is the single list the compiler, the renderer and the
 * compatibility matrix share.
 */

export const COMPONENTS_VERSION = 1 as const;

export const COMPONENT_PRIORITIES = ["P0", "P1", "P2"] as const;
export type ComponentPriority = (typeof COMPONENT_PRIORITIES)[number];

export const COMPONENT_STATUSES = ["Not started", "Supported", "Partial", "Unsupported", "Experimental"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];

export interface ComponentDefinition {
  /** WeChat component name, without the `wx-` prefix. */
  name: string;
  priority: ComponentPriority;
  status: ComponentStatus;
  /** Event names the component emits (WeChat `bind*` names). */
  events: readonly string[];
  /** Attributes/properties accepted by the component. */
  properties: readonly string[];
  /** True when the component is drawn inside the View Runtime WebView. */
  inPage: true;
}

export const COMPONENT_REGISTRY: readonly ComponentDefinition[] = [
  { name: "view", priority: "P0", status: "Not started", events: [], properties: ["hover-class", "hover-stop-propagation", "hover-start-time", "hover-stay-time"], inPage: true },
  { name: "text", priority: "P0", status: "Not started", events: [], properties: ["selectable", "space", "decode"], inPage: true },
  { name: "image", priority: "P0", status: "Not started", events: ["error", "load"], properties: ["src", "mode", "lazy-load", "show-menu-by-longpress"], inPage: true },
  { name: "button", priority: "P0", status: "Not started", events: ["tap", "longpress", "touchstart", "touchmove", "touchend"], properties: ["size", "type", "plain", "disabled", "loading", "form-type", "open-type", "hover-class"], inPage: true },
  { name: "input", priority: "P0", status: "Not started", events: ["input", "focus", "blur", "confirm", "keyboardheightchange"], properties: ["value", "type", "password", "placeholder", "disabled", "maxlength", "focus", "confirm-type"], inPage: true },
  { name: "scroll-view", priority: "P0", status: "Not started", events: ["scroll", "scrolltoupper", "scrolltolower"], properties: ["scroll-x", "scroll-y", "upper-threshold", "lower-threshold", "scroll-top", "scroll-left", "enhanced", "show-scrollbar"], inPage: true },
  { name: "textarea", priority: "P1", status: "Experimental", events: ["input", "focus", "blur", "confirm"], properties: ["value", "placeholder", "disabled", "maxlength", "auto-height", "fixed"], inPage: true },
  { name: "checkbox", priority: "P1", status: "Experimental", events: ["change"], properties: ["value", "checked", "disabled", "color"], inPage: true },
  { name: "checkbox-group", priority: "P1", status: "Experimental", events: ["change"], properties: [], inPage: true },
  { name: "radio", priority: "P1", status: "Experimental", events: ["change"], properties: ["value", "checked", "disabled", "color"], inPage: true },
  { name: "radio-group", priority: "P1", status: "Experimental", events: ["change"], properties: [], inPage: true },
  { name: "switch", priority: "P1", status: "Experimental", events: ["change"], properties: ["checked", "disabled", "type", "color"], inPage: true },
  { name: "slider", priority: "P1", status: "Experimental", events: ["change", "changing"], properties: ["value", "min", "max", "step", "disabled", "activeColor", "backgroundColor", "block-size"], inPage: true },
  { name: "picker", priority: "P1", status: "Partial", events: ["change", "cancel", "columnchange"], properties: ["mode", "range", "range-key", "value", "start", "end", "disabled"], inPage: true },
  { name: "form", priority: "P1", status: "Experimental", events: ["submit", "reset"], properties: ["report-submit"], inPage: true },
  { name: "swiper", priority: "P1", status: "Experimental", events: ["change", "transition", "animationfinish"], properties: ["indicator-dots", "indicator-color", "autoplay", "current", "interval", "duration", "circular", "vertical"], inPage: true },
  { name: "swiper-item", priority: "P1", status: "Experimental", events: [], properties: [], inPage: true },
  { name: "tab-bar", priority: "P1", status: "Experimental", events: ["change", "tap"], properties: ["items", "selected", "color", "selected-color", "background-color", "border-style"], inPage: true },
  { name: "video", priority: "P2", status: "Not started", events: ["play", "pause", "ended", "timeupdate", "error", "fullscreenchange"], properties: ["src", "controls", "autoplay", "loop", "muted", "poster", "object-fit"], inPage: true },
  { name: "canvas", priority: "P2", status: "Not started", events: ["touchstart", "touchmove", "touchend", "error"], properties: ["canvas-id", "type", "disable-scroll"], inPage: true },
  { name: "map", priority: "P2", status: "Not started", events: ["markertap", "regionchange", "tap"], properties: ["latitude", "longitude", "scale", "markers", "show-location"], inPage: true },
  { name: "camera", priority: "P2", status: "Not started", events: ["binderror", "bindstop", "bindinitdone", "bindscancode"], properties: ["mode", "device-position", "flash", "resolution"], inPage: true },
] as const;

/** Components that are drawn by the host, not the View Runtime. */
export const HOST_COMPONENTS = ["navigationBar", "tabBar", "capsule"] as const;

export function componentByName(name: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY.find((component) => component.name === name);
}

/** True when the component belongs to a priority the given milestone must ship. */
export function componentsForPriority(priority: ComponentPriority): ComponentDefinition[] {
  return COMPONENT_REGISTRY.filter((component) => component.priority === priority);
}

/** A build tool reports a component it does not implement, never ignores it. */
export function isImplementedComponent(name: string): boolean {
  const component = componentByName(name);
  return component !== undefined && component.status === "Supported";
}

/**
 * Runtime and lifecycle contract.
 *
 * The Service Runtime evaluates Mini App code in an isolated JavaScript engine.
 * It provides the global `App`, `Page` and `Component` registrations plus the
 * lifecycle callbacks below. A callback that the runtime does not implement is
 * never silently swallowed: the build tool or the runtime reports it.
 */

export const LIFECYCLE_VERSION = 1 as const;

/** Lifecycle of the app object (`App({...})`). */
export const APP_LIFECYCLE = ["onLaunch", "onShow", "onHide", "onError", "onUnhandledRejection"] as const;
export type AppLifecycle = (typeof APP_LIFECYCLE)[number];

/** Lifecycle of a page object (`Page({...})`). */
export const PAGE_LIFECYCLE = [
  "onLoad",
  "onShow",
  "onReady",
  "onHide",
  "onUnload",
  "onPullDownRefresh",
  "onReachBottom",
  "onPageScroll",
  "onResize",
  "onShareAppMessage",
  "onTabItemTap",
] as const;
export type PageLifecycle = (typeof PAGE_LIFECYCLE)[number];

/** Lifecycle of a custom component (`Component({...})`). */
export const COMPONENT_LIFECYCLE = [
  "created",
  "attached",
  "ready",
  "moved",
  "detached",
  "error",
] as const;
export type ComponentLifecycle = (typeof COMPONENT_LIFECYCLE)[number];

/** Lifecycle callbacks are options of App/Page/Component, never `wx.*` functions. */
export function isLifecycleName(name: string): name is AppLifecycle | PageLifecycle | ComponentLifecycle {
  return (
    (APP_LIFECYCLE as readonly string[]).includes(name) ||
    (PAGE_LIFECYCLE as readonly string[]).includes(name) ||
    (COMPONENT_LIFECYCLE as readonly string[]).includes(name)
  );
}

/**
 * App-level states. The host moves an app through these states; a transition
 * that is not listed is invalid and must be reported, not forced.
 */
export const APP_STATES = ["created", "launching", "running", "hidden", "closing", "closed", "crashed"] as const;
export type AppState = (typeof APP_STATES)[number];

const APP_TRANSITIONS: Record<AppState, readonly AppState[]> = {
  created: ["launching", "closing"],
  launching: ["running", "crashed", "closing"],
  running: ["hidden", "closing", "crashed"],
  hidden: ["running", "closing", "crashed"],
  closing: ["closed"],
  closed: [],
  crashed: ["closing", "closed"],
};

export function canTransitionApp(from: AppState, to: AppState): boolean {
  return APP_TRANSITIONS[from].includes(to);
}

/** Page-level states, per page in the stack. */
export const PAGE_STATES = ["created", "loading", "ready", "hidden", "unloaded"] as const;
export type PageState = (typeof PAGE_STATES)[number];

const PAGE_TRANSITIONS: Record<PageState, readonly PageState[]> = {
  created: ["loading"],
  loading: ["ready", "unloaded"],
  ready: ["hidden", "unloaded"],
  hidden: ["ready", "unloaded"],
  unloaded: [],
};

export function canTransitionPage(from: PageState, to: PageState): boolean {
  return PAGE_TRANSITIONS[from].includes(to);
}

/**
 * A page instance identity. `pageId` is allocated by the host, never by the
 * package, and is part of every bridge message binding.
 */
export interface PageInstance {
  pageId: string;
  route: string;
  state: PageState;
  /** Index in `getCurrentPages()`; 0 is the bottom of the stack. */
  index: number;
}

/** The service runtime's view of the app it is hosting. */
export interface RuntimeIdentity {
  appId: string;
  appVersion: string;
  sessionId: string;
  runtimeVersion: string;
  baseLibraryVersion: string;
}

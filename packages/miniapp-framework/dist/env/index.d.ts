/**
 * The QChat JavaScript environment.
 *
 * QuickJS provides ECMAScript only: no timers, no `console`, no `Intl`, no
 * `URL`, no `TextEncoder`, no `AbortController` and no `structuredClone`. Import
 * this module and call `installEnv()`, or import `@mna/qchat/env/auto` for the
 * one-line version. Nothing here has a top-level side effect, so a bundle only
 * contains the pieces the app actually installs.
 */
import { type QappLocale } from "./intl.js";
import { type QappTimerQueue, type QappTimerScheduler } from "./timers.js";
export * from "./abort.js";
export * from "./clone.js";
export * from "./console.js";
export * from "./encoding.js";
export * from "./intl.js";
export * from "./timers.js";
export * from "./url.js";
export interface InstallEnvOptions {
    /** Locale used when the app does not pass one to `Intl`; defaults to `en-US`. */
    locale?: QappLocale;
    /** Route `toLocaleString` on Date and Number through the polyfill. */
    patchToLocale?: boolean;
    /** Replace a native `Intl` implementation instead of keeping it. */
    forceIntl?: boolean;
    timers?: boolean;
    console?: boolean;
    structuredClone?: boolean;
    url?: boolean;
    encoding?: boolean;
    abort?: boolean;
    intl?: boolean;
    /** Custom timer queue, used by tests. */
    queue?: QappTimerQueue;
    /** Custom scheduler, used when `queue` is not given. */
    scheduler?: QappTimerScheduler;
}
export interface InstalledEnv {
    timers: boolean;
    console: boolean;
    structuredClone: boolean;
    url: boolean;
    encoding: boolean;
    abort: boolean;
    intl: boolean;
}
/** Installs the requested parts of the environment and reports what ran. */
export declare function installEnv(options?: InstallEnvOptions): InstalledEnv;
//# sourceMappingURL=index.d.ts.map
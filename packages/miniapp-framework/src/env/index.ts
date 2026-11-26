/**
 * The QChat JavaScript environment.
 *
 * QuickJS provides ECMAScript only: no timers, no `console`, no `Intl`, no
 * `URL`, no `TextEncoder`, no `AbortController` and no `structuredClone`. Import
 * this module and call `installEnv()`, or import `@mna/qchat/env/auto` for the
 * one-line version. Nothing here has a top-level side effect, so a bundle only
 * contains the pieces the app actually installs.
 */

import { installAbort } from "./abort.js";
import { installStructuredClone } from "./clone.js";
import { installConsole } from "./console.js";
import { installEncoding } from "./encoding.js";
import { installIntl, type QappLocale } from "./intl.js";
import {
  createTimerQueue,
  installTimers,
  type QappTimerQueue,
  type QappTimerScheduler,
} from "./timers.js";
import { installUrl } from "./url.js";

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
export function installEnv(options: InstallEnvOptions = {}): InstalledEnv {
  const installed: InstalledEnv = {
    timers: false,
    console: false,
    structuredClone: false,
    url: false,
    encoding: false,
    abort: false,
    intl: false,
  };
  if (options.console !== false) {
    installConsole();
    installed.console = true;
  }
  if (options.timers !== false) {
    installTimers(
      options.queue ??
        (options.scheduler ? createTimerQueue(options.scheduler) : undefined),
    );
    installed.timers = true;
  }
  if (options.structuredClone !== false) {
    installStructuredClone();
    installed.structuredClone = true;
  }
  if (options.url !== false) {
    installUrl();
    installed.url = true;
  }
  if (options.encoding !== false) {
    installEncoding();
    installed.encoding = true;
  }
  if (options.abort !== false) {
    installAbort();
    installed.abort = true;
  }
  if (options.intl !== false) {
    installed.intl = installIntl({
      locale: options.locale,
      patchToLocale: options.patchToLocale,
      force: options.forceIntl,
    });
  }
  return installed;
}

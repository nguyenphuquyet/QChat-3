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
import { installIntl } from "./intl.js";
import { createTimerQueue, installTimers, } from "./timers.js";
import { installUrl } from "./url.js";
export * from "./abort.js";
export * from "./clone.js";
export * from "./console.js";
export * from "./encoding.js";
export * from "./intl.js";
export * from "./timers.js";
export * from "./url.js";
/** Installs the requested parts of the environment and reports what ran. */
export function installEnv(options = {}) {
    const installed = {
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
        installTimers(options.queue ??
            (options.scheduler ? createTimerQueue(options.scheduler) : undefined));
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
//# sourceMappingURL=index.js.map
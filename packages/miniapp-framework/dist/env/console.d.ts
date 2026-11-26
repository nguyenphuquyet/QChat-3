/**
 * QuickJS has no `console`. Every call is forwarded to the host as a `log`
 * message, which the Flutter runtime shows in the dev console and the CLI and
 * Studio print from the dev watcher, so `console.log` is observable while
 * developing without being a second logging system.
 */
export type QappLogLevel = "debug" | "info" | "warn" | "error";
export interface QappConsole {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    trace(...args: unknown[]): void;
}
export interface QappLogSink {
    (entry: {
        level: QappLogLevel;
        message: string;
        stack?: string;
    }): void;
}
export declare const MAX_LOG_LENGTH = 4000;
export declare function formatConsoleArgs(args: unknown[]): {
    message: string;
    stack?: string;
};
export declare function createConsole(sink: QappLogSink): QappConsole;
export declare function installConsole(sink?: QappLogSink): QappConsole;
/** The console installed by `installConsole()`, if any. */
export declare function installedConsole(): QappConsole | null;
//# sourceMappingURL=console.d.ts.map
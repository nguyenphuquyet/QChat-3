import { host } from "../host.js";
import { defineGlobal, installGlobal } from "./scope.js";
export const MAX_LOG_LENGTH = 4000;
const MAX_DEPTH = 3;
const MAX_ENTRIES = 40;
function isErrorLike(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.message === "string" &&
        (typeof candidate.stack === "string" || typeof candidate.name === "string"));
}
function describe(value, depth, seen) {
    if (value === null)
        return "null";
    const type = typeof value;
    if (type === "string")
        return value;
    if (type === "number" || type === "boolean")
        return String(value);
    if (type === "undefined")
        return "undefined";
    if (type === "bigint")
        return `${String(value)}n`;
    if (type === "symbol")
        return String(value);
    if (type === "function") {
        const name = value.name;
        return name ? `[Function: ${name}]` : "[Function]";
    }
    if (isErrorLike(value)) {
        const name = value.name ?? "Error";
        return `${name}: ${value.message}`;
    }
    if (seen.includes(value))
        return "[Circular]";
    if (depth > MAX_DEPTH)
        return Array.isArray(value) ? "[Array]" : "[Object]";
    const nextSeen = [...seen, value];
    if (Array.isArray(value)) {
        const items = value
            .slice(0, MAX_ENTRIES)
            .map((item) => describe(item, depth + 1, nextSeen));
        if (value.length > MAX_ENTRIES)
            items.push(`… ${value.length - MAX_ENTRIES} more`);
        return `[${items.join(", ")}]`;
    }
    const record = value;
    let entries;
    try {
        entries = Object.keys(record).slice(0, MAX_ENTRIES);
    }
    catch {
        return "[Object]";
    }
    const body = entries
        .map((key) => {
        let rendered;
        try {
            rendered = describe(record[key], depth + 1, nextSeen);
        }
        catch {
            rendered = "[Unreadable]";
        }
        return `${key}: ${rendered}`;
    })
        .join(", ");
    return `{ ${body} }`;
}
export function formatConsoleArgs(args) {
    let stack;
    const parts = args.map((value) => {
        if (value instanceof Error ||
            (isErrorLike(value) && typeof value.stack === "string")) {
            if (typeof value.stack === "string" && stack === undefined)
                stack = value.stack;
        }
        return describe(value, 0, []);
    });
    let message = parts.join(" ");
    if (message.length > MAX_LOG_LENGTH) {
        message = `${message.slice(0, MAX_LOG_LENGTH)}… (${message.length - MAX_LOG_LENGTH} more characters)`;
    }
    return stack === undefined ? { message } : { message, stack };
}
export function createConsole(sink) {
    const emit = (level, args) => {
        const { message, stack } = formatConsoleArgs(args);
        try {
            sink(stack === undefined ? { level, message } : { level, message, stack });
        }
        catch {
            // Logging must never break the app.
        }
    };
    return {
        log: (...args) => emit("info", args),
        info: (...args) => emit("info", args),
        warn: (...args) => emit("warn", args),
        error: (...args) => emit("error", args),
        debug: (...args) => emit("debug", args),
        trace: (...args) => emit("debug", args),
    };
}
function hostSink(entry) {
    host().send("log", entry);
}
let installed = null;
export function installConsole(sink = hostSink) {
    if (installed)
        return installed;
    installed = createConsole(sink);
    installGlobal("console", () => installed, { force: true });
    defineGlobal("print", (...args) => {
        // QuickJS exposes `print` in its default std module; keep it working and
        // route it to the same sink so nothing writes to an invisible stdout.
        hostSink({ level: "info", ...formatConsoleArgs(args) });
    });
    return installed;
}
/** The console installed by `installConsole()`, if any. */
export function installedConsole() {
    return installed;
}
//# sourceMappingURL=console.js.map
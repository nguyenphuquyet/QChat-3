/**
 * Wire protocol shared by the JavaScript runtime, the compiler and the Dart
 * host. Everything in this file must stay JSON serializable and must not use
 * Node or browser APIs: the same code is bundled into QuickJS.
 *
 * The component, event, style and permission lists themselves live in
 * `packages/contracts/miniapp-ui.contract.json`. `ui-contract.generated.ts` is
 * produced from that file, so this module is the only place that turns the
 * generated data into the public protocol types.
 */
import { EVENT_NAMES, PERMISSION_IDS, PROTOCOL_VERSION as CONTRACT_PROTOCOL_VERSION, RUNTIME_VERSION as CONTRACT_RUNTIME_VERSION, SDK_VERSION as CONTRACT_SDK_VERSION, STYLE_ENUM_ALIASES, STYLE_ENUM_KEYS, STYLE_ENUM_VALUES, STYLE_KEYS, TEXT_NODE_TYPE, } from "./ui-contract.generated.js";
export const PROTOCOL_VERSION = CONTRACT_PROTOCOL_VERSION;
export const SDK_VERSION = CONTRACT_SDK_VERSION;
export const RUNTIME_VERSION = CONTRACT_RUNTIME_VERSION;
// Re-exported so the rest of the SDK (and tests) read the single source.
export { EVENT_NAMES, PERMISSION_IDS, STYLE_ENUM_ALIASES, STYLE_ENUM_KEYS, STYLE_ENUM_VALUES, STYLE_KEYS, TEXT_NODE_TYPE, };
export class QChatError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "QChatError";
        this.code = code;
    }
}
export function isPlainObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== null &&
        Object.getPrototypeOf(value) === Object.prototype);
}
export function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
}
/**
 * Normalise a style enum value to its canonical camelCase form. CSS-like
 * aliases such as `"space-between"` are accepted and mapped in one place, so
 * every consumer (TS runtime, Dart host, tests) agrees on the same spelling.
 */
export function normalizeStyleEnum(enumName, value) {
    if (typeof value !== "string" || value.length === 0)
        return undefined;
    const aliases = STYLE_ENUM_ALIASES[enumName];
    if (aliases && aliases[value])
        return aliases[value];
    const values = STYLE_ENUM_VALUES[enumName];
    if (values && values.includes(value))
        return value;
    return value;
}
//# sourceMappingURL=protocol.js.map
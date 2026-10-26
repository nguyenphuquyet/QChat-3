/**
 * Wire protocol shared by the JavaScript runtime, the compiler and the Dart
 * host. Everything in this file must stay JSON serializable and must not use
 * Node or browser APIs: the same code is bundled into QuickJS.
 */
export const PROTOCOL_VERSION = 1;
export const SDK_VERSION = "1.0.0";
export const RUNTIME_VERSION = "1.0.0";
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
//# sourceMappingURL=protocol.js.map
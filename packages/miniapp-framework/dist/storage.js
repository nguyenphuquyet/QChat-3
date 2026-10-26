import { callHost } from "./host.js";
/**
 * Per-app storage. The host enforces a 64 KB value limit, a 512 KB namespace
 * quota and 128 keys. Data never leaves the app's own namespace.
 */
export async function getStorage(key) {
    const result = await callHost("getStorage", { key });
    return result.value ?? null;
}
export async function setStorage(key, value) {
    await callHost("setStorage", { key, value });
}
export async function removeStorage(key) {
    await callHost("removeStorage", { key });
}
export function createStorage(namespace) {
    const prefix = namespace.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 32);
    return {
        get(key) {
            return getStorage(`${prefix}.${key}`);
        },
        set(key, value) {
            return setStorage(`${prefix}.${key}`, value);
        },
        remove(key) {
            return removeStorage(`${prefix}.${key}`);
        },
    };
}
//# sourceMappingURL=storage.js.map
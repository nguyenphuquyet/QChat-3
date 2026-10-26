import { callHost } from "./host.js";

/**
 * Per-app storage. The host enforces a 64 KB value limit, a 512 KB namespace
 * quota and 128 keys. Data never leaves the app's own namespace.
 */
export async function getStorage<T = unknown>(key: string): Promise<T | null> {
  const result = await callHost<{ value: T | null }>("getStorage", { key });
  return result.value ?? null;
}

export async function setStorage(key: string, value: unknown): Promise<void> {
  await callHost<void>("setStorage", { key, value });
}

export async function removeStorage(key: string): Promise<void> {
  await callHost<void>("removeStorage", { key });
}

export function createStorage(namespace: string) {
  const prefix = namespace.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 32);
  return {
    get<T = unknown>(key: string) {
      return getStorage<T>(`${prefix}.${key}`);
    },
    set(key: string, value: unknown) {
      return setStorage(`${prefix}.${key}`, value);
    },
    remove(key: string) {
      return removeStorage(`${prefix}.${key}`);
    },
  };
}

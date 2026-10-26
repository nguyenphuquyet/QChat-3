/**
 * Per-app storage. The host enforces a 64 KB value limit, a 512 KB namespace
 * quota and 128 keys. Data never leaves the app's own namespace.
 */
export declare function getStorage<T = unknown>(key: string): Promise<T | null>;
export declare function setStorage(key: string, value: unknown): Promise<void>;
export declare function removeStorage(key: string): Promise<void>;
export declare function createStorage(namespace: string): {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
};
//# sourceMappingURL=storage.d.ts.map
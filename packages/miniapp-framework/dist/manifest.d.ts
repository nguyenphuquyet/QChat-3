export declare const QAPP_FORMAT = "qapp";
export declare const QAPP_SCHEMA_VERSION = 2;
export declare const QAPP_ENTRY = "app.js";
export declare const MAX_QAPP_BYTES: number;
export declare const MAX_QAPP_APP_JS_BYTES: number;
/** Permission ids come from the contract so the manifest can never drift. */
export declare const QAPP_PERMISSIONS: readonly ["toast", "user.profile", "media.choose", "share", "storage", "qchat.api", "network"];
export type QappPermission = (typeof QAPP_PERMISSIONS)[number];
export declare const SEMVER_PATTERN: RegExp;
export declare const HOST_PATTERN: RegExp;
export interface QappManifest {
    schemaVersion: typeof QAPP_SCHEMA_VERSION;
    format: typeof QAPP_FORMAT;
    /** The app id is assigned by the server; it is never part of a package. */
    name: string;
    description?: string;
    version: string;
    entry: typeof QAPP_ENTRY;
    sdkVersion: string;
    minRuntimeVersion: string;
    requestedPermissions: QappPermission[];
    networkDomains?: string[];
    /** Source entry used by the compiler; stripped from the packaged manifest. */
    source?: string;
    icon?: string;
    buildHash?: string;
    appSha256?: string;
}
export interface QappMetadata {
    formatVersion: 1;
    compilerVersion: string;
    sdkVersion: string;
    version: string;
    entry: string;
    builtAt: string;
    appSha256: string;
    files: Array<{
        path: string;
        sha256: string;
        size: number;
    }>;
}
export declare class ManifestError extends Error {
    readonly code: string;
    constructor(code: string, message?: string);
}
export declare function normalizeManifest(input: unknown): QappManifest;
export declare function isSafeRelativePath(path: string): boolean;
export declare function packagedManifest(manifest: QappManifest, appSha256?: string): QappManifest;
//# sourceMappingURL=manifest.d.ts.map
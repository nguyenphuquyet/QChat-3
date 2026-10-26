import { PERMISSION_IDS } from "./ui-contract.generated.js";
export const QAPP_FORMAT = "qapp";
export const QAPP_SCHEMA_VERSION = 2;
export const QAPP_ENTRY = "app.js";
export const MAX_QAPP_BYTES = 20 * 1024 * 1024;
export const MAX_QAPP_APP_JS_BYTES = 4 * 1024 * 1024;
/** Permission ids come from the contract so the manifest can never drift. */
export const QAPP_PERMISSIONS = PERMISSION_IDS;
export const SEMVER_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/;
export const HOST_PATTERN = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})$/i;
export class ManifestError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = "ManifestError";
    }
}
function stringValue(value, field, min, max) {
    if (typeof value !== "string")
        throw new ManifestError("MANIFEST_INVALID", `${field} must be a string`);
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) {
        throw new ManifestError("MANIFEST_INVALID", `${field} is invalid`);
    }
    return trimmed;
}
export function normalizeManifest(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new ManifestError("MANIFEST_INVALID");
    }
    const raw = input;
    if (raw.schemaVersion !== QAPP_SCHEMA_VERSION) {
        throw new ManifestError("MANIFEST_SCHEMA", "schemaVersion must be 2");
    }
    const format = raw.format ?? QAPP_FORMAT;
    if (format !== QAPP_FORMAT) {
        throw new ManifestError("MANIFEST_FORMAT", "format must be qapp");
    }
    if (raw.appId !== undefined) {
        throw new ManifestError("MANIFEST_APP_ID_FORBIDDEN", "appId is assigned by the server and must not be declared in manifest.json");
    }
    const name = stringValue(raw.name, "name", 1, 60);
    const description = raw.description == null
        ? ""
        : stringValue(raw.description, "description", 0, 500);
    const version = stringValue(raw.version, "version", 5, 40);
    if (!SEMVER_PATTERN.test(version)) {
        throw new ManifestError("MANIFEST_INVALID", "version must be semver");
    }
    const entry = raw.entry == null ? QAPP_ENTRY : raw.entry;
    if (entry !== QAPP_ENTRY) {
        throw new ManifestError("MANIFEST_INVALID", "entry must be app.js");
    }
    const sdkVersion = stringValue(raw.sdkVersion ?? "1.0.0", "sdkVersion", 5, 40);
    const minRuntimeVersion = stringValue(raw.minRuntimeVersion ?? "1.0.0", "minRuntimeVersion", 5, 40);
    if (!SEMVER_PATTERN.test(sdkVersion) || !SEMVER_PATTERN.test(minRuntimeVersion)) {
        throw new ManifestError("MANIFEST_INVALID", "versions must be semver");
    }
    const permissionsRaw = raw.requestedPermissions ?? [];
    if (!Array.isArray(permissionsRaw) || permissionsRaw.length > QAPP_PERMISSIONS.length) {
        throw new ManifestError("MANIFEST_INVALID", "requestedPermissions is invalid");
    }
    const permissions = [];
    for (const value of permissionsRaw) {
        if (typeof value !== "string" || !QAPP_PERMISSIONS.includes(value)) {
            throw new ManifestError("MANIFEST_INVALID", `unknown permission ${String(value)}`);
        }
        if (!permissions.includes(value)) {
            permissions.push(value);
        }
    }
    let networkDomains;
    if (raw.networkDomains != null) {
        if (!Array.isArray(raw.networkDomains) || raw.networkDomains.length > 10) {
            throw new ManifestError("MANIFEST_INVALID", "networkDomains must be an array of at most 10 hosts");
        }
        networkDomains = [];
        for (const value of raw.networkDomains) {
            if (typeof value !== "string" || value.length > 253 || !HOST_PATTERN.test(value)) {
                throw new ManifestError("MANIFEST_INVALID", `invalid network domain ${String(value)}`);
            }
            networkDomains.push(value.toLowerCase());
        }
        if (networkDomains.length && !permissions.includes("network")) {
            throw new ManifestError("MANIFEST_INVALID", "networkDomains requires the network permission");
        }
    }
    if (permissions.includes("network") && !networkDomains?.length) {
        throw new ManifestError("MANIFEST_INVALID", "network permission requires networkDomains");
    }
    const source = raw.source == null ? "src/main.tsx" : stringValue(raw.source, "source", 1, 200);
    if (!isSafeRelativePath(source)) {
        throw new ManifestError("MANIFEST_INVALID", "source must be a relative path");
    }
    const icon = raw.icon == null ? undefined : stringValue(raw.icon, "icon", 1, 200);
    return {
        schemaVersion: QAPP_SCHEMA_VERSION,
        format: QAPP_FORMAT,
        name,
        description,
        version,
        entry: QAPP_ENTRY,
        sdkVersion,
        minRuntimeVersion,
        requestedPermissions: permissions,
        ...(networkDomains?.length ? { networkDomains } : {}),
        ...(source !== "src/main.tsx" ? { source } : {}),
        ...(icon ? { icon } : {}),
    };
}
export function isSafeRelativePath(path) {
    const normalized = path.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || normalized.includes(":")) {
        return false;
    }
    return normalized
        .split("/")
        .every((part) => part.length > 0 && part !== "." && part !== "..");
}
export function packagedManifest(manifest, appSha256) {
    const { source: _source, ...rest } = manifest;
    return {
        ...rest,
        ...(appSha256 ? { appSha256 } : {}),
    };
}
//# sourceMappingURL=manifest.js.map
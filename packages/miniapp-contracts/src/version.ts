/**
 * Contract versions. A breaking change to a contract bumps the matching
 * version and requires a new ADR. The host rejects a package or a message whose
 * major version it does not implement.
 */
export const CONTRACT_VERSION = 1 as const;

/** Bridge protocol identifier and version. */
export const BRIDGE_PROTOCOL = "qchat.miniapp.bridge/1" as const;
export const BRIDGE_VERSION = 1 as const;

/** Package format. The file extension is `.qxpkg`. */
export const PACKAGE_FORMAT = "qxpkg" as const;
export const PACKAGE_FORMAT_VERSION = 1 as const;

/** Runtime version reported to packages and to the server. */
export const RUNTIME_VERSION = "0.1.0" as const;

/** Maximum serialized bridge message, in bytes (UTF-8). */
export const MAX_BRIDGE_MESSAGE_BYTES = 1024 * 1024;

/** Maximum page stack depth. */
export const MAX_PAGE_STACK = 10;

/** Maximum number of pages a package may declare. */
export const MAX_PACKAGE_PAGES = 64;

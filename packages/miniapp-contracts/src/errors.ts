/**
 * Every error the host or the runtime reports is one of these codes. A code is
 * never reused for a different meaning. `retryable` tells the caller whether a
 * plain retry can succeed without changing the request.
 */
export const ERROR_CODES = {
  BRIDGE_INVALID_MESSAGE: { retryable: false, message: "The bridge message is malformed." },
  BRIDGE_UNKNOWN_METHOD: { retryable: false, message: "The bridge method is not allowlisted." },
  BRIDGE_ORIGIN_REJECTED: { retryable: false, message: "The message did not come from the app origin." },
  BRIDGE_PAGE_MISMATCH: { retryable: false, message: "The message is bound to another app, session or page." },
  BRIDGE_TIMEOUT: { retryable: true, message: "The request timed out." },
  BRIDGE_CANCELLED: { retryable: false, message: "The request was cancelled." },
  BRIDGE_PAGE_CLOSED: { retryable: false, message: "The page is closed." },
  BRIDGE_TOO_LARGE: { retryable: false, message: "The bridge message is too large." },
  API_UNSUPPORTED: { retryable: false, message: "This API is not supported by this runtime." },
  API_PERMISSION_DENIED: { retryable: false, message: "The Mini App has not been granted this permission." },
  API_INVALID_ARGUMENT: { retryable: false, message: "An API argument is invalid." },
  API_FAILED: { retryable: true, message: "The API call failed." },
  API_CANCELLED: { retryable: false, message: "The API call was cancelled." },
  NAVIGATION_INVALID_ROUTE: { retryable: false, message: "The route is not declared by the package." },
  NAVIGATION_STACK_LIMIT: { retryable: false, message: "The page stack limit was reached." },
  NAVIGATION_NO_TAB_BAR: { retryable: false, message: "The package has no tab bar." },
  STORAGE_KEY_INVALID: { retryable: false, message: "The storage key is invalid." },
  STORAGE_QUOTA_EXCEEDED: { retryable: false, message: "The Mini App storage quota is exhausted." },
  STORAGE_CORRUPT: { retryable: false, message: "The stored value cannot be decoded." },
  NETWORK_DOMAIN_REJECTED: { retryable: false, message: "The host is not on the Mini App domain allowlist." },
  NETWORK_HTTPS_REQUIRED: { retryable: false, message: "Only HTTPS requests are allowed." },
  NETWORK_TIMEOUT: { retryable: true, message: "The network request timed out." },
  NETWORK_RESPONSE_TOO_LARGE: { retryable: false, message: "The response exceeds the size limit." },
  THEME_INVALID_VALUE: { retryable: false, message: "qxColorScheme must be light, dark or auto." },
  THEME_EVENT_FORBIDDEN: { retryable: false, message: "A fixed-theme page must not receive a host theme event." },
  MANIFEST_INVALID: { retryable: false, message: "The package manifest is invalid." },
  MANIFEST_VERSION_UNSUPPORTED: { retryable: false, message: "The package format version is not supported." },
  PACKAGE_SIGNATURE_INVALID: { retryable: false, message: "The package signature is not valid." },
  PACKAGE_HASH_MISMATCH: { retryable: false, message: "A package file does not match its hash." },
  PACKAGE_UNSAFE_PATH: { retryable: false, message: "The package contains an unsafe path." },
  PACKAGE_TOO_LARGE: { retryable: false, message: "The package exceeds the size limit." },
  PACKAGE_FORMAT_UNSUPPORTED: { retryable: false, message: "The package format is not supported." },
  PACKAGE_REVOKED: { retryable: false, message: "This version has been revoked." },
  PACKAGE_DOWNGRADE_BLOCKED: { retryable: false, message: "This downgrade is not allowed." },
  PACKAGE_INSTALL_FAILED: { retryable: true, message: "The package could not be installed." },
  MINIAPP_WEBVIEW_UNSUPPORTED: { retryable: false, message: "The system WebView does not provide the required feature." },
  RUNTIME_CRASH: { retryable: true, message: "The Mini App runtime stopped unexpectedly." },
  RUNTIME_SCRIPT_ERROR: { retryable: false, message: "The Mini App script threw an error." },
  WXML_PARSE_ERROR: { retryable: false, message: "The WXML document is malformed." },
  WXML_INVALID_TAG: { retryable: false, message: "The WXML tag name is invalid." },
  WXML_INVALID_ATTRIBUTE: { retryable: false, message: "The WXML attribute is invalid." },
  WXML_UNCLOSED_TAG: { retryable: false, message: "A WXML element is not closed." },
  WXML_UNEXPECTED_CLOSE_TAG: { retryable: false, message: "A WXML close tag does not match the open element." },
  WXML_UNTERMINATED_COMMENT: { retryable: false, message: "A WXML comment is not terminated." },
  WXSS_PARSE_ERROR: { retryable: false, message: "The WXSS stylesheet is malformed." },
  WXSS_UNSUPPORTED_FEATURE: { retryable: false, message: "This WXSS feature is not supported." },
  COMPILER_UNSUPPORTED_SYNTAX: { retryable: false, message: "The build tool does not support this syntax." },
  COMPILER_UNSUPPORTED_DIRECTIVE: { retryable: false, message: "The build tool does not support this WXML directive." },
  COMPILER_UNSUPPORTED_CONFIG: { retryable: false, message: "The build tool does not support this configuration key." },
  COMPILER_DIAGNOSTIC: { retryable: false, message: "The build failed with a diagnostic." },
  WXS_UNSUPPORTED: { retryable: false, message: "WXS is not implemented in this runtime version." },
  COMPONENT_UNSUPPORTED: { retryable: false, message: "This component is not implemented in this runtime version." },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface MiniAppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
}

/** Build a typed error; the default message is the registry message. */
export function miniAppError(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
): MiniAppError {
  const error: MiniAppError = { code, message: message ?? ERROR_CODES[code].message };
  if (details) error.details = details;
  return error;
}

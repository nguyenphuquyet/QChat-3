/// Stable error codes returned by the SDK. The host uses the same codes on the
/// other side of the bridge, so applications can branch on them safely.
export type QChatErrorCode =
  | "BRIDGE_UNAVAILABLE"
  | "TIMEOUT"
  | "CANCELLED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "NOT_SUPPORTED"
  | "NOT_FOUND"
  | "STORAGE_QUOTA_EXCEEDED"
  | "NETWORK_ERROR"
  | "HOST_ERROR";

export type QChatErrorPayload = {
  code: string;
  message?: string;
  details?: unknown;
};

export class QChatError extends Error {
  readonly code: QChatErrorCode | string;
  readonly details?: unknown;

  constructor(code: string, message?: string, details?: unknown) {
    super(message || code);
    this.name = "QChatError";
    this.code = code;
    this.details = details;
  }

  toJSON(): QChatErrorPayload {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export function isQChatError(error: unknown): error is QChatError {
  return error instanceof QChatError;
}

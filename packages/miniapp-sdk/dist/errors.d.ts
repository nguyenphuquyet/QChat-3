export type QChatErrorCode = "BRIDGE_UNAVAILABLE" | "TIMEOUT" | "CANCELLED" | "PERMISSION_DENIED" | "INVALID_ARGUMENT" | "NOT_SUPPORTED" | "NOT_FOUND" | "STORAGE_QUOTA_EXCEEDED" | "NETWORK_ERROR" | "HOST_ERROR";
export type QChatErrorPayload = {
    code: string;
    message?: string;
    details?: unknown;
};
export declare class QChatError extends Error {
    readonly code: QChatErrorCode | string;
    readonly details?: unknown;
    constructor(code: string, message?: string, details?: unknown);
    toJSON(): QChatErrorPayload;
}
export declare function isQChatError(error: unknown): error is QChatError;
//# sourceMappingURL=errors.d.ts.map
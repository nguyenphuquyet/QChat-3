import type { QChatErrorPayload } from "./errors";
export type BridgeRequest = {
    id: string;
    method: string;
    params: unknown;
};
export type BridgeResponse = {
    id: string;
    ok: true;
    result?: unknown;
} | {
    id: string;
    ok: false;
    error: QChatErrorPayload;
};
export type BridgeTransport = (request: BridgeRequest) => void;
export type BridgeOptions = {
    transport?: BridgeTransport;
    timeoutMs?: number;
    requestTimeoutMs?: number;
    chooseImageTimeoutMs?: number;
};
//# sourceMappingURL=protocol.d.ts.map
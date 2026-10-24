import type { QChatErrorPayload } from "./errors";

export type BridgeRequest = {
  id: string;
  method: string;
  params: unknown;
};

export type BridgeResponse =
  | { id: string; ok: true; result?: unknown }
  | { id: string; ok: false; error: QChatErrorPayload };

/// The only function the WebView needs from the host. The host injects
/// `window.QChatNative.postMessage`, which forwards one JSON string per call.
export type BridgeTransport = (request: BridgeRequest) => void;

export type BridgeOptions = {
  transport?: BridgeTransport;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  chooseImageTimeoutMs?: number;
};

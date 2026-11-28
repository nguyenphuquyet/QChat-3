/**
 * Host-side bridge client (specification section 4.3).
 *
 * One client per app/session/page binding. It sends typed requests, matches
 * responses by id, enforces the method allowlist, applies a timeout, supports
 * cancellation and rejects every pending request when the page closes. It
 * validates every inbound message with the shared contract, so a response from
 * a foreign app/session/page can never settle a request.
 */

import {
  BRIDGE_VERSION,
  makeRequestId,
  miniAppError,
  parseBridgeMessage,
  type BridgeBinding,
  type BridgeEvent,
  type BridgeMessage,
  type BridgeRequest,
  type MiniAppError,
} from "@qchat/miniapp-contracts";

export interface BridgeTransport {
  send(message: BridgeMessage): void;
}

export interface BridgeClientOptions {
  binding: BridgeBinding;
  transport: BridgeTransport;
  /** Methods the host may call. Derived from the API registry. */
  allowlist: readonly string[];
  /** Default request timeout. */
  timeoutMs?: number;
  /** Events pushed by the host (theme, app lifecycle, page messages). */
  onEvent?: (event: BridgeEvent) => void;
}

export interface BridgeRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface BridgeClient {
  request<T = unknown>(method: string, params?: Record<string, unknown>, options?: BridgeRequestOptions): Promise<T>;
  /** Consume one inbound message; returns an error for a malformed message. */
  handleMessage(value: unknown): MiniAppError | null;
  /** Reject every pending request; later requests fail with `BRIDGE_PAGE_CLOSED`. */
  close(): void;
  pendingCount(): number;
  closed(): boolean;
}

interface Pending {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: MiniAppError) => void;
  timer: ReturnType<typeof setTimeout> | null;
  cleanup: () => void;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function createBridgeClient(options: BridgeClientOptions): BridgeClient {
  const { binding, transport, allowlist } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Map<string, Pending>();
  let counter = 0;
  let isClosed = false;

  function settle(id: string): Pending | undefined {
    const entry = pending.get(id);
    if (!entry) return undefined;
    pending.delete(id);
    entry.cleanup();
    return entry;
  }

  function send(message: BridgeMessage): void {
    transport.send(message);
  }

  function request<T>(method: string, params: Record<string, unknown> = {}, requestOptions: BridgeRequestOptions = {}): Promise<T> {
    if (isClosed) return Promise.reject(miniAppError("BRIDGE_PAGE_CLOSED"));
    if (typeof method !== "string" || !allowlist.includes(method)) {
      return Promise.reject(miniAppError("BRIDGE_UNKNOWN_METHOD", undefined, { method }));
    }
    if (requestOptions.signal?.aborted) return Promise.reject(miniAppError("BRIDGE_CANCELLED"));

    const id = makeRequestId(counter);
    counter += 1;
    const message: BridgeRequest = {
      v: BRIDGE_VERSION,
      kind: "request",
      appId: binding.appId,
      sessionId: binding.sessionId,
      pageId: binding.pageId,
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = requestOptions.timeoutMs ?? timeoutMs;
      const timer = setTimeout(() => {
        if (!settle(id)) return;
        reject(miniAppError("BRIDGE_TIMEOUT", undefined, { method, timeout }));
      }, Math.max(1, timeout));

      const onAbort = (): void => {
        if (!settle(id)) return;
        try {
          send({
            v: BRIDGE_VERSION,
            kind: "cancel",
            appId: binding.appId,
            sessionId: binding.sessionId,
            pageId: binding.pageId,
            id,
          });
        } catch {
          // The page may already be gone; the local rejection is what matters.
        }
        reject(miniAppError("BRIDGE_CANCELLED", undefined, { method }));
      };
      requestOptions.signal?.addEventListener("abort", onAbort, { once: true });

      const entry: Pending = {
        method,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
        cleanup: () => {
          clearTimeout(timer);
          requestOptions.signal?.removeEventListener("abort", onAbort);
        },
      };
      pending.set(id, entry);

      try {
        send(message);
      } catch (cause) {
        if (!settle(id)) return;
        reject(miniAppError("BRIDGE_INVALID_MESSAGE", `The transport failed: ${String(cause)}`));
      }
    });
  }

  function handleMessage(value: unknown): MiniAppError | null {
    const parsed = parseBridgeMessage(value, binding);
    if (!parsed.ok) return parsed.error;
    const message = parsed.message;

    if (message.kind === "response") {
      const entry = settle(message.id);
      if (!entry) return null; // late response after a timeout or cancel
      if (message.ok) {
        entry.resolve(message.result);
      } else {
        entry.reject(message.error ?? miniAppError("API_FAILED"));
      }
      return null;
    }

    if (message.kind === "event") {
      if (options.onEvent) {
        options.onEvent(message);
        return null;
      }
      return miniAppError("BRIDGE_UNKNOWN_METHOD", "The host does not handle this event.", { event: message.event });
    }

    if (message.kind === "cancel") {
      const entry = settle(message.id);
      if (entry) entry.reject(miniAppError("BRIDGE_CANCELLED"));
      return null;
    }

    return miniAppError("BRIDGE_INVALID_MESSAGE", "A request cannot arrive at the bridge client.");
  }

  return {
    request,
    handleMessage,
    close() {
      if (isClosed) return;
      isClosed = true;
      for (const [id, entry] of pending) {
        pending.delete(id);
        entry.cleanup();
        entry.reject(miniAppError("BRIDGE_PAGE_CLOSED", undefined, { method: entry.method }));
      }
    },
    pendingCount() {
      return pending.size;
    },
    closed() {
      return isClosed;
    },
  };
}

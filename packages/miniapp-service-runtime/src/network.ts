/**
 * Network adapter for `wx.request`.
 *
 * The policy (HTTPS, domain allowlist, headers, size, timeout) lives in the API
 * host so every platform applies the same rules. This module only moves bytes:
 * the Node adapter below is used by the harness and the desktop simulator;
 * Android and iOS install a native adapter in M5/M8.
 */

export interface NetworkRequest {
  url: string;
  method: string;
  header: Record<string, string>;
  /** Serialised body, already prepared by the API host. */
  body?: string;
  timeoutMs: number;
  /** Hard cap the adapter must enforce while reading the response. */
  maxBytes: number;
}

export interface NetworkResponse {
  statusCode: number;
  header: Record<string, string>;
  body: string;
}

export interface NetworkAdapter {
  request(request: NetworkRequest): Promise<NetworkResponse>;
}

export type NetworkFailureCode = "NETWORK_TIMEOUT" | "NETWORK_RESPONSE_TOO_LARGE" | "NETWORK_DOMAIN_REJECTED";

export class NetworkAdapterError extends Error {
  readonly code: NetworkFailureCode;

  constructor(code: NetworkFailureCode, message: string) {
    super(message);
    this.name = "NetworkAdapterError";
    this.code = code;
  }
}

/** Real HTTP adapter for Node (tests, simulator). Not used by the app itself. */
export function createFetchNetworkAdapter(): NetworkAdapter {
  return {
    async request(request) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs);
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.header,
          body: request.body,
          redirect: "manual",
          signal: controller.signal,
        });
        const header: Record<string, string> = {};
        response.headers.forEach((value, name) => {
          header[name.toLowerCase()] = value;
        });

        const reader = response.body?.getReader();
        if (!reader) return { statusCode: response.status, header, body: "" };
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > request.maxBytes) {
            await reader.cancel();
            throw new NetworkAdapterError("NETWORK_RESPONSE_TOO_LARGE", "The response exceeds the size limit.");
          }
          chunks.push(value);
        }
        const merged = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return { statusCode: response.status, header, body: new TextDecoder().decode(merged) };
      } catch (cause) {
        if (cause instanceof NetworkAdapterError) throw cause;
        if (controller.signal.aborted) throw new NetworkAdapterError("NETWORK_TIMEOUT", "The request timed out.");
        throw cause;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

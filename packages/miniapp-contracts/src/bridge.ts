import { BRIDGE_VERSION, MAX_BRIDGE_MESSAGE_BYTES } from "./version.js";
import { ERROR_CODES, isErrorCode, miniAppError, type ErrorCode, type MiniAppError } from "./errors.js";
import { hasOnlyKeys, isNonEmptyString, isRecord, utf8Length, type UnknownRecord } from "./validate.js";

/**
 * One envelope for every message. A message is bound to one app, one host
 * session and one page; the receiver must compare all three with its own
 * binding and reject a mismatch. `id` correlates a request with its response.
 */
export interface BridgeRequest {
  v: typeof BRIDGE_VERSION;
  kind: "request";
  appId: string;
  sessionId: string;
  pageId: string;
  id: string;
  method: string;
  params: UnknownRecord;
}

export interface BridgeResponse {
  v: typeof BRIDGE_VERSION;
  kind: "response";
  appId: string;
  sessionId: string;
  pageId: string;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: MiniAppError;
}

export interface BridgeEvent {
  v: typeof BRIDGE_VERSION;
  kind: "event";
  appId: string;
  sessionId: string;
  pageId: string;
  event: string;
  payload: UnknownRecord;
}

export interface BridgeCancel {
  v: typeof BRIDGE_VERSION;
  kind: "cancel";
  appId: string;
  sessionId: string;
  pageId: string;
  id: string;
}

export type BridgeMessage = BridgeRequest | BridgeResponse | BridgeEvent | BridgeCancel;

export interface BridgeBinding {
  appId: string;
  sessionId: string;
  pageId: string;
}

const BASE_KEYS = ["v", "kind", "appId", "sessionId", "pageId"] as const;
const METHOD = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/;
const EVENT = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export type ParseResult =
  | { ok: true; message: BridgeMessage }
  | { ok: false; error: MiniAppError };

function fail(code: ErrorCode, message?: string): ParseResult {
  return { ok: false, error: miniAppError(code, message) };
}

function bindingMatches(value: UnknownRecord, binding: BridgeBinding | undefined): boolean {
  if (!binding) return true;
  return (
    value.appId === binding.appId &&
    value.sessionId === binding.sessionId &&
    value.pageId === binding.pageId
  );
}

/**
 * Validate an untrusted value from the WebView or the service engine. Unknown
 * keys are rejected so a message cannot smuggle a second interpretation.
 * `binding` is the host's own app/session/page; when given, a mismatch is
 * rejected before the method is read.
 */
export function parseBridgeMessage(
  value: unknown,
  binding?: BridgeBinding,
  maxBytes = MAX_BRIDGE_MESSAGE_BYTES,
): ParseResult {
  if (!isRecord(value)) return fail("BRIDGE_INVALID_MESSAGE", "A message must be an object.");
  if (value.v !== BRIDGE_VERSION) return fail("BRIDGE_INVALID_MESSAGE", "Unsupported bridge version.");
  if (!isNonEmptyString(value.appId, 128) || !isNonEmptyString(value.sessionId, 128) || !isNonEmptyString(value.pageId, 128)) {
    return fail("BRIDGE_INVALID_MESSAGE", "appId, sessionId and pageId are required.");
  }
  if (!bindingMatches(value, binding)) return fail("BRIDGE_PAGE_MISMATCH");

  const kind = value.kind;
  if (kind === "request") {
    if (!hasOnlyKeys(value, [...BASE_KEYS, "id", "method", "params"])) {
      return fail("BRIDGE_INVALID_MESSAGE", "Unexpected request key.");
    }
    if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
    if (typeof value.method !== "string" || !METHOD.test(value.method)) {
      return fail("BRIDGE_INVALID_MESSAGE", "Invalid method name.");
    }
    if (value.params !== undefined && !isRecord(value.params)) {
      return fail("BRIDGE_INVALID_MESSAGE", "params must be an object.");
    }
    const message: BridgeRequest = {
      v: BRIDGE_VERSION,
      kind,
      appId: value.appId,
      sessionId: value.sessionId,
      pageId: value.pageId,
      id: value.id,
      method: value.method,
      params: (value.params as UnknownRecord | undefined) ?? {},
    };
    return checkSize(message, maxBytes);
  }

  if (kind === "response") {
    if (!hasOnlyKeys(value, [...BASE_KEYS, "id", "ok", "result", "error"])) {
      return fail("BRIDGE_INVALID_MESSAGE", "Unexpected response key.");
    }
    if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
    if (typeof value.ok !== "boolean") return fail("BRIDGE_INVALID_MESSAGE", "ok must be a boolean.");
    if (value.ok && value.error !== undefined) return fail("BRIDGE_INVALID_MESSAGE", "A successful response cannot carry an error.");
    if (!value.ok) {
      if (!isRecord(value.error)) return fail("BRIDGE_INVALID_MESSAGE", "A failed response needs an error.");
      if (!isErrorCode(value.error.code)) return fail("BRIDGE_INVALID_MESSAGE", "Unknown error code.");
      if (!isNonEmptyString(value.error.message, 2048)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid error message.");
      if (value.error.details !== undefined && !isRecord(value.error.details)) {
        return fail("BRIDGE_INVALID_MESSAGE", "error.details must be an object.");
      }
    }
    const message: BridgeResponse = {
      v: BRIDGE_VERSION,
      kind,
      appId: value.appId,
      sessionId: value.sessionId,
      pageId: value.pageId,
      id: value.id,
      ok: value.ok,
      result: value.result,
      error: value.error as MiniAppError | undefined,
    };
    return checkSize(message, maxBytes);
  }

  if (kind === "event") {
    if (!hasOnlyKeys(value, [...BASE_KEYS, "event", "payload"])) {
      return fail("BRIDGE_INVALID_MESSAGE", "Unexpected event key.");
    }
    if (typeof value.event !== "string" || !EVENT.test(value.event) || value.event.length > 64) {
      return fail("BRIDGE_INVALID_MESSAGE", "Invalid event name.");
    }
    if (value.payload !== undefined && !isRecord(value.payload)) {
      return fail("BRIDGE_INVALID_MESSAGE", "payload must be an object.");
    }
    const message: BridgeEvent = {
      v: BRIDGE_VERSION,
      kind,
      appId: value.appId,
      sessionId: value.sessionId,
      pageId: value.pageId,
      event: value.event,
      payload: (value.payload as UnknownRecord | undefined) ?? {},
    };
    return checkSize(message, maxBytes);
  }

  if (kind === "cancel") {
    if (!hasOnlyKeys(value, [...BASE_KEYS, "id"])) {
      return fail("BRIDGE_INVALID_MESSAGE", "Unexpected cancel key.");
    }
    if (!isNonEmptyString(value.id, 64) || !ID.test(value.id)) return fail("BRIDGE_INVALID_MESSAGE", "Invalid request id.");
    const message: BridgeCancel = {
      v: BRIDGE_VERSION,
      kind,
      appId: value.appId,
      sessionId: value.sessionId,
      pageId: value.pageId,
      id: value.id,
    };
    return checkSize(message, maxBytes);
  }

  return fail("BRIDGE_INVALID_MESSAGE", "Unknown message kind.");
}

function checkSize(message: BridgeMessage, maxBytes: number): ParseResult {
  if (utf8Length(JSON.stringify(message)) > maxBytes) return fail("BRIDGE_TOO_LARGE");
  return { ok: true, message };
}

/** True when the method is on the host allowlist. Never call a method by name without this. */
export function isAllowedMethod(method: string, allowlist: readonly string[]): boolean {
  return allowlist.includes(method);
}

/** A deterministic request id for the service runtime. */
export function makeRequestId(counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new RangeError("counter must be a non-negative safe integer");
  return `r${counter.toString(36)}`;
}

export function isOk(message: BridgeResponse): boolean {
  return message.ok === true && message.error === undefined;
}

export function errorFor(message: BridgeResponse): MiniAppError {
  return message.error ?? miniAppError("API_FAILED", "The response did not carry an error.");
}

export { ERROR_CODES };

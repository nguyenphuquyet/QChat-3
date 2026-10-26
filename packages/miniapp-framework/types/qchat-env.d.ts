/**
 * Globals the QChat JavaScript environment installs in QuickJS.
 *
 * The runtime is ECMAScript only: no timers, no `console`, no `Intl`, no `URL`,
 * no `TextEncoder`, no `AbortController` and no `structuredClone`. They exist
 * after `import "@mna/qchat/env/auto";` (or the individual `install*` calls).
 *
 * qapp projects keep `"lib": ["ES2020"]` and must not add `"DOM"`: the package
 * has no WebView, so this file — not lib.dom — is the contract. The compiler
 * injects it into the generated type-check config when the project does not add
 * the DOM lib itself.
 */

type QappLogLevel = "debug" | "info" | "warn" | "error";

interface QappConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  trace(...args: unknown[]): void;
}

declare var console: QappConsole;
declare function print(...args: unknown[]): void;

/* Timers: the host wakes the runtime and runs everything that is due. */
declare function setTimeout(
  handler: (...args: any[]) => void,
  delayMs?: number,
  ...args: any[]
): number;
declare function clearTimeout(id?: number): void;
declare function setInterval(
  handler: (...args: any[]) => void,
  delayMs?: number,
  ...args: any[]
): number;
declare function clearInterval(id?: number): void;
declare function requestAnimationFrame(handler: (time: number) => void): number;
declare function cancelAnimationFrame(id?: number): void;
declare function queueMicrotask(handler: () => void): void;

declare function structuredClone<T>(value: T, options?: unknown): T;

declare class URLSearchParams {
  constructor(init?: string | URLSearchParams | Iterable<[unknown, unknown]> | Record<string, unknown>);
  append(name: unknown, value: unknown): void;
  delete(name: unknown, value?: unknown): void;
  get(name: unknown): string | null;
  getAll(name: unknown): string[];
  has(name: unknown, value?: unknown): boolean;
  set(name: unknown, value: unknown): void;
  sort(): void;
  toString(): string;
  entries(): Array<[string, string]>;
  keys(): string[];
  values(): string[];
  forEach(callback: (value: string, key: string) => void): void;
  readonly size: number;
}

declare class URL {
  constructor(input: unknown, base?: unknown);
  href: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  readonly origin: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
  toJSON(): string;
}

declare class TextEncoder {
  readonly encoding: "utf-8";
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  constructor(
    label?: string,
    options?: { fatal?: boolean; ignoreBOM?: boolean },
  );
  readonly encoding: "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  decode(input?: ArrayLike<number> | null, options?: { stream?: boolean }): string;
}

interface QappAbortEvent {
  type: "abort";
  target: AbortSignal;
}

declare class AbortSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  onabort: ((event: QappAbortEvent) => void) | null;
  addEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  removeEventListener(type: "abort", listener: (event: QappAbortEvent) => void): void;
  throwIfAborted(): void;
  static abort(reason?: unknown): AbortSignal;
  static timeout(milliseconds: number): AbortSignal;
}

declare class AbortController {
  constructor();
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}

/*
 * `Intl` itself is not declared here: the ES library already types it, and
 * `Intl` is a global namespace whose members cannot be redeclared. The QChat
 * polyfill implements the documented subset for `vi-VN` and `en-US` and raises
 * a `RangeError` for any other locale, so the types are wider than the runtime
 * on purpose. See docs/MINIAPPS.md for the supported options.
 */

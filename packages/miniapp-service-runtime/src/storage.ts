/**
 * Per-app storage adapter.
 *
 * The host owns persistence; this package only defines the surface and a real
 * in-memory implementation for the Node harness and the desktop simulator.
 * Android and iOS install a durable adapter (SQLite/file) in M5/M8. A missing
 * adapter is an honest `API_UNSUPPORTED`, never a silent memory fallback.
 */

export interface StorageAdapter {
  /** Raw JSON string for a key, or `null` when the key is absent. */
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
  /** Every stored key and its raw value; used for quota accounting. */
  entries(): ReadonlyArray<readonly [string, string]>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, string>();

  read(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.map.set(key, value);
  }

  remove(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  entries(): ReadonlyArray<readonly [string, string]> {
    return [...this.map.entries()];
  }
}

/** UTF-8 byte length, without depending on Node's `Buffer`. */
export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

import { useEffect, useState } from "@mna/qchat";

export type LogTone = "info" | "success" | "warn" | "error";

export interface LogEntry {
  id: number;
  at: number;
  scope: string;
  message: string;
  tone: LogTone;
}

const MAX_ENTRIES = 200;

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

/**
 * Append one line to the shared log. Every screen writes here and the Debug tab
 * reads the same list, so a Mini App needs no global state library: one module
 * scope plus a subscription is enough.
 */
export function pushLog(
  scope: string,
  message: string,
  tone: LogTone = "info",
): void {
  entries = [
    ...entries,
    { id: nextId, at: Date.now(), scope, message, tone },
  ].slice(-MAX_ENTRIES);
  nextId += 1;
  emit();
}

export function clearLogs(): void {
  entries = [];
  emit();
}

/** Non-reactive snapshot, for helpers that run outside a component. */
export function logEntries(): LogEntry[] {
  return entries;
}

/** Subscribe a component to the log store. */
export function useLogs(): LogEntry[] {
  const [snapshot, setSnapshot] = useState<LogEntry[]>(entries);
  useEffect(() => {
    const listener = () => setSnapshot(entries);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}

let timeFormatter: Intl.DateTimeFormat | null = null;

/** `Intl` comes from `@mna/qchat/env/auto`, which `main.tsx` installs once. */
export function formatTime(at: number): string {
  if (!timeFormatter) {
    timeFormatter = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
  return timeFormatter.format(new Date(at));
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

export function shorten(value: string, max = 200): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * One host call, one consistent pair of log lines. A rejected permission is a
 * normal rejection here, so a demo button never leaves a silent gap.
 */
export async function runCall<T>(
  label: string,
  task: () => Promise<T>,
): Promise<T | null> {
  pushLog(label, "bắt đầu…");
  try {
    const result = await task();
    pushLog(
      label,
      `OK · ${shorten(JSON.stringify(result ?? null))}`,
      "success",
    );
    return result;
  } catch (error) {
    pushLog(label, `LỖI · ${describeError(error)}`, "error");
    return null;
  }
}

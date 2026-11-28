/**
 * Compiler diagnostics. Every diagnostic names the file, the 1-based line and
 * column, a registry error code and an explanation, as section 6 requires.
 */

import type { ErrorCode } from "@qchat/miniapp-contracts";

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  offset: number;
}

export interface Diagnostic {
  code: ErrorCode;
  message: string;
  file: string;
  line: number;
  column: number;
}

export type CompileResult<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export function diagnostic(code: ErrorCode, message: string, at: SourceLocation): Diagnostic {
  return { code, message, file: at.file, line: at.line, column: at.column };
}

export function formatDiagnostic(entry: Diagnostic): string {
  return `${entry.file}:${entry.line}:${entry.column} ${entry.code} ${entry.message}`;
}

/**
 * WXSS compiler.
 *
 * WXSS is CSS with three QChat-specific rules:
 *
 * - `rpx` is resolved against the page width (750 rpx = the page width) through
 *   the `--qchat-rpx` custom property, which the host sets from the measured
 *   WebView width. A fallback of `calc(100vw / 750)` keeps a standalone page
 *   correct.
 * - `@import` is inlined at build time, confined to the package root, with cycle
 *   detection.
 * - `@media (prefers-color-scheme)` is rejected: it would resolve against the
 *   device or host theme, not the Mini App's `qxColorScheme`. Developer themes
 *   use `[data-theme="dark"]`, which is passed through untouched.
 *
 * Component styles can be scoped with `scopeSelector`; `:host` maps to the
 * scope selector and every other selector is prefixed with it.
 */

import type { ErrorCode } from "@qchat/miniapp-contracts";
import { diagnostic, type CompileResult, type Diagnostic, type SourceLocation } from "./diagnostics.js";
import { resolvePackagePath } from "./paths.js";

export interface WxssCompileOptions {
  /** Read a package file for `@import`; return `null` when absent. */
  loadFile?: (path: string) => string | null;
  /** Prefix for component styles, e.g. `[data-wx-component="card"]`. */
  scopeSelector?: string;
}

export interface CompiledWxss {
  file: string;
  css: string;
  files: readonly string[];
}

interface WxssContext {
  file: string;
  options: WxssCompileOptions;
  diagnostics: Diagnostic[];
  files: string[];
  stack: string[];
}

class CssFailure {
  constructor(readonly entry: Diagnostic) {}
}

class CssCursor {
  index = 0;
  line = 1;
  column = 1;

  constructor(
    readonly source: string,
    readonly file: string,
  ) {}

  get eof(): boolean {
    return this.index >= this.source.length;
  }

  peek(offset = 0): string {
    return this.source[this.index + offset] ?? "";
  }

  startsWith(text: string): boolean {
    return this.source.startsWith(text, this.index);
  }

  loc(): SourceLocation {
    return { file: this.file, line: this.line, column: this.column, offset: this.index };
  }

  advance(count = 1): void {
    for (let step = 0; step < count && this.index < this.source.length; step += 1) {
      if (this.source[this.index] === "\n") {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
      this.index += 1;
    }
  }

  fail(code: ErrorCode, message: string, at: SourceLocation = this.loc()): never {
    throw new CssFailure(diagnostic(code, message, at));
  }

  /** Skip whitespace and comments. */
  trivia(): void {
    for (;;) {
      while (!this.eof && /\s/.test(this.peek())) this.advance();
      if (!this.startsWith("/*")) return;
      const start = this.loc();
      const end = this.source.indexOf("*/", this.index + 2);
      if (end === -1) this.fail("WXSS_PARSE_ERROR", "A comment is not terminated.", start);
      this.advance(end + 2 - this.index);
    }
  }
}

function error(ctx: WxssContext, code: ErrorCode, message: string, at: SourceLocation): void {
  ctx.diagnostics.push(diagnostic(code, message, at));
}

/** Read text until one of `stops` at nesting depth 0, outside strings. */
function readUntil(cursor: CssCursor, stops: readonly string[]): { text: string; stop: string } {
  let text = "";
  let depth = 0;
  while (!cursor.eof) {
    const char = cursor.peek();
    if (char === '"' || char === "'") {
      const quote = char;
      const start = cursor.loc();
      text += char;
      cursor.advance();
      while (!cursor.eof) {
        const current = cursor.peek();
        text += current;
        cursor.advance();
        if (current === "\\") {
          if (!cursor.eof) {
            text += cursor.peek();
            cursor.advance();
          }
          continue;
        }
        if (current === quote) break;
      }
      if (text[text.length - 1] !== quote) {
        cursor.fail("WXSS_PARSE_ERROR", "A string is not terminated.", start);
      }
      continue;
    }
    if (cursor.startsWith("/*")) {
      const start = cursor.loc();
      const end = cursor.source.indexOf("*/", cursor.index + 2);
      if (end === -1) cursor.fail("WXSS_PARSE_ERROR", "A comment is not terminated.", start);
      cursor.advance(end + 2 - cursor.index);
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && stops.includes(char)) return { text, stop: char };
    text += char;
    cursor.advance();
  }
  return { text, stop: "" };
}

const RPX = /^([+-]?(?:\d+\.?\d*|\.\d+))rpx\b/;

/** Replace `rpx` outside strings and `url(...)` with a page-width calc. */
function transformValue(value: string, at: SourceLocation, ctx: WxssContext): string {
  if (/prefers-color-scheme/i.test(value)) {
    error(
      ctx,
      "WXSS_UNSUPPORTED_FEATURE",
      "prefers-color-scheme is unsupported; use [data-theme] instead.",
      at,
    );
  }
  let output = "";
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (char === '"' || char === "'") {
      const quote = char;
      output += char;
      index += 1;
      while (index < value.length) {
        const current = value[index];
        output += current;
        index += 1;
        if (current === "\\" && index < value.length) {
          output += value[index];
          index += 1;
          continue;
        }
        if (current === quote) break;
      }
      continue;
    }
    if (/^url\(/i.test(value.slice(index))) {
      const start = index;
      let depth = 0;
      let quote = "";
      while (index < value.length) {
        const current = value[index];
        if (quote) {
          if (current === "\\") index += 1;
          else if (current === quote) quote = "";
          index += 1;
          continue;
        }
        if (current === '"' || current === "'") {
          quote = current;
          index += 1;
          continue;
        }
        if (current === "(") depth += 1;
        if (current === ")") {
          depth -= 1;
          index += 1;
          if (depth === 0) break;
          continue;
        }
        index += 1;
      }
      output += value.slice(start, index);
      continue;
    }
    const match = RPX.exec(value.slice(index));
    if (match) {
      const number = Number(match[1]);
      output += number === 0 ? "0" : `calc(${match[1]} * var(--qchat-rpx, calc(100vw / 750)))`;
      index += match[0].length;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function splitSelectors(selector: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const char of selector) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function transformSelector(selector: string, at: SourceLocation, ctx: WxssContext): string {
  if (/prefers-color-scheme/i.test(selector)) {
    error(
      ctx,
      "WXSS_UNSUPPORTED_FEATURE",
      "prefers-color-scheme is unsupported; use [data-theme] instead.",
      at,
    );
  }
  const scope = ctx.options.scopeSelector;
  if (!scope) return splitSelectors(selector).join(", ");
  return splitSelectors(selector)
    .map((part) => (part.includes(":host") ? part.replaceAll(":host", scope) : `${scope} ${part}`))
    .join(", ");
}

interface Declaration {
  name: string;
  value: string;
}

function parseDeclarations(cursor: CssCursor, ctx: WxssContext): Declaration[] {
  const declarations: Declaration[] = [];
  for (;;) {
    cursor.trivia();
    if (cursor.eof) cursor.fail("WXSS_PARSE_ERROR", "A declaration block is not closed.");
    if (cursor.peek() === "}") {
      cursor.advance();
      return declarations;
    }
    const start = cursor.loc();
    const name = readUntil(cursor, [":", ";", "}"]).text.trim();
    if (cursor.peek() !== ":") {
      cursor.fail("WXSS_PARSE_ERROR", `Expected ":" after "${name || "property"}".`, start);
    }
    cursor.advance();
    if (!/^(?:--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/.test(name)) {
      cursor.fail("WXSS_PARSE_ERROR", `Invalid property name "${name}".`, start);
    }
    const value = readUntil(cursor, [";", "}"]).text.trim();
    if (value.length === 0) {
      cursor.fail("WXSS_PARSE_ERROR", `Property "${name}" has no value.`, start);
    }
    if (value.includes("{")) {
      cursor.fail("WXSS_PARSE_ERROR", "Nested rules are not supported in WXSS.", start);
    }
    declarations.push({ name, value: transformValue(value, start, ctx) });
    if (cursor.peek() === ";") cursor.advance();
  }
}

function formatDeclarations(declarations: readonly Declaration[]): string {
  return declarations.map((entry) => `${entry.name}:${entry.value}`).join(";");
}

function parseKeyframes(cursor: CssCursor, name: string, ctx: WxssContext): string {
  const blocks: string[] = [];
  for (;;) {
    cursor.trivia();
    if (cursor.eof) cursor.fail("WXSS_PARSE_ERROR", `@keyframes ${name} is not closed.`);
    if (cursor.peek() === "}") {
      cursor.advance();
      return `@keyframes ${name}{${blocks.join("")}}`;
    }
    const start = cursor.loc();
    const selector = readUntil(cursor, ["{", "}"]).text.trim();
    if (cursor.peek() !== "{") {
      cursor.fail("WXSS_PARSE_ERROR", "A keyframe needs a declaration block.", start);
    }
    cursor.advance();
    if (selector.length === 0) cursor.fail("WXSS_PARSE_ERROR", "A keyframe selector is empty.", start);
    const declarations = parseDeclarations(cursor, ctx);
    blocks.push(`${selector}{${formatDeclarations(declarations)}}`);
  }
}

/** Consume a balanced block whose opening `{` was already consumed. */
function skipBlock(cursor: CssCursor): void {
  const start = cursor.loc();
  let depth = 1;
  while (!cursor.eof) {
    const char = cursor.peek();
    if (char === '"' || char === "'") {
      const quote = char;
      cursor.advance();
      while (!cursor.eof) {
        const current = cursor.peek();
        cursor.advance();
        if (current === "\\" && !cursor.eof) cursor.advance();
        else if (current === quote) break;
      }
      continue;
    }
    if (cursor.startsWith("/*")) {
      const end = cursor.source.indexOf("*/", cursor.index + 2);
      if (end === -1) cursor.fail("WXSS_PARSE_ERROR", "A comment is not terminated.", cursor.loc());
      cursor.advance(end + 2 - cursor.index);
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      cursor.advance();
      if (depth === 0) return;
      continue;
    }
    cursor.advance();
  }
  cursor.fail("WXSS_PARSE_ERROR", "A block is not closed.", start);
}

function importTarget(prelude: string): string | null {
  const raw = prelude.trim();
  if (raw.length === 0) return null;
  if (/^(?:https?:)?\/\//i.test(raw)) return null;
  const url = /^url\(\s*(['"]?)(.*?)\1\s*\)$/i.exec(raw);
  if (url) return url[2];
  const quoted = /^(['"])(.*?)\1$/.exec(raw);
  if (quoted) return quoted[2];
  return null;
}

function parseStylesheet(cursor: CssCursor, ctx: WxssContext, nested: boolean): string {
  const output: string[] = [];
  let sawRule = false;
  for (;;) {
    cursor.trivia();
    if (cursor.eof) {
      if (nested) cursor.fail("WXSS_PARSE_ERROR", "A block is not closed.");
      return output.join("");
    }
    if (cursor.peek() === "}") {
      if (!nested) cursor.fail("WXSS_PARSE_ERROR", "Unexpected \"}\".");
      cursor.advance();
      return output.join("");
    }
    if (cursor.peek() === "@") {
      const at = cursor.loc();
      cursor.advance();
      let name = "";
      while (!cursor.eof && /[A-Za-z-]/.test(cursor.peek())) {
        name += cursor.peek();
        cursor.advance();
      }
      name = name.toLowerCase();
      if (name.length === 0) cursor.fail("WXSS_PARSE_ERROR", "An at-rule has no name.", at);
      cursor.trivia();

      if (name === "import") {
        const { text, stop } = readUntil(cursor, [";"]);
        if (stop !== ";") cursor.fail("WXSS_PARSE_ERROR", "@import must end with \";\".", at);
        cursor.advance();
        if (nested) {
          error(ctx, "WXSS_UNSUPPORTED_FEATURE", "@import is only allowed at the top level.", at);
          continue;
        }
        if (sawRule) {
          error(ctx, "WXSS_PARSE_ERROR", "@import must precede every rule.", at);
          continue;
        }
        const target = importTarget(text);
        if (!target) {
          error(ctx, "WXSS_UNSUPPORTED_FEATURE", "Only a local @import target is supported.", at);
          continue;
        }
        if (/^(?:https?:|data:|file:)/i.test(target) || target.startsWith("//")) {
          error(ctx, "WXSS_UNSUPPORTED_FEATURE", "A remote @import is not supported.", at);
          continue;
        }
        const path = resolvePackagePath(ctx.file, target);
        if (!path) {
          error(ctx, "WXSS_PARSE_ERROR", `Unsafe @import path "${target}".`, at);
          continue;
        }
        if (ctx.stack.includes(path)) {
          error(ctx, "WXSS_PARSE_ERROR", `@import cycle: ${[...ctx.stack, path].join(" -> ")}.`, at);
          continue;
        }
        if (!ctx.options.loadFile) {
          error(ctx, "WXSS_PARSE_ERROR", `Cannot load "${path}": the compiler has no file reader.`, at);
          continue;
        }
        const source = ctx.options.loadFile(path);
        if (source === null) {
          error(ctx, "WXSS_PARSE_ERROR", `Cannot load "${path}": the file does not exist.`, at);
          continue;
        }
        const imported = compileWxssSource(source, path, ctx.options, [...ctx.stack, path]);
        if (!imported.ok) {
          ctx.diagnostics.push(...imported.diagnostics);
          continue;
        }
        ctx.files.push(path, ...imported.value.files);
        output.push(imported.value.css);
        continue;
      }

      if (name === "media" || name === "supports") {
        const prelude = readUntil(cursor, ["{", "}"]).text.trim();
        if (cursor.peek() !== "{") {
          cursor.fail("WXSS_PARSE_ERROR", `@${name} needs a block.`, at);
        }
        if (prelude.length === 0) cursor.fail("WXSS_PARSE_ERROR", `@${name} needs a condition.`, at);
        cursor.advance();
        if (/prefers-color-scheme/i.test(prelude)) {
          error(
            ctx,
            "WXSS_UNSUPPORTED_FEATURE",
            "prefers-color-scheme is unsupported; use [data-theme] instead.",
            at,
          );
        }
        const inner = parseStylesheet(cursor, ctx, true);
        output.push(`@${name} ${prelude}{${inner}}`);
        sawRule = true;
        continue;
      }

      if (name === "keyframes" || name === "-webkit-keyframes") {
        const prelude = readUntil(cursor, ["{", "}"]).text.trim();
        if (cursor.peek() !== "{") {
          cursor.fail("WXSS_PARSE_ERROR", `@${name} needs a block.`, at);
        }
        cursor.advance();
        if (prelude.length === 0) cursor.fail("WXSS_PARSE_ERROR", `@${name} needs a name.`, at);
        output.push(parseKeyframes(cursor, prelude, ctx));
        sawRule = true;
        continue;
      }

      if (name === "font-face") {
        const prelude = readUntil(cursor, ["{", "}"]).text.trim();
        if (cursor.peek() !== "{") {
          cursor.fail("WXSS_PARSE_ERROR", "@font-face needs a block.", at);
        }
        cursor.advance();
        const declarations = parseDeclarations(cursor, ctx);
        output.push(`@font-face${prelude.length > 0 ? ` ${prelude}` : ""}{${formatDeclarations(declarations)}}`);
        sawRule = true;
        continue;
      }

      error(ctx, "WXSS_UNSUPPORTED_FEATURE", `@${name} is not supported in WXSS.`, at);
      // Skip the block or the statement so one diagnostic does not cascade.
      const skipped = readUntil(cursor, [";", "{", "}"]);
      if (skipped.stop === "{") {
        cursor.advance();
        skipBlock(cursor);
      } else if (skipped.stop === ";") {
        cursor.advance();
      }
      continue;
    }

    const at = cursor.loc();
    const selector = readUntil(cursor, ["{", ";", "}"]).text.trim();
    if (cursor.peek() !== "{") {
      cursor.fail("WXSS_PARSE_ERROR", "A rule needs a selector and a declaration block.", at);
    }
    cursor.advance();
    if (selector.length === 0) cursor.fail("WXSS_PARSE_ERROR", "A rule has an empty selector.", at);
    const transformed = transformSelector(selector, at, ctx);
    const declarations = parseDeclarations(cursor, ctx);
    output.push(`${transformed}{${formatDeclarations(declarations)}}`);
    sawRule = true;
  }
}

function compileWxssSource(
  source: string,
  file: string,
  options: WxssCompileOptions,
  stack: string[],
): CompileResult<CompiledWxss> {
  const ctx: WxssContext = {
    file,
    options,
    diagnostics: [],
    files: [],
    stack,
  };
  const cursor = new CssCursor(source, file);
  try {
    const css = parseStylesheet(cursor, ctx, false);
    if (ctx.diagnostics.length > 0) return { ok: false, diagnostics: ctx.diagnostics };
    return { ok: true, value: { file, css, files: ctx.files }, diagnostics: [] };
  } catch (cause) {
    if (cause instanceof CssFailure) return { ok: false, diagnostics: [cause.entry] };
    throw cause;
  }
}

export function compileWxss(source: string, file = "app.wxss", options: WxssCompileOptions = {}): CompileResult<CompiledWxss> {
  return compileWxssSource(source, file, options, [file]);
}

/**
 * WXML parser.
 *
 * WXML is XML-like but not XML: attribute values hold `{{ }}` expressions,
 * directives are attributes (`wx:if`, `wx:for`, `bindtap`), and the tag set is
 * QChat's component registry. The parser only builds the syntax tree; the
 * compiler validates directives and produces the render plan. Every error
 * carries file, line, column and a registry code.
 */

import type { ErrorCode } from "@qchat/miniapp-contracts";
import { diagnostic, type CompileResult, type Diagnostic, type SourceLocation } from "./diagnostics.js";

export interface WxmlAttribute {
  name: string;
  /** `null` for a boolean attribute. */
  value: string | null;
  loc: SourceLocation;
}

export interface WxmlElement {
  type: "element";
  tag: string;
  attributes: WxmlAttribute[];
  children: WxmlNode[];
  selfClosing: boolean;
  loc: SourceLocation;
}

export interface WxmlText {
  type: "text";
  text: string;
  loc: SourceLocation;
}

export type WxmlNode = WxmlElement | WxmlText;

export interface WxmlDocument {
  type: "document";
  file: string;
  children: WxmlNode[];
}

const TAG_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
const ATTRIBUTE_NAME = /^[A-Za-z_:][A-Za-z0-9_:.-]*$/;

class ParseFailure {
  readonly entry: Diagnostic;
  constructor(entry: Diagnostic) {
    this.entry = entry;
  }
}

class Cursor {
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
    throw new ParseFailure(diagnostic(code, message, at));
  }

  skipWhitespace(): void {
    while (!this.eof && /\s/.test(this.peek())) this.advance();
  }
}

function readName(cursor: Cursor, pattern: RegExp, code: ErrorCode, what: string): string {
  const start = cursor.loc();
  let name = "";
  while (!cursor.eof && /[A-Za-z0-9_:.-]/.test(cursor.peek())) {
    name += cursor.peek();
    cursor.advance();
  }
  if (name.length === 0 || !pattern.test(name)) {
    cursor.fail(code, `Invalid ${what} name${name ? ` "${name}"` : ""}.`, start);
  }
  return name;
}

function parseOpen(cursor: Cursor): WxmlElement {
  const loc = cursor.loc();
  cursor.advance(); // <
  const tag = readName(cursor, TAG_NAME, "WXML_INVALID_TAG", "tag");
  const attributes: WxmlAttribute[] = [];
  const seen = new Set<string>();
  let selfClosing = false;

  for (;;) {
    cursor.skipWhitespace();
    if (cursor.eof) cursor.fail("WXML_UNCLOSED_TAG", `Element <${tag}> is not closed.`, loc);
    if (cursor.startsWith("/>")) {
      cursor.advance(2);
      selfClosing = true;
      break;
    }
    if (cursor.peek() === ">") {
      cursor.advance();
      break;
    }
    if (cursor.peek() === "/") {
      cursor.fail("WXML_PARSE_ERROR", "Expected '/>' to close the element.");
    }
    if (cursor.peek() === "<") {
      cursor.fail("WXML_UNCLOSED_TAG", `Element <${tag}> is not closed.`, loc);
    }

    const attributeLoc = cursor.loc();
    const name = readName(cursor, ATTRIBUTE_NAME, "WXML_INVALID_ATTRIBUTE", "attribute");
    if (seen.has(name)) {
      cursor.fail("WXML_INVALID_ATTRIBUTE", `Duplicate attribute "${name}".`, attributeLoc);
    }
    seen.add(name);

    cursor.skipWhitespace();
    let value: string | null = null;
    if (cursor.peek() === "=") {
      cursor.advance();
      cursor.skipWhitespace();
      const quote = cursor.peek();
      if (quote !== '"' && quote !== "'") {
        cursor.fail("WXML_INVALID_ATTRIBUTE", `Attribute "${name}" must be quoted.`);
      }
      cursor.advance();
      const start = cursor.index;
      while (!cursor.eof && cursor.peek() !== quote) cursor.advance();
      if (cursor.eof) {
        cursor.fail("WXML_INVALID_ATTRIBUTE", `Attribute "${name}" has no closing quote.`, attributeLoc);
      }
      value = cursor.source.slice(start, cursor.index);
      cursor.advance(); // closing quote
    }
    attributes.push({ name, value, loc: attributeLoc });
  }

  return { type: "element", tag, attributes, children: [], selfClosing, loc };
}

function parseClose(cursor: Cursor): string {
  const loc = cursor.loc();
  cursor.advance(2); // </
  const tag = readName(cursor, TAG_NAME, "WXML_INVALID_TAG", "tag");
  cursor.skipWhitespace();
  if (cursor.peek() !== ">") {
    cursor.fail("WXML_PARSE_ERROR", `Expected '>' after </${tag}>.`);
  }
  cursor.advance();
  return tag;
}

export function parseWxml(source: string, file = "app.wxml"): CompileResult<WxmlDocument> {
  const cursor = new Cursor(source, file);
  const root: WxmlElement = {
    type: "element",
    tag: "#root",
    attributes: [],
    children: [],
    selfClosing: false,
    loc: { file, line: 1, column: 1, offset: 0 },
  };
  const stack: WxmlElement[] = [root];

  try {
    while (!cursor.eof) {
      const top = stack[stack.length - 1];

      if (cursor.startsWith("<!--")) {
        const start = cursor.loc();
        const end = cursor.source.indexOf("-->", cursor.index + 4);
        if (end === -1) cursor.fail("WXML_UNTERMINATED_COMMENT", "Comment is not terminated.", start);
        cursor.advance(end + 3 - cursor.index);
        continue;
      }

      if (cursor.startsWith("</")) {
        const loc = cursor.loc();
        const tag = parseClose(cursor);
        if (top === root) {
          cursor.fail("WXML_UNEXPECTED_CLOSE_TAG", `Unexpected </${tag}> with no open element.`, loc);
        }
        if (top.tag !== tag) {
          cursor.fail("WXML_UNEXPECTED_CLOSE_TAG", `</${tag}> does not match <${top.tag}>.`, loc);
        }
        stack.pop();
        continue;
      }

      if (cursor.peek() === "<") {
        const element = parseOpen(cursor);
        top.children.push(element);
        if (!element.selfClosing) stack.push(element);
        continue;
      }

      const loc = cursor.loc();
      const start = cursor.index;
      while (!cursor.eof) {
        // A mustache block is opaque: `{{ a < b }}` is an expression, not a tag.
        if (cursor.startsWith("{{")) {
          const end = cursor.source.indexOf("}}", cursor.index + 2);
          if (end === -1) cursor.fail("WXML_PARSE_ERROR", "A mustache expression is not terminated.", cursor.loc());
          cursor.advance(end + 2 - cursor.index);
          continue;
        }
        if (cursor.peek() === "<") break;
        cursor.advance();
      }
      const text = cursor.source.slice(start, cursor.index);
      if (text.length > 0) top.children.push({ type: "text", text, loc });
    }

    if (stack.length > 1) {
      const unclosed = stack[stack.length - 1];
      return { ok: false, diagnostics: [diagnostic("WXML_UNCLOSED_TAG", `Element <${unclosed.tag}> is not closed.`, unclosed.loc)] };
    }
  } catch (cause) {
    if (cause instanceof ParseFailure) return { ok: false, diagnostics: [cause.entry] };
    throw cause;
  }

  return { ok: true, value: { type: "document", file, children: root.children }, diagnostics: [] };
}

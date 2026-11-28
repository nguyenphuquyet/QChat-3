/**
 * WXS (WeChat Script) parser.
 *
 * WXS is a small, non-JavaScript script language that runs in the view layer.
 * This module compiles it once at build time into the typed AST that
 * `@qchat/miniapp-contracts` defines; the device never parses source. The
 * accepted subset is deliberately narrow — `var`, named functions, `if`,
 * `for`/`for-in`/`while`/`do-while`, `return`/`break`/`continue`, the usual
 * operators, object/array/function literals, `getRegExp`, `console.log`,
 * `module.exports` and a literal `require`.
 *
 * Everything that can reach a host object or change the meaning of a function
 * (`this`, `new`, arrow functions, template literals, regular-expression
 * literals, `let`/`const`, `try`/`catch`, `switch`, labels, spread, optional
 * chaining, async/await, generators) is rejected with a diagnostic. ADR 013
 * records the subset and the reasons.
 */

import type {
  WxsAssignmentOperator,
  WxsBinaryOperator,
  WxsDoWhileStatement,
  WxsExpression,
  WxsForStatement,
  WxsFunctionStatement,
  WxsIfStatement,
  WxsLocation,
  WxsProgram,
  WxsReturnStatement,
  WxsStatement,
  WxsUnaryOperator,
  WxsVarStatement,
  WxsWhileStatement,
} from "@qchat/miniapp-contracts";
import { diagnostic, type CompileResult, type Diagnostic, type SourceLocation } from "./diagnostics.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const KEYWORDS = new Set([
  "var", "function", "return", "if", "else", "for", "in", "while", "do",
  "break", "continue", "true", "false", "null", "typeof", "new", "this",
  "let", "const", "switch", "case", "default", "try", "catch", "finally",
  "throw", "delete", "void", "instanceof", "class", "extends", "super",
  "yield", "async", "await", "with", "debugger", "of",
]);

const UNSUPPORTED_KEYWORDS: Record<string, string> = {
  let: "WXS uses var; let is not supported.",
  const: "WXS uses var; const is not supported.",
  switch: "switch is not supported in WXS.",
  case: "switch is not supported in WXS.",
  default: "switch is not supported in WXS.",
  try: "try/catch is not supported in WXS.",
  catch: "try/catch is not supported in WXS.",
  finally: "try/catch is not supported in WXS.",
  throw: "throw is not supported in WXS.",
  new: "new is not supported in WXS.",
  this: "this is not available in WXS.",
  delete: "delete is not supported in WXS.",
  void: "void is not supported in WXS.",
  instanceof: "instanceof is not supported in WXS.",
  class: "classes are not supported in WXS.",
  extends: "classes are not supported in WXS.",
  super: "classes are not supported in WXS.",
  yield: "generators are not supported in WXS.",
  async: "async functions are not supported in WXS.",
  await: "async functions are not supported in WXS.",
  with: "with is not supported in WXS.",
  debugger: "debugger is not supported in WXS.",
  of: "for-of is not supported in WXS.",
};

const PUNCTUATORS = [
  ">>>=", "===", "!==", ">>>", "<<=", ">>=", "...",
  "==", "!=", "<=", ">=", "&&", "||", "??", "++", "--",
  "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "**", "=>", "?.",
  "{", "}", "(", ")", "[", "]", ";", ",", "<", ">", "+", "-", "*", "/", "%",
  "&", "|", "^", "!", "~", "?", ":", "=", ".",
] as const;

const ASSIGNMENT_OPERATORS = new Set<WxsAssignmentOperator>(["=", "+=", "-=", "*=", "/=", "%="]);

const UNSUPPORTED_PUNCTUATORS: Record<string, string> = {
  "??": "The nullish coalescing operator is not supported in WXS.",
  "??=": "The nullish assignment operator is not supported in WXS.",
  "&&=": "Logical assignment is not supported in WXS.",
  "||=": "Logical assignment is not supported in WXS.",
  "**": "The exponent operator is not supported in WXS.",
  "**=": "The exponent assignment operator is not supported in WXS.",
  "=>": "Arrow functions are not supported in WXS; use function.",
  "?.": "Optional chaining is not supported in WXS.",
  "...": "Spread syntax is not supported in WXS.",
};

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER = /(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/;

type TokenType = "identifier" | "keyword" | "number" | "string" | "punct" | "eof";

interface Token {
  type: TokenType;
  value: string;
  offset: number;
  line: number;
  column: number;
}

class WxsSyntaxError extends Error {
  constructor(
    readonly code: "WXS_PARSE_ERROR" | "WXS_UNSUPPORTED_FEATURE" | "WXS_UNSAFE_ACCESS",
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const advance = (count: number): void => {
    for (let cursor = 0; cursor < count; cursor += 1) {
      if (source[index] === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      index += 1;
    }
  };

  while (index < source.length) {
    const char = source[index];

    if (char === " " || char === "\t" || char === "\r" || char === "\n" || char === "\uFEFF") {
      advance(1);
      continue;
    }

    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") advance(1);
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const start = index;
      advance(2);
      let closed = false;
      while (index < source.length) {
        if (source[index] === "*" && source[index + 1] === "/") {
          advance(2);
          closed = true;
          break;
        }
        advance(1);
      }
      if (!closed) throw new WxsSyntaxError("WXS_PARSE_ERROR", "A block comment is not terminated.", start);
      continue;
    }

    if (char === "`") {
      throw new WxsSyntaxError(
        "WXS_UNSUPPORTED_FEATURE",
        "Template literals are not supported in WXS; use string concatenation.",
        index,
      );
    }

    const startOffset = index;
    const startLine = line;
    const startColumn = column;

    if (char === '"' || char === "'") {
      const quote = char;
      let value = "";
      advance(1);
      let closed = false;
      while (index < source.length) {
        const current = source[index];
        if (current === "\\") {
          const next = source[index + 1];
          if (next === undefined) break;
          if (next === "\n") {
            advance(2);
            continue;
          }
          if (next === "u") {
            const hex = source.slice(index + 2, index + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw new WxsSyntaxError("WXS_PARSE_ERROR", "A string escape is malformed.", index);
            }
            value += String.fromCharCode(Number.parseInt(hex, 16));
            advance(6);
            continue;
          }
          if (next === "x") {
            const hex = source.slice(index + 2, index + 4);
            if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
              throw new WxsSyntaxError("WXS_PARSE_ERROR", "A string escape is malformed.", index);
            }
            value += String.fromCharCode(Number.parseInt(hex, 16));
            advance(4);
            continue;
          }
          const simple: Record<string, string> = {
            n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0",
          };
          value += simple[next] ?? next;
          advance(2);
          continue;
        }
        if (current === quote) {
          advance(1);
          closed = true;
          break;
        }
        if (current === "\n") break;
        value += current;
        advance(1);
      }
      if (!closed) throw new WxsSyntaxError("WXS_PARSE_ERROR", "A string literal is not terminated.", startOffset);
      tokens.push({ type: "string", value, offset: startOffset, line: startLine, column: startColumn });
      continue;
    }

    const rest = source.slice(index);
    const number = NUMBER.exec(rest);
    if (number && number.index === 0) {
      advance(number[0].length);
      tokens.push({ type: "number", value: number[0], offset: startOffset, line: startLine, column: startColumn });
      continue;
    }

    const identifier = IDENTIFIER.exec(rest);
    if (identifier && identifier.index === 0) {
      advance(identifier[0].length);
      tokens.push({
        type: KEYWORDS.has(identifier[0]) ? "keyword" : "identifier",
        value: identifier[0],
        offset: startOffset,
        line: startLine,
        column: startColumn,
      });
      continue;
    }

    const punctuator = PUNCTUATORS.find((candidate) => rest.startsWith(candidate));
    if (!punctuator) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `Unexpected character "${char}".`, startOffset);
    }
    const unsupported = UNSUPPORTED_PUNCTUATORS[punctuator];
    if (unsupported) throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", unsupported, startOffset);
    advance(punctuator.length);
    tokens.push({ type: "punct", value: punctuator, offset: startOffset, line: startLine, column: startColumn });
  }

  tokens.push({ type: "eof", value: "", offset: source.length, line, column });
  return tokens;
}

function location(token: Token): WxsLocation {
  return { line: token.line, column: token.column };
}

export interface ParseWxsOptions {
  /** Location of the first character of [source] in its package file. */
  base?: SourceLocation;
  /** Resolve `require("...")` to a package path; `null` means unsafe. */
  resolveRequire?: (specifier: string) => string | null;
}

class Parser {
  private index = 0;
  private functionDepth = 0;
  private loopDepth = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly resolveRequire?: (specifier: string) => string | null,
  ) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.tokens[this.index];
    if (this.index < this.tokens.length - 1) this.index += 1;
    return token;
  }

  private at(type: TokenType, value?: string): boolean {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  private atPunct(value: string): boolean {
    return this.at("punct", value);
  }

  private atKeyword(value: string): boolean {
    return this.at("keyword", value);
  }

  private acceptPunct(value: string): boolean {
    if (!this.atPunct(value)) return false;
    this.next();
    return true;
  }

  private expectPunct(value: string): Token {
    const token = this.next();
    if (token.type !== "punct" || token.value !== value) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `Expected "${value}".`, token.offset);
    }
    return token;
  }

  private expectKeyword(value: string): Token {
    const token = this.next();
    if (token.type !== "keyword" || token.value !== value) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `Expected "${value}".`, token.offset);
    }
    return token;
  }

  private expectIdentifier(what = "an identifier"): Token {
    const token = this.next();
    if (token.type !== "identifier") {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `Expected ${what}.`, token.offset);
    }
    return token;
  }

  private semicolon(): void {
    if (this.acceptPunct(";")) return;
    const token = this.peek();
    if (token.type === "eof" || (token.type === "punct" && token.value === "}")) return;
    throw new WxsSyntaxError("WXS_PARSE_ERROR", "Expected \";\".", token.offset);
  }

  private unsupported(token: Token): never {
    const message = UNSUPPORTED_KEYWORDS[token.value];
    if (message) throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", message, token.offset);
    throw new WxsSyntaxError("WXS_PARSE_ERROR", `Unexpected "${token.value}".`, token.offset);
  }

  parseProgram(): WxsProgram {
    const body: WxsStatement[] = [];
    while (!this.at("eof")) {
      body.push(this.parseStatement());
    }
    return { type: "program", body };
  }

  private parseStatement(): WxsStatement {
    const token = this.peek();

    if (token.type === "punct") {
      if (token.value === ";") {
        this.next();
        return { type: "empty", loc: location(token) };
      }
      if (token.value === "{") {
        const start = this.next();
        return { type: "block", body: this.parseBlockBody(), loc: location(start) };
      }
    }

    if (token.type === "keyword") {
      switch (token.value) {
        case "var": return this.parseVar(true);
        case "function": return this.parseFunctionDeclaration();
        case "if": return this.parseIf();
        case "for": return this.parseFor();
        case "while": return this.parseWhile();
        case "do": return this.parseDoWhile();
        case "return": return this.parseReturn();
        case "break": return this.parseJump("break");
        case "continue": return this.parseJump("continue");
        case "else": throw new WxsSyntaxError("WXS_PARSE_ERROR", "\"else\" has no matching \"if\".", token.offset);
        default: this.unsupported(token);
      }
    }

    const start = this.peek();
    const expression = this.parseExpression();
    this.semicolon();
    return { type: "expression", expression, loc: location(start) };
  }

  private parseBlockBody(): WxsStatement[] {
    const body: WxsStatement[] = [];
    while (!this.atPunct("}")) {
      if (this.at("eof")) {
        throw new WxsSyntaxError("WXS_PARSE_ERROR", "A block is not closed.", this.peek().offset);
      }
      body.push(this.parseStatement());
    }
    this.expectPunct("}");
    return body;
  }

  private parseBody(): WxsStatement[] {
    if (!this.atPunct("{")) return [this.parseStatement()];
    this.expectPunct("{");
    return this.parseBlockBody();
  }

  private parseLoopBody(): WxsStatement[] {
    this.loopDepth += 1;
    try {
      return this.parseBody();
    } finally {
      this.loopDepth -= 1;
    }
  }

  private parseFunctionBody(): WxsStatement[] {
    const savedLoopDepth = this.loopDepth;
    this.loopDepth = 0;
    this.functionDepth += 1;
    try {
      this.expectPunct("{");
      return this.parseBlockBody();
    } finally {
      this.functionDepth -= 1;
      this.loopDepth = savedLoopDepth;
    }
  }

  private parseVar(withSemicolon: boolean): WxsVarStatement {
    const start = this.expectKeyword("var");
    const declarations: { name: string; init: WxsExpression | null }[] = [];
    do {
      const name = this.expectIdentifier("a variable name");
      let init: WxsExpression | null = null;
      if (this.acceptPunct("=")) init = this.parseAssignment();
      declarations.push({ name: name.value, init });
    } while (this.acceptPunct(","));
    if (withSemicolon) this.semicolon();
    return { type: "var", declarations, loc: location(start) };
  }

  private parseFunctionDeclaration(): WxsFunctionStatement {
    const start = this.expectKeyword("function");
    const name = this.expectIdentifier("a function name");
    const params = this.parseParams();
    const body = this.parseFunctionBody();
    return { type: "function", name: name.value, params, body, loc: location(start) };
  }

  private parseParams(): string[] {
    this.expectPunct("(");
    const params: string[] = [];
    if (!this.atPunct(")")) {
      do {
        if (this.atPunct("...")) {
          throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Rest parameters are not supported in WXS.", this.peek().offset);
        }
        params.push(this.expectIdentifier("a parameter name").value);
        if (this.atPunct("=")) {
          throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Default parameters are not supported in WXS.", this.peek().offset);
        }
      } while (this.acceptPunct(","));
    }
    this.expectPunct(")");
    return params;
  }

  private parseIf(): WxsIfStatement {
    const start = this.expectKeyword("if");
    this.expectPunct("(");
    const test = this.parseExpression();
    this.expectPunct(")");
    const consequent = this.parseBody();
    let alternate: WxsStatement[] | null = null;
    if (this.atKeyword("else")) {
      this.next();
      alternate = this.parseBody();
    }
    return { type: "if", test, consequent, alternate, loc: location(start) };
  }

  private parseFor(): WxsStatement {
    const start = this.expectKeyword("for");
    this.expectPunct("(");

    if (this.atKeyword("var")) {
      const varStart = this.next();
      const name = this.expectIdentifier("a loop variable");
      if (this.atKeyword("in")) {
        this.next();
        const object = this.parseExpression();
        this.expectPunct(")");
        const body = this.parseLoopBody();
        return { type: "forIn", name: name.value, object, body, loc: location(start) };
      }
      if (this.atKeyword("of")) {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "for-of is not supported in WXS.", this.peek().offset);
      }
      const declarations: { name: string; init: WxsExpression | null }[] = [];
      let init: WxsExpression | null = null;
      if (this.acceptPunct("=")) init = this.parseAssignment();
      declarations.push({ name: name.value, init });
      while (this.acceptPunct(",")) {
        const nextName = this.expectIdentifier("a variable name");
        let nextInit: WxsExpression | null = null;
        if (this.acceptPunct("=")) nextInit = this.parseAssignment();
        declarations.push({ name: nextName.value, init: nextInit });
      }
      this.expectPunct(";");
      const varStatement: WxsStatement = { type: "var", declarations, loc: location(varStart) };
      const test = this.atPunct(";") ? null : this.parseExpression();
      this.expectPunct(";");
      const update = this.atPunct(")") ? null : this.parseExpression();
      this.expectPunct(")");
      return { type: "for", init: varStatement, test, update, body: this.parseLoopBody(), loc: location(start) };
    }

    let init: WxsStatement | null = null;
    if (!this.atPunct(";")) {
      const initStart = this.peek();
      const expression = this.parseExpression();
      if (this.atKeyword("in")) {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "for-in needs a var declaration.", this.peek().offset);
      }
      init = { type: "expression", expression, loc: location(initStart) };
    }
    this.expectPunct(";");
    const test = this.atPunct(";") ? null : this.parseExpression();
    this.expectPunct(";");
    const update = this.atPunct(")") ? null : this.parseExpression();
    this.expectPunct(")");
    return { type: "for", init, test, update, body: this.parseLoopBody(), loc: location(start) };
  }

  private parseWhile(): WxsWhileStatement {
    const start = this.expectKeyword("while");
    this.expectPunct("(");
    const test = this.parseExpression();
    this.expectPunct(")");
    return { type: "while", test, body: this.parseLoopBody(), loc: location(start) };
  }

  private parseDoWhile(): WxsDoWhileStatement {
    const start = this.expectKeyword("do");
    const body = this.parseLoopBody();
    this.expectKeyword("while");
    this.expectPunct("(");
    const test = this.parseExpression();
    this.expectPunct(")");
    this.semicolon();
    return { type: "doWhile", body, test, loc: location(start) };
  }

  private parseReturn(): WxsReturnStatement {
    const start = this.expectKeyword("return");
    if (this.functionDepth === 0) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", "\"return\" is only allowed inside a function.", start.offset);
    }
    let argument: WxsExpression | null = null;
    if (!this.atPunct(";") && !this.atPunct("}") && !this.at("eof")) {
      argument = this.parseExpression();
    }
    this.semicolon();
    return { type: "return", argument, loc: location(start) };
  }

  private parseJump(kind: "break" | "continue"): WxsStatement {
    const start = this.next();
    if (this.at("identifier")) {
      throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Labels are not supported in WXS.", this.peek().offset);
    }
    if (this.loopDepth === 0) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `"${kind}" is only allowed inside a loop.`, start.offset);
    }
    this.semicolon();
    return { type: kind, loc: location(start) };
  }

  parseExpression(): WxsExpression {
    let expression = this.parseAssignment();
    if (!this.atPunct(",")) return expression;
    const items: WxsExpression[] = [expression];
    while (this.acceptPunct(",")) items.push(this.parseAssignment());
    return { type: "sequence", items, loc: items[0].loc };
  }

  private parseAssignment(): WxsExpression {
    const start = this.peek();
    const left = this.parseConditional();
    const token = this.peek();
    if (token.type === "punct" && ASSIGNMENT_OPERATORS.has(token.value as WxsAssignmentOperator)) {
      if (left.type !== "identifier" && left.type !== "member") {
        throw new WxsSyntaxError("WXS_PARSE_ERROR", "The assignment target is not a variable or property.", token.offset);
      }
      this.next();
      const value = this.parseAssignment();
      return {
        type: "assignment",
        op: token.value as WxsAssignmentOperator,
        target: left,
        value,
        loc: location(start),
      };
    }
    return left;
  }

  private parseConditional(): WxsExpression {
    const start = this.peek();
    const test = this.parseBinary(0);
    if (!this.acceptPunct("?")) return test;
    const consequent = this.parseAssignment();
    this.expectPunct(":");
    const alternate = this.parseAssignment();
    return { type: "conditional", test, consequent, alternate, loc: location(start) };
  }

  private parseBinary(level: number): WxsExpression {
    const levels: readonly (readonly WxsBinaryOperator[])[] = [
      ["|"],
      ["^"],
      ["&"],
      ["==", "!=", "===", "!=="],
      ["<", "<=", ">", ">="],
      ["<<", ">>", ">>>"],
      ["+", "-"],
      ["*", "/", "%"],
    ];
    if (level >= levels.length) return this.parseUnary();
    let left = this.parseBinary(level + 1);
    for (;;) {
      const token = this.peek();
      if (token.type !== "punct" || !(levels[level] as readonly string[]).includes(token.value)) break;
      this.next();
      const right = this.parseBinary(level + 1);
      left = { type: "binary", op: token.value as WxsBinaryOperator, left, right, loc: left.loc };
    }
    return left;
  }

  private parseUnary(): WxsExpression {
    const token = this.peek();
    if (token.type === "punct" && (token.value === "!" || token.value === "-" || token.value === "+" || token.value === "~")) {
      this.next();
      return { type: "unary", op: token.value as WxsUnaryOperator, operand: this.parseUnary(), loc: location(token) };
    }
    if (token.type === "punct" && (token.value === "++" || token.value === "--")) {
      this.next();
      return {
        type: "update",
        op: token.value,
        prefix: true,
        argument: this.parseUnary(),
        loc: location(token),
      };
    }
    if (token.type === "keyword" && token.value === "typeof") {
      this.next();
      return { type: "unary", op: "typeof", operand: this.parseUnary(), loc: location(token) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): WxsExpression {
    let expression = this.parsePrimary();
    for (;;) {
      const token = this.peek();
      if (token.type !== "punct") break;
      if (token.value === ".") {
        this.next();
        const property = this.next();
        if (property.type !== "identifier" && property.type !== "keyword") {
          throw new WxsSyntaxError("WXS_PARSE_ERROR", "Expected a property name after \".\".", property.offset);
        }
        if (FORBIDDEN_KEYS.has(property.value)) {
          throw new WxsSyntaxError("WXS_UNSAFE_ACCESS", `Property "${property.value}" is not allowed.`, property.offset);
        }
        expression = {
          type: "member",
          object: expression,
          property: { type: "literal", value: property.value, loc: location(property) },
          computed: false,
          loc: location(token),
        };
        continue;
      }
      if (token.value === "[") {
        this.next();
        const property = this.parseExpression();
        this.expectPunct("]");
        expression = { type: "member", object: expression, property, computed: true, loc: location(token) };
        continue;
      }
      if (token.value === "(") {
        this.next();
        const args: WxsExpression[] = [];
        if (!this.atPunct(")")) {
          do {
            args.push(this.parseAssignment());
          } while (this.acceptPunct(","));
        }
        this.expectPunct(")");
        if (expression.type === "identifier" && expression.name === "require") {
          expression = this.requireExpression(args, token);
          continue;
        }
        expression = { type: "call", callee: expression, args, loc: location(token) };
        continue;
      }
      if (token.value === "++" || token.value === "--") {
        this.next();
        expression = { type: "update", op: token.value, prefix: false, argument: expression, loc: location(token) };
        continue;
      }
      if (token.value === "=>") {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Arrow functions are not supported in WXS.", token.offset);
      }
      break;
    }
    return expression;
  }

  private requireExpression(args: WxsExpression[], token: Token): WxsExpression {
    if (args.length !== 1 || args[0].type !== "literal" || typeof args[0].value !== "string") {
      throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "require needs one literal path.", token.offset);
    }
    const specifier = args[0].value;
    const resolved = this.resolveRequire ? this.resolveRequire(specifier) : specifier;
    if (resolved === null) {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", `Unsafe require path "${specifier}".`, token.offset);
    }
    return { type: "require", path: resolved, loc: location(token) };
  }

  private parsePrimary(): WxsExpression {
    const token = this.next();

    if (token.type === "number") {
      const value = token.value.startsWith("0x") || token.value.startsWith("0X")
        ? Number.parseInt(token.value.slice(2), 16)
        : Number(token.value);
      return { type: "literal", value, loc: location(token) };
    }

    if (token.type === "string") {
      return { type: "literal", value: token.value, loc: location(token) };
    }

    if (token.type === "identifier") {
      return { type: "identifier", name: token.value, loc: location(token) };
    }

    if (token.type === "keyword") {
      switch (token.value) {
        case "true": return { type: "literal", value: true, loc: location(token) };
        case "false": return { type: "literal", value: false, loc: location(token) };
        case "null": return { type: "literal", value: null, loc: location(token) };
        case "function": return this.parseFunctionExpression(token);
        default: this.unsupported(token);
      }
    }

    if (token.type === "punct") {
      if (token.value === "(") {
        const expression = this.parseExpression();
        this.expectPunct(")");
        if (this.atPunct("=>")) {
          throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Arrow functions are not supported in WXS.", this.peek().offset);
        }
        return expression;
      }
      if (token.value === "[") {
        const items: WxsExpression[] = [];
        while (!this.atPunct("]")) {
          if (this.atPunct("...")) {
            throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Spread syntax is not supported in WXS.", this.peek().offset);
          }
          items.push(this.parseAssignment());
          if (!this.acceptPunct(",")) break;
        }
        this.expectPunct("]");
        return { type: "array", items, loc: location(token) };
      }
      if (token.value === "{") {
        return this.parseObjectLiteral(token);
      }
      if (token.value === "/") {
        throw new WxsSyntaxError(
          "WXS_UNSUPPORTED_FEATURE",
          "Regular-expression literals are not supported in WXS; use getRegExp.",
          token.offset,
        );
      }
      if (token.value === "=>") {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Arrow functions are not supported in WXS.", token.offset);
      }
    }

    if (token.type === "eof") {
      throw new WxsSyntaxError("WXS_PARSE_ERROR", "The expression is incomplete.", token.offset);
    }
    throw new WxsSyntaxError("WXS_PARSE_ERROR", `Unexpected "${token.value}".`, token.offset);
  }

  private parseFunctionExpression(start: Token): WxsExpression {
    let name: string | null = null;
    if (this.at("identifier")) name = this.next().value;
    const params = this.parseParams();
    const body = this.parseFunctionBody();
    return { type: "functionExpression", name, params, body, loc: location(start) };
  }

  private parseObjectLiteral(start: Token): WxsExpression {
    const entries: { key: string; value: WxsExpression }[] = [];
    while (!this.atPunct("}")) {
      if (this.atPunct("...")) {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Spread syntax is not supported in WXS.", this.peek().offset);
      }
      if (this.atPunct("[")) {
        throw new WxsSyntaxError("WXS_UNSUPPORTED_FEATURE", "Computed object keys are not supported in WXS.", this.peek().offset);
      }
      const key = this.next();
      if (key.type !== "identifier" && key.type !== "string" && key.type !== "number" && key.type !== "keyword") {
        throw new WxsSyntaxError("WXS_PARSE_ERROR", "Expected an object key.", key.offset);
      }
      if (FORBIDDEN_KEYS.has(key.value)) {
        throw new WxsSyntaxError("WXS_UNSAFE_ACCESS", `Property "${key.value}" is not allowed.`, key.offset);
      }
      let value: WxsExpression;
      if (this.acceptPunct(":")) {
        value = this.parseAssignment();
      } else if (key.type === "identifier") {
        value = { type: "identifier", name: key.value, loc: location(key) };
      } else {
        throw new WxsSyntaxError("WXS_PARSE_ERROR", "Expected \":\" after an object key.", this.peek().offset);
      }
      entries.push({ key: key.value, value });
      if (!this.acceptPunct(",")) break;
    }
    this.expectPunct("}");
    return { type: "object", entries, loc: location(start) };
  }
}

function offsetLocation(base: SourceLocation, source: string, offset: number): SourceLocation {
  let line = base.line;
  let column = base.column;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { file: base.file, line, column, offset: base.offset + offset };
}

/**
 * Compile one WXS source. `file` names the package file; `options.base` lets an
 * inline `<wxs>` block report positions in the page WXML rather than in the
 * extracted code.
 */
export function parseWxs(source: string, file: string, options: ParseWxsOptions = {}): CompileResult<WxsProgram> {
  const base: SourceLocation = options.base ?? { file, line: 1, column: 1, offset: 0 };
  try {
    const tokens = tokenize(source);
    const program = new Parser(tokens, options.resolveRequire).parseProgram();
    return { ok: true, value: program, diagnostics: [] };
  } catch (cause) {
    if (cause instanceof WxsSyntaxError) {
      const at = offsetLocation(base, source, cause.offset);
      const entry: Diagnostic = diagnostic(cause.code, cause.message, at);
      return { ok: false, diagnostics: [entry] };
    }
    throw cause;
  }
}

/** Every `require` path a program pulls in, in source order and deduplicated. */
export function collectWxsRequires(program: WxsProgram): string[] {
  const paths = new Set<string>();

  const visitExpression = (expression: WxsExpression): void => {
    switch (expression.type) {
      case "literal":
      case "identifier":
        return;
      case "array":
        for (const item of expression.items) visitExpression(item);
        return;
      case "object":
        for (const entry of expression.entries) visitExpression(entry.value);
        return;
      case "functionExpression":
        for (const statement of expression.body) visitStatement(statement);
        return;
      case "member":
        visitExpression(expression.object);
        visitExpression(expression.property);
        return;
      case "call":
        visitExpression(expression.callee);
        for (const argument of expression.args) visitExpression(argument);
        return;
      case "require":
        paths.add(expression.path);
        return;
      case "unary":
        visitExpression(expression.operand);
        return;
      case "update":
        visitExpression(expression.argument);
        return;
      case "binary":
      case "logical":
        visitExpression(expression.left);
        visitExpression(expression.right);
        return;
      case "conditional":
        visitExpression(expression.test);
        visitExpression(expression.consequent);
        visitExpression(expression.alternate);
        return;
      case "assignment":
        visitExpression(expression.target);
        visitExpression(expression.value);
        return;
      case "sequence":
        for (const item of expression.items) visitExpression(item);
        return;
    }
  };

  const visitStatement = (statement: WxsStatement): void => {
    switch (statement.type) {
      case "var":
        for (const declaration of statement.declarations) {
          if (declaration.init) visitExpression(declaration.init);
        }
        return;
      case "function":
        for (const entry of statement.body) visitStatement(entry);
        return;
      case "return":
        if (statement.argument) visitExpression(statement.argument);
        return;
      case "if":
        visitExpression(statement.test);
        for (const entry of statement.consequent) visitStatement(entry);
        for (const entry of statement.alternate ?? []) visitStatement(entry);
        return;
      case "for":
        if (statement.init) visitStatement(statement.init);
        if (statement.test) visitExpression(statement.test);
        if (statement.update) visitExpression(statement.update);
        for (const entry of statement.body) visitStatement(entry);
        return;
      case "forIn":
        visitExpression(statement.object);
        for (const entry of statement.body) visitStatement(entry);
        return;
      case "while":
        visitExpression(statement.test);
        for (const entry of statement.body) visitStatement(entry);
        return;
      case "doWhile":
        for (const entry of statement.body) visitStatement(entry);
        visitExpression(statement.test);
        return;
      case "block":
        for (const entry of statement.body) visitStatement(entry);
        return;
      case "expression":
        visitExpression(statement.expression);
        return;
      case "break":
      case "continue":
      case "empty":
        return;
    }
  };

  for (const statement of program.body) visitStatement(statement);
  return [...paths];
}

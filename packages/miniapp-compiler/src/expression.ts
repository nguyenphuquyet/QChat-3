/**
 * The WXML data-expression language (`{{ ... }}`).
 *
 * WXML expressions are not JavaScript and are never handed to `eval`. This
 * module parses the documented subset — literals, property and index access,
 * unary/binary operators, the ternary operator, array literals and object
 * literals — and evaluates it against page data. The only call form is a
 * function of a declared page WXS module (`{{ m.format(x) }}`); assignment,
 * `new`, spread and every other executable form are rejected at compile time.
 */

export type Expression =
  | { kind: "literal"; value: string | number | boolean | null | undefined }
  | { kind: "identifier"; name: string }
  | { kind: "member"; object: Expression; property: Expression; computed: boolean }
  | { kind: "call"; callee: Expression; args: Expression[] }
  | { kind: "unary"; op: "!" | "-" | "+"; operand: Expression }
  | { kind: "binary"; op: BinaryOperator; left: Expression; right: Expression }
  | { kind: "conditional"; test: Expression; consequent: Expression; alternate: Expression }
  | { kind: "array"; items: Expression[] }
  | { kind: "object"; entries: ObjectEntry[] };

export interface ExpressionParseOptions {
  /**
   * WXS module names declared by the page. A call is accepted only when its
   * callee is a path rooted at one of these modules; every other call is a
   * compile error.
   */
  wxsModules?: ReadonlySet<string>;
}

export interface ExpressionEvaluateOptions {
  /** Call one WXS export with already-evaluated arguments. */
  call?: (path: string, args: readonly unknown[]) => unknown;
}

export type ObjectEntry = { key: string; value: Expression } | { spread: Expression };

export type BinaryOperator =
  | "+" | "-" | "*" | "/" | "%"
  | "===" | "!==" | "==" | "!="
  | "<" | "<=" | ">" | ">="
  | "&&" | "||";

export interface ExpressionError {
  message: string;
  /** Offset in the expression source, 0-based. */
  offset: number;
}

export type ParseExpressionResult =
  | { ok: true; expression: Expression }
  | { ok: false; error: ExpressionError };

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * `m.fn` / `m.util.fn` as segments, or `null` for any other callee shape.
 * Computed access is not a WXS call path because the module must be known at
 * build time.
 */
export function expressionCallPath(expression: Expression): string[] | null {
  if (expression.kind === "identifier") return [expression.name];
  if (expression.kind !== "member" || expression.computed) return null;
  const property = expression.property;
  if (property.kind !== "literal" || typeof property.value !== "string") return null;
  const parent = expressionCallPath(expression.object);
  if (!parent) return null;
  return [...parent, property.value];
}

type TokenType = "number" | "string" | "identifier" | "operator" | "eof";

interface Token {
  type: TokenType;
  value: string;
  offset: number;
}

const OPERATORS = [
  "===", "!==", "==", "!=", "<=", ">=", "&&", "||", "...",
  "+", "-", "*", "/", "%", "!", "<", ">", "?", ":", ".", "[", "]", "(", ")", "{", "}", ",",
] as const;

const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER = /(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/;

class ExpressionFailure extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const rest = source.slice(index);

    if (char === '"' || char === "'") {
      const quote = char;
      let cursor = index + 1;
      let value = "";
      let closed = false;
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === "\\") {
          const next = source[cursor + 1];
          if (next === undefined) break;
          value += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
          cursor += 2;
          continue;
        }
        if (current === quote) {
          cursor += 1;
          closed = true;
          break;
        }
        value += current;
        cursor += 1;
      }
      if (!closed) throw new ExpressionFailure("A string literal is not terminated.", index);
      tokens.push({ type: "string", value, offset: index });
      index = cursor;
      continue;
    }

    const number = NUMBER.exec(rest);
    if (number && number.index === 0) {
      tokens.push({ type: "number", value: number[0], offset: index });
      index += number[0].length;
      continue;
    }

    const identifier = IDENTIFIER.exec(rest);
    if (identifier && identifier.index === 0) {
      tokens.push({ type: "identifier", value: identifier[0], offset: index });
      index += identifier[0].length;
      continue;
    }

    if (rest.startsWith("?.")) {
      throw new ExpressionFailure("Optional chaining is not supported in a WXML expression.", index);
    }
    const operator = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (!operator) {
      throw new ExpressionFailure(`Unexpected character "${char}".`, index);
    }
    tokens.push({ type: "operator", value: operator, offset: index });
    index += operator.length;
  }
  tokens.push({ type: "eof", value: "", offset: source.length });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly options: ExpressionParseOptions,
  ) {}

  private peek(): Token {
    return this.tokens[this.index];
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private isOperator(value: string): boolean {
    const token = this.peek();
    return token.type === "operator" && token.value === value;
  }

  private expect(value: string): Token {
    const token = this.next();
    if (token.type !== "operator" || token.value !== value) {
      throw new ExpressionFailure(`Expected "${value}".`, token.offset);
    }
    return token;
  }

  parse(): Expression {
    const expression = this.parseTernary();
    const token = this.peek();
    if (token.type !== "eof") {
      throw new ExpressionFailure(`Unexpected "${token.value}".`, token.offset);
    }
    return expression;
  }

  private parseTernary(): Expression {
    const test = this.parseBinary(0);
    if (!this.isOperator("?")) return test;
    this.next();
    const consequent = this.parseTernary();
    this.expect(":");
    const alternate = this.parseTernary();
    return { kind: "conditional", test, consequent, alternate };
  }

  private parseBinary(level: number): Expression {
    const levels: readonly (readonly BinaryOperator[])[] = [
      ["||"],
      ["&&"],
      ["===", "!==", "==", "!="],
      ["<", "<=", ">", ">="],
      ["+", "-"],
      ["*", "/", "%"],
    ];
    if (level >= levels.length) return this.parseUnary();
    let left = this.parseBinary(level + 1);
    for (;;) {
      const token = this.peek();
      if (token.type !== "operator" || !(levels[level] as readonly string[]).includes(token.value)) break;
      this.next();
      const right = this.parseBinary(level + 1);
      left = { kind: "binary", op: token.value as BinaryOperator, left, right };
    }
    return left;
  }

  private parseUnary(): Expression {
    const token = this.peek();
    if (token.type === "operator" && (token.value === "!" || token.value === "-" || token.value === "+")) {
      this.next();
      return { kind: "unary", op: token.value, operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expression = this.parsePrimary();
    for (;;) {
      if (this.isOperator(".")) {
        this.next();
        const property = this.next();
        if (property.type !== "identifier") {
          throw new ExpressionFailure("Expected a property name after \".\".", property.offset);
        }
        if (FORBIDDEN_KEYS.has(property.value)) {
          throw new ExpressionFailure(`Property "${property.value}" is not allowed.`, property.offset);
        }
        expression = {
          kind: "member",
          object: expression,
          property: { kind: "literal", value: property.value },
          computed: false,
        };
        continue;
      }
      if (this.isOperator("[")) {
        this.next();
        const property = this.parseTernary();
        this.expect("]");
        expression = { kind: "member", object: expression, property, computed: true };
        continue;
      }
      if (this.isOperator("(")) {
        this.next();
        const args: Expression[] = [];
        if (!this.isOperator(")")) {
          for (;;) {
            args.push(this.parseTernary());
            if (!this.isOperator(",")) break;
            this.next();
          }
        }
        this.expect(")");
        const path = expressionCallPath(expression);
        const modules = this.options.wxsModules;
        if (!modules) {
          throw new ExpressionFailure("Function calls are not supported in a WXML expression.", this.peek().offset);
        }
        if (!path || path.length < 2 || !modules.has(path[0])) {
          throw new ExpressionFailure(
            "Only a function of a declared WXS module can be called in a WXML expression.",
            this.peek().offset,
          );
        }
        expression = { kind: "call", callee: expression, args };
        continue;
      }
      return expression;
    }
  }

  private parsePrimary(): Expression {
    const token = this.next();
    if (token.type === "number") {
      const value = token.value.startsWith("0x") || token.value.startsWith("0X")
        ? Number.parseInt(token.value.slice(2), 16)
        : Number(token.value);
      return { kind: "literal", value };
    }
    if (token.type === "string") return { kind: "literal", value: token.value };
    if (token.type === "identifier") {
      switch (token.value) {
        case "true": return { kind: "literal", value: true };
        case "false": return { kind: "literal", value: false };
        case "null": return { kind: "literal", value: null };
        case "undefined": return { kind: "literal", value: undefined };
        case "this": throw new ExpressionFailure("\"this\" is not available in a WXML expression.", token.offset);
        case "new": throw new ExpressionFailure("\"new\" is not supported in a WXML expression.", token.offset);
        case "function": throw new ExpressionFailure("Functions are not supported in a WXML expression.", token.offset);
        default: return { kind: "identifier", name: token.value };
      }
    }
    if (token.type === "operator" && token.value === "(") {
      const expression = this.parseTernary();
      this.expect(")");
      return expression;
    }
    if (token.type === "operator" && token.value === "[") {
      const items: Expression[] = [];
      if (!this.isOperator("]")) {
        for (;;) {
          items.push(this.parseTernary());
          if (!this.isOperator(",")) break;
          this.next();
        }
      }
      this.expect("]");
      return { kind: "array", items };
    }
    if (token.type === "operator" && token.value === "{") {
      const entries: ObjectEntry[] = [];
      if (!this.isOperator("}")) {
        for (;;) {
          if (this.isOperator("...")) {
            this.next();
            entries.push({ spread: this.parseTernary() });
          } else {
            const key = this.next();
            if (key.type !== "identifier" && key.type !== "string" && key.type !== "number") {
              throw new ExpressionFailure("Expected an object key.", key.offset);
            }
            if (FORBIDDEN_KEYS.has(key.value)) {
              throw new ExpressionFailure(`Property "${key.value}" is not allowed.`, key.offset);
            }
            this.expect(":");
            entries.push({ key: key.value, value: this.parseTernary() });
          }
          if (!this.isOperator(",")) break;
          this.next();
        }
      }
      this.expect("}");
      return { kind: "object", entries };
    }
    throw new ExpressionFailure(
      token.type === "eof" ? "The expression is incomplete." : `Unexpected "${token.value}".`,
      token.offset,
    );
  }
}

export function parseExpression(source: string, options: ExpressionParseOptions = {}): ParseExpressionResult {
  try {
    return { ok: true, expression: new Parser(tokenize(source), options).parse() };
  } catch (cause) {
    if (cause instanceof ExpressionFailure) {
      return { ok: false, error: { message: cause.message, offset: cause.offset } };
    }
    throw cause;
  }
}

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function readProperty(target: unknown, key: string | number): unknown {
  if (target === null || target === undefined) return undefined;
  const name = String(key);
  if (FORBIDDEN_KEYS.has(name)) return undefined;
  if (typeof target === "string") {
    if (name === "length") return target.length;
    const index = Number(name);
    return Number.isInteger(index) && index >= 0 && index < target.length ? target[index] : undefined;
  }
  if (Array.isArray(target)) {
    if (name === "length") return target.length;
    const index = Number(name);
    return Number.isInteger(index) && index >= 0 && index < target.length ? target[index] : undefined;
  }
  if (typeof target === "object") {
    return hasOwn(target, name) ? (target as Record<string, unknown>)[name] : undefined;
  }
  return undefined;
}

function truthy(value: unknown): boolean {
  return Boolean(value);
}

function add(left: unknown, right: unknown): unknown {
  if (typeof left === "number" && typeof right === "number") return left + right;
  if (typeof left === "string" || typeof right === "string") return `${left ?? ""}${right ?? ""}`;
  return (left as number) + (right as number);
}

function compare(operator: BinaryOperator, left: unknown, right: unknown): unknown {
  switch (operator) {
    case "===": return left === right;
    case "!==": return left !== right;
    // WXML follows JavaScript's loose equality; the inputs are JSON data only.
    case "==": return left == right; // eslint-disable-line eqeqeq
    case "!=": return left != right; // eslint-disable-line eqeqeq
    case "<": return (left as number) < (right as number);
    case "<=": return (left as number) <= (right as number);
    case ">": return (left as number) > (right as number);
    case ">=": return (left as number) >= (right as number);
    default: throw new Error(`not a comparison: ${operator}`);
  }
}

export function evaluateExpression(
  expression: Expression,
  scope: Record<string, unknown>,
  options: ExpressionEvaluateOptions = {},
): unknown {
  switch (expression.kind) {
    case "literal":
      return expression.value;
    case "identifier":
      return hasOwn(scope, expression.name) ? scope[expression.name] : undefined;
    case "member": {
      const object = evaluateExpression(expression.object, scope, options);
      const property = evaluateExpression(expression.property, scope, options) as string | number;
      return readProperty(object, property);
    }
    case "call": {
      const path = expressionCallPath(expression.callee);
      if (!path || !options.call) throw new Error("a WXML expression called a function without a WXS runtime");
      const args = expression.args.map((argument) => evaluateExpression(argument, scope, options));
      return options.call(path.join("."), args);
    }
    case "unary": {
      const operand = evaluateExpression(expression.operand, scope, options);
      if (expression.op === "!") return !truthy(operand);
      if (expression.op === "-") return -(operand as number);
      return +(operand as number);
    }
    case "binary": {
      if (expression.op === "&&") {
        const left = evaluateExpression(expression.left, scope, options);
        return truthy(left) ? evaluateExpression(expression.right, scope, options) : left;
      }
      if (expression.op === "||") {
        const left = evaluateExpression(expression.left, scope, options);
        return truthy(left) ? left : evaluateExpression(expression.right, scope, options);
      }
      const left = evaluateExpression(expression.left, scope, options);
      const right = evaluateExpression(expression.right, scope, options);
      if (expression.op === "+") return add(left, right);
      if (expression.op === "-") return (left as number) - (right as number);
      if (expression.op === "*") return (left as number) * (right as number);
      if (expression.op === "/") return (left as number) / (right as number);
      if (expression.op === "%") return (left as number) % (right as number);
      return compare(expression.op, left, right);
    }
    case "conditional":
      return truthy(evaluateExpression(expression.test, scope, options))
        ? evaluateExpression(expression.consequent, scope, options)
        : evaluateExpression(expression.alternate, scope, options);
    case "array":
      return expression.items.map((item) => evaluateExpression(item, scope, options));
    case "object": {
      const result: Record<string, unknown> = {};
      for (const entry of expression.entries) {
        if ("spread" in entry) {
          const value = evaluateExpression(entry.spread, scope, options);
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
              if (!FORBIDDEN_KEYS.has(key)) result[key] = item;
            }
          }
          continue;
        }
        result[entry.key] = evaluateExpression(entry.value, scope, options);
      }
      return result;
    }
  }
}

/** Convert an evaluated value to the string a WXML attribute or text expects. */
export function stringifyExpressionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

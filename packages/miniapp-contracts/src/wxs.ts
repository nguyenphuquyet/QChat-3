/**
 * WXS (WeChat Script) compiled AST and the runtime seam.
 *
 * WXS is the only script that runs in the view layer. It is compiled at build
 * time into this typed tree and executed by an interpreter that owns every value
 * it touches; the Mini App's page JavaScript and the host are never reachable
 * from it. ADR 013 records the supported subset and the isolation rules.
 *
 * The AST is JSON: it travels inside `build/view.json` and is validated by
 * `isWxsBundle` before an installed bundle is used.
 */

/** 1-based source position of an AST node. */
export interface WxsLocation {
  line: number;
  column: number;
}

export interface WxsProgram {
  type: "program";
  body: WxsStatement[];
}

export type WxsStatement =
  | WxsVarStatement
  | WxsFunctionStatement
  | WxsReturnStatement
  | WxsIfStatement
  | WxsForStatement
  | WxsForInStatement
  | WxsWhileStatement
  | WxsDoWhileStatement
  | WxsBlockStatement
  | WxsExpressionStatement
  | WxsBreakStatement
  | WxsContinueStatement
  | WxsEmptyStatement;

export interface WxsVarStatement {
  type: "var";
  declarations: { name: string; init: WxsExpression | null }[];
  loc: WxsLocation;
}

export interface WxsFunctionStatement {
  type: "function";
  name: string;
  params: string[];
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsReturnStatement {
  type: "return";
  argument: WxsExpression | null;
  loc: WxsLocation;
}

export interface WxsIfStatement {
  type: "if";
  test: WxsExpression;
  consequent: WxsStatement[];
  alternate: WxsStatement[] | null;
  loc: WxsLocation;
}

export interface WxsForStatement {
  type: "for";
  init: WxsStatement | null;
  test: WxsExpression | null;
  update: WxsExpression | null;
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsForInStatement {
  type: "forIn";
  name: string;
  object: WxsExpression;
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsWhileStatement {
  type: "while";
  test: WxsExpression;
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsDoWhileStatement {
  type: "doWhile";
  body: WxsStatement[];
  test: WxsExpression;
  loc: WxsLocation;
}

export interface WxsBlockStatement {
  type: "block";
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsExpressionStatement {
  type: "expression";
  expression: WxsExpression;
  loc: WxsLocation;
}

export interface WxsBreakStatement {
  type: "break";
  loc: WxsLocation;
}

export interface WxsContinueStatement {
  type: "continue";
  loc: WxsLocation;
}

export interface WxsEmptyStatement {
  type: "empty";
  loc: WxsLocation;
}

export type WxsExpression =
  | WxsLiteral
  | WxsIdentifier
  | WxsArrayLiteral
  | WxsObjectLiteral
  | WxsFunctionExpression
  | WxsMember
  | WxsCall
  | WxsRequire
  | WxsUnary
  | WxsUpdate
  | WxsBinary
  | WxsLogical
  | WxsConditional
  | WxsAssignment
  | WxsSequence;

export interface WxsLiteral {
  type: "literal";
  value: string | number | boolean | null;
  loc: WxsLocation;
}

export interface WxsIdentifier {
  type: "identifier";
  name: string;
  loc: WxsLocation;
}

export interface WxsArrayLiteral {
  type: "array";
  items: WxsExpression[];
  loc: WxsLocation;
}

export interface WxsObjectLiteral {
  type: "object";
  entries: { key: string; value: WxsExpression }[];
  loc: WxsLocation;
}

export interface WxsFunctionExpression {
  type: "functionExpression";
  name: string | null;
  params: string[];
  body: WxsStatement[];
  loc: WxsLocation;
}

export interface WxsMember {
  type: "member";
  object: WxsExpression;
  property: WxsExpression;
  computed: boolean;
  loc: WxsLocation;
}

export interface WxsCall {
  type: "call";
  callee: WxsExpression;
  args: WxsExpression[];
  loc: WxsLocation;
}

/** `require("./x.wxs")` after the compiler resolved the literal path. */
export interface WxsRequire {
  type: "require";
  path: string;
  loc: WxsLocation;
}

export type WxsUnaryOperator = "!" | "-" | "+" | "~" | "typeof";

export interface WxsUnary {
  type: "unary";
  op: WxsUnaryOperator;
  operand: WxsExpression;
  loc: WxsLocation;
}

export interface WxsUpdate {
  type: "update";
  op: "++" | "--";
  prefix: boolean;
  argument: WxsExpression;
  loc: WxsLocation;
}

export type WxsBinaryOperator =
  | "+" | "-" | "*" | "/" | "%"
  | "==" | "!=" | "===" | "!=="
  | "<" | "<=" | ">" | ">="
  | "&" | "|" | "^" | "<<" | ">>" | ">>>";

export interface WxsBinary {
  type: "binary";
  op: WxsBinaryOperator;
  left: WxsExpression;
  right: WxsExpression;
  loc: WxsLocation;
}

export interface WxsLogical {
  type: "logical";
  op: "&&" | "||";
  left: WxsExpression;
  right: WxsExpression;
  loc: WxsLocation;
}

export interface WxsConditional {
  type: "conditional";
  test: WxsExpression;
  consequent: WxsExpression;
  alternate: WxsExpression;
  loc: WxsLocation;
}

export type WxsAssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=";

export interface WxsAssignment {
  type: "assignment";
  op: WxsAssignmentOperator;
  target: WxsExpression;
  value: WxsExpression;
  loc: WxsLocation;
}

export interface WxsSequence {
  type: "sequence";
  items: WxsExpression[];
  loc: WxsLocation;
}

/** One `<wxs module="...">` block or `.wxs` file, already compiled. */
export interface WxsModule {
  /** Module name as written in `<wxs module="m">`. */
  name: string;
  /** Package-relative file, or `<page>.wxml#wxs:<name>` for inline code. */
  file: string;
  ast: WxsProgram;
}

export interface WxsBundle {
  /** Page-level modules, keyed by the `<wxs module="...">` name. */
  modules: Record<string, WxsModule>;
  /**
   * Every compiled `.wxs` source, keyed by package-relative path (or the
   * synthetic `<page>.wxml#wxs:<name>` path of an inline module). `require`
   * resolves against this map, so a shared module has one AST.
   */
  sources: Record<string, WxsProgram>;
  /** Every `.wxs` file the modules pulled in, for the package file list. */
  files: string[];
}

/** What the service runtime needs to invoke a WXS event handler. */
export interface WxsInvoker {
  /**
   * Call the export at `path` (`"m.tap"` or `"m.util.tap"`) with [args].
   * Throws on a missing export, a runtime error or a limit breach.
   */
  call(path: string, args: readonly unknown[], context?: WxsInvocationContext): unknown;
  /**
   * Deliver a view event to a WXS handler. The handler receives
   * `(event, ownerInstance)`, where `ownerInstance.callMethod(name, data)`
   * calls back into a page method. Falls back to `call(path, [event])` when a
   * runtime predates this method.
   */
  callEvent?(path: string, event: unknown, context?: WxsInvocationContext): unknown;
}

export interface WxsInvocationContext {
  /** `ownerInstance.callMethod(name, data)` from the WXS handler. */
  callMethod?: (name: string, data?: unknown) => void;
  /** `console.log` sink; defaults to discarding. */
  log?: (message: string) => void;
}

const STATEMENT_TYPES = new Set([
  "var", "function", "return", "if", "for", "forIn", "while", "doWhile",
  "block", "expression", "break", "continue", "empty",
]);

const EXPRESSION_TYPES = new Set([
  "literal", "identifier", "array", "object", "functionExpression", "member",
  "call", "require", "unary", "update", "binary", "logical", "conditional",
  "assignment", "sequence",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocation(value: unknown): boolean {
  return isRecord(value)
    && Number.isSafeInteger(value.line) && (value.line as number) > 0
    && Number.isSafeInteger(value.column) && (value.column as number) > 0;
}

function isStatement(value: unknown): boolean {
  return isRecord(value)
    && typeof value.type === "string"
    && STATEMENT_TYPES.has(value.type)
    && isLocation(value.loc);
}

function isExpression(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string" || !EXPRESSION_TYPES.has(value.type)) return false;
  if (!isLocation(value.loc)) return false;
  switch (value.type) {
    case "literal":
      return value.value === null
        || typeof value.value === "string"
        || typeof value.value === "number"
        || typeof value.value === "boolean";
    case "identifier":
      return typeof value.name === "string" && value.name.length > 0;
    case "array":
      return Array.isArray(value.items) && value.items.every(isExpression);
    case "object":
      return Array.isArray(value.entries)
        && value.entries.every((entry) => isRecord(entry) && typeof entry.key === "string" && isExpression(entry.value));
    case "functionExpression":
      return (value.name === null || typeof value.name === "string")
        && Array.isArray(value.params)
        && value.params.every((param) => typeof param === "string")
        && Array.isArray(value.body)
        && value.body.every(isStatement);
    case "member":
      return isExpression(value.object) && isExpression(value.property) && typeof value.computed === "boolean";
    case "call":
      return isExpression(value.callee) && Array.isArray(value.args) && value.args.every(isExpression);
    case "require":
      return typeof value.path === "string" && value.path.length > 0;
    case "unary":
      return ["!", "-", "+", "~", "typeof"].includes(value.op as string) && isExpression(value.operand);
    case "update":
      return (value.op === "++" || value.op === "--")
        && typeof value.prefix === "boolean"
        && isExpression(value.argument);
    case "binary":
      return typeof value.op === "string"
        && BINARY_OPERATORS.has(value.op)
        && isExpression(value.left)
        && isExpression(value.right);
    case "logical":
      return (value.op === "&&" || value.op === "||") && isExpression(value.left) && isExpression(value.right);
    case "conditional":
      return isExpression(value.test) && isExpression(value.consequent) && isExpression(value.alternate);
    case "assignment":
      return typeof value.op === "string"
        && ASSIGNMENT_OPERATORS.has(value.op)
        && isExpression(value.target)
        && isExpression(value.value);
    case "sequence":
      return Array.isArray(value.items) && value.items.every(isExpression);
    default:
      return false;
  }
}

function isStatementBody(value: unknown): boolean {
  return Array.isArray(value) && value.every(isStatement) && validateStatements(value);
}

/** Validate a compiled WXS bundle from an installed package. */
export function isWxsBundle(value: unknown): value is WxsBundle {
  if (!isRecord(value) || !isRecord(value.modules) || !isRecord(value.sources) || !Array.isArray(value.files)) {
    return false;
  }
  for (const file of value.files) {
    if (typeof file !== "string" || file.length === 0) return false;
  }
  for (const [path, program] of Object.entries(value.sources)) {
    if (path.length === 0 || !isProgram(program)) return false;
  }
  for (const [name, module] of Object.entries(value.modules)) {
    if (!isRecord(module) || module.name !== name) return false;
    if (typeof module.file !== "string" || module.file.length === 0) return false;
    if (!isProgram(module.ast)) return false;
    if (!Object.prototype.hasOwnProperty.call(value.sources, module.file)) return false;
  }
  return true;
}

function isProgram(value: unknown): value is WxsProgram {
  return isRecord(value) && value.type === "program" && isStatementBody(value.body);
}

const BINARY_OPERATORS = new Set([
  "+", "-", "*", "/", "%",
  "==", "!=", "===", "!==",
  "<", "<=", ">", ">=",
  "&", "|", "^", "<<", ">>", ">>>",
]);

const ASSIGNMENT_OPERATORS = new Set(["=", "+=", "-=", "*=", "/=", "%="]);

function validateStatements(statements: readonly unknown[]): boolean {
  for (const statement of statements) {
    if (!isStatement(statement)) return false;
    const node = statement as Record<string, unknown>;
    switch (node.type) {
      case "var":
        if (!Array.isArray(node.declarations)
          || !node.declarations.every((entry) => isRecord(entry)
            && typeof entry.name === "string"
            && (entry.init === null || isExpression(entry.init)))) return false;
        break;
      case "function":
        if (typeof node.name !== "string"
          || !Array.isArray(node.params)
          || !node.params.every((param) => typeof param === "string")
          || !isStatementBody(node.body)) return false;
        break;
      case "return":
        if (node.argument !== null && !isExpression(node.argument)) return false;
        break;
      case "if":
        if (!isExpression(node.test) || !isStatementBody(node.consequent)) return false;
        if (node.alternate !== null && !isStatementBody(node.alternate)) return false;
        break;
      case "for":
        if (node.init !== null && !isStatement(node.init)) return false;
        if (node.test !== null && !isExpression(node.test)) return false;
        if (node.update !== null && !isExpression(node.update)) return false;
        if (!isStatementBody(node.body)) return false;
        break;
      case "forIn":
        if (typeof node.name !== "string" || !isExpression(node.object) || !isStatementBody(node.body)) return false;
        break;
      case "while":
        if (!isExpression(node.test) || !isStatementBody(node.body)) return false;
        break;
      case "doWhile":
        if (!isStatementBody(node.body) || !isExpression(node.test)) return false;
        break;
      case "block":
        if (!isStatementBody(node.body)) return false;
        break;
      case "expression":
        if (!isExpression(node.expression)) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

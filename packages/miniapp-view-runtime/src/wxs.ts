/**
 * WXS interpreter.
 *
 * WXS is compiled to a typed AST at build time (see the compiler package) and
 * executed here by a tree-walking interpreter that owns every value it touches.
 * The interpreter never evaluates source, never calls `Function`, and never
 * exposes a host object: arguments are cloned in, results are cloned out, and
 * member access is an explicit allowlist. `__proto__`, `prototype` and
 * `constructor` are rejected, a step budget stops runaway loops, and a call
 * depth limit stops runaway recursion. ADR 013 records the contract.
 *
 * The runtime is page-scoped. It is created once per page bundle and used both
 * for template calls (`{{ m.format(x) }}`) and for event handlers
 * (`wxs:m.tap`).
 */

import {
  isWxsBundle,
  type ErrorCode,
  type WxsBundle,
  type WxsExpression,
  type WxsInvocationContext,
  type WxsInvoker,
  type WxsStatement,
} from "@qchat/miniapp-contracts";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const DEFAULT_STEP_BUDGET = 1_000_000;
const DEFAULT_MAX_CALL_DEPTH = 64;
const MAX_ARRAY_LENGTH = 100_000;
const MAX_STRING_LENGTH = 1_000_000;

export class WxsError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WxsError";
  }
}

export interface WxsRuntimeOptions {
  /** Statements and expressions executed by one call before it fails. */
  stepBudget?: number;
  /** Nested WXS calls before a call fails. */
  maxCallDepth?: number;
  /** Default `console.log` sink. */
  log?: (message: string) => void;
}

export interface WxsRuntime extends WxsInvoker {
  /** Deliver an event handler; the handler receives `(event, ownerInstance)`. */
  callEvent(path: string, event: unknown, context?: WxsInvocationContext): unknown;
  /** Drop module caches; later calls start from a fresh module scope. */
  destroy(): void;
}

type WxsValue =
  | undefined
  | null
  | boolean
  | number
  | string
  | WxsObject
  | WxsValue[]
  | WxsClosure
  | WxsNative
  | RegExp;

interface WxsObject {
  [key: string]: WxsValue;
}

type WxsFunction = WxsClosure | WxsNative;

class WxsClosure {
  constructor(
    readonly node: { params: string[]; body: WxsStatement[]; name?: string | null },
    readonly scope: Env,
    readonly runtime: Interpreter,
  ) {}
}

class WxsNative {
  constructor(
    readonly name: string,
    readonly fn: (args: WxsValue[]) => WxsValue,
  ) {}
}

class Env {
  private readonly vars = new Map<string, WxsValue>();

  constructor(private readonly parent: Env | null = null) {}

  define(name: string, value: WxsValue): void {
    this.vars.set(name, value);
  }

  has(name: string): boolean {
    if (this.vars.has(name)) return true;
    return this.parent?.has(name) ?? false;
  }

  get(name: string): WxsValue {
    if (this.vars.has(name)) return this.vars.get(name);
    return this.parent?.get(name);
  }

  set(name: string, value: WxsValue): void {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.set(name, value);
      return;
    }
    throw new WxsError("WXS_RUNTIME_ERROR", `Assignment to undeclared variable "${name}".`);
  }
}

class ReturnSignal {
  constructor(readonly value: WxsValue) {}
}

class BreakSignal {}
class ContinueSignal {}

const STRING_METHODS = new Set([
  "charAt", "charCodeAt", "codePointAt", "indexOf", "lastIndexOf", "includes",
  "startsWith", "endsWith", "slice", "substring", "substr", "split", "replace",
  "replaceAll", "toUpperCase", "toLowerCase", "trim", "trimStart", "trimEnd",
  "concat", "repeat", "padStart", "padEnd", "localeCompare", "match", "search",
]);

const NUMBER_METHODS = new Set(["toFixed", "toPrecision", "toExponential"]);

const ARRAY_METHODS = new Set([
  "push", "pop", "shift", "unshift", "slice", "splice", "concat", "join",
  "indexOf", "lastIndexOf", "includes", "reverse", "sort", "map", "filter",
  "reduce", "reduceRight", "forEach", "some", "every", "find", "findIndex",
  "fill", "at",
]);

const REGEXP_METHODS = new Set(["test", "exec"]);

function isCallable(value: WxsValue): value is WxsFunction {
  return value instanceof WxsClosure || value instanceof WxsNative;
}

function isPlainObject(value: WxsValue): value is WxsObject {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && !(value instanceof RegExp)
    && !(value instanceof WxsClosure)
    && !(value instanceof WxsNative);
}

function createObject(): WxsObject {
  return Object.create(null) as WxsObject;
}

function own(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function truthy(value: WxsValue): boolean {
  return Boolean(value);
}

function display(value: WxsValue): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => item === null || item === undefined ? "" : display(item)).join(",");
  if (value instanceof RegExp) return String(value);
  if (value instanceof WxsClosure) return `[Function ${value.node.name ?? "anonymous"}]`;
  if (value instanceof WxsNative) return `[Function ${value.name}]`;
  return "[object Object]";
}

function propertyKey(value: WxsValue): string {
  if (typeof value === "string") return value;
  return display(value);
}

function cloneInto(value: unknown, depth = 0): WxsValue {
  if (depth > 64) throw new WxsError("WXS_RUNTIME_ERROR", "A value passed to WXS is nested too deeply.");
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return value as WxsValue;
  if (type === "function" || type === "symbol" || type === "bigint") {
    throw new WxsError("WXS_RUNTIME_ERROR", `A ${type} cannot be passed to WXS.`);
  }
  if (Array.isArray(value)) return value.map((item) => cloneInto(item, depth + 1));
  if (type === "object") {
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (value instanceof Date) return value.toISOString();
    const result = createObject();
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new WxsError("WXS_UNSAFE_ACCESS", `Property "${key}" is not allowed.`);
      }
      result[key] = cloneInto(item, depth + 1);
    }
    return result;
  }
  throw new WxsError("WXS_RUNTIME_ERROR", `A ${type} cannot be passed to WXS.`);
}

function cloneOut(value: WxsValue, depth = 0): unknown {
  if (depth > 64) throw new WxsError("WXS_RUNTIME_ERROR", "A WXS value is nested too deeply.");
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof RegExp) return String(value);
  if (value instanceof WxsClosure || value instanceof WxsNative) {
    throw new WxsError("WXS_RUNTIME_ERROR", "A WXS function cannot cross the runtime boundary.");
  }
  if (Array.isArray(value)) return value.map((item) => cloneOut(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = cloneOut(item, depth + 1);
  }
  return result;
}

class Interpreter implements WxsRuntime {
  private readonly stepBudget: number;
  private readonly maxCallDepth: number;
  private readonly defaultLog: (message: string) => void;
  private readonly globals = new Env();
  private readonly modules = new Map<string, WxsValue>();
  private readonly running = new Set<string>();
  private steps = 0;
  private depth = 0;
  private log: (message: string) => void;

  constructor(
    private readonly bundle: WxsBundle,
    options: WxsRuntimeOptions = {},
  ) {
    this.stepBudget = options.stepBudget ?? DEFAULT_STEP_BUDGET;
    this.maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH;
    this.defaultLog = options.log ?? (() => {});
    this.log = this.defaultLog;
    this.installGlobals();
  }

  call(path: string, args: readonly unknown[], context?: WxsInvocationContext): unknown {
    this.begin(context);
    try {
      const fn = this.resolveExport(path);
      const value = this.invoke(fn, args.map((argument) => cloneInto(argument)));
      return cloneOut(value);
    } finally {
      this.log = this.defaultLog;
    }
  }

  callEvent(path: string, event: unknown, context?: WxsInvocationContext): unknown {
    this.begin(context);
    try {
      const fn = this.resolveExport(path);
      const owner = createObject();
      owner.callMethod = new WxsNative("callMethod", (args) => {
        if (!context?.callMethod) {
          throw new WxsError("WXS_RUNTIME_ERROR", "ownerInstance.callMethod is not available here.");
        }
        context.callMethod(propertyKey(args[0]), cloneOut(args[1] ?? undefined));
        return undefined;
      });
      const value = this.invoke(fn, [cloneInto(event), owner]);
      return cloneOut(value);
    } finally {
      this.log = this.defaultLog;
    }
  }

  destroy(): void {
    this.modules.clear();
    this.running.clear();
  }

  private begin(context: WxsInvocationContext | undefined): void {
    this.steps = 0;
    this.depth = 0;
    this.log = context?.log ?? this.defaultLog;
  }

  private resolveExport(path: string): WxsFunction {
    if (typeof path !== "string" || path.length === 0 || path.length > 256) {
      throw new WxsError("WXS_RUNTIME_ERROR", "A WXS export path is invalid.");
    }
    const segments = path.split(".");
    if (segments.length < 2 || segments.some((segment) => !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment))) {
      throw new WxsError("WXS_RUNTIME_ERROR", `"${path}" is not a WXS export path.`);
    }
    const module = this.bundle.modules[segments[0]];
    if (!module) {
      throw new WxsError("WXS_RUNTIME_ERROR", `WXS module "${segments[0]}" is not declared.`);
    }
    let value = this.loadSource(module.file);
    for (let index = 1; index < segments.length; index += 1) {
      value = this.getMember(value, segments[index]);
    }
    if (!isCallable(value)) {
      throw new WxsError("WXS_RUNTIME_ERROR", `WXS export "${path}" is not a function.`);
    }
    return value;
  }

  private loadSource(path: string): WxsValue {
    if (this.modules.has(path)) return this.modules.get(path);
    const program = this.bundle.sources[path];
    if (!program) {
      throw new WxsError("WXS_RUNTIME_ERROR", `WXS source "${path}" is missing from the bundle.`);
    }

    const exportsObject = createObject();
    const moduleObject = createObject();
    moduleObject.exports = exportsObject;
    // Node-style cycles see the partial exports object, never an empty module.
    this.modules.set(path, exportsObject);
    this.running.add(path);

    const env = new Env(this.globals);
    env.define("module", moduleObject);
    env.define("exports", exportsObject);
    env.define("require", new WxsNative("require", (args) => {
      const specifier = args[0];
      if (typeof specifier !== "string") {
        throw new WxsError("WXS_RUNTIME_ERROR", "require needs a path string.");
      }
      return this.loadSource(specifier);
    }));

    try {
      this.hoist(program.body, env);
      this.executeStatements(program.body, env);
    } finally {
      this.running.delete(path);
    }
    const result = moduleObject.exports;
    this.modules.set(path, result);
    return result;
  }

  private hoist(statements: readonly WxsStatement[], env: Env): void {
    for (const statement of statements) {
      switch (statement.type) {
        case "var":
          for (const declaration of statement.declarations) {
            if (!env.has(declaration.name)) env.define(declaration.name, undefined);
          }
          break;
        case "function":
          env.define(statement.name, new WxsClosure(statement, env, this));
          break;
        case "if":
          this.hoist(statement.consequent, env);
          this.hoist(statement.alternate ?? [], env);
          break;
        case "for":
          if (statement.init) this.hoist([statement.init], env);
          this.hoist(statement.body, env);
          break;
        case "forIn":
          if (!env.has(statement.name)) env.define(statement.name, undefined);
          this.hoist(statement.body, env);
          break;
        case "while":
          this.hoist(statement.body, env);
          break;
        case "doWhile":
          this.hoist(statement.body, env);
          break;
        case "block":
          this.hoist(statement.body, env);
          break;
        default:
          break;
      }
    }
  }

  private executeStatements(statements: readonly WxsStatement[], env: Env): void {
    for (const statement of statements) this.execute(statement, env);
  }

  private execute(statement: WxsStatement, env: Env): void {
    this.step();
    switch (statement.type) {
      case "var":
        for (const declaration of statement.declarations) {
          if (declaration.init) env.set(declaration.name, this.evaluate(declaration.init, env));
        }
        return;
      case "function":
        return;
      case "return":
        throw new ReturnSignal(statement.argument ? this.evaluate(statement.argument, env) : undefined);
      case "if":
        if (truthy(this.evaluate(statement.test, env))) this.executeStatements(statement.consequent, env);
        else if (statement.alternate) this.executeStatements(statement.alternate, env);
        return;
      case "for":
        this.executeFor(statement, env);
        return;
      case "forIn":
        this.executeForIn(statement, env);
        return;
      case "while":
        this.executeWhile(statement.test, statement.body, env);
        return;
      case "doWhile":
        for (;;) {
          this.step();
          try {
            this.executeStatements(statement.body, env);
          } catch (signal) {
            if (signal instanceof BreakSignal) break;
            if (!(signal instanceof ContinueSignal)) throw signal;
          }
          if (!truthy(this.evaluate(statement.test, env))) break;
        }
        return;
      case "block":
        this.executeStatements(statement.body, env);
        return;
      case "expression":
        this.evaluate(statement.expression, env);
        return;
      case "break":
        throw new BreakSignal();
      case "continue":
        throw new ContinueSignal();
      case "empty":
        return;
    }
  }

  private executeFor(
    statement: Extract<WxsStatement, { type: "for" }>,
    env: Env,
  ): void {
    if (statement.init) this.execute(statement.init, env);
    for (;;) {
      this.step();
      if (statement.test && !truthy(this.evaluate(statement.test, env))) break;
      try {
        this.executeStatements(statement.body, env);
      } catch (signal) {
        if (signal instanceof BreakSignal) break;
        if (!(signal instanceof ContinueSignal)) throw signal;
      }
      if (statement.update) this.evaluate(statement.update, env);
    }
  }

  private executeForIn(
    statement: Extract<WxsStatement, { type: "forIn" }>,
    env: Env,
  ): void {
    const object = this.evaluate(statement.object, env);
    let keys: string[];
    if (Array.isArray(object)) {
      keys = object.map((_, index) => String(index));
    } else if (isPlainObject(object)) {
      keys = Object.keys(object);
    } else {
      throw new WxsError("WXS_RUNTIME_ERROR", "for-in needs an object or an array.");
    }
    for (const key of keys) {
      this.step();
      env.set(statement.name, key);
      try {
        this.executeStatements(statement.body, env);
      } catch (signal) {
        if (signal instanceof BreakSignal) break;
        if (!(signal instanceof ContinueSignal)) throw signal;
      }
    }
  }

  private executeWhile(
    test: WxsExpression,
    body: readonly WxsStatement[],
    env: Env,
  ): void {
    for (;;) {
      this.step();
      if (!truthy(this.evaluate(test, env))) break;
      try {
        this.executeStatements(body, env);
      } catch (signal) {
        if (signal instanceof BreakSignal) break;
        if (!(signal instanceof ContinueSignal)) throw signal;
      }
    }
  }

  private evaluate(expression: WxsExpression, env: Env): WxsValue {
    this.step();
    switch (expression.type) {
      case "literal":
        return expression.value;
      case "identifier":
        return env.get(expression.name);
      case "array":
        return expression.items.map((item) => this.evaluate(item, env));
      case "object": {
        const object = createObject();
        for (const entry of expression.entries) {
          if (FORBIDDEN_KEYS.has(entry.key)) {
            throw new WxsError("WXS_UNSAFE_ACCESS", `Property "${entry.key}" is not allowed.`);
          }
          object[entry.key] = this.evaluate(entry.value, env);
        }
        return object;
      }
      case "functionExpression":
        return new WxsClosure(expression, env, this);
      case "member": {
        const object = this.evaluate(expression.object, env);
        const key = expression.computed
          ? propertyKey(this.evaluate(expression.property, env))
          : propertyKey(this.evaluate(expression.property, env));
        return this.getMember(object, key);
      }
      case "call": {
        const callee = this.evaluate(expression.callee, env);
        const args = expression.args.map((argument) => this.evaluate(argument, env));
        return this.invoke(callee, args);
      }
      case "require":
        return this.loadSource(expression.path);
      case "unary": {
        const value = this.evaluate(expression.operand, env);
        switch (expression.op) {
          case "!": return !truthy(value);
          case "-": return -Number(value);
          case "+": return Number(value);
          case "~": return ~Number(value);
          case "typeof": return this.typeOf(value);
        }
        return undefined;
      }
      case "update": {
        const reference = this.reference(expression.argument, env);
        const before = Number(this.read(reference));
        const after = expression.op === "++" ? before + 1 : before - 1;
        this.write(reference, after);
        return expression.prefix ? after : before;
      }
      case "binary": {
        const left = this.evaluate(expression.left, env);
        const right = this.evaluate(expression.right, env);
        return this.binary(expression.op, left, right);
      }
      case "logical": {
        const left = this.evaluate(expression.left, env);
        if (expression.op === "&&") return truthy(left) ? this.evaluate(expression.right, env) : left;
        return truthy(left) ? left : this.evaluate(expression.right, env);
      }
      case "conditional":
        return truthy(this.evaluate(expression.test, env))
          ? this.evaluate(expression.consequent, env)
          : this.evaluate(expression.alternate, env);
      case "assignment": {
        const reference = this.reference(expression.target, env);
        if (expression.op === "=") {
          const value = this.evaluate(expression.value, env);
          this.write(reference, value);
          return value;
        }
        const current = this.read(reference);
        const value = this.binary(
          expression.op.slice(0, -1) as "+" | "-" | "*" | "/" | "%",
          current,
          this.evaluate(expression.value, env),
        );
        this.write(reference, value);
        return value;
      }
      case "sequence": {
        let value: WxsValue = undefined;
        for (const item of expression.items) value = this.evaluate(item, env);
        return value;
      }
    }
  }

  private typeOf(value: WxsValue): string {
    if (isCallable(value)) return "function";
    if (value === null) return "object";
    if (Array.isArray(value)) return "object";
    if (value instanceof RegExp) return "object";
    return typeof value;
  }

  private binary(op: string, left: WxsValue, right: WxsValue): WxsValue {
    switch (op) {
      case "+":
        if (typeof left === "string" || typeof right === "string") return display(left) + display(right);
        if (typeof left === "object" && left !== null || typeof right === "object" && right !== null) {
          return display(left) + display(right);
        }
        return (left as number) + (right as number);
      case "-": return Number(left) - Number(right);
      case "*": return Number(left) * Number(right);
      case "/": return Number(left) / Number(right);
      case "%": return Number(left) % Number(right);
      case "==": return left == right; // eslint-disable-line eqeqeq
      case "!=": return left != right; // eslint-disable-line eqeqeq
      case "===": return left === right;
      case "!==": return left !== right;
      case "<": return (left as number) < (right as number);
      case "<=": return (left as number) <= (right as number);
      case ">": return (left as number) > (right as number);
      case ">=": return (left as number) >= (right as number);
      case "&": return Number(left) & Number(right);
      case "|": return Number(left) | Number(right);
      case "^": return Number(left) ^ Number(right);
      case "<<": return Number(left) << Number(right);
      case ">>": return Number(left) >> Number(right);
      case ">>>": return Number(left) >>> Number(right);
      default:
        throw new WxsError("WXS_RUNTIME_ERROR", `Unsupported operator "${op}".`);
    }
  }

  private reference(expression: WxsExpression, env: Env): { kind: "variable"; env: Env; name: string } | { kind: "member"; object: WxsValue; key: string } {
    if (expression.type === "identifier") {
      return { kind: "variable", env, name: expression.name };
    }
    if (expression.type === "member") {
      const object = this.evaluate(expression.object, env);
      const key = propertyKey(this.evaluate(expression.property, env));
      if (FORBIDDEN_KEYS.has(key)) {
        throw new WxsError("WXS_UNSAFE_ACCESS", `Property "${key}" is not allowed.`);
      }
      return { kind: "member", object, key };
    }
    throw new WxsError("WXS_RUNTIME_ERROR", "The expression is not assignable.");
  }

  private read(reference: { kind: "variable"; env: Env; name: string } | { kind: "member"; object: WxsValue; key: string }): WxsValue {
    if (reference.kind === "variable") return reference.env.get(reference.name);
    return this.getMember(reference.object, reference.key);
  }

  private write(reference: { kind: "variable"; env: Env; name: string } | { kind: "member"; object: WxsValue; key: string }, value: WxsValue): void {
    if (reference.kind === "variable") {
      reference.env.set(reference.name, value);
      return;
    }
    this.setMember(reference.object, reference.key, value);
  }

  private invoke(callee: WxsValue, args: WxsValue[]): WxsValue {
    if (callee instanceof WxsNative) return callee.fn(args);
    if (!(callee instanceof WxsClosure)) {
      throw new WxsError("WXS_RUNTIME_ERROR", `"${display(callee)}" is not a function.`);
    }
    if (this.depth >= this.maxCallDepth) {
      throw new WxsError("WXS_LIMIT_EXCEEDED", `WXS calls are nested more than ${this.maxCallDepth} deep.`);
    }
    this.depth += 1;
    try {
      const env = new Env(callee.scope);
      for (let index = 0; index < callee.node.params.length; index += 1) {
        env.define(callee.node.params[index], args[index]);
      }
      env.define("arguments", args.slice());
      this.hoist(callee.node.body, env);
      try {
        this.executeStatements(callee.node.body, env);
      } catch (signal) {
        if (signal instanceof ReturnSignal) return signal.value;
        throw signal;
      }
      return undefined;
    } finally {
      this.depth -= 1;
    }
  }

  private getMember(object: WxsValue, key: string): WxsValue {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new WxsError("WXS_UNSAFE_ACCESS", `Property "${key}" is not allowed.`);
    }
    if (object === null || object === undefined) {
      throw new WxsError("WXS_RUNTIME_ERROR", `Cannot read property "${key}" of ${display(object)}.`);
    }
    if (typeof object === "string") return this.stringMember(object, key);
    if (typeof object === "number") return this.numberMember(object, key);
    if (typeof object === "boolean") return this.booleanMember(object, key);
    if (Array.isArray(object)) return this.arrayMember(object, key);
    if (object instanceof RegExp) return this.regExpMember(object, key);
    if (object instanceof WxsClosure) {
      if (key === "length") return object.node.params.length;
      return undefined;
    }
    if (object instanceof WxsNative) {
      if (key === "length") return 0;
      return undefined;
    }
    if (own(object, key)) return object[key];
    if (key === "hasOwnProperty") {
      return new WxsNative("hasOwnProperty", (args) => own(object, propertyKey(args[0])));
    }
    if (key === "toString" || key === "valueOf") {
      return new WxsNative(key, () => key === "toString" ? "[object Object]" : object);
    }
    return undefined;
  }

  private setMember(object: WxsValue, key: string, value: WxsValue): void {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new WxsError("WXS_UNSAFE_ACCESS", `Property "${key}" is not allowed.`);
    }
    if (object === null || object === undefined) {
      throw new WxsError("WXS_RUNTIME_ERROR", `Cannot set property "${key}" of ${display(object)}.`);
    }
    if (Array.isArray(object)) {
      if (key === "length") {
        const length = Number(value);
        if (!Number.isInteger(length) || length < 0 || length > MAX_ARRAY_LENGTH) {
          throw new WxsError("WXS_RUNTIME_ERROR", `An array length must be an integer between 0 and ${MAX_ARRAY_LENGTH}.`);
        }
        object.length = length;
        return;
      }
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < MAX_ARRAY_LENGTH) {
        object[index] = value;
        return;
      }
      throw new WxsError("WXS_RUNTIME_ERROR", `"${key}" is not an array index.`);
    }
    if (isPlainObject(object)) {
      object[key] = value;
      return;
    }
    throw new WxsError("WXS_RUNTIME_ERROR", `Cannot set property "${key}" on ${display(object)}.`);
  }

  private stringMember(value: string, key: string): WxsValue {
    if (key === "length") return value.length;
    if (key === "toString" || key === "valueOf") return new WxsNative(key, () => value);
    if (!STRING_METHODS.has(key)) return undefined;
    return new WxsNative(key, (args) => {
      if ((key === "replace" || key === "replaceAll") && isCallable(args[1])) {
        throw new WxsError("WXS_UNSUPPORTED_FEATURE", `String.${key} does not accept a WXS function.`);
      }
      const method = (String.prototype as unknown as Record<string, (...values: unknown[]) => unknown>)[key];
      return method.apply(value, args as unknown[]) as WxsValue;
    });
  }

  private numberMember(value: number, key: string): WxsValue {
    if (key === "valueOf") return new WxsNative(key, () => value);
    if (key === "toString") return new WxsNative(key, (args) => value.toString(args[0] === undefined ? 10 : Number(args[0])));
    if (!NUMBER_METHODS.has(key)) return undefined;
    return new WxsNative(key, (args) => {
      const method = (Number.prototype as unknown as Record<string, (...values: unknown[]) => string>)[key];
      return method.apply(value, args as unknown[]);
    });
  }

  private booleanMember(value: boolean, key: string): WxsValue {
    if (key === "toString" || key === "valueOf") return new WxsNative(key, () => String(value));
    return undefined;
  }

  private arrayMember(value: WxsValue[], key: string): WxsValue {
    if (key === "length") return value.length;
    if (key === "toString") return new WxsNative("toString", () => value.map(display).join(","));
    if (key === "valueOf") return new WxsNative("valueOf", () => value);
    if (own(value, key)) return (value as unknown as WxsObject)[key];
    if (!ARRAY_METHODS.has(key)) return undefined;

    const self = this;
    return new WxsNative(key, (args) => {
      const array = value;
      switch (key) {
        case "push":
          array.push(...args);
          return array.length;
        case "pop":
          return array.pop();
        case "shift":
          return array.shift();
        case "unshift":
          array.unshift(...args);
          return array.length;
        case "slice":
          return array.slice(Number(args[0] ?? 0), args[1] === undefined ? undefined : Number(args[1]));
        case "splice":
          return array.splice(
            Number(args[0] ?? 0),
            args[1] === undefined ? array.length : Number(args[1]),
            ...args.slice(2),
          );
        case "concat":
          return array.concat(...args.map((argument) => Array.isArray(argument) ? argument : [argument]));
        case "join":
          return array.map((item) => item === null || item === undefined ? "" : display(item)).join(args[0] === undefined ? "," : String(args[0]));
        case "indexOf":
          return array.indexOf(args[0], args[1] === undefined ? 0 : Number(args[1]));
        case "lastIndexOf":
          return array.lastIndexOf(args[0], args[1] === undefined ? array.length - 1 : Number(args[1]));
        case "includes":
          return array.includes(args[0], args[1] === undefined ? 0 : Number(args[1]));
        case "reverse":
          array.reverse();
          return array;
        case "fill":
          array.fill(args[0], args[1] === undefined ? 0 : Number(args[1]), args[2] === undefined ? array.length : Number(args[2]));
          return array;
        case "at": {
          const index = Number(args[0] ?? 0);
          return array.at(index);
        }
        case "sort": {
          const comparator = args[0];
          if (comparator === undefined) {
            array.sort((left, right) => display(left).localeCompare(display(right)));
            return array;
          }
          if (!isCallable(comparator)) {
            throw new WxsError("WXS_RUNTIME_ERROR", "sort needs a function comparator.");
          }
          array.sort((left, right) => Number(self.invoke(comparator, [left, right])));
          return array;
        }
        case "forEach":
        case "map":
        case "filter":
        case "some":
        case "every":
        case "find":
        case "findIndex":
        case "reduce":
        case "reduceRight": {
          const callback = args[0];
          if (!isCallable(callback)) {
            throw new WxsError("WXS_RUNTIME_ERROR", `${key} needs a WXS function.`);
          }
          const call = (item: WxsValue, index: number): WxsValue => self.invoke(callback, [item, index, array]);
          switch (key) {
            case "forEach": array.forEach((item, index) => { call(item, index); }); return undefined;
            case "map": return array.map((item, index) => call(item, index));
            case "filter": return array.filter((item, index) => truthy(call(item, index)));
            case "some": return array.some((item, index) => truthy(call(item, index)));
            case "every": return array.every((item, index) => truthy(call(item, index)));
            case "find": return array.find((item, index) => truthy(call(item, index)));
            case "findIndex": return array.findIndex((item, index) => truthy(call(item, index)));
            case "reduce":
            case "reduceRight": {
              const reducer = (accumulator: WxsValue, item: WxsValue, index: number): WxsValue =>
                self.invoke(callback, [accumulator, item, index, array]);
              if (args.length > 1) return key === "reduce"
                ? array.reduce(reducer, args[1])
                : array.reduceRight(reducer, args[1]);
              return key === "reduce" ? array.reduce(reducer) : array.reduceRight(reducer);
            }
            default:
              return undefined;
          }
        }
        default:
          return undefined;
      }
    });
  }

  private regExpMember(value: RegExp, key: string): WxsValue {
    switch (key) {
      case "source": return value.source;
      case "global": return value.global;
      case "ignoreCase": return value.ignoreCase;
      case "multiline": return value.multiline;
      case "lastIndex": return value.lastIndex;
      case "toString": return new WxsNative("toString", () => String(value));
      case "test": return new WxsNative("test", (args) => value.test(String(args[0])));
      case "exec": return new WxsNative("exec", (args) => {
        const result = value.exec(String(args[0]));
        if (result === null) return null;
        const array = Array.from(result) as WxsValue[];
        (array as unknown as WxsObject).index = result.index;
        (array as unknown as WxsObject).input = result.input;
        return array;
      });
      default:
        if (!REGEXP_METHODS.has(key)) return undefined;
        return undefined;
    }
  }

  private installGlobals(): void {
    const define = (name: string, value: WxsValue): void => this.globals.define(name, value);

    define("undefined", undefined);
    define("NaN", Number.NaN);
    define("Infinity", Number.POSITIVE_INFINITY);

    const math = createObject();
    for (const constant of ["E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2"] as const) {
      math[constant] = Math[constant];
    }
    for (const method of [
      "abs", "acos", "asin", "atan", "atan2", "ceil", "cos", "exp", "floor",
      "log", "max", "min", "pow", "random", "round", "sign", "sin", "sqrt",
      "tan", "trunc",
    ] as const) {
      math[method] = new WxsNative(method, (args) => {
        const fn = (Math as unknown as Record<string, (...values: number[]) => number>)[method];
        return fn(...args.map((argument) => Number(argument)));
      });
    }
    define("Math", math);

    const json = createObject();
    json.parse = new WxsNative("parse", (args) => {
      const text = String(args[0]);
      try {
        return cloneInto(JSON.parse(text));
      } catch (cause) {
        if (cause instanceof WxsError) throw cause;
        throw new WxsError("WXS_RUNTIME_ERROR", `JSON.parse failed: ${String(cause)}`);
      }
    });
    json.stringify = new WxsNative("stringify", (args) => {
      const value = args[0];
      const spacing = args[1] === undefined ? undefined : args[1] as string | number;
      const result = JSON.stringify(cloneOut(value), null, spacing);
      return result === undefined ? undefined : result;
    });
    define("JSON", json);

    const object = createObject();
    object.keys = new WxsNative("keys", (args) => {
      const value = args[0];
      if (Array.isArray(value)) return value.map((_, index) => String(index));
      if (isPlainObject(value)) return Object.keys(value);
      throw new WxsError("WXS_RUNTIME_ERROR", "Object.keys needs an object.");
    });
    object.values = new WxsNative("values", (args) => {
      const value = args[0];
      if (Array.isArray(value)) return value.slice();
      if (isPlainObject(value)) return Object.keys(value).map((key) => value[key]);
      throw new WxsError("WXS_RUNTIME_ERROR", "Object.values needs an object.");
    });
    define("Object", object);

    const array = createObject();
    array.isArray = new WxsNative("isArray", (args) => Array.isArray(args[0]));
    define("Array", array);

    define("parseInt", new WxsNative("parseInt", (args) => {
      const radix = args[1] === undefined ? undefined : Number(args[1]);
      return Number.parseInt(String(args[0]), radix);
    }));
    define("parseFloat", new WxsNative("parseFloat", (args) => Number.parseFloat(String(args[0]))));
    define("isNaN", new WxsNative("isNaN", (args) => Number.isNaN(Number(args[0]))));
    define("isFinite", new WxsNative("isFinite", (args) => Number.isFinite(Number(args[0]))));
    define("decodeURI", new WxsNative("decodeURI", (args) => decodeURI(String(args[0]))));
    define("encodeURI", new WxsNative("encodeURI", (args) => encodeURI(String(args[0]))));
    define("decodeURIComponent", new WxsNative("decodeURIComponent", (args) => decodeURIComponent(String(args[0]))));
    define("encodeURIComponent", new WxsNative("encodeURIComponent", (args) => encodeURIComponent(String(args[0]))));

    define("getRegExp", new WxsNative("getRegExp", (args) => {
      const pattern = String(args[0] ?? "");
      const flags = args[1] === undefined ? "" : String(args[1]);
      if (!/^[gimsuy]*$/.test(flags) || new Set(flags).size !== flags.length) {
        throw new WxsError("WXS_RUNTIME_ERROR", `getRegExp flags "${flags}" are invalid.`);
      }
      try {
        return new RegExp(pattern, flags);
      } catch (cause) {
        throw new WxsError("WXS_RUNTIME_ERROR", `getRegExp failed: ${String(cause)}`);
      }
    }));

    const consoleObject = createObject();
    const write = (args: WxsValue[]): WxsValue => {
      const message = args.map((argument) => typeof argument === "string" ? argument : display(argument)).join(" ");
      this.log(message.length > MAX_STRING_LENGTH ? `${message.slice(0, MAX_STRING_LENGTH)}…` : message);
      return undefined;
    };
    for (const name of ["log", "info", "warn", "error", "debug"] as const) {
      consoleObject[name] = new WxsNative(name, write);
    }
    define("console", consoleObject);
  }

  private step(): void {
    this.steps += 1;
    if (this.steps > this.stepBudget) {
      throw new WxsError("WXS_LIMIT_EXCEEDED", `WXS exceeded ${this.stepBudget} steps.`);
    }
  }
}

/** Create a page-scoped WXS runtime from a compiled bundle. */
export function createWxsRuntime(bundle: WxsBundle, options: WxsRuntimeOptions = {}): WxsRuntime {
  if (!isWxsBundle(bundle)) {
    throw new WxsError("WXS_RUNTIME_ERROR", "The WXS bundle is malformed.");
  }
  return new Interpreter(bundle, options);
}

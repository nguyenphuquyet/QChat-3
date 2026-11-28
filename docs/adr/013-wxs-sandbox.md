# ADR 013 — WXS sandbox

- **Status:** ACCEPTED (implemented in M7 task 3; Node tests pass, every device
  claim is `UNVERIFIED`)
- **Date:** 2026-11-28
- **Milestone:** M7 (task 3)
- **Implements:** section 6 of the specification. Extends ADR 009's engine
  boundary to the view layer and ADR 012's view transport.

## Context

WXS is the view layer's script language: `{{ m.format(x) }}` in a WXML
expression and `bindtap="wxs:m.tap"` on an element. It exists so a page can
format data and react to a touch without a round trip to the service. WeChat
runs WXS inside its own view engine, in the same process as the rendered tree.

QChat's view layer is a system `WebView` that renders a tree the service sends
(ADR 012). Three constraints follow:

1. **No source on device.** The view bundle is data; the page host never parses
   or evaluates WXS source, and `qchat-view.js` ships no interpreter.
2. **No second JS engine.** The page WebView must not become a second
   general-purpose runtime with its own globals and its own escape surface.
   WXS runs in the service runtime, next to the page JS, on the platform engine.
3. **No reuse of the expression evaluator.** `{{ }}` is a data-only language
   (ADR 012 and `expression.ts`); it has no statements, no variables and no
   calls other than WXS exports. WXS needs statements, closures and modules, so
   it gets a typed AST and an interpreter instead of an extension of the
   expression grammar.

## Decision

### 1. Build-time parse, typed AST

`packages/miniapp-compiler/src/wxs.ts` lexes and parses a `.wxs` file or an
inline `<wxs>` block once, at build time, into the typed AST defined in
`packages/miniapp-contracts/src/wxs.ts`. Every node carries a
`WxsLocation` (file, 1-based line/column, offset), so a diagnostic and a runtime
error both point at real source. The device never sees source text.

A page bundle carries:

```ts
interface WxsBundle {
  modules: Record<string, { name: string; file: string; ast: WxsProgram }>;
  sources: Record<string, WxsProgram>; // every module and required file
  files: string[];                     // real .wxs files, for the package list
}
```

`modules` maps the page's `module` names to their entry file. `sources` holds
every compiled program, including files pulled in by `require`, keyed by package
path. An inline block uses the synthetic key `<page>.wxml#wxs:<name>`; it is in
`sources` but not in `files`, because it is not a file the package installs.
`reviveWxml` validates the bundle with `isWxsBundle` and refuses a malformed one
instead of rendering without WXS.

### 2. Accepted subset

The parser accepts exactly this language and rejects everything else with a
diagnostic:

- `var` declarations, named `function` declarations and function expressions;
- `if`/`else`, `for`, `for-in`, `while`, `do-while`;
- `return`, `break`, `continue`;
- the usual unary, binary, logical and ternary operators, assignment and
  compound assignment;
- object, array and function literals, member and computed member access;
- `getRegExp(pattern, flags)`, `console.log` (and `info`/`warn`/`error`/`debug`);
- `module.exports` / `exports` and a literal `require("...")`.

Rejected with `WXS_UNSUPPORTED_FEATURE` or `WXS_PARSE_ERROR`:

| Rejected | Why |
|---|---|
| `let`, `const` | WXS is `var`-scoped; two binding models invite accidental shadowing |
| arrow functions, `this` | `this` would expose the interpreter's call frame |
| template literals | no need; string concatenation covers the subset |
| regular-expression literals | `getRegExp` is the documented form and validates flags |
| `new`, classes | no constructors in the sandbox |
| `try`/`catch`/`finally`, `throw` | errors are the runtime's, not the script's |
| `switch`, labels | not in the documented subset |
| spread, optional chaining | not in the documented subset |
| `async`/`await`, generators, `yield` | no event loop and no suspension |
| `delete`, `void`, `instanceof`, `with`, `debugger` | no host or object model to act on |

A bare top-level `return` or `break` is a `WXS_PARSE_ERROR`; a call whose callee
is not a declared module export is a `WXML_INVALID_EXPRESSION` at compile time.

### 3. Isolation

`packages/miniapp-view-runtime/src/wxs.ts` is a tree-walking interpreter. It
never calls `eval` or `Function`, never receives a host object and never shares
a scope with page JS:

- Every call gets a fresh `Env` whose parent is the interpreter's globals. A
  module body runs in its own `Env`; closures capture the environment they were
  created in, not the caller's.
- Arguments are **cloned in** (`cloneInto`): primitives pass by value, arrays and
  plain objects are copied, `Date` becomes an ISO string, a `RegExp` is copied,
  and a function/symbol/bigint is refused. Nesting deeper than 64 is refused.
- Results are **cloned out** (`cloneOut`): a function cannot cross the boundary;
  a `RegExp` becomes its string form; forbidden keys are dropped.
- The only globals are `undefined`, `NaN`, `Infinity`, `Math` (constants and 21
  numeric methods), `JSON` (`parse`/`stringify`), `Object` (`keys`/`values`),
  `Array.isArray`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, the four URI
  functions, `getRegExp`, `console`, `module`, `exports` and `require`.
- There is no `wx`, no DOM, no timer, no bridge, no `process`, no
  `require` of a non-literal path, and no host global to reach.

Member access is an explicit allowlist per type:

- string: `charAt`, `charCodeAt`, `codePointAt`, `indexOf`, `lastIndexOf`,
  `includes`, `startsWith`, `endsWith`, `slice`, `substring`, `substr`, `split`,
  `replace`, `replaceAll`, `toUpperCase`, `toLowerCase`, `trim`, `trimStart`,
  `trimEnd`, `concat`, `repeat`, `padStart`, `padEnd`, `localeCompare`, `match`,
  `search`;
- number: `toFixed`, `toPrecision`, `toExponential`;
- array: `push`, `pop`, `shift`, `unshift`, `slice`, `splice`, `concat`, `join`,
  `indexOf`, `lastIndexOf`, `includes`, `reverse`, `sort`, `map`, `filter`,
  `reduce`, `reduceRight`, `forEach`, `some`, `every`, `find`, `findIndex`,
  `fill`, `at`;
- `RegExp`: `test`, `exec`;
- everything else is an own property of the object or `undefined`.

`__proto__`, `prototype` and `constructor` are rejected by the parser
(`WXS_UNSAFE_ACCESS`) and again by the interpreter, so a computed key cannot
reach them either.

### 4. Modules, `require` and state

A `require("...")` is resolved **at compile time** against the requiring file's
package path; the compiler loads the target recursively, adds it to `sources`
and to the package file list, and a cycle is loaded once. A non-literal
`require` is a compile error. At runtime `require(path)` looks the path up in
the precompiled bundle; it cannot load anything that was not compiled.

Each file is evaluated once and cached in the runtime. A cycle sees the partial
`module.exports` object, matching Node's behaviour. The module cache is
page-scoped and survives across calls, so module-level state (a counter, a
cache) behaves as a page would expect. `destroy()` clears the cache.

### 5. WXML integration

- A template call is only a static path rooted at a module the page declared:
  `{{ m.format(x) }}`, `{{ m.util.pad(x) }}`. The compiler resolves the path and
  emits a `call` node; `renderWxml` invokes it on the page runtime. Computed
  callees (`{{ modules[i](x) }}`) and any other function are rejected.
- An event handler is the string `wxs:<module>.<fn>`. The compiler validates
  the module and the shape; the render tree carries the string; the WebView
  sends it back as a normal `view.event` and the service dispatches it through
  `invokeWxsEvent`.
- A handler receives `(event, ownerInstance)`. `ownerInstance.callMethod(name,
  data)` is the only method; it reaches the page's handler map with a synthetic
  `ViewEvent` whose `detail` is the data object (a non-object becomes
  `{ value }`). There is no `selectComponent`, `getState` or `triggerEvent` on
  `ownerInstance`; a page that needs those calls its own method.
- A runtime error keeps its `WXS_*` code on the bridge error and goes to
  `app.onError`; it is never swallowed. A missing runtime is `WXS_UNSUPPORTED`,
  not a silent no-op.

### 6. Limits

| Limit | Value | Error |
|---|---|---|
| Statements per call | 1,000,000 | `WXS_LIMIT_EXCEEDED` |
| Nested WXS calls | 64 | `WXS_LIMIT_EXCEEDED` |
| Array length | 100,000 | `WXS_RUNTIME_ERROR` |
| String length (a log line) | 1,000,000 | truncated with `…` |
| Value nesting across the boundary | 64 | `WXS_RUNTIME_ERROR` |
| Export path length | 256 | `WXS_RUNTIME_ERROR` |

The step budget resets at the start of every `call`/`callEvent`, so one
expensive render does not starve the next. The budget is configurable for tests
(`stepBudget`), but the shipped default is the value above.

### 7. Page-only, inline rule

WXS is page-scoped: a component may not declare `<wxs>`, because the runtime
belongs to the page and a component never owns page data. A component that
declares one gets `WXS_UNSUPPORTED`; a page that uses `wxs:` without declaring
the module gets `WXML_INVALID_EVENT`.

An inline `<wxs>` body is raw text until the first `</wxs>`; `<`, `>`, `{{` and
`}}` inside it are code, not markup. The documented limitation is that the
literal string `</wxs>` cannot appear inside inline code — use `src` for such a
module. A `<wxs>` must be a direct child of the page; one nested in an element
is `WXS_PARSE_ERROR`.

### 8. Performance note

The service renders the tree and the WebView applies it, so a WXS handler runs
in the service and its result travels back over the same `view.event` channel as
a page handler. WeChat runs WXS in the view layer, so a WXS handler there does
not cross a process boundary. The subset, the results and the errors are the
same; the latency is not. This difference is recorded in
`docs/compatibility.md` and is the reason WXS is not a substitute for a page
handler in a hot path.

## Consequences

- The view bundle stays data. A device never parses WXS, so a malformed module
  fails the build, not the first render.
- The interpreter is small enough to unit-test on Node and to audit: no `eval`,
  no host object, one allowlist per type, explicit limits.
- The compiler package now depends on `@qchat/miniapp-view-runtime` for
  `renderWxml`; the service runtime and the harness pass the same page runtime
  to rendering and to events, so module state is shared.
- `renderWxml` creates and caches one runtime per `CompiledWxml` when the caller
  does not supply one. The harness supplies its own, so a test can inspect or
  replace it.
- WXS in a component, computed callees and the full `ownerInstance` API are not
  implemented. They are recorded as differences, not as silent fallbacks.
- Every WXS behaviour is Node-verified only. Real-device evaluation, timing and
  interaction stay `UNVERIFIED`/`BLOCKED` until the device run.

## Evidence

- `packages/miniapp-contracts/src/wxs.ts` — AST, `WxsBundle`, `WxsInvoker`,
  `isWxsBundle`, error codes.
- `packages/miniapp-compiler/src/wxs.ts` — lexer/parser, `parseWxs`,
  `collectWxsRequires`.
- `packages/miniapp-compiler/src/wxml-compiler.ts` — `<wxs>` collection,
  `src`/inline modules, `require` recursion, expression calls, `wxs:` events,
  the per-page runtime cache.
- `packages/miniapp-compiler/src/expression.ts` — the `call` node and the
  static call path.
- `packages/miniapp-view-runtime/src/wxs.ts` — the interpreter, cloning,
  allowlists, limits and `WxsError`.
- `packages/miniapp-service-runtime/src/index.ts` — `invokeWxsEvent`, the
  `wxs:` branch of `dispatchViewEvent`, `wxsEventDetail`.
- `packages/miniapp-compiler/test/wxs.test.ts` (17 tests) and
  `packages/miniapp-service-runtime/test/wxs.test.ts` (4 tests).
- ADR 009 (engine boundary), ADR 012 (view transport), section 6 of the
  specification.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ElementNode, RenderNode } from "@qchat/miniapp-contracts";
import {
  compileWxml,
  formatDiagnostic,
  loadComponentRegistry,
  renderWxml,
  resolveComponentPath,
  type ComponentRenderRequest,
  type CompiledWxml,
  type ElementTemplate,
} from "../src/index.js";

const PAGE = "pages/index/index.wxml";

function element(node: RenderNode): ElementNode {
  assert.equal(node.type, "element");
  return node as ElementNode;
}

function text(node: RenderNode): string {
  assert.equal(node.type, "text");
  return (node as { text: string }).text;
}

function fixture(): Record<string, string> {
  return {
    "app.json": JSON.stringify({
      pages: ["pages/index/index"],
      usingComponents: { "app-badge": "/components/badge/badge" },
    }),
    "app.js": "App({});",
    "pages/index/index.json": JSON.stringify({
      usingComponents: { "my-card": "./card/card" },
    }),
    "pages/index/index.wxml": `<my-card title="{{title}}" count="{{count}}">
      <text slot="head" class="head">{{heading}}</text>
      <text class="body">Body {{count}}</text>
    </my-card>`,
    "pages/index/index.js": "Page({ data: {} });",
    "pages/index/card/card.json": JSON.stringify({
      component: true,
      usingComponents: { "my-label": "../../../components/label/label" },
    }),
    "pages/index/card/card.wxml": `<view class="card">
      <slot name="head"></slot>
      <text class="title">{{title}}/{{count}}</text>
      <my-label text="{{title}}"></my-label>
      <slot></slot>
    </view>`,
    "pages/index/card/card.js": "Component({ properties: { title: String, count: Number } });",
    "components/label/label.json": JSON.stringify({ component: true }),
    "components/label/label.wxml": `<text class="label">{{text}}</text>`,
    "components/label/label.js": "Component({ properties: { text: String } });",
    "components/badge/badge.json": JSON.stringify({ component: true }),
    "components/badge/badge.wxml": `<text class="badge">{{count}}</text>`,
    "components/badge/badge.js": "Component({ properties: { count: Number } });",
  };
}

function compilePage(
  files: Record<string, string>,
  pageUsing: Record<string, string>,
  appUsing: Record<string, string> = {},
): CompiledWxml {
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    appUsingComponents: appUsing,
    pageUsingComponents: pageUsing,
  });
  assert.equal(registry.ok, true, registry.ok ? "" : formatDiagnostic(registry.diagnostics[0]));
  if (!registry.ok) throw new Error("unreachable");
  const compiled = compileWxml(files[PAGE], PAGE, {
    loadFile: read,
    componentTags: registry.value.tags,
    componentTemplates: registry.value.templates,
  });
  assert.equal(compiled.ok, true, compiled.ok ? "" : formatDiagnostic(compiled.diagnostics[0]));
  if (!compiled.ok) throw new Error("unreachable");
  return compiled.value;
}

test("resolves relative, root-relative and nested component paths", () => {
  assert.equal(resolveComponentPath(PAGE, "./card/card"), "pages/index/card/card");
  assert.equal(resolveComponentPath(PAGE, "../../components/card/card"), "components/card/card");
  assert.equal(resolveComponentPath(PAGE, "/components/card/card"), "components/card/card");
  assert.equal(resolveComponentPath(PAGE, "../../../escape/card"), null);
  assert.equal(resolveComponentPath(PAGE, "plugin://x/y"), null);
});

test("loads app, page and nested usingComponents once", () => {
  const files = fixture();
  files[PAGE] = `${files[PAGE]}\n<app-badge count="{{count}}"></app-badge>`;
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    appUsingComponents: { "app-badge": "/components/badge/badge" },
    pageUsingComponents: { "my-card": "./card/card" },
  });
  assert.equal(registry.ok, true, registry.ok ? "" : formatDiagnostic(registry.diagnostics[0]));
  if (!registry.ok) return;
  assert.deepEqual(registry.value.tags, {
    "app-badge": "components/badge/badge",
    "my-card": "pages/index/card/card",
  });
  assert.deepEqual(Object.keys(registry.value.templates).sort(), [
    "components/badge/badge",
    "components/label/label",
    "pages/index/card/card",
  ]);
  assert.ok(registry.value.files.includes("pages/index/card/card.wxml"));
  assert.ok(registry.value.files.includes("components/label/label.js"));
});

test("an app-level component the page never uses is not loaded", () => {
  const files: Record<string, string> = {
    "pages/index/index.json": JSON.stringify({ usingComponents: { "my-card": "./card/card" } }),
    "pages/index/index.wxml": `<my-card></my-card>`,
    "pages/index/card/card.json": JSON.stringify({ component: true }),
    "pages/index/card/card.wxml": `<view class="card">card</view>`,
    "pages/index/card/card.js": "Component({});",
    // This global component refers to itself: loading it would report a cycle.
    "components/loop/loop.json": JSON.stringify({
      component: true,
      usingComponents: { "loop-loop": "/components/loop/loop" },
    }),
    "components/loop/loop.wxml": `<loop-loop></loop-loop>`,
    "components/loop/loop.js": "Component({});",
  };
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    appUsingComponents: { "loop-loop": "/components/loop/loop" },
    pageUsingComponents: { "my-card": "./card/card" },
  });
  assert.equal(registry.ok, true, registry.ok ? "" : formatDiagnostic(registry.diagnostics[0]));
  if (!registry.ok) return;
  assert.deepEqual(registry.value.tags, { "my-card": "pages/index/card/card" });
  assert.deepEqual(Object.keys(registry.value.templates), ["pages/index/card/card"]);
  assert.ok(!registry.value.files.includes("components/loop/loop.wxml"));
});

test("a custom tag compiles to wx-<tag> and carries the component path", () => {
  const compiled = compilePage(fixture(), { "my-card": "./card/card" });
  const root = compiled.nodes[0] as ElementTemplate;
  assert.equal(root.type, "element");
  assert.equal(root.tag, "wx-my-card");
  assert.equal(root.component, "pages/index/card/card");
  assert.equal(root.children.length, 2);
});

test("renders component data, properties and both slots", () => {
  const compiled = compilePage(fixture(), { "my-card": "./card/card" });
  const requests: ComponentRenderRequest[] = [];
  const result = renderWxml(compiled, { title: "Hi", heading: "Head", count: 2 }, {
    componentData(request) {
      requests.push(request);
      if (request.path === "pages/index/card/card") return { title: "default", count: 0, extra: "card" };
      if (request.path === "components/label/label") return { text: "label-default" };
      return {};
    },
    componentHandler(request) {
      return `component:${request.instanceKey}:${request.handler}`;
    },
  });
  assert.equal(result.ok, true, result.ok ? "" : formatDiagnostic(result.diagnostics[0]));
  if (!result.ok) return;

  const card = element(result.value);
  assert.equal(card.tag, "wx-my-card");
  // `title` and `count` are component properties, so they are not host props.
  assert.deepEqual(card.props, { "data-qchat-component": "pages/index/card/card" });
  const view = element(card.children[0]);
  assert.equal(view.tag, "wx-view");
  assert.equal(view.props.class, "card");
  // Named slot, component text, nested component, default slot.
  assert.deepEqual(view.children.map((child) => (child.type === "element" ? child.tag : "text")), [
    "wx-text",
    "wx-text",
    "wx-my-label",
    "wx-text",
  ]);
  assert.equal(element(view.children[0]).props.class, "head");
  assert.equal(element(view.children[0]).props.slot, undefined);
  assert.equal(text(element(view.children[0]).children[0]), "Head");
  assert.equal(text(element(view.children[1]).children[0]), "Hi/2");
  const label = element(view.children[2]);
  assert.equal(label.tag, "wx-my-label");
  assert.equal(element(label.children[0]).tag, "wx-text");
  assert.equal(text(element(label.children[0]).children[0]), "Hi");
  assert.equal(text(element(view.children[3]).children[0]), "Body 2");

  assert.deepEqual(requests.map((request) => request.path), [
    "pages/index/card/card",
    "components/label/label",
  ]);
  assert.deepEqual(requests[0].props, { title: "Hi", count: 2 });
  assert.equal(requests[0].instanceKey, "0");
});

test("a component method is namespaced for the host", () => {
  const files = fixture();
  files["pages/index/card/card.wxml"] = `<view class="card"><button bindtap="onTap">Go</button></view>`;
  const compiled = compilePage(files, { "my-card": "./card/card" });
  const result = renderWxml(compiled, {}, {
    componentData: () => ({}),
    componentHandler: (request) => `component:${request.instanceKey}:${request.handler}`,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const view = element(element(result.value).children[0]);
  const button = element(view.children[0]);
  assert.equal(button.events?.tap.handler, "component:0:onTap");
});

test("a host without component support fails loudly", () => {
  const compiled = compilePage(fixture(), { "my-card": "./card/card" });
  const result = renderWxml(compiled, { title: "Hi", count: 0 });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics[0].code, "COMPONENT_UNSUPPORTED");
});

test("a missing component file is a compiler diagnostic, never a plain tag", () => {
  const files = fixture();
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    pageUsingComponents: { "my-card": "./missing/missing" },
  });
  assert.equal(registry.ok, false);
  if (registry.ok) return;
  assert.ok(registry.diagnostics.some((entry) => entry.code === "COMPILER_UNSUPPORTED_CONFIG"));

  const compiled = compileWxml(files[PAGE], PAGE, { loadFile: read });
  assert.equal(compiled.ok, false);
  if (compiled.ok) return;
  assert.ok(compiled.diagnostics.some((entry) => entry.code === "WXML_UNKNOWN_COMPONENT"));
});

test("a component cycle is reported instead of recursing", () => {
  const files: Record<string, string> = {
    "pages/index/index.json": JSON.stringify({ usingComponents: { "a-a": "../../components/a/a" } }),
    "pages/index/index.wxml": `<a-a></a-a>`,
    "components/a/a.json": JSON.stringify({ component: true, usingComponents: { "b-b": "../b/b" } }),
    "components/a/a.wxml": `<b-b></b-b>`,
    "components/a/a.js": "Component({});",
    "components/b/b.json": JSON.stringify({ component: true, usingComponents: { "a-a": "../a/a" } }),
    "components/b/b.wxml": `<a-a></a-a>`,
    "components/b/b.js": "Component({});",
  };
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    pageUsingComponents: { "a-a": "../../components/a/a" },
  });
  assert.equal(registry.ok, false);
  if (registry.ok) return;
  assert.ok(registry.diagnostics.some((entry) => /cycle/i.test(entry.message)));
});

test("usingComponents rejects extensions and invalid tags", () => {
  const read = (): string | null => null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    pageUsingComponents: {
      "My_Card": "./card/card",
      "bad-card": "./card/card.json",
      "plugin-card": "plugin://provider/card",
    },
  });
  assert.equal(registry.ok, false);
  if (registry.ok) return;
  assert.equal(registry.diagnostics.length, 3);
});

test("a component must be declared with component: true", () => {
  const files = fixture();
  files["pages/index/card/card.json"] = JSON.stringify({ usingComponents: {} });
  const read = (path: string): string | null => files[path] ?? null;
  const registry = loadComponentRegistry({
    read,
    pageFile: PAGE,
    pageUsingComponents: { "my-card": "./card/card" },
  });
  assert.equal(registry.ok, false);
  if (registry.ok) return;
  assert.ok(registry.diagnostics.some((entry) => /component.*true/i.test(entry.message)));
});

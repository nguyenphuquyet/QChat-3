import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import {
  buildMiniProgram,
  type BuildOptions,
  type BuiltMiniProgram,
} from "../src/builder.js";

export const fixtureProject = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/wechat-basic",
);

const created: string[] = [];

export function projectPath(relative: string): string {
  return path.join(fixtureProject, ...relative.split("/"));
}

/// Writes a temporary WeChat-shaped project. Call [cleanupProjects] in
/// `after()` so a failed assertion does not leave directories behind.
export async function makeProject(
  files: Record<string, string | Buffer>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "qchat-mp-"));
  created.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, ...relative.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
  return root;
}

export async function cleanupProjects(): Promise<void> {
  await Promise.all(created.splice(0).map((root) => rm(root, { recursive: true, force: true })));
}

/// A minimal valid project with two pages and one component.
export function minimalProject(extra: Record<string, string | Buffer> = {}): Record<string, string | Buffer> {
  return {
    "app.json": JSON.stringify({
      pages: ["pages/index/index", "pages/detail/detail"],
      window: {
        navigationBarTitleText: "Fixture",
        navigationBarBackgroundColor: "#ffffff",
        navigationBarTextStyle: "black",
        backgroundColor: "#f7f7f7",
      },
    }),
    "app.js": 'console.info("app boot");\n',
    "app.wxss": "page { background: #f7f7f7; }\n",
    "manifest.json": JSON.stringify({
      name: "Fixture App",
      version: "1.2.3",
      description: "A fixture",
      requestedPermissions: ["toast"],
    }),
    "pages/index/index.js": `export default Page({
  data: { count: 0, show: false, items: ["a", "b"], title: "Hi" },
  inc() { this.setData({ count: this.data.count + 1 }); },
});\n`,
    "pages/index/index.wxml": `<view class="page" id="page">
  <text id="count">{{count}}</text>
  <view wx:if="{{show}}" id="shown">shown</view>
  <view wx:for="{{items}}" wx:key="*this" class="row">{{item}}</view>
  <fixture-card title="{{title}}" />
</view>\n`,
    "pages/index/index.wxss": ".page { padding: 20px; }\n",
    "pages/index/index.json": JSON.stringify({
      usingComponents: { "fixture-card": "/components/fixture-card/fixture-card" },
    }),
    "pages/detail/detail.js": 'export default Page({ data: { from: "" } });\n',
    "pages/detail/detail.wxml": '<view id="detail">detail</view>\n',
    "pages/detail/detail.json": JSON.stringify({ navigationBarTitleText: "Detail" }),
    "components/fixture-card/fixture-card.js": `export default Component({
  properties: { title: { type: String, value: "" } },
});\n`,
    "components/fixture-card/fixture-card.wxml": '<view class="card" id="card">{{title}}</view>\n',
    "components/fixture-card/fixture-card.wxss": ".card { color: red; }\n",
    "components/fixture-card/fixture-card.json": JSON.stringify({ component: true }),
    ...extra,
  };
}

export const fixedDate = new Date("2026-01-01T00:00:00.000Z");

/// Builds a fixture in development mode: fast, unminified and readable in
/// failure messages.
export async function buildFixture(
  projectDir: string,
  options: Partial<BuildOptions> = {},
): Promise<BuiltMiniProgram> {
  const outRoot = await mkdtemp(path.join(tmpdir(), "qchat-out-"));
  created.push(outRoot);
  return buildMiniProgram({
    projectDir,
    outFile: path.join(outRoot, "fixture.japp"),
    outDir: path.join(outRoot, "unpacked"),
    date: fixedDate,
    mode: "development",
    minify: false,
    ...options,
  });
}

export type BootedApp = {
  dom: JSDOM;
  window: JSDOM["window"] & Record<string, unknown>;
  document: Document;
  logs: string[];
  settle: (ticks?: number) => Promise<void>;
  html: () => string;
  tap: (element: Element | null) => void;
  input: (element: HTMLInputElement | HTMLTextAreaElement, value: string) => void;
  scroll: (element: Element, top?: number, left?: number) => void;
  dispose: () => Promise<void>;
};

/// Executes the official glass-easel bootstrap bundled in `app-service.js`
/// against jsdom. jsdom's `window.eval` runs the bundle in the window's global
/// scope, which is what glass-easel expects; `new Function` does not.
export async function bootBuiltApp(
  built: BuiltMiniProgram,
  options: {
    url?: string;
    config?: Record<string, unknown>;
    /// App-level WXSS to attach to the document, for computed-style checks.
    styles?: string;
  } = {},
): Promise<BootedApp> {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: options.url ?? "http://localhost/token/index.html",
  });
  const { window } = dom;
  const document = window.document;
  const logs: string[] = [];

  // Keep the page's console output visible to the test without letting it
  // pollute the runner's stdout.
  (window as unknown as Record<string, unknown>).console = {
    log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    info: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    error: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
  };
  (window as unknown as Record<string, unknown>).__QCHAT_APP_CONFIG__ =
    options.config ?? JSON.parse(built.appConfigJson);
  (window as unknown as Record<string, unknown>).qchat = {
    call: async () => ({}),
  };

  if (options.styles) {
    const style = document.createElement("style");
    style.textContent = options.styles;
    document.head.appendChild(style);
  }

  try {
    window.eval(built.appService.toString("utf8"));
  } catch (error) {
    await rm(built.outDir, { recursive: true, force: true });
    throw error;
  }

  const settle = async (ticks = 12): Promise<void> => {
    for (let index = 0; index < ticks; index++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };
  await settle();

  const tap = (element: Element | null): void => {
    if (!element) return;
    const MouseEvent = window.MouseEvent;
    const init = { bubbles: true, cancelable: true, clientX: 10, clientY: 10 };
    element.dispatchEvent(new MouseEvent("mousedown", init));
    element.dispatchEvent(new MouseEvent("mouseup", init));
  };

  const input = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    element.value = value;
    element.dispatchEvent(new window.Event("input", { bubbles: true, composed: true }));
  };

  const scroll = (element: Element, top = 0, left = 0): void => {
    const target = element as HTMLElement;
    target.scrollTop = top;
    target.scrollLeft = left;
    target.dispatchEvent(new window.Event("scroll", { bubbles: false }));
  };

  return {
    dom,
    window: window as JSDOM["window"] & Record<string, unknown>,
    document,
    logs,
    settle,
    html: () => document.body.innerHTML,
    tap,
    input,
    scroll,
    dispose: async () => {
      window.close();
      await rm(built.outDir, { recursive: true, force: true });
    },
  };
}

/// The style-scope prefix makes the rendered class `F--qchat-input`, so tests
/// match the suffix rather than the authored class.
export function byClass(root: ParentNode, className: string): Element | null {
  const nodes = root.querySelectorAll("[class]");
  for (const node of nodes) {
    const tokens = String(node.getAttribute("class") || "").split(/\s+/);
    if (tokens.some((token) => token === className || token.endsWith(`--${className}`))) {
      return node;
    }
  }
  return null;
}

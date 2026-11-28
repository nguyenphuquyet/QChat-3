import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MemoryDomAdapter } from "@qchat/miniapp-view-runtime";
import {
  HOST_TOAST_EVENT,
  MemoryStorageAdapter,
  type NetworkAdapter,
  type NetworkRequest,
} from "@qchat/miniapp-service-runtime";
import { createSampleHost, loadSample } from "../src/index.js";

const ROOT = fileURLToPath(new URL("./fixtures/m4-api", import.meta.url));

function handleByClass(dom: MemoryDomAdapter, className: string): string {
  const visit = (handle: string): string | null => {
    const node = dom.nodes.get(handle);
    if (!node) return null;
    if (node.attrs.get("class") === className) return handle;
    for (const child of node.children) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  for (const child of dom.nodes.get(dom.root)?.children ?? []) {
    const found = visit(child);
    if (found) return found;
  }
  throw new Error(`no element with class ${JSON.stringify(className)}`);
}

function textOf(dom: MemoryDomAdapter, className: string): string {
  const handle = handleByClass(dom, className);
  const node = dom.nodes.get(handle);
  if (!node) throw new Error("missing node");
  return node.children
    .map((child) => dom.nodes.get(child)?.text ?? "")
    .join("");
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("auto theme follows the host and system info reaches the page", () => {
  const sample = loadSample(ROOT);
  const host = createSampleHost(sample, {
    hostTheme: "dark",
    systemInfo: { platform: "ios", windowWidth: 390 },
  });
  host.launch();

  assert.equal(host.sample.app.qxColorScheme, "auto");
  assert.equal(host.theme(), "dark");
  assert.equal((host.dom as MemoryDomAdapter).theme, "dark");

  const dom = host.dom as MemoryDomAdapter;
  assert.equal(textOf(dom, "platform"), "ios");
  assert.equal(textOf(dom, "theme"), "dark");
  host.close();
});

test("an asynchronous storage call resolves and patches the page", async () => {
  const storage = new MemoryStorageAdapter();
  const host = createSampleHost(loadSample(ROOT), { storage });
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  dom.dispatch(handleByClass(dom, "save"), "tap");
  assert.equal(textOf(dom, "stored"), "", "the callback has not run yet");
  await settle();

  assert.equal(textOf(dom, "stored"), "saved");
  assert.equal(storage.read("note"), '{"text":"hello"}');
  assert.deepEqual(host.events.at(-1), {
    event: HOST_TOAST_EVENT,
    payload: { title: "Saved", icon: "success", duration: 1500 },
  });
  host.close();
});

test("wx.request goes through the recording network adapter", async () => {
  const requests: NetworkRequest[] = [];
  const network: NetworkAdapter = {
    async request(request) {
      requests.push(request);
      return {
        statusCode: 200,
        header: { "content-type": "application/json" },
        body: '{"message":"hi"}',
      };
    },
  };

  const host = createSampleHost(loadSample(ROOT), {
    network,
    domains: ["api.example.com"],
    systemInfo: { platform: "android" },
  });
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  dom.dispatch(handleByClass(dom, "fetch"), "tap");
  await settle();

  assert.equal(textOf(dom, "remote"), "hi");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.example.com/greeting");
  assert.equal(requests[0].method, "GET");
  host.close();
});

test("wx.request without an adapter fails honestly, with no fallback", async () => {
  const host = createSampleHost(loadSample(ROOT));
  const dom = host.dom as MemoryDomAdapter;
  host.launch();

  dom.dispatch(handleByClass(dom, "fetch"), "tap");
  await settle();

  assert.equal(textOf(dom, "remote"), "failed:API_UNSUPPORTED");
  host.close();
});

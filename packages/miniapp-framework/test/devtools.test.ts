import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { BuiltMiniProgram } from "../src/builder.js";
import {
  bootBuiltApp,
  buildFixture,
  cleanupProjects,
  makeProject,
  minimalProject,
  type BootedApp,
} from "./helpers.js";

after(cleanupProjects);

type DevMessage = Record<string, unknown> & { source?: string; type?: string };

type Wx = {
  request: (options: Record<string, unknown>) => Promise<unknown>;
} & Record<string, unknown>;

type DevtoolsBoot = {
  app: BootedApp;
  built: BuiltMiniProgram;
  messages: DevMessage[];
};

/// Boots with a fake `window.parent` so the runtime's dev channel has somewhere
/// to post. `config` can override `devtools` without rebuilding.
async function bootWithParent(options: {
  build?: { devtools?: boolean; mode?: "development" | "production" };
  config?: Record<string, unknown>;
} = {}): Promise<DevtoolsBoot> {
  const built = await buildFixture(
    await makeProject(
      minimalProject({
        "manifest.json": JSON.stringify({
          name: "Fixture App",
          version: "1.2.3",
          description: "A fixture",
          requestedPermissions: ["network"],
        }),
      }),
    ),
    { minify: false, ...(options.build ?? {}) },
  );
  const messages: DevMessage[] = [];
  const parent = {
    postMessage: (message: DevMessage) => {
      messages.push(message);
    },
  };
  const app = await bootBuiltApp(built, {
    config: options.config ? { ...built.appConfig, ...options.config } : undefined,
    beforeEval: (window) => {
      Object.defineProperty(window, "parent", { value: parent, configurable: true });
    },
  });
  return { app, built, messages };
}

function ofType(messages: DevMessage[], type: string): DevMessage[] {
  return messages.filter((message) => message.type === type);
}

describe("development event channel", () => {
  it("forwards console, network and error events to the embedding Studio", async () => {
    const { app, built, messages } = await bootWithParent();
    try {
      assert.equal(built.appConfig.devtools, true);

      // `app.js` logs during boot, before the first page mounts.
      const bootLogs = ofType(messages, "console");
      assert.ok(
        bootLogs.some((message) => message.message === "app boot"),
        `expected the app.js boot log, saw ${JSON.stringify(messages)}`,
      );

      app.window.console.log("hello", { answer: 42 });
      const logs = ofType(messages, "console");
      const lastLog = logs[logs.length - 1]!;
      assert.equal(lastLog.level, "log");
      assert.equal(lastLog.message, 'hello {"answer":42}');

      const wx = app.window.wx as Wx;
      await wx.request({ url: "/api/thing", method: "POST", data: { x: 1 } });
      await app.settle();

      const requests = messages.filter(
        (message) => message.type === "network" && message.phase === "request",
      );
      const responses = messages.filter(
        (message) => message.type === "network" && message.phase === "response",
      );
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.method, "POST");
      assert.equal(requests[0]?.url, "/api/thing");
      assert.equal(responses.length, 1);
      assert.equal(typeof responses[0]?.durationMs, "number");

      const error = new app.window.Event("error");
      Object.assign(error, { message: "boom", filename: "pages/index/index.js", lineno: 3, colno: 4 });
      app.window.dispatchEvent(error);
      const errors = ofType(messages, "error");
      assert.equal(errors.length, 1);
      assert.equal(errors[0]?.message, "boom");
      assert.equal(errors[0]?.file, "pages/index/index.js");
      assert.equal(errors[0]?.line, 3);
      assert.equal(errors[0]?.column, 4);

      const rejection = new app.window.Event("unhandledrejection");
      Object.assign(rejection, { reason: new Error("nope") });
      app.window.dispatchEvent(rejection);
      const rejections = messages.filter(
        (message) => message.type === "error" && message.file === "unhandledrejection",
      );
      assert.equal(rejections.length, 1);
      assert.equal(rejections[0]?.message, "nope");

      for (const message of messages) {
        assert.equal(message.source, "qchat-miniapp", "every message is namespaced for the Studio");
      }
    } finally {
      await app.dispose();
    }
  });

  it("stays silent when devtools is disabled", async () => {
    const { app, messages } = await bootWithParent({ config: { devtools: false } });
    try {
      app.window.console.log("hidden");
      const wx = app.window.wx as Wx;
      await wx.request({ url: "/api/thing" });
      await app.settle();

      const error = new app.window.Event("error");
      Object.assign(error, { message: "hidden" });
      app.window.dispatchEvent(error);

      assert.deepEqual(messages, []);
    } finally {
      await app.dispose();
    }
  });

  it("disables the channel in production builds by default", async () => {
    const { app, built, messages } = await bootWithParent({ build: { mode: "production" } });
    try {
      assert.equal(built.appConfig.devtools, false);
      app.window.console.log("production");
      await app.settle();
      assert.deepEqual(messages, []);
    } finally {
      await app.dispose();
    }
  });

  it("does nothing when there is no embedding parent", async () => {
    const built = await buildFixture(await makeProject(minimalProject()), { minify: false });
    const app = await bootBuiltApp(built);
    try {
      // jsdom sets `window.parent === window`; posting must not throw.
      assert.doesNotThrow(() => app.window.console.log("standalone"));
    } finally {
      await app.dispose();
    }
  });
});

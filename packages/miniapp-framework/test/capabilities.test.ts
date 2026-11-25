import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BUILTIN_COMPONENTS } from "../src/builtin.js";
import {
  API_CAPABILITIES,
  COMPONENT_CAPABILITIES,
  buildCapabilities,
} from "../src/capabilities.js";
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

/// Values created inside jsdom carry jsdom's prototypes, so `deepStrictEqual`
/// rejects them even when the data is identical. Compare plain copies instead.
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type WxError = Error & { code?: string };

type Wx = {
  canIUse: (schema: string) => boolean;
  getCapabilities: () => {
    permissions: string[];
    apis: Record<string, { supported: boolean; reason?: string }>;
    components: Record<string, { attributes: string[]; values?: Record<string, string[]> }>;
  };
  showToast: (options: Record<string, unknown>) => Promise<unknown>;
  request: (options: Record<string, unknown>) => Promise<unknown>;
  setStorageSync: (key: string, data: unknown) => void;
  getStorageSync: (key: string) => unknown;
  setStorage: (options: Record<string, unknown>) => Promise<unknown>;
} & Record<string, unknown>;

let built: BuiltMiniProgram;

before(async () => {
  built = await buildFixture(await makeProject(minimalProject()));
});

/// Boots the same package with an overridden permission list. The capability
/// manifest is embedded at build time, so only `permissions` changes.
async function boot(permissions?: string[]): Promise<{ app: BootedApp; wx: Wx }> {
  const config = permissions === undefined
    ? undefined
    : { ...built.appConfig, permissions };
  const app = await bootBuiltApp(built, config ? { config } : {});
  return { app, wx: app.window.wx as Wx };
}

describe("capability registry", () => {
  it("answers wx.canIUse from the embedded registry", async () => {
    const { app, wx } = await boot();
    try {
      assert.equal(wx.canIUse("wx.showToast"), true);
      assert.equal(wx.canIUse("wx.getStorageSync"), true);
      assert.equal(wx.canIUse("wx.showModal"), false);
      assert.equal(wx.canIUse("wx.notARealApi"), false);

      assert.equal(wx.canIUse("swiper"), true);
      assert.equal(wx.canIUse("swiper.autoplay"), true);
      assert.equal(wx.canIUse("swiper.easing-function.easeInCubic"), true);
      assert.equal(wx.canIUse("swiper.easing-function.bogus"), false);
      assert.equal(wx.canIUse("swiper.notAnAttribute"), false);

      assert.equal(wx.canIUse("button.open-type.share"), true);
      assert.equal(wx.canIUse("button.open-type.contact"), false);
      assert.equal(wx.canIUse("picker.mode.date"), true);
      assert.equal(wx.canIUse("picker.mode.region"), false);
      assert.equal(wx.canIUse("map"), false);
      assert.equal(wx.canIUse(""), false);
    } finally {
      await app.dispose();
    }
  });

  it("reports declared permissions and unsupported reasons via wx.getCapabilities", async () => {
    const { app, wx } = await boot();
    try {
      const capabilities = wx.getCapabilities();
      assert.deepEqual(capabilities.permissions, ["toast"]);
      assert.equal(capabilities.apis.showToast?.supported, true);
      assert.equal(capabilities.apis.showModal?.supported, false);
      assert.ok(capabilities.apis.showModal?.reason, "unsupported APIs carry a reason");
      assert.ok(capabilities.components.swiper?.attributes.includes("autoplay"));
      assert.deepEqual(plain(capabilities.components.button?.values?.["open-type"]), ["share", "getUserInfo"]);

      // The answer is a copy: a Mini Program cannot rewrite the host's registry.
      capabilities.apis.showToast!.supported = false;
      assert.equal(wx.getCapabilities().apis.showToast?.supported, true);
    } finally {
      await app.dispose();
    }
  });

  it("keeps the runtime, the component set and the registry in sync", async () => {
    const { app, wx } = await boot();
    try {
      const runtimeApis = Object.entries(wx)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name)
        .sort();

      for (const [name, capability] of Object.entries(API_CAPABILITIES)) {
        if (!capability.supported) continue;
        assert.equal(
          typeof wx[name],
          "function",
          `wx.${name} is listed as supported but missing from the runtime`,
        );
      }
      for (const name of runtimeApis) {
        assert.ok(
          API_CAPABILITIES[name],
          `wx.${name} is implemented but missing from API_CAPABILITIES`,
        );
      }
      assert.deepEqual(
        Object.keys(COMPONENT_CAPABILITIES).sort(),
        [...BUILTIN_COMPONENTS].sort(),
        "every built-in has a component capability entry and vice versa",
      );
    } finally {
      await app.dispose();
    }
  });

  it("builds the manifest from deduplicated, sorted permissions", () => {
    const manifest = buildCapabilities(["toast", "storage", "toast"]);
    assert.deepEqual(manifest.permissions, ["storage", "toast"]);
    assert.deepEqual(manifest.bridge.showToast, ["toast"]);
    assert.deepEqual(manifest.bridge.setStorage, ["storage"]);
    assert.equal(manifest.bridge.canIUse, undefined);
    assert.equal(manifest.apis.showModal?.supported, false);
    assert.ok(manifest.apis.showModal?.reason);
  });

  it("embeds the capability manifest in a development build", () => {
    assert.equal(built.appConfig.devtools, true);
    assert.deepEqual(built.appConfig.permissions, ["toast"]);
    assert.equal(built.appConfig.capabilities.apis.showToast?.supported, true);
    assert.equal(built.appConfig.capabilities.apis.showModal?.supported, false);
    assert.ok(built.appConfig.capabilities.components["rich-text"]);
  });
});

describe("permission gating", () => {
  it("rejects bridge APIs whose permission was not declared", async () => {
    const { app, wx } = await boot([]);
    try {
      let toastCode = "";
      await wx.showToast({
        title: "hi",
        fail: (error: WxError) => {
          toastCode = error.code ?? "";
        },
      });
      assert.equal(toastCode, "PERMISSION_DENIED");

      let requestCode = "";
      await wx.request({
        url: "/api/thing",
        fail: (error: WxError) => {
          requestCode = error.code ?? "";
        },
      });
      assert.equal(requestCode, "PERMISSION_DENIED");

      let storageCode = "";
      await wx.setStorage({
        key: "k",
        data: "v",
        fail: (error: WxError) => {
          storageCode = error.code ?? "";
        },
      });
      assert.equal(storageCode, "PERMISSION_DENIED");
    } finally {
      await app.dispose();
    }
  });

  it("runs a bridge API once its permission is declared", async () => {
    const { app, wx } = await boot(["toast"]);
    try {
      let succeeded = false;
      let failed = false;
      await wx.showToast({
        title: "hi",
        success: () => {
          succeeded = true;
        },
        fail: () => {
          failed = true;
        },
      });
      assert.equal(succeeded, true);
      assert.equal(failed, false);
    } finally {
      await app.dispose();
    }
  });

  it("scopes sync storage to the declared storage permission", async () => {
    const denied = await boot([]);
    try {
      denied.wx.setStorageSync("k", "v");
      assert.equal(denied.wx.getStorageSync("k"), "");
    } finally {
      await denied.app.dispose();
    }

    const allowed = await boot(["storage"]);
    try {
      allowed.wx.setStorageSync("k", "v");
      assert.equal(allowed.wx.getStorageSync("k"), "v");
    } finally {
      await allowed.app.dispose();
    }
  });
});

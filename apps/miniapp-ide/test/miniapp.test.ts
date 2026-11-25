import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ALLOWED_PERMISSIONS,
  APP_JSON_SCHEMA,
  BUILTIN_COMPONENTS,
  COMPONENT_JSON_SCHEMA,
  MANIFEST_SCHEMA,
  PAGE_JSON_SCHEMA,
  diagnoseProject,
  kindFor,
  ownerRouteOf,
  resolveComponentSpec,
  type ProjectFile,
} from "../src/lib/miniapp";
import { TEMPLATE_IDS, TEMPLATES, templateFiles } from "../src/lib/templates";
import { languageFor } from "../src/lib/utils";

function filesOf(template: (typeof TEMPLATE_IDS)[number]): ProjectFile[] {
  return templateFiles(template, {
    name: "Probe App",
    description: "Probe",
    version: "2.1.0",
    permissions: ["storage"],
  });
}

function errorsOf(files: ProjectFile[]) {
  return diagnoseProject(files).filter((diagnostic) => diagnostic.severity === "error");
}

/** Minimal project that passes every check unless a test breaks one file. */
function minimalProject(): ProjectFile[] {
  return [
    {
      relative: "app.json",
      content: `${JSON.stringify({ pages: ["pages/index/index"] }, null, 2)}\n`,
    },
    { relative: "app.js", content: "App({});\n" },
    { relative: "pages/index/index.js", content: "Page({ onTap() {} });\n" },
    { relative: "pages/index/index.json", content: "{}\n" },
    { relative: "pages/index/index.wxml", content: "<view bindtap=\"onTap\">hi</view>\n" },
    { relative: "pages/index/index.wxss", content: ".a { color: red; }\n" },
    { relative: "manifest.json", content: '{ "name": "Probe", "version": "1.0.0" }\n' },
  ];
}

test("every template is a complete WeChat project", () => {
  assert.deepEqual(TEMPLATE_IDS, ["starter", "counter", "blank"]);
  for (const id of TEMPLATE_IDS) {
    const files = filesOf(id);
    const relative = new Set(files.map((file) => file.relative));
    for (const required of [
      "app.json",
      "app.js",
      "app.wxss",
      "manifest.json",
      "project.config.json",
      "pages/index/index.js",
      "pages/index/index.json",
      "pages/index/index.wxml",
      "pages/index/index.wxss",
    ]) {
      assert.ok(relative.has(required), `${id} is missing ${required}`);
    }
    for (const file of files.filter((entry) => entry.relative.endsWith(".json"))) {
      assert.doesNotThrow(
        () => JSON.parse(file.content),
        `${id}/${file.relative} is not valid JSON`,
      );
    }
    const app = JSON.parse(files.find((file) => file.relative === "app.json")!.content) as {
      pages?: string[];
    };
    assert.ok(app.pages && app.pages.length > 0, `${id}/app.json needs pages`);
    for (const route of app.pages) {
      assert.ok(relative.has(`${route}.wxml`), `${id} page ${route} has no WXML`);
      assert.ok(relative.has(`${route}.js`), `${id} page ${route} has no script`);
    }
    assert.deepEqual(errorsOf(files), [], `${id} has static-analysis errors`);
  }
});

test("template overrides apply to the manifest and project config", () => {
  const files = filesOf("starter");
  const manifest = JSON.parse(
    files.find((file) => file.relative === "manifest.json")!.content,
  ) as Record<string, unknown>;
  assert.equal(manifest.name, "Probe App");
  assert.equal(manifest.version, "2.1.0");
  assert.deepEqual(manifest.requestedPermissions, ["storage"]);
  const config = JSON.parse(
    files.find((file) => file.relative === "project.config.json")!.content,
  ) as Record<string, unknown>;
  assert.equal(config.projectname, "Probe App");
});

test("the built-in component list matches the shipped host components", () => {
  const directory = fileURLToPath(
    new URL("../../../packages/miniapp-framework/builtin", import.meta.url),
  );
  const shipped = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "behaviors" && name !== "shared")
    .sort();
  assert.deepEqual([...BUILTIN_COMPONENTS].sort(), shipped);
});

test("file kinds, owners and component specs follow the WeChat layout", () => {
  assert.equal(kindFor("app.json"), "app");
  assert.equal(kindFor("pages/home/home.wxml"), "markup");
  assert.equal(kindFor("pages/home/home.wxss"), "style");
  assert.equal(kindFor("pages/home/home.json"), "page");
  assert.equal(kindFor("components/card/card.json"), "component");
  assert.equal(ownerRouteOf("pages/home/home.wxml"), "pages/home/home");
  assert.equal(ownerRouteOf("app.json"), null);
  assert.equal(resolveComponentSpec("./card/card", "pages/home/home.json"), "pages/home/card/card");
  assert.equal(resolveComponentSpec("/components/card/card", "pages/home/home.json"), "components/card/card");
  assert.equal(resolveComponentSpec("plugin://demo", "pages/home/home.json"), null);
  assert.equal(languageFor("pages/index/index.wxml"), "wxml");
  assert.equal(languageFor("pages/index/index.wxss"), "wxss");
  assert.equal(languageFor("utils/format.wxs"), "javascript");
});

test("schemas describe the four project JSON files", () => {
  assert.deepEqual(APP_JSON_SCHEMA.required, ["pages"]);
  assert.equal(PAGE_JSON_SCHEMA.type, "object");
  assert.ok(COMPONENT_JSON_SCHEMA.properties?.["component"]);
  assert.ok(MANIFEST_SCHEMA.properties?.["requestedPermissions"]);
  const manifest = JSON.stringify(MANIFEST_SCHEMA);
  for (const permission of ALLOWED_PERMISSIONS) {
    assert.ok(manifest.includes(`"${permission}"`), `manifest schema omits ${permission}`);
  }
});

test("a valid project has no diagnostics", () => {
  assert.deepEqual(diagnoseProject(minimalProject()), []);
});

test("missing app.json is reported instead of being guessed", () => {
  const diagnostics = diagnoseProject([]);
  assert.equal(diagnostics[0]?.id, "app.json:missing");
  assert.equal(diagnostics[0]?.severity, "error");
});

test("missing page files are reported", () => {
  const files = minimalProject().filter(
    (file) => file.relative !== "pages/index/index.wxml",
  );
  const errors = errorsOf(files);
  assert.ok(errors.some((error) => error.id === "app.json:route:pages/index/index:wxml"));
});

test("WXML tag balance is checked", () => {
  const files = minimalProject().map((file) =>
    file.relative === "pages/index/index.wxml"
      ? { ...file, content: "<view><text>hi</view>\n" }
      : file,
  );
  const errors = errorsOf(files);
  assert.ok(errors.some((error) => error.id.endsWith(":mismatch")), JSON.stringify(errors));
});

test("WXSS blocks must be closed", () => {
  const files = minimalProject().map((file) =>
    file.relative === "pages/index/index.wxss"
      ? { ...file, content: ".a { color: red;\n" }
      : file,
  );
  assert.ok(errorsOf(files).some((error) => error.id.endsWith(":unclosed-brace")));
});

test("usingComponents must point at real component files", () => {
  const files = minimalProject().map((file) =>
    file.relative === "pages/index/index.json"
      ? { ...file, content: '{"usingComponents":{"card":"/components/card/card"}}\n' }
      : file,
  );
  const errors = errorsOf(files);
  assert.ok(errors.some((error) => error.id.includes("using:card:json")));
});

test("wx:for without wx:key is a warning", () => {
  const files = minimalProject().map((file) =>
    file.relative === "pages/index/index.wxml"
      ? { ...file, content: '<view wx:for="{{items}}">{{item}}</view>\n' }
      : file,
  );
  const warnings = diagnoseProject(files).filter(
    (diagnostic) => diagnostic.severity === "warning",
  );
  assert.ok(warnings.some((warning) => warning.id.endsWith(":wx-for-key")));
});

test("event handlers must exist in the matching script", () => {
  const files = minimalProject().map((file) =>
    file.relative === "pages/index/index.js"
      ? { ...file, content: "Page({});\n" }
      : file,
  );
  const warnings = diagnoseProject(files).filter(
    (diagnostic) => diagnostic.severity === "warning",
  );
  assert.ok(warnings.some((warning) => warning.id.includes("handler:onTap")));
});

test("manifest permissions are validated against the capability registry", () => {
  const files = minimalProject().map((file) =>
    file.relative === "manifest.json"
      ? { ...file, content: '{ "name": "Probe", "version": "1.0.0", "requestedPermissions": ["teleport"] }\n' }
      : file,
  );
  const errors = errorsOf(files);
  assert.ok(errors.some((error) => error.id === "manifest.json:permissions:teleport"));
});

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BuildError, readPackageManifest } from "../src/builder.js";
import { readZip } from "../src/zip.js";
import {
  bootBuiltApp,
  buildFixture,
  byClass,
  cleanupProjects,
  fixtureProject,
  makeProject,
  minimalProject,
} from "./helpers.js";

after(cleanupProjects);

function assertBuildError(error: unknown, code: string): BuildError {
  assert.ok(error instanceof BuildError, `expected BuildError, got ${String(error)}`);
  assert.equal(error.code, code);
  return error;
}

describe("buildMiniProgram", () => {
  it("builds the verified multi-page fixture into the webapp container", async () => {
    const built = await buildFixture(fixtureProject);

    assert.equal(built.manifest.schemaVersion, 3);
    assert.equal(built.manifest.format, "webapp");
    assert.equal(built.manifest.entry, "index.html");
    assert.equal(built.manifest.version, "1.0.0");
    assert.deepEqual(built.manifest.requestedPermissions, []);

    assert.deepEqual(
      built.appConfig.pages.map((page) => page.route),
      ["pages/index/index", "pages/detail/detail"],
    );
    assert.deepEqual(
      built.appConfig.components.map((component) => component.id),
      ["components/card/card"],
    );
    assert.equal(built.appConfig.entry, "pages/index/index");
    assert.equal(built.appConfig.sdkVersion, "2.0.0");

    assert.ok(built.files.includes("index.html"));
    assert.ok(built.files.includes("manifest.json"));
    assert.ok(built.files.includes("metadata.json"));
    assert.ok(built.files.includes("permissions.json"));
    assert.ok(built.files.includes("assets/app-service.js"));
    assert.ok(built.files.includes("assets/app-wxss.css"));
    assert.ok(built.files.includes("assets/app-config.json"));

    assert.match(built.indexHtml, /<script src="\/assets\/app-service\.js"><\/script>/);
    assert.match(built.indexHtml, /<link rel="stylesheet" href="\/assets\/app-wxss\.css">/);
    assert.match(built.indexHtml, /window\.__QCHAT_APP_CONFIG__ = \{/);
  });

  it("renders pages, directives, slots and scoped component styles", async () => {
    const built = await buildFixture(fixtureProject);
    const app = await bootBuiltApp(built);
    const html = app.html();

    assert.match(html, /<wx-page>/);
    assert.equal(app.document.querySelector("#page")?.tagName.toLowerCase(), "wx-view");
    assert.equal(app.document.querySelector("#count")?.tagName.toLowerCase(), "wx-text");
    assert.equal(app.document.querySelector("#count")?.textContent, "0");
    assert.equal(app.document.querySelector("#inc")?.tagName.toLowerCase(), "wx-button");
    assert.equal(app.document.querySelector("#inc")?.textContent?.trim(), "plus");
    // wx:if is false and wx:for expands both items.
    assert.equal(app.document.querySelector("#shown"), null);
    assert.equal(app.document.querySelectorAll(".row").length, 2);
    // The custom component uses the official host tag and scoped class prefix.
    const card = app.document.querySelector("wx-card");
    assert.ok(card);
    assert.match(card?.getAttribute("wx-host") ?? "", /^[A-Z]$/);
    const cardBody = byClass(app.document, "card");
    assert.ok(cardBody);
    assert.match(cardBody?.getAttribute("class") ?? "", /^[A-Z]--card$/);
    assert.match(card?.textContent ?? "", /Hello/);
    await app.dispose();
  });

  it("keeps metadata consistent with the archive payload", async () => {
    const built = await buildFixture(fixtureProject);
    const entries = readZip(built.bytes);
    const names = entries.map((entry) => entry.name).sort();

    assert.deepEqual(names, [...built.files].sort());
    assert.ok(names.includes("manifest.json"));
    assert.ok(names.includes("metadata.json"));
    assert.ok(names.includes("permissions.json"));

    const metadata = JSON.parse(
      entries.find((entry) => entry.name === "metadata.json")?.bytes.toString("utf8") ?? "{}",
    ) as { files: Array<{ path: string; size: number; sha256: string }> };
    const index = entries.find((entry) => entry.name === "index.html");
    assert.ok(index);
    assert.equal(
      metadata.files.find((file) => file.path === "index.html")?.size,
      index.bytes.length,
    );
    assert.equal(
      metadata.files.find((file) => file.path === "index.html")?.sha256,
      built.metadata.entrySha256,
    );
    for (const file of metadata.files) {
      assert.ok(names.includes(file.path), `metadata lists missing file ${file.path}`);
    }

    const manifest = await readPackageManifest(built.outFile);
    assert.deepEqual(manifest, built.manifest);
  });

  it("accepts a UTF-8 BOM in project JSON", async () => {
    const project = minimalProject();
    project["app.json"] = `\uFEFF${project["app.json"] as string}`;
    project["pages/index/index.json"] = `\uFEFF${project["pages/index/index.json"] as string}`;
    const built = await buildFixture(await makeProject(project));
    assert.equal(built.appConfig.pages[0]?.route, "pages/index/index");
  });

  it("reports invalid JSON with the official compiler-independent diagnostics", async () => {
    const project = minimalProject();
    project["app.json"] = '{"pages": ["pages/index/index",],}';
    const root = await makeProject(project);
    await assert.rejects(buildFixture(root), (error) => {
      const failure = assertBuildError(error, "JSON_INVALID");
      assert.equal(failure.diagnostics[0]?.file, "app.json");
      assert.ok(failure.diagnostics[0]?.message);
      return true;
    });
  });

  it("fails on WXML syntax errors reported by the official compiler", async () => {
    const project = minimalProject();
    project["pages/index/index.wxml"] = '<view><text>{{unclosed</text></view>\n';
    const root = await makeProject(project);
    await assert.rejects(buildFixture(root), (error) => {
      const failure = assertBuildError(error, "WXML_SYNTAX");
      assert.ok(failure.diagnostics.length > 0);
      assert.ok(failure.diagnostics.some((item) => item.file === "pages/index/index.wxml"));
      return true;
    });
  });

  it("fails when a declared page file is missing", async () => {
    const missingScript = minimalProject();
    delete missingScript["pages/detail/detail.js"];
    await assert.rejects(
      buildFixture(await makeProject(missingScript)),
      (error) => assertBuildError(error, "SCRIPT_MISSING").code === "SCRIPT_MISSING",
    );

    const missingTemplate = minimalProject();
    delete missingTemplate["pages/detail/detail.wxml"];
    await assert.rejects(
      buildFixture(await makeProject(missingTemplate)),
      (error) => assertBuildError(error, "TEMPLATE_MISSING").code === "TEMPLATE_MISSING",
    );
  });

  it("rewrites asset URLs and copies assets under assets/", async () => {
    const pixel = Buffer.from("89504e470d0a1a0a", "hex");
    const project = minimalProject({
      "pages/index/images/pic.png": pixel,
      "styles/colors.wxss": ".token { color: #123456; }\n",
    });
    project["pages/index/index.wxml"] =
      '<view id="page"><image id="pic" src="images/pic.png" /><image id="remote" src="https://example.com/a.png" /></view>\n';
    project["pages/index/index.wxss"] =
      '@import "../../styles/colors.wxss";\n.page { background: url("./images/pic.png"); }\n';

    const built = await buildFixture(await makeProject(project));
    const wxml = built.project.rewritten.get("pages/index/index.wxml") ?? "";
    const wxss = built.project.rewritten.get("pages/index/index.wxss") ?? "";

    assert.match(wxml, /src="\/assets\/pages\/index\/images\/pic\.png"/);
    assert.match(wxml, /src="https:\/\/example\.com\/a\.png"/);
    assert.match(wxss, /background: url\("\/assets\/pages\/index\/images\/pic\.png"\)/);
    assert.doesNotMatch(wxss, /@import/);
    assert.match(wxss, /\.token \{ color: #123456; \}/);
    assert.ok(built.files.includes("assets/pages/index/images/pic.png"));
    assert.deepEqual(
      readZip(built.bytes).find((entry) => entry.name === "assets/pages/index/images/pic.png")?.bytes,
      pixel,
    );
    assert.match(built.appWxss.toString("utf8"), /\.token/);
  });

  it("produces stable metadata for a fixed timestamp", async () => {
    const root = await makeProject(minimalProject());
    const first = await buildFixture(root);
    const second = await buildFixture(root);

    // The official plugin registers templates from async tasks, so object
    // groups inside `app-service.js` are not byte-stable. Everything the host
    // verifies is stable.
    assert.deepEqual(first.manifest, second.manifest);
    assert.equal(first.indexHtml, second.indexHtml);
    assert.equal(first.appConfigJson, second.appConfigJson);
    // Style-scope letters are assigned from the async registration order, so
    // the stylesheet bytes are not stable; its size and rules are.
    assert.equal(first.appWxss.length, second.appWxss.length);
    assert.match(first.appWxss.toString("utf8"), /\.page\{/);
    assert.match(second.appWxss.toString("utf8"), /\.page\{/);
    assert.deepEqual(
      first.metadata.files.map((file) => [file.path, file.size]),
      second.metadata.files.map((file) => [file.path, file.size]),
    );
    assert.deepEqual(first.files, second.files);
  });

  it("bundles every declared page, including pages without usingComponents", async () => {
    const built = await buildFixture(fixtureProject);
    const service = built.appService.toString("utf8");
    assert.match(service, /pages\/detail\/detail/);
    assert.match(service, /pages\/index\/index/);
  });

  it("bundles a bare Page() page with no page JSON", async () => {
    const project = minimalProject();
    delete project["pages/index/index.json"];
    project["pages/index/index.js"] = `Page({
  data: { title: "Bare", count: 7 },
  inc() { this.setData({ count: this.data.count + 1 }); },
});
`;
    project["pages/index/index.wxml"] =
      '<view id="page"><text id="t">{{title}} {{count}}</text><button id="b" bindtap="inc">+</button></view>\n';

    const built = await buildFixture(await makeProject(project));
    assert.equal(built.appConfig.pages[0]?.route, "pages/index/index");
    assert.match(built.appService.toString("utf8"), /glass-easel-component/);

    const app = await bootBuiltApp(built);
    assert.equal(app.document.querySelector("#t")?.textContent, "Bare 7");
    await app.dispose();
  });

  it("rejects app.json without pages", async () => {
    const project = minimalProject();
    project["app.json"] = JSON.stringify({ pages: [] });
    await assert.rejects(
      buildFixture(await makeProject(project)),
      (error) => assertBuildError(error, "INVALID_APP").code === "INVALID_APP",
    );
  });

  it("ignores files outside the asset extension allow-list", async () => {
    const project = minimalProject({
      "notes.md": "not shipped\n",
      "assets/data.txt": "shipped\n",
    });
    const built = await buildFixture(await makeProject(project));
    assert.ok(built.files.includes("assets/data.txt"));
    assert.ok(!built.files.some((file) => file.endsWith(".md")));
  });

  it("writes the unpacked directory and the .japp file", async () => {
    const built = await buildFixture(fixtureProject);
    const index = await readFile(path.join(built.outDir, "index.html"), "utf8");
    assert.equal(index, built.indexHtml);
    const manifest = JSON.parse(await readFile(path.join(built.outDir, "manifest.json"), "utf8"));
    assert.deepEqual(manifest, built.manifest);
    const archive = await readFile(built.outFile);
    assert.ok(archive.equals(built.bytes));
  });
});

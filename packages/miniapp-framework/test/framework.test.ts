import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject, slugName, validateQapp } from "../src/compiler.js";
import { normalizeManifest, ManifestError } from "../src/manifest.js";
import { findNode, runQapp, textContent, walkTree } from "../src/tester.js";
import { readZip, writeZip } from "../src/zip.js";

const examples = path.resolve(import.meta.dirname, "../../miniapp-examples");

function workspace(): string {
  return mkdtempSync(path.join(tmpdir(), "qchat-qapp-"));
}

test("ZIP writer and reader round-trip UTF-8 entries", () => {
  const bytes = writeZip([
    { name: "manifest.json", data: Buffer.from('{"ok":true}') },
    { name: "assets/tên.txt", data: Buffer.from("xin chào") },
  ]);
  const entries = readZip(bytes);
  assert.equal(entries.length, 2);
  assert.equal(
    entries.find((entry) => entry.name === "assets/tên.txt")?.bytes.toString(),
    "xin chào",
  );
});

test("package slugs transliterate Vietnamese names", () => {
  assert.equal(slugName("Cà Phê Nhà"), "ca-phe-nha");
  assert.equal(slugName("Đồ uống & Bánh"), "do-uong-banh");
  assert.equal(slugName("Demo Kit"), "demo-kit");
  assert.equal(slugName("***"), "miniapp");
});

test("ZIP reader rejects traversal, duplicates and unsupported methods", () => {
  const traversal = Buffer.from("x");
  assert.throws(
    () => writeZip([{ name: "../evil.js", data: traversal }]),
    /ZIP_INVALID_NAME/,
  );
  assert.throws(
    () =>
      writeZip([
        { name: "a.js", data: traversal },
        { name: "A.JS", data: traversal },
      ]),
    /ZIP_DUPLICATE_FILE/,
  );
  const valid = writeZip([{ name: "a.js", data: traversal }]);
  const broken = Buffer.from(valid);
  broken[0] = 0;
  assert.throws(() => readZip(broken), /ZIP_INVALID/);
});

test("manifest requires qapp format and rejects a declared appId", () => {
  const base = {
    schemaVersion: 2,
    format: "qapp",
    name: "Demo",
    version: "1.0.0",
    entry: "app.js",
    sdkVersion: "1.0.0",
    minRuntimeVersion: "1.0.0",
    requestedPermissions: ["toast"],
  };
  assert.equal(normalizeManifest(base).name, "Demo");
  assert.throws(
    () => normalizeManifest({ ...base, appId: "mp_0123456789abcdef" }),
    (error: unknown) =>
      error instanceof ManifestError && error.code === "MANIFEST_APP_ID_FORBIDDEN",
  );
  assert.throws(
    () => normalizeManifest({ ...base, schemaVersion: 1 }),
    (error: unknown) => error instanceof ManifestError,
  );
  assert.throws(
    () => normalizeManifest({ ...base, requestedPermissions: ["admin"] }),
    (error: unknown) => error instanceof ManifestError,
  );
  // Any HTTPS host is reachable, so `network` does not need a host list.
  assert.deepEqual(
    normalizeManifest({ ...base, requestedPermissions: ["network"] })
      .requestedPermissions,
    ["network"],
  );
});

test("compiler packs every example with checksums and no appId", async () => {
  const directory = workspace();
  try {
    for (const [project, expectedText] of [
      ["hello-world", "Hello from TSX"],
      ["counter", "Counter"],
      ["shell", "Xin chào"],
      ["custom-kit", "24h 18m"],
      ["rap-pho", "Rạp Phố"],
    ] as const) {
      const projectDir = path.join(examples, project);
      const outfile = path.join(directory, `${project}.japp`);
      const result = await compileProject({
        projectDir,
        outfile,
        typecheck: true,
        now: new Date("2026-01-01T00:00:00.000Z"),
      });
      assert.equal(
        result.metadata.files.find((file) => file.path === "app.js")?.sha256,
        createHash("sha256").update(result.appJs).digest("hex"),
      );
      const bytes = readFileSync(outfile);
      const inspection = validateQapp(bytes, {
        version: result.manifest.version,
      });
      assert.equal(inspection.manifest.format, "qapp");
      assert.equal(inspection.manifest.entry, "app.js");
      assert.equal("appId" in inspection.manifest, false);
      assert.equal("appId" in inspection.metadata, false);
      assert.ok(inspection.files.every((file) => file.size > 0));
      const harness = runQapp(bytes);
      try {
        assert.ok(textContent(harness.latest()).includes(expectedText));
      } finally {
        harness.dispose();
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("counter state changes through host event and rerender", async () => {
  const directory = workspace();
  try {
    const result = await compileProject({
      projectDir: path.join(examples, "counter"),
      outfile: path.join(directory, "counter.japp"),
      typecheck: false,
    });
    const harness = runQapp(result.bytes);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const before = harness.latest();
      assert.ok(before?.root);
      let buttonCount = 0;
      walkTree(before, (node) => {
        if (node.type === "Button") buttonCount += 1;
      });
      assert.ok(buttonCount >= 2);
      const increment = findNode(before, (node) => {
        if (node.type !== "Button") return false;
        return textContent({ ...before!, root: node }).includes("Increment");
      });
      assert.ok(increment, "increment button is present");
      const next = harness.dispatch(increment!.id, "press", {});
      assert.ok(next);
      assert.notEqual(next!.revision, before!.revision);
      assert.ok(textContent(next).includes("1"));
      const stored = harness.calls.filter((call) => call.method === "setStorage");
      assert.ok(stored.length >= 1, "state is persisted through the host");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("validateQapp rejects a tampered bundle and legacy archives", async () => {
  const directory = workspace();
  try {
    const result = await compileProject({
      projectDir: path.join(examples, "hello-world"),
      outfile: path.join(directory, "hello.japp"),
      typecheck: false,
    });
    const entries = readZip(result.bytes).map((entry) => ({
      name: entry.name,
      data: entry.bytes,
    }));
    const tampered = entries.map((entry) =>
      entry.name === "app.js"
        ? { ...entry, data: Buffer.concat([entry.data, Buffer.from("x")]) }
        : entry,
    );
    assert.throws(
      () => validateQapp(writeZip(tampered)),
      /APP_CHECKSUM_MISMATCH|METADATA_MISMATCH/,
    );
    const legacy = writeZip([
      { name: "manifest.json", data: Buffer.from(JSON.stringify({ schemaVersion: 1 })) },
      { name: "index.html", data: Buffer.from("<h1>legacy</h1>") },
    ]);
    assert.throws(
      () => validateQapp(legacy),
      (error: unknown) =>
        error instanceof ManifestError && error.code.startsWith("MANIFEST_"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

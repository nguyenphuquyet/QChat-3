/**
 * Generate the committed `.qxpkg` fixtures the Flutter verifier tests read.
 *
 * The fixture key is a fixed RFC 8032 seed, so the archives are reproducible:
 * running this script twice must not change a byte, and a diff means the
 * package format or the compiler changed. The key is a test key only; it is
 * absent from `miniAppTrustedPackageKeys`, which stays empty until the signing
 * service issues the production key (ADR 016).
 *
 *   pnpm --filter @qchat/miniapp-compiler fixture:miniapp
 */

import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAppPackage, type PackageFileInput } from "../src/index.js";

/** RFC 8032 §7.1 test-vector seed: a 32-byte Ed25519 private key. */
const SEED = Buffer.from(
  "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
  "hex",
);

const KEY_ID = "fixture-test-key";

/**
 * PKCS#8 wraps a raw Ed25519 seed in a 16-byte prefix; Node only imports the
 * DER form, so the seed is dressed here instead of relying on a PEM file.
 */
function ed25519PrivateKey(seed: Buffer) {
  const der = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

const SOURCES: Record<string, string> = {
  "app.json": JSON.stringify({
    pages: ["pages/index/index"],
    qxColorScheme: "light",
    window: { navigationBarTitleText: "Fixture" },
  }),
  "app.js": "App({});",
  "app.wxss": ".page{color:#1f2937}",
  "pages/index/index.wxml": '<view class="page">{{title}}</view>',
  "pages/index/index.wxss": ".page{padding:16rpx}",
  "pages/index/index.js": "Page({data:{title:'Fixture'}});",
  "pages/index/index.json": '{"navigationBarTitleText":"Fixture"}',
};

/**
 * `fixture-1.0.0-alt` is a second valid package for the same version with
 * different content: the installer must refuse it instead of overwriting the
 * version that is already installed.
 */
const FIXTURES = [
  { file: "fixture-1.0.0", version: "1.0.0", sources: SOURCES },
  { file: "fixture-1.1.0", version: "1.1.0", sources: SOURCES },
  { file: "fixture-1.2.0", version: "1.2.0", sources: SOURCES },
  {
    file: "fixture-1.0.0-alt",
    version: "1.0.0",
    sources: {
      ...SOURCES,
      "app.js": "App({alternative: true});",
    },
  },
] as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const outDir = join(repoRoot, "apps", "mobile", "test", "fixtures", "miniapp");

const privateKey = ed25519PrivateKey(SEED);
const publicKeyBase64 = Buffer.from(
  createPublicKey(privateKey).export({ format: "jwk" }).x,
  "base64url",
).toString("base64");

mkdirSync(outDir, { recursive: true });

for (const { file, version, sources } of FIXTURES) {
  const result = createAppPackage(
    (path) => (Object.hasOwn(sources, path) ? sources[path] : null),
    {
      appId: "qchat.fixture",
      version,
      name: "Fixture",
      minRuntimeVersion: "0.1.0",
      keyId: KEY_ID,
      privateKey,
    },
  );
  if (!result.ok || !result.created) {
    throw new Error(`fixture ${file}: ${result.error?.message ?? "no package"}`);
  }
  const target = join(outDir, `${file}.qxpkg`);
  writeFileSync(target, result.created.bytes);
  console.log(
    `${target} ${result.created.bytes.length} bytes sha256=${createHash("sha256")
      .update(result.created.bytes)
      .digest("hex")}`,
  );
}

const keyFile = join(outDir, "fixture-key.json");
writeFileSync(
  keyFile,
  `${JSON.stringify(
    {
      keyId: KEY_ID,
      publicKeyBase64,
      seedHex: SEED.toString("hex"),
      note: "Test key only. It is not in miniAppTrustedPackageKeys; the tests pass it explicitly.",
    },
    null,
    2,
  )}\n`,
);
console.log(`${keyFile} keyId=${KEY_ID} publicKey=${publicKeyBase64}`);

// End-to-end smoke test for the Mini App backend. It talks to a running QChat
// server and uses the same database as that server, so run it only against a
// disposable environment:
//
//   $env:BASE_URL="http://127.0.0.1:3000"; node scripts/miniapps-smoke.mjs
//
// It creates a throwaway developer account, walks the whole upload → review →
// release → download → revoke flow and deletes its data afterwards.
import { createHash, randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const suffix = randomBytes(5).toString("hex");
const qchatId = `mpdev${suffix}`;
const email = `${qchatId}@example.test`;
const password = "miniapp-smoke-password";

function assert(value, message) {
  if (!value) throw new Error(`ASSERT: ${message}`);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data);
    const method = entry.method ?? 0;
    const body = method === 8 ? deflateRawSync(data) : data;
    const name = Buffer.from(entry.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
function build(version, files) {
  const appJs = Buffer.from(
    `globalThis.__qchatSmoke = ${JSON.stringify({ version })};`,
  );
  const manifest = {
    schemaVersion: 2,
    format: "qapp",
    name: "Smoke App",
    description: "Built by the smoke test",
    version,
    entry: "app.js",
    sdkVersion: "1.0.0",
    minRuntimeVersion: "1.0.0",
    requestedPermissions: ["toast", "storage"],
    appSha256: sha256(appJs),
  };
  const entries = [
    { name: "manifest.json", data: JSON.stringify(manifest) },
    { name: "app.js", data: appJs },
    {
      name: "permissions.json",
      data: JSON.stringify({
        requestedPermissions: manifest.requestedPermissions,
      }),
    },
    ...(files ?? []),
  ];
  const metadata = {
    formatVersion: 1,
    compilerVersion: "1.0.0",
    sdkVersion: manifest.sdkVersion,
    version: manifest.version,
    entry: "app.js",
    builtAt: new Date().toISOString(),
    appSha256: manifest.appSha256,
    files: entries.map((entry) => ({
      path: entry.name,
      sha256: sha256(Buffer.from(entry.data)),
      size: Buffer.byteLength(entry.data),
    })),
  };
  return zip([
    ...entries,
    { name: "metadata.json", data: JSON.stringify(metadata) },
  ]);
}

async function request(path, { token, key, method = "GET", body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers["X-QChat-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

let userId;
let appId;
try {
  const registered = await request("/auth/register", {
    method: "POST",
    body: { qchatId, email, password, nickname: "Smoke Dev", deviceName: "Smoke" },
  });
  assert(registered.status === 200, `register ${registered.status} ${JSON.stringify(registered.data)}`);
  const token = registered.data.accessToken;
  userId = registered.data.userId;
  assert(token && userId, "tokens");

  const created = await request("/miniapps/developer/apps", {
    token,
    method: "POST",
    body: {
      name: "Smoke App",
      description: "Created by the smoke test",
      category: "utilities",
      developerName: "Smoke Dev",
      contactEmail: email,
    },
  });
  assert(created.status === 200, `create ${created.status} ${JSON.stringify(created.data)}`);
  appId = created.data.appId;
  assert(/^mp_[a-z0-9]{16}$/.test(appId), "app id format");

  const form = new FormData();
  form.set("version", "1.0.0");
  form.set("channel", "DEVELOPMENT");
  form.set("file", new Blob([build("1.0.0")], { type: "application/octet-stream" }), "build.japp");
  const uploaded = await request(`/miniapps/developer/apps/${appId}/builds`, {
    token,
    method: "POST",
    form,
  });
  assert(uploaded.status === 201, `upload ${uploaded.status} ${JSON.stringify(uploaded.data)}`);
  assert(uploaded.data.build.status === "UPLOADED", "uploaded state");
  assert(uploaded.data.build.sha256.length === 64, "sha256");
  assert(uploaded.data.build.format === "qapp", "native format");
  assert(uploaded.data.build.sdkVersion === "1.0.0", "sdk version");
  assert(uploaded.data.build.entry === "app.js", "entry");

  const badForm = new FormData();
  badForm.set("version", "9.9.9");
  badForm.set(
    "file",
    new Blob([build("9.9.9", [{ name: "../evil.js", data: "x" }])], {
      type: "application/octet-stream",
    }),
    "bad.japp",
  );
  const bad = await request(`/miniapps/developer/apps/${appId}/builds`, {
    token,
    method: "POST",
    form: badForm,
  });
  assert(bad.status === 400 && bad.data.error === "ZIP_INVALID_NAME", `bad zip ${bad.status} ${JSON.stringify(bad.data)}`);

  const submitted = await request(
    `/miniapps/developer/apps/${appId}/versions/${uploaded.data.build.id}/submit`,
    { token, method: "POST" },
  );
  assert(submitted.status === 200 && submitted.data.status === "REVIEWING", `submit ${JSON.stringify(submitted.data)}`);

  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });

  const queue = await request("/miniapps/review/queue", { token });
  assert(queue.status === 200, "queue");
  assert(queue.data.versions.some((row) => row.id === uploaded.data.build.id), "queued build");

  const decision = await request(
    `/miniapps/review/versions/${uploaded.data.build.id}/decision`,
    { token, method: "POST", body: { approve: true, reason: "" } },
  );
  assert(decision.status === 200 && decision.data.status === "APPROVED", `approve ${JSON.stringify(decision.data)}`);

  const released = await request(
    `/miniapps/developer/apps/${appId}/versions/${uploaded.data.build.id}/release`,
    { token, method: "POST" },
  );
  assert(released.status === 200 && released.data.status === "PUBLISHED", "release");

  const store = await request("/miniapps/store", { token });
  assert(store.status === 200 && store.data.items.some((item) => item.appId === appId), "store list");

  const detail = await request(`/miniapps/store/${appId}`, { token });
  assert(detail.status === 200 && detail.data.currentVersion === "1.0.0", "store detail");
  assert(detail.data.runtimeVersion === "1.0.0", "runtime version");

  const manifest = await request(`/miniapps/store/${appId}/manifest`, { token });
  assert(manifest.status === 200, "manifest");
  assert(manifest.data.format === "qapp", "manifest format");
  assert(manifest.data.sdkVersion === "1.0.0", "manifest sdk");
  assert(manifest.data.manifest.appSha256.length === 64, "manifest app checksum");

  const location = await request(`/miniapps/store/${appId}/build`, { token });
  // The filesystem adapter returns an HMAC URL served by the API, while the S3
  // adapter returns a presigned URL on the object store.
  assert(
    location.status === 200 &&
      (location.data.url.includes("/api/miniapps/blob") ||
        /^https?:\/\//.test(location.data.url)),
    "signed build url",
  );
  const download = await fetch(location.data.url);
  assert(download.status === 200, `download ${download.status}`);
  const downloaded = Buffer.from(await download.arrayBuffer());
  const sha = createHash("sha256").update(downloaded).digest("hex");
  assert(sha === uploaded.data.build.sha256, "downloaded checksum");

  await request("/miniapps/recent", { token, method: "POST", body: { appId } });
  const recent = await request("/miniapps/recent", { token });
  assert(recent.status === 200 && recent.data[0].appId === appId, "recent");
  await request("/miniapps/favorites", { token, method: "POST", body: { appId } });
  const favorites = await request("/miniapps/favorites", { token });
  assert(favorites.status === 200 && favorites.data[0].appId === appId, "favorites");
  await request(`/miniapps/favorites/${appId}`, { token, method: "DELETE" });
  const afterFavorite = await request("/miniapps/favorites", { token });
  assert(!afterFavorite.data.some((item) => item.appId === appId), "favorite removed");

  const telemetry = await request("/miniapps/telemetry", {
    token,
    method: "POST",
    body: { appId, version: "1.0.0", event: "open", durationMs: 12 },
  });
  assert(telemetry.status === 200, "telemetry");

  const analytics = await request(`/miniapps/developer/apps/${appId}/analytics`, { token });
  assert(analytics.status === 200 && analytics.data.events.some((event) => event.event === "open"), "analytics");

  const key = await request(`/miniapps/developer/apps/${appId}/keys`, {
    token,
    method: "POST",
    body: { name: "CI" },
  });
  assert(key.status === 200 && key.data.secret.startsWith("qk_"), "api key");
  const keyForm = new FormData();
  keyForm.set("version", "1.0.1");
  keyForm.set("channel", "PRODUCTION");
  keyForm.set("file", new Blob([build("1.0.1")], { type: "application/octet-stream" }), "build.japp");
  const keyUpload = await request(`/miniapps/developer/apps/${appId}/builds`, {
    key: key.data.secret,
    method: "POST",
    form: keyForm,
  });
  assert(keyUpload.status === 201, `key upload ${keyUpload.status} ${JSON.stringify(keyUpload.data)}`);

  await request(`/miniapps/developer/apps/${appId}/versions/${keyUpload.data.build.id}/submit`, {
    token,
    method: "POST",
  });
  await request(`/miniapps/review/versions/${keyUpload.data.build.id}/decision`, {
    token,
    method: "POST",
    body: { approve: true, reason: "" },
  });
  const released2 = await request(
    `/miniapps/developer/apps/${appId}/versions/${keyUpload.data.build.id}/release`,
    { token, method: "POST" },
  );
  assert(released2.status === 200, "release 1.0.1");

  const rollback = await request(`/miniapps/developer/apps/${appId}/rollback`, {
    token,
    method: "POST",
    body: { version: "1.0.0" },
  });
  assert(rollback.status === 200 && rollback.data.currentVersion === "1.0.0", "rollback");
  const forward = await request(`/miniapps/developer/apps/${appId}/rollback`, {
    token,
    method: "POST",
    body: { version: "1.0.1" },
  });
  assert(forward.status === 200 && forward.data.currentVersion === "1.0.1", "rollback forward");

  const revokeOld = await request(`/miniapps/developer/apps/${appId}/revoke`, {
    token,
    method: "POST",
    body: { version: "1.0.0", reason: "Smoke test revoke" },
  });
  assert(revokeOld.status === 200 && revokeOld.data.suspended === false, "revoke old build");
  const revokedBuild = await request(`/miniapps/store/${appId}/build?version=1.0.0`, { token });
  assert(revokedBuild.status === 410 && revokedBuild.data.error === "VERSION_REVOKED", "revoked build hidden");

  const suspended = await request(`/miniapps/review/apps/${appId}/suspend`, {
    token,
    method: "POST",
    body: { reason: "Smoke suspend" },
  });
  assert(suspended.status === 200, "suspend");
  const hidden = await request(`/miniapps/store/${appId}`, { token });
  assert(hidden.status === 410 && hidden.data.error === "APP_SUSPENDED", `suspended ${hidden.status}`);
  const restored = await request(`/miniapps/review/apps/${appId}/restore`, {
    token,
    method: "POST",
  });
  assert(restored.status === 200, "restore");
  const visible = await request(`/miniapps/store/${appId}`, { token });
  assert(visible.status === 200, "visible after restore");

  const revokeCurrent = await request(`/miniapps/developer/apps/${appId}/revoke`, {
    token,
    method: "POST",
    body: { reason: "Smoke test revoke current" },
  });
  assert(revokeCurrent.status === 200 && revokeCurrent.data.suspended === true, "revoke current");

  const suspendedCurrent = await request(`/miniapps/store/${appId}`, { token });
  assert(suspendedCurrent.status === 410, "suspended after revoking current");
  const restoreBlocked = await request(`/miniapps/review/apps/${appId}/restore`, {
    token,
    method: "POST",
  });
  assert(restoreBlocked.status === 409, `restore without published build ${restoreBlocked.status}`);

  const republished = await request(
    `/miniapps/developer/apps/${appId}/versions/${keyUpload.data.build.id}/release`,
    { token, method: "POST" },
  );
  assert(republished.status === 200 && republished.data.status === "PUBLISHED", "re-release revoked build");
  const visibleAgain = await request(`/miniapps/store/${appId}`, { token });
  assert(
    visibleAgain.status === 200 && visibleAgain.data.currentVersion === "1.0.1",
    "visible after re-release",
  );

  const unauthorized = await request("/miniapps/store");
  assert(unauthorized.status === 401, `unauthorized ${unauthorized.status}`);

  console.log(`OK ${appId} — upload, review, release, download, keys, revoke all passed`);
} finally {
  if (userId) {
    await prisma.miniApp.deleteMany({ where: { developerId: userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
  await prisma.$disconnect();
}

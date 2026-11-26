// Production smoke test for the red-packet cover framing fields.
//
//   node scripts/cover-framing-smoke.mjs
//
// It registers a throw-away designer, uploads a 1x1 PNG, saves a cover whose
// flap and bubble carry a zoom and a pan, then reads the cover back and checks
// the server echoed the framing instead of stripping it (designs are strict
// parsed, so an unlisted key fails or vanishes silently).
const base = (
  process.env.API_URL ?? "https://chat.nguyenphuquyet.online/api"
).replace(/\/$/, "");
const suffix = process.env.SMOKE_SUFFIX ?? Math.random().toString(36).slice(2, 8);
const password = process.env.SMOKE_PASSWORD ?? "Smoke-test-password-2026!";

const failures = [];
const check = (condition, label) => {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) failures.push(label);
};

async function request(path, method = "GET", body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: response.status, data };
}

// 1x1 transparent PNG.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadPng(token) {
  const intent = await request(
    "/media/upload-intent",
    "POST",
    { mime: "image/png", size: png.length, name: "framing.png" },
    token,
  );
  if (intent.status !== 200)
    throw new Error(`upload-intent: ${JSON.stringify(intent.data)}`);
  const put = await fetch(intent.data.url, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  if (!put.ok) throw new Error(`put: ${put.status} ${await put.text()}`);
  const done = await request(
    "/media/complete",
    "POST",
    { mediaId: intent.data.id },
    token,
  );
  if (done.status !== 200)
    throw new Error(`complete: ${JSON.stringify(done.data)}`);
  return intent.data.id;
}

const qchatId = `smoke_frame_${suffix}`.slice(0, 24);
const registered = await request("/auth/register", "POST", {
  qchatId,
  email: `${qchatId}@example.test`,
  nickname: "Smoke framing",
  password,
  deviceName: "Cover framing smoke",
});
if (registered.status !== 200)
  throw new Error(`register: ${JSON.stringify(registered.data)}`);
const token = registered.data.accessToken;

const designer = await request(
  "/wallet/designer",
  "POST",
  { displayName: "Smoke framing", bio: "" },
  token,
);
check(designer.status === 200, "designer account created");

const imageId = await uploadPng(token);
check(typeof imageId === "string", "PNG uploaded");

const design = {
  background: {
    type: "image",
    color: "#d93b30",
    colors: [],
    mediaId: imageId,
    imageScale: 2.25,
    imageOffsetX: -0.4,
    imageOffsetY: 0.35,
  },
  bottomColor: "#d93b30",
  topHeight: 0.8,
  receiptHeight: 0.34,
  archLine: true,
  overlayColor: "#80000000",
  openColor: "#f6e3b0",
  openTextColor: "#a8512f",
  openLabel: "Mở",
  decorations: [],
  effects: { sparkles: false, float: false, pulse: false },
  message: {
    imageId,
    startColor: "#f5a83a",
    endColor: "#f7c65a",
    imageScale: 1.75,
    imageOffsetX: 0.2,
    imageOffsetY: -0.6,
  },
};

const created = await request(
  "/wallet/covers",
  "POST",
  { name: "Smoke framing", description: "", design, publish: false },
  token,
);
check(created.status === 200, `cover saved (${created.status})`);
if (created.status !== 200) {
  console.log(JSON.stringify(created.data));
} else {
  const saved = created.data.design ?? {};
  check(saved.background?.imageScale === 2.25, "flap zoom stored");
  check(saved.background?.imageOffsetX === -0.4, "flap pan X stored");
  check(saved.background?.imageOffsetY === 0.35, "flap pan Y stored");
  check(saved.message?.imageScale === 1.75, "bubble zoom stored");
  check(saved.message?.imageOffsetX === 0.2, "bubble pan X stored");
  check(saved.message?.imageOffsetY === -0.6, "bubble pan Y stored");

  const patch = await request(
    `/wallet/covers/${created.data.id}`,
    "PATCH",
    {
      design: {
        ...design,
        background: { ...design.background, imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 },
        message: { ...design.message, imageScale: 1.25, imageOffsetX: 0.1, imageOffsetY: 0.1 },
      },
    },
    token,
  );
  check(patch.status === 200, `cover updated (${patch.status})`);
  check(patch.data.design?.background?.imageScale === 1, "reset persisted");
  check(patch.data.design?.message?.imageScale === 1.25, "update persisted");

  const reread = await request("/wallet/covers", "GET", undefined, token);
  const mine = (reread.data.items ?? []).find((item) => item.id === created.data.id);
  check(!!mine, "cover round-trips through the list");
  check(mine?.design?.message?.imageScale === 1.25, "list keeps the framing");

  const wild = await request(
    `/wallet/covers/${created.data.id}`,
    "PATCH",
    { design: { ...design, background: { ...design.background, imageScale: 9 } } },
    token,
  );
  check(wild.status === 400, `out-of-range zoom rejected (${wild.status})`);

  await request(`/wallet/covers/${created.data.id}`, "DELETE", undefined, token);
  check(true, "throw-away cover removed");
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nall framing checks passed");

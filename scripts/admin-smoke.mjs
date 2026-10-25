// Production smoke test for the admin console API.
//
//   ADMIN_QCHAT=<admin qchatId> ADMIN_PASSWORD=<password> \
//     node scripts/admin-smoke.mjs
//
// It creates throw-away accounts (`smoke_*`), exercises scoped permissions,
// report lookup, Mini App moderation endpoints and permanent account deletion,
// then removes the accounts it created. The admin account used to run it is
// left untouched; see docs/ADMIN.md for cleanup.
const base = (
  process.env.API_URL ?? "https://chat.nguyenphuquyet.online/api"
).replace(/\/$/, "");
const suffix =
  process.env.SMOKE_SUFFIX ?? Math.random().toString(36).slice(2, 8);
const password = process.env.SMOKE_PASSWORD ?? "Smoke-test-password-2026!";
const adminQchat = process.env.ADMIN_QCHAT;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminQchat || !adminPassword)
  throw new Error("ADMIN_QCHAT and ADMIN_PASSWORD are required");

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

async function login(identifier, secret = password) {
  const result = await request("/auth/login", "POST", {
    identifier,
    password: secret,
    deviceName: "Admin smoke test",
  });
  return { ...result, token: result.data.accessToken };
}

async function register(name) {
  const qchatId = `smoke_${name}_${suffix}`.slice(0, 24);
  const result = await request("/auth/register", "POST", {
    qchatId,
    email: `${qchatId}@example.test`,
    nickname: `Smoke ${name}`,
    password,
    deviceName: "Admin smoke test",
  });
  if (result.status !== 200)
    throw new Error(`register ${name}: ${JSON.stringify(result.data)}`);
  return { ...result.data, qchatId, email: `${qchatId}@example.test` };
}

const admin = await login(adminQchat, adminPassword);
if (!admin.token) throw new Error(`admin login failed: ${admin.data.error}`);

const manager = await register("manager");
const member = await register("member");
const removed = await register("removed");
const created = [manager, member, removed];

try {
  const stats = await request("/admin/stats", "GET", undefined, admin.token);
  check(stats.status === 200 && stats.data.me?.role === "ADMIN", "admin stats + identity");
  check(
    Array.isArray(stats.data.me?.permissions) &&
      stats.data.me.permissions.length === 8,
    "full admin receives every section",
  );

  const scoped = await request(
    `/admin/users/${manager.userId}`,
    "PATCH",
    { adminPermissions: ["reports"] },
    admin.token,
  );
  check(scoped.status === 200, "grant scoped management section");

  const managerLogin = await login(manager.qchatId);
  const managerStats = await request(
    "/admin/stats",
    "GET",
    undefined,
    managerLogin.token,
  );
  check(
    managerStats.status === 200 &&
      JSON.stringify(managerStats.data.me?.permissions) === JSON.stringify(["reports"]),
    "manager sees only granted section in /admin/stats",
  );
  check(
    (await request("/admin/reports", "GET", undefined, managerLogin.token)).status === 200,
    "manager can read granted section",
  );
  check(
    (await request("/admin/users", "GET", undefined, managerLogin.token)).status === 403,
    "manager cannot read users section",
  );
  check(
    (await request("/admin/audit", "GET", undefined, managerLogin.token)).status === 403,
    "manager cannot read audit section",
  );
  check(
    (await request("/admin/payments", "GET", undefined, managerLogin.token)).status === 403,
    "manager cannot read payments section",
  );
  const escalation = await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { role: "ADMIN" },
    managerLogin.token,
  );
  check(
    escalation.status === 403 && escalation.data.error === "FORBIDDEN",
    "report-only manager cannot reach the users section",
  );
  check(
    (await request(`/admin/users/${member.userId}`, "DELETE", undefined, managerLogin.token))
      .status === 403,
    "manager cannot delete accounts",
  );

  // A conversation requires a friendship between the creator and each peer.
  for (const account of [manager, member, removed]) {
    const invitation = await request(
      "/friends/requests",
      "POST",
      { recipientId: account.userId },
      admin.token,
    );
    const accepted = await request(
      `/friends/requests/${invitation.data.id}`,
      "PATCH",
      { accept: true },
      account.accessToken,
    );
    if (invitation.status !== 200 || accepted.status !== 200)
      console.error(
        "friendship error",
        invitation.status,
        invitation.data.error,
        accepted.status,
        accepted.data.error,
      );
  }

  const group = await request(
    "/conversations",
    "POST",
    {
      kind: "GROUP",
      title: `Smoke report ${suffix}`,
      memberIds: [manager.userId, member.userId, removed.userId],
    },
    admin.token,
  );
  check(group.status === 200 && group.data.id, "create conversation for report");
  if (group.status !== 200) console.error("conversation error", group);
  const conversationId = group.data.id;

  const sent = await request(
    `/conversations/${conversationId}/messages`,
    "POST",
    {
      clientId: crypto.randomUUID(),
      kind: "TEXT",
      text: `Smoke message ${suffix}`,
    },
    removed.accessToken,
  );
  check(sent.status === 200, "reported account sends a message");

  const report = await request(
    "/reports",
    "POST",
    { targetId: conversationId, reason: `Smoke report ${suffix}` },
    admin.token,
  );
  check(report.status === 200, "report a conversation as a member");
  check(
    (
      await request(
        "/reports",
        "POST",
        { targetId: crypto.randomUUID(), reason: "Not my conversation" },
        admin.token,
      )
    ).status === 404,
    "reporting a foreign conversation is rejected",
  );

  const reports = await request("/admin/reports", "GET", undefined, admin.token);
  const row = reports.data.find?.((item) => item.targetId === conversationId);
  check(
    reports.status === 200 &&
      row?.conversation?.id === conversationId &&
      row?.conversation?.members?.length === 4 &&
      row?.conversation?._count?.members === 4 &&
      row?.reporter?.qchatId === adminQchat,
    "admin resolves the reported chat, members and reporter",
  );

  const apps = await request("/admin/miniapps", "GET", undefined, admin.token);
  const queue = await request("/admin/miniapps/review", "GET", undefined, admin.token);
  check(
    apps.status === 200 && Array.isArray(apps.data.items),
    "Mini App list is readable",
  );
  check(
    queue.status === 200 &&
      Array.isArray(queue.data.versions) &&
      Array.isArray(queue.data.permissions),
    "Mini App review queue is readable",
  );

  const payments = await request("/admin/payments", "GET", undefined, admin.token);
  check(
    payments.status === 200 && typeof payments.data.summary?.totalBalance === "number",
    "payment summary is readable",
  );
  const transactionList = await request(
    "/admin/payments/transactions",
    "GET",
    undefined,
    admin.token,
  );
  check(
    transactionList.status === 200 && Array.isArray(transactionList.data.items),
    "payment transaction list is readable",
  );
  const adjust = await request(
    `/admin/payments/wallets/${manager.userId}/adjust`,
    "POST",
    { amount: 1000, note: "Smoke test wallet credit" },
    admin.token,
  );
  check(
    adjust.status === 200 && adjust.data.balance >= 1000,
    "admin can credit a wallet",
  );

  const disabled = await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { disabled: true },
    admin.token,
  );
  const blockedLogin = await login(member.qchatId);
  check(
    disabled.status === 200 && blockedLogin.status === 401,
    "locked account cannot sign in",
  );
  const unlocked = await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { disabled: false },
    admin.token,
  );

  const grantedUsers = await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { adminPermissions: ["users"] },
    admin.token,
  );
  const memberLogin = await login(member.qchatId);
  if (memberLogin.status !== 200)
    console.error(
      "member login failed",
      unlocked.status,
      grantedUsers.status,
      grantedUsers.data.error,
      memberLogin.status,
      memberLogin.data.error,
    );
  const memberStats = await request("/admin/stats", "GET", undefined, memberLogin.token);
  check(
    memberStats.status === 200 &&
      JSON.stringify(memberStats.data.me?.permissions) === JSON.stringify(["users"]),
    "users-section manager can open the console",
  );
  check(
    (await request("/admin/users", "GET", undefined, memberLogin.token)).status === 200,
    "users-section manager can list accounts",
  );
  const selfLock = await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { disabled: true },
    memberLogin.token,
  );
  check(
    selfLock.status === 400 && selfLock.data.error === "SELF_LOCK",
    "manager cannot lock their own account",
  );
  check(
    (
      await request(
        `/admin/users/${manager.userId}`,
        "PATCH",
        { role: "ADMIN" },
        memberLogin.token,
      )
    ).data.error === "ADMIN_REQUIRED",
    "section manager cannot promote accounts",
  );
  await request(
    `/admin/users/${member.userId}`,
    "PATCH",
    { adminPermissions: [] },
    admin.token,
  );
  check(
    (await request("/admin/stats", "GET", undefined, memberLogin.token)).status === 403,
    "revoked section closes the console immediately",
  );

  const removedAccount = await request(
    `/admin/users/${removed.userId}`,
    "DELETE",
    undefined,
    admin.token,
  );
  const afterDelete = await request(
    `/admin/users/${removed.userId}`,
    "GET",
    undefined,
    admin.token,
  );
  const messages = await request(
    `/conversations/${conversationId}/messages`,
    "GET",
    undefined,
    admin.token,
  );
  check(
    removedAccount.status === 200 &&
      afterDelete.status === 404 &&
      Array.isArray(messages.data) &&
      !messages.data.some((message) => message.senderId === removed.userId),
    "deleted account and its messages are gone",
  );
  check(
    (await request(`/admin/users/${admin.userId}`, "DELETE", undefined, admin.token))
      .status === 400,
    "admin cannot delete their own account",
  );
} finally {
  for (const account of created) {
    await request(`/admin/users/${account.userId}`, "DELETE", undefined, admin.token);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nAll admin smoke checks passed");
}

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ServiceAccount } from "firebase-admin/app";
import type { Messaging } from "firebase-admin/messaging";
import { db } from "./db";

/**
 * Firebase Cloud Messaging for new chat messages.
 *
 * The key is read from `FIREBASE_SERVICE_ACCOUNT` (the JSON document itself),
 * then from `FIREBASE_SERVICE_ACCOUNT_FILE` (a path to it), and finally from
 * `apps/server/secrets/firebase-service-account.json` on the host (that folder is
 * git-ignored; GitHub rejects Google Cloud credentials in a push). Without any
 * key this module is a no-op: the server, the realtime worker and the app all
 * keep working as before, and adding a key switches push on.
 */
let client: Messaging | null | undefined;

/** The parsed service account, or null when no key is available at all. */
async function serviceAccount(): Promise<ServiceAccount | null> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (inline) return JSON.parse(inline);
  const explicit = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (explicit) return JSON.parse(await readFile(explicit, "utf8"));
  // pnpm runs a script from its package directory, so both Next and the
  // realtime worker sit two levels below the checkout; a test run from the
  // repository root sits one level above. `import.meta.url` is not used here
  // because Next's bundler rewrites it.
  const candidates = [
    resolve(
      process.cwd(),
      "../../apps/server/secrets/firebase-service-account.json",
    ),
    resolve(process.cwd(), "apps/server/secrets/firebase-service-account.json"),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, "utf8"));
    } catch (error) {
      // No key in this checkout: push is simply off, not an error.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function messaging(): Promise<Messaging | null> {
  if (client !== undefined) return client;
  try {
    const account = await serviceAccount();
    if (!account) return (client = null);
    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    // A named app of our own: messaging derives the project id from AppOptions,
    // so reusing an unrelated default app would leave it unresolved.
    const name = "qchat-push";
    const app =
      getApps().find((existing) => existing.name === name) ??
      initializeApp(
        { credential: cert(account), projectId: account.projectId },
        name,
      );
    client = getMessaging(app);
  } catch (error) {
    // A malformed key must not take down message delivery.
    console.error("FCM is disabled: service account could not be loaded", {
      message: error instanceof Error ? error.message : undefined,
    });
    client = null;
  }
  return client;
}

const dead = new Set([
  "messaging/installation-id-not-registered",
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

const labels: Record<string, string> = {
  IMAGE: "[Ảnh]",
  VIDEO: "[Video]",
  AUDIO: "[Tin nhắn thoại]",
  FILE: "[Tệp tin]",
  GIF: "[Ảnh động]",
  STICKER: "[Nhãn dán]",
  CONTACT: "[Danh thiếp]",
  LOCATION: "[Vị trí]",
  TRANSFER: "[Chuyển khoản]",
  RED_PACKET: "[Lì xì]",
};

/** One line shown under the sender's name. */
function preview(message: Record<string, unknown>) {
  const kind = String(message.kind ?? "TEXT");
  const text = typeof message.text === "string" ? message.text.trim() : "";
  const label = labels[kind];
  if (label) return label;
  if (kind === "TEXT" && text)
    return text.length > 180 ? `${text.slice(0, 179)}…` : text;
  return "Tin nhắn mới";
}

/**
 * Pushes one `message:new` event to one recipient.
 *
 * The realtime worker calls this after emitting the socket event, so a client
 * that already received the message still gets a notification unless it is
 * in the foreground (the app suppresses its own banner there). Muted
 * conversations and the sender are skipped, and `previewPush` decides whether
 * the text may appear on the lock screen.
 *
 * Called fire-and-forget; failures are logged, never thrown at the outbox loop.
 */
export async function sendMessagePush(
  userId: string,
  message: Record<string, unknown>,
) {
  if (userId === message.senderId) return;
  const conversationId = String(message.conversationId ?? "");
  if (!conversationId) return;
  const fcm = await messaging();
  if (!fcm) return;
  const member = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: {
      muted: true,
      user: { select: { previewPush: true } },
      conversation: { select: { kind: true, title: true } },
    },
  });
  if (!member || member.muted) return;
  const devices = await db.pushDevice.findMany({
    where: { userId },
    select: { token: true },
  });
  if (!devices.length) return;
  const sender = await db.user.findUnique({
    where: { id: String(message.senderId) },
    select: { nickname: true },
  });
  const name = sender?.nickname ?? "QChat";
  const group = member.conversation.kind !== "DIRECT";
  const title = group ? member.conversation.title || name : name;
  const text = preview(message);
  const body = member.user.previewPush
    ? group
      ? `${name}: ${text}`
      : text
    : "Bạn có tin nhắn mới";
  const result = await fcm.sendEachForMulticast({
    // `PushDevice.token` stores the Firebase Installation ID that
    // firebase_messaging's register() reports; admin v14 sends to FIDs.
    fids: devices.map((device) => device.token),
    notification: { title, body },
    data: {
      conversationId,
      messageId: String(message.id ?? ""),
      kind: String(message.kind ?? "TEXT"),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "qchat_messages",
        color: "#07C160",
        sound: "default",
      },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", "thread-id": conversationId } },
    },
  });
  const expired = devices
    .filter((_, index) => {
      const response = result.responses[index];
      return !response.success && dead.has(response.error?.code ?? "");
    })
    .map((device) => device.token);
  if (expired.length)
    await db.pushDevice.deleteMany({ where: { token: { in: expired } } });
}

/** Whether a service account is configured and usable. */
export async function pushReady() {
  return (await messaging()) !== null;
}

/**
 * Sends one test notification to a single installation id from the admin
 * console. Returns a code instead of throwing so the console can explain why
 * nothing arrived: unconfigured FCM, a dead installation id, or a transport
 * failure.
 */
export async function sendTestPush(fid: string): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "PUSH_NOT_CONFIGURED" | "PUSH_DEVICE_GONE" | "PUSH_FAILED";
      detail?: string;
    }
> {
  const fcm = await messaging();
  if (!fcm) return { ok: false, code: "PUSH_NOT_CONFIGURED" };
  try {
    await fcm.send({
      fid,
      notification: {
        title: "QChat",
        body: "Thông báo thử từ quản trị viên",
      },
      data: { kind: "TEST" },
      android: {
        priority: "high",
        notification: {
          channelId: "qchat_messages",
          color: "#07C160",
          sound: "default",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default" } },
      },
    });
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    if (dead.has(code))
      return { ok: false, code: "PUSH_DEVICE_GONE", detail: code };
    return {
      ok: false,
      code: "PUSH_FAILED",
      detail: code || (error instanceof Error ? error.message : undefined),
    };
  }
}

import { readFile } from "node:fs/promises";
import type { Messaging } from "firebase-admin/messaging";
import { db } from "./db";

/**
 * Firebase Cloud Messaging for new chat messages.
 *
 * The service account is not in the repository. Set either
 * `FIREBASE_SERVICE_ACCOUNT` (the JSON document itself) or
 * `FIREBASE_SERVICE_ACCOUNT_FILE` (a path to it), both from the Firebase
 * console → Project settings → Service accounts. Without one of them this
 * module is a no-op: the server, the realtime worker and the app all keep
 * working as before, and adding the variable switches push on.
 */
let client: Messaging | null | undefined;

async function messaging(): Promise<Messaging | null> {
  if (client !== undefined) return client;
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!inline && !file) return (client = null);
  try {
    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    const account = JSON.parse(inline || (await readFile(file!, "utf8")));
    const app = getApps()[0] ?? initializeApp({ credential: cert(account) });
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

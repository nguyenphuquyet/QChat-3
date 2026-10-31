import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { db } from "../services/db";
import { requireCondition } from "../security/errors";
import { visibleMoment } from "./moments";
import { uuid } from "../../../../packages/contracts";
const storage = () =>
  new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });
const Bucket = () => process.env.S3_BUCKET ?? "qchat-private";
const types = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mp4",
  "audio/mpeg",
  "application/pdf",
] as const;
/// Best-effort removal of stored objects after their rows are gone. A failed
/// delete only leaves an unreferenced object behind, so it must not fail the
/// account operation that triggered it.
export async function deleteMediaObjects(keys: string[]) {
  if (!keys.length || !process.env.S3_ENDPOINT) return;
  await Promise.allSettled(
    keys.map((key) =>
      storage().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key })),
    ),
  );
}
export function validSignature(mime: string, bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  switch (mime) {
    case "image/jpeg":
      return b[0] === 255 && b[1] === 216 && b[2] === 255;
    case "image/png":
      return b
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/gif":
      return /^GIF8[79]a/.test(b.toString("ascii", 0, 6));
    case "image/webp":
      return (
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      );
    case "video/mp4":
    case "video/quicktime":
    case "audio/mp4":
      return b.toString("ascii", 4, 8) === "ftyp";
    case "video/webm":
      // Every WebM/Matroska container starts with the EBML magic.
      return b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "audio/mpeg":
      return (
        b.toString("ascii", 0, 3) === "ID3" ||
        (b[0] === 255 && (b[1] & 224) === 224)
      );
    case "application/pdf":
      return b.toString("ascii", 0, 5) === "%PDF-";
    default:
      return false;
  }
}
export async function mediaRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
) {
  const [, id, sub] = path;
  if (id === "upload-intent" && method === "POST") {
    const v = z
      .object({
        mime: z.enum(types),
        size: z
          .number()
          .int()
          .positive()
          .max(25 * 1024 * 1024),
        name: z
          .string()
          .min(1)
          .max(150)
          .regex(/^[^\x00-\x1f\\/]+$/),
      })
      .strict()
      .parse(body);
    const used = await db.media.aggregate({
      where: { ownerId: userId },
      _sum: { size: true },
    });
    requireCondition(
      (used._sum.size ?? 0) + v.size <= 1024 * 1024 * 1024,
      413,
      "QUOTA_EXCEEDED",
    );
    const file = await db.media.create({
      data: { ...v, ownerId: userId, key: `staging/${userId}/${randomUUID()}` },
    });
    return {
      id: file.id,
      url: await getSignedUrl(
        storage(),
        new PutObjectCommand({
          Bucket: Bucket(),
          Key: file.key,
          ContentType: v.mime,
          ContentLength: v.size,
        }),
        { expiresIn: 300 },
      ),
    };
  }
  if (id === "complete" && method === "POST") {
    const { mediaId } = z.object({ mediaId: uuid }).strict().parse(body);
    const file = await db.media.findUnique({ where: { id: mediaId } });
    requireCondition(file && file.ownerId === userId);
    if (file.status === 'READY') return file;
    const head = await storage().send(
      new HeadObjectCommand({ Bucket: Bucket(), Key: file.key }),
    );
    requireCondition(
      head.ContentLength === file.size && head.ContentType === file.mime,
      400,
      "INVALID_UPLOAD",
    );
    const data = await storage().send(
      new GetObjectCommand({
        Bucket: Bucket(),
        Key: file.key,
        Range: "bytes=0-31",
        IfMatch: head.ETag,
      }),
    );
    const bytes = await data.Body?.transformToByteArray();
    if (!bytes || !validSignature(file.mime, bytes)) {
      await storage().send(
        new DeleteObjectCommand({ Bucket: Bucket(), Key: file.key }),
      );
      await db.media.delete({ where: { id: mediaId } });
      requireCondition(false, 400, "INVALID_FILE_SIGNATURE");
    }
    const immutableKey = `private/${userId}/${randomUUID()}`;
    await storage().send(new CopyObjectCommand({Bucket:Bucket(),Key:immutableKey,CopySource:`${Bucket()}/${file.key}`,CopySourceIfMatch:head.ETag}));
    const completed = await db.media.update({
      where: { id: mediaId },
      data: { status: "READY", key:immutableKey },
    });
    await storage().send(new DeleteObjectCommand({Bucket:Bucket(),Key:file.key}));
    return completed;
  }
  if (sub === "access" && method === "GET") {
    const file = await db.media.findUnique({
      where: { id: uuid.parse(id) },
      include: {
        messages: { select: { conversationId: true, recalledAt: true } },
        moments: { select: { momentId: true } },
      },
    });
    requireCondition(file && file.status === "READY", 404, "NOT_FOUND");
    let allowed = file.ownerId === userId;
    if (!allowed)
      allowed = !!(await db.conversation.findFirst({
        where: { wallpaperMediaId: file.id, members: { some: { userId } } },
        select: { id: true },
      }));
    if (!allowed)
      allowed = !!(await db.user.findFirst({
        where: { avatarId: file.id, disabled: false },
        select: { id: true },
      }));
    if (!allowed)
      allowed = !!(await db.conversationMember.findFirst({
        where: {
          userId,
          conversationId: {
            in: file.messages
              .filter((m) => !m.recalledAt)
              .map((m) => m.conversationId),
          },
        },
      }));
    if (!allowed)
      for (const m of file.moments) {
        try {
          await visibleMoment(userId, m.momentId);
          allowed = true;
          break;
        } catch {}
      }
    // Cover artwork is public with a published cover and travels with every
    // red packet that used it, so a market viewer or a recipient can load the
    // same background and decoration pictures as the designer.
    if (!allowed) {
      const rows = await db.$queryRaw<{ one: number }[]>`
        SELECT 1 AS one
        FROM "RedPacketCover"
        WHERE status = 'PUBLISHED'
          AND design::text LIKE ${`%${file.id}%`}
        LIMIT 1
      `;
      allowed = rows.length > 0;
    }
    if (!allowed) {
      const rows = await db.$queryRaw<{ one: number }[]>`
        SELECT 1 AS one
        FROM "MoneyTransfer" mt
        JOIN "Message" m ON m.id = mt."messageId"
        JOIN "ConversationMember" cm
          ON cm."conversationId" = m."conversationId"
        WHERE cm."userId" = ${userId}::uuid
          AND mt."coverDesign" IS NOT NULL
          AND mt."coverDesign"::text LIKE ${`%${file.id}%`}
        LIMIT 1
      `;
      allowed = rows.length > 0;
    }
    requireCondition(allowed);
    return {
      mime: file.mime,
      name: file.name,
      size: file.size,
      url: await getSignedUrl(
        storage(),
        new GetObjectCommand({
          Bucket: Bucket(),
          Key: file.key,
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        }),
        { expiresIn: 60 },
      ),
    };
  }
}

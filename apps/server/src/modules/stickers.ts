import { z } from "zod";
import { db } from "../services/db";
import { requireCondition } from "../security/errors";
import { uuid } from "../../../../packages/contracts";

/// A pack holds one picture per sticker. The client sends the pictures through
/// the normal media pipeline first, so nothing here copies binary data.
const maxStickers = 60;

const name = z.string().trim().min(1).max(40);
const description = z.string().trim().max(200);
const artwork = {
  id: true,
  mediaId: true,
  label: true,
  animated: true,
  position: true,
} as const;

const packInclude = (userId: string) => ({
  owner: { select: { id: true, nickname: true } },
  stickers: { orderBy: { position: "asc" as const }, select: artwork },
  members: { where: { userId }, select: { userId: true } },
});

type PackRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  coverMediaId: string | null;
  avatarMediaId: string | null;
  published: boolean;
  updatedAt: Date;
  owner?: { nickname: string } | null;
  stickers: {
    id: string;
    mediaId: string;
    label: string;
    animated: boolean;
    position: number;
  }[];
  members?: { userId: string }[];
};

/// The shape both the sticker panel and the studio read. A pack the user does
/// not own but has added is still "in their library", which is what decides
/// whether its stickers can be sent.
function packJson(pack: PackRow, userId: string) {
  const mine = pack.ownerId === userId;
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    coverMediaId: pack.coverMediaId,
    avatarMediaId: pack.avatarMediaId,
    published: pack.published,
    mine,
    added: mine || (pack.members?.length ?? 0) > 0,
    ownerId: pack.ownerId,
    ownerName: pack.owner?.nickname ?? "",
    updatedAt: pack.updatedAt,
    stickerCount: pack.stickers.length,
    stickers: pack.stickers.map((sticker) => ({
      ...sticker,
      packId: pack.id,
      packName: pack.name,
    })),
  };
}

async function accessiblePack(userId: string, id: string) {
  const pack = await db.stickerPack.findFirst({
    where: {
      id: uuid.parse(id),
      OR: [
        { ownerId: userId },
        { published: true },
        { members: { some: { userId } } },
      ],
    },
    include: packInclude(userId),
  });
  requireCondition(pack, 404, "NOT_FOUND");
  return pack;
}

/// Artwork the pack may point at: a media row this user uploaded and that is
/// already processed, so the client can render it immediately.
async function requireOwnedMedia(userId: string, mediaId: string) {
  const media = await db.media.findFirst({
    where: { id: mediaId, ownerId: userId, status: "READY" },
    select: { id: true },
  });
  requireCondition(media, 400, "MEDIA_NOT_READY");
}

async function ownedPack(userId: string, id: string) {
  const pack = await db.stickerPack.findFirst({
    where: { id: uuid.parse(id), ownerId: userId },
    include: packInclude(userId),
  });
  requireCondition(pack, 404, "NOT_FOUND");
  return pack;
}

export async function stickersRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
) {
  const [, section, id, sub, subId] = path;

  if (!section && method === "GET") {
    const [owned, added, market, recents] = await Promise.all([
      db.stickerPack.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: "desc" },
        include: packInclude(userId),
      }),
      db.stickerPack.findMany({
        where: { ownerId: { not: userId }, members: { some: { userId } } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: packInclude(userId),
      }),
      db.stickerPack.findMany({
        where: { published: true, ownerId: { not: userId } },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: packInclude(userId),
      }),
      db.userSticker.findMany({
        where: { userId },
        orderBy: { usedAt: "desc" },
        take: 24,
        include: {
          sticker: {
            include: { pack: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);
    return {
      packs: [...owned, ...added].map((pack) => packJson(pack, userId)),
      market: market.map((pack) => packJson(pack, userId)),
      recent: recents.map((row) => ({
        ...row.sticker,
        packId: row.sticker.packId,
        packName: row.sticker.pack.name,
      })),
    };
  }

  if (section === "used" && method === "POST") {
    const { stickerId } = z.object({ stickerId: uuid }).strict().parse(body);
    const sticker = await db.sticker.findFirst({
      where: {
        id: stickerId,
        pack: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
            { published: true },
          ],
        },
      },
      select: { id: true },
    });
    requireCondition(sticker, 404, "NOT_FOUND");
    await db.userSticker.upsert({
      where: { userId_stickerId: { userId, stickerId } },
      create: { userId, stickerId },
      update: { usedAt: new Date(), uses: { increment: 1 } },
    });
    return { ok: true };
  }

  if (section !== "packs") return undefined;

  if (!id && method === "POST") {
    const v = z
      .object({ name, description: description.default("") })
      .strict()
      .parse(body);
    const pack = await db.stickerPack.create({
      data: { ...v, ownerId: userId },
      include: packInclude(userId),
    });
    return packJson(pack, userId);
  }

  if (sub === "add" && method === "POST") {
    const pack = await db.stickerPack.findFirst({
      where: { id: uuid.parse(id), published: true },
      include: packInclude(userId),
    });
    requireCondition(pack, 404, "NOT_FOUND");
    if (pack.ownerId !== userId)
      await db.userStickerPack.upsert({
        where: { userId_packId: { userId, packId: pack.id } },
        create: { userId, packId: pack.id },
        update: {},
      });
    return packJson(
      await db.stickerPack.findUniqueOrThrow({
        where: { id: pack.id },
        include: packInclude(userId),
      }),
      userId,
    );
  }

  if (sub === "remove" && method === "POST") {
    const pack = await accessiblePack(userId, id);
    requireCondition(pack.ownerId !== userId, 400, "OWN_PACK");
    await db.userStickerPack.deleteMany({
      where: { userId, packId: pack.id },
    });
    return { ok: true };
  }

  if (!id) return undefined;

  if (!sub) {
    if (method === "GET")
      return packJson(await accessiblePack(userId, id), userId);
    if (method === "DELETE") {
      const pack = await ownedPack(userId, id);
      await db.stickerPack.delete({ where: { id: pack.id } });
      return { ok: true };
    }
    if (method === "PATCH") {
      const v = z
        .object({
          name: name.optional(),
          description: description.optional(),
          published: z.boolean().optional(),
          coverMediaId: uuid.nullable().optional(),
          avatarMediaId: uuid.nullable().optional(),
        })
        .strict()
        .parse(body);
      requireCondition(
        v.name !== undefined ||
          v.description !== undefined ||
          v.published !== undefined ||
          v.coverMediaId !== undefined ||
          v.avatarMediaId !== undefined,
        400,
        "NOTHING_TO_UPDATE",
      );
      const pack = await ownedPack(userId, id);
      if (v.coverMediaId) await requireOwnedMedia(userId, v.coverMediaId);
      if (v.avatarMediaId) await requireOwnedMedia(userId, v.avatarMediaId);
      const updated = await db.stickerPack.update({
        where: { id: pack.id },
        data: v,
        include: packInclude(userId),
      });
      return packJson(updated, userId);
    }
    return undefined;
  }

  if (sub === "stickers") {
    if (!subId && method === "POST") {
      const v = z
        .object({
          mediaId: uuid,
          label: z.string().trim().max(40).default(""),
          animated: z.boolean().default(false),
        })
        .strict()
        .parse(body);
      const pack = await ownedPack(userId, id);
      requireCondition(pack.stickers.length < maxStickers, 409, "PACK_FULL");
      const media = await db.media.findFirst({
        where: { id: v.mediaId, ownerId: userId, status: "READY" },
        select: { id: true },
      });
      requireCondition(media, 400, "MEDIA_NOT_READY");
      const position = pack.stickers.reduce(
        (last, sticker) => Math.max(last, sticker.position + 1),
        0,
      );
      const sticker = await db.sticker.create({
        data: { ...v, packId: pack.id, position },
        select: artwork,
      });
      if (!pack.coverMediaId || !pack.avatarMediaId)
        await db.stickerPack.update({
          where: { id: pack.id },
          data: {
            ...(pack.coverMediaId ? {} : { coverMediaId: v.mediaId }),
            ...(pack.avatarMediaId ? {} : { avatarMediaId: v.mediaId }),
          },
        });
      return { ...sticker, packId: pack.id, packName: pack.name };
    }
    if (subId && method === "DELETE") {
      const pack = await ownedPack(userId, id);
      await db.sticker.deleteMany({
        where: { id: uuid.parse(subId), packId: pack.id },
      });
      return { ok: true };
    }
  }

  return undefined;
}

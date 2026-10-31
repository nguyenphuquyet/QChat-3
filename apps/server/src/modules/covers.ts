import { z } from "zod";
import { db } from "../services/db";
import { requireCondition } from "../security/errors";
import { uuid } from "../../../../packages/contracts";

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "INVALID_COLOR");

const backgroundSchema = z.object({
  // A cover animates through a video. Any container the client can sniff is
  // accepted; MP4/H.264 is the one every platform plays. Stills use `image`.
  // `gif` is kept readable for covers saved before the switch, and `mp4` is
  // accepted as the same design as `video` for older clients.
  type: z
    .enum(["solid", "gradient", "image", "gif", "video", "mp4"])
    .default("solid"),
  color: color.default("#d93b30"),
  colors: z.array(color).max(4).default([]),
  mediaId: uuid.optional(),
  // Framing of the picture inside the flap: 1 covers it, up to 3 zooms in,
  // and the offsets are fractions of the flap. The client clamps them against
  // the real crop before painting.
  imageScale: z.number().min(1).max(3).default(1),
  imageOffsetX: z.number().min(-1).max(1).default(0),
  imageOffsetY: z.number().min(-1).max(1).default(0),
});

const decorationSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["emoji", "text", "image"]).default("emoji"),
  value: z.string().min(1).max(200),
  x: z.number().min(-0.2).max(1.2),
  y: z.number().min(-0.2).max(1.2),
  size: z.number().min(0.04).max(0.9),
  rotation: z.number().min(-7).max(7).default(0),
  animation: z.enum(["none", "float", "pulse", "sparkle"]).default("none"),
  area: z.enum(["top", "bottom", "all"]).default("top"),
});

const effectsSchema = z.object({
  sparkles: z.boolean().default(false),
  float: z.boolean().default(false),
  pulse: z.boolean().default(false),
});

// The chat bubble is designed separately from the cover: its own picture and
// the two golds that fade that picture in towards the tail.
const messageSchema = z.object({
  imageId: uuid.optional(),
  startColor: color.default("#f5a83a"),
  endColor: color.default("#f7c65a"),
  // Framing of the message picture, same units as the cover background.
  imageScale: z.number().min(1).max(3).default(1),
  imageOffsetX: z.number().min(-1).max(1).default(0),
  imageOffsetY: z.number().min(-1).max(1).default(0),
});

const designSchema = z
  .object({
    background: backgroundSchema.optional(),
    bottomColor: color.default("#d93b30"),
    topHeight: z.number().min(0.45).max(0.92).default(0.8),
    receiptHeight: z.number().min(0.12).max(0.7).default(0.34),
    archLine: z.boolean().default(true),
    overlayColor: color.default("#80000000"),
    openColor: color.default("#f6e3b0"),
    openTextColor: color.default("#a8512f"),
    openLabel: z.string().min(1).max(8).default("Mở"),
    decorations: z.array(decorationSchema).max(40).default([]),
    effects: effectsSchema.optional(),
    message: messageSchema.optional(),
  })
  .strict();

const defaultBackground = { type: "solid", color: "#d93b30", colors: [] };
const defaultEffects = { sparkles: false, float: false, pulse: false };
const defaultMessage = { startColor: "#f5a83a", endColor: "#f7c65a" };

function parseDesign(raw: unknown) {
  const value = designSchema.parse(raw);
  const background = value.background ?? defaultBackground;
  return {
    ...value,
    // Store one canonical name, so every reader only handles `video`.
    background:
      background.type === "mp4" ? { ...background, type: "video" } : background,
    effects: value.effects ?? defaultEffects,
    message: value.message ?? defaultMessage,
  };
}

type DesignMedia = {
  background: { type: string; mediaId?: string };
  decorations?: { kind: string; value: string }[];
  message?: {
    imageId?: string;
    startColor?: string;
    endColor?: string;
  };
};

async function validateMedia(userId: string, design: DesignMedia) {
  const checks: { id: string; kind: "image" | "gif" | "video" }[] = [];
  const mediaId = design.background.mediaId;
  if (
    (design.background.type === "image" ||
      design.background.type === "gif" ||
      design.background.type === "video" ||
      design.background.type === "mp4") &&
    mediaId
  ) {
    checks.push({
      id: mediaId,
      kind:
        design.background.type === "image"
          ? "image"
          : design.background.type === "gif"
            ? "gif"
            : "video",
    });
  }
  for (const item of design.decorations ?? []) {
    if (item.kind === "image" && item.value) {
      checks.push({ id: item.value, kind: "image" });
    }
  }
  if (design.message?.imageId) {
    checks.push({ id: design.message.imageId, kind: "image" });
  }
  for (const check of checks) {
    const file = await db.media.findFirst({
      where: { id: check.id, ownerId: userId, status: "READY" },
      select: { id: true, mime: true },
    });
    requireCondition(file, 400, "MEDIA_NOT_READY");
    if (check.kind === "video") {
      requireCondition(file.mime.startsWith("video/"), 400, "MEDIA_NOT_VIDEO");
      continue;
    }
    requireCondition(file.mime.startsWith("image/"), 400, "MEDIA_NOT_IMAGE");
    if (check.kind === "gif") {
      requireCondition(file.mime === "image/gif", 400, "MEDIA_NOT_GIF");
    }
  }
}

const designerSelect = {
  userId: true,
  displayName: true,
  bio: true,
  user: {
    select: { qchatId: true, nickname: true, avatarId: true },
  },
} as const;

const coverInclude = (userId: string) =>
  ({
    designer: { select: designerSelect },
    owners: { where: { userId }, select: { selected: true } },
  }) as const;

function presentCover(cover: any, userId: string) {
  const { owners, ...rest } = cover;
  return {
    ...rest,
    mine: cover.designerId === userId,
    owned: (owners?.length ?? 0) > 0,
    selected: owners?.[0]?.selected === true,
  };
}

/// A snapshot of a cover the sender owns, stored with the transfer so a
/// packet keeps its look even if the designer edits or deletes the cover.
export async function coverSnapshotForTransfer(
  userId: string,
  coverId: string,
) {
  const owned = await db.userRedPacketCover.findUnique({
    where: { userId_coverId: { userId, coverId } },
    include: { cover: { select: { id: true, design: true } } },
  });
  requireCondition(owned, 400, "COVER_NOT_OWNED");
  return { id: owned.cover.id, design: owned.cover.design };
}

export async function coversRoute(
  userId: string,
  method: string,
  path: string[],
  body: unknown,
  url: URL,
) {
  const [, section, id, action] = path;

  if (section === "covers" && !id && method === "GET") {
    const items = await db.userRedPacketCover.findMany({
      where: { userId },
      orderBy: { acquiredAt: "desc" },
      include: { cover: { include: coverInclude(userId) } },
    });
    return {
      items: items.map((row) =>
        presentCover({ ...row.cover, selected: row.selected }, userId),
      ),
    };
  }

  if (section === "covers" && id === "market" && method === "GET") {
    const query = z
      .string()
      .max(80)
      .parse(url.searchParams.get("q") ?? "")
      .trim();
    const items = await db.redPacketCover.findMany({
      where: {
        status: "PUBLISHED",
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { description: { contains: query, mode: "insensitive" as const } },
                {
                  designer: {
                    displayName: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ claimCount: "desc" }, { updatedAt: "desc" }],
      take: 60,
      include: coverInclude(userId),
    });
    return { items: items.map((item) => presentCover(item, userId)) };
  }

  if (section === "covers" && !id && method === "POST") {
    const input = z
      .object({
        name: z.string().trim().min(1).max(40),
        description: z.string().trim().max(200).default(""),
        design: designSchema,
        publish: z.boolean().default(false),
      })
      .strict()
      .parse(body);
    const designer = await db.redPacketDesigner.findUnique({
      where: { userId },
      select: { userId: true },
    });
    requireCondition(designer, 403, "DESIGNER_REQUIRED");
    const design = parseDesign(input.design);
    await validateMedia(userId, design);
    const cover = await db.$transaction(async (tx) => {
      const created = await tx.redPacketCover.create({
        data: {
          designerId: userId,
          name: input.name,
          description: input.description,
          design,
          status: input.publish ? "PUBLISHED" : "DRAFT",
        },
      });
      await tx.userRedPacketCover.create({
        data: { userId, coverId: created.id },
      });
      return created;
    });
    return presentCover(
      await db.redPacketCover.findUniqueOrThrow({
        where: { id: cover.id },
        include: coverInclude(userId),
      }),
      userId,
    );
  }

  if (section === "covers" && id && method === "PATCH") {
    const input = z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        description: z.string().trim().max(200).optional(),
        design: designSchema.optional(),
        publish: z.boolean().optional(),
      })
      .strict()
      .parse(body);
    const existing = await db.redPacketCover.findUnique({
      where: { id: uuid.parse(id) },
      select: { id: true, designerId: true },
    });
    requireCondition(existing && existing.designerId === userId, 404, "COVER_NOT_FOUND");
    const design = input.design === undefined ? undefined : parseDesign(input.design);
    if (design) await validateMedia(userId, design);
    const cover = await db.redPacketCover.update({
      where: { id: existing.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(design === undefined ? {} : { design }),
        ...(input.publish === undefined
          ? {}
          : { status: input.publish ? "PUBLISHED" : "DRAFT" }),
      },
      include: coverInclude(userId),
    });
    return presentCover(cover, userId);
  }

  if (section === "covers" && id && method === "DELETE") {
    const deleted = await db.redPacketCover.deleteMany({
      where: { id: uuid.parse(id), designerId: userId },
    });
    requireCondition(deleted.count === 1, 404, "COVER_NOT_FOUND");
    return { ok: true };
  }

  if (section === "covers" && id && action === "claim" && method === "POST") {
    const cover = await db.redPacketCover.findUnique({
      where: { id: uuid.parse(id) },
      select: { id: true, status: true, designerId: true },
    });
    requireCondition(
      cover && (cover.status === "PUBLISHED" || cover.designerId === userId),
      404,
      "COVER_NOT_FOUND",
    );
    const existing = await db.userRedPacketCover.findUnique({
      where: { userId_coverId: { userId, coverId: cover.id } },
      select: { coverId: true },
    });
    if (!existing) {
      await db.$transaction([
        db.userRedPacketCover.create({
          data: { userId, coverId: cover.id },
        }),
        db.redPacketCover.update({
          where: { id: cover.id },
          data: { claimCount: { increment: 1 } },
        }),
      ]);
    }
    return { ok: true, claimed: !existing };
  }

  if (section === "covers" && id && action === "select" && method === "POST") {
    if (id === "default") {
      await db.userRedPacketCover.updateMany({
        where: { userId },
        data: { selected: false },
      });
      return { selectedId: null };
    }
    const coverId = uuid.parse(id);
    const owned = await db.userRedPacketCover.findUnique({
      where: { userId_coverId: { userId, coverId } },
      select: { coverId: true },
    });
    requireCondition(owned, 403, "COVER_NOT_OWNED");
    await db.$transaction([
      db.userRedPacketCover.updateMany({
        where: { userId },
        data: { selected: false },
      }),
      db.userRedPacketCover.update({
        where: { userId_coverId: { userId, coverId } },
        data: { selected: true },
      }),
    ]);
    return { selectedId: coverId };
  }

  if (section === "designer" && method === "GET") {
    const designer = await db.redPacketDesigner.findUnique({
      where: { userId },
      include: {
        user: { select: { qchatId: true, nickname: true, avatarId: true } },
        covers: {
          orderBy: { updatedAt: "desc" },
          include: coverInclude(userId),
        },
      },
    });
    return {
      designer: designer
        ? {
            ...designer,
            covers: designer.covers.map((cover) =>
              presentCover(cover, userId),
            ),
          }
        : null,
    };
  }

  if (section === "designer" && method === "POST") {
    const input = z
      .object({
        displayName: z.string().trim().min(1).max(40),
        bio: z.string().trim().max(200).default(""),
      })
      .strict()
      .parse(body);
    requireCondition(
      !(await db.redPacketDesigner.findUnique({
        where: { userId },
        select: { userId: true },
      })),
      409,
      "DESIGNER_EXISTS",
    );
    const designer = await db.redPacketDesigner.create({
      data: { userId, displayName: input.displayName, bio: input.bio },
      include: { user: { select: { qchatId: true, nickname: true, avatarId: true } } },
    });
    return { designer };
  }

  if (section === "designer" && method === "PATCH") {
    const input = z
      .object({
        displayName: z.string().trim().min(1).max(40).optional(),
        bio: z.string().trim().max(200).optional(),
      })
      .strict()
      .parse(body);
    const updated = await db.redPacketDesigner.updateMany({
      where: { userId },
      data: {
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.bio === undefined ? {} : { bio: input.bio }),
      },
    });
    requireCondition(updated.count === 1, 404, "DESIGNER_NOT_FOUND");
    const designer = await db.redPacketDesigner.findUniqueOrThrow({
      where: { userId },
      include: { user: { select: { qchatId: true, nickname: true, avatarId: true } } },
    });
    return { designer };
  }

  if (section === "designers" && id && method === "GET") {
    const designerId = uuid.parse(id);
    const designer = await db.redPacketDesigner.findUnique({
      where: { userId: designerId },
      include: {
        user: { select: { qchatId: true, nickname: true, avatarId: true } },
        covers: {
          where: { status: "PUBLISHED" },
          orderBy: { updatedAt: "desc" },
          include: coverInclude(userId),
        },
      },
    });
    requireCondition(designer, 404, "DESIGNER_NOT_FOUND");
    return {
      designer: {
        ...designer,
        covers: designer.covers.map((cover) => presentCover(cover, userId)),
      },
    };
  }
}

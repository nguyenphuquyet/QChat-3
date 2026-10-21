import { z } from "zod";
export const uuid = z.string().uuid();
export const registerSchema = z
  .object({
    qchatId: z.string().regex(/^[a-z][a-z0-9_]{3,23}$/),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
    nickname: z.string().trim().min(1).max(64),
    deviceName: z.string().max(100).default("Mobile"),
  })
  .strict();
export const loginSchema = z
  .object({
    identifier: z.string().min(1).max(254),
    password: z.string().min(1).max(128),
    deviceName: z.string().max(100).default("Mobile"),
  })
  .strict();
export const messageSchema = z
  .object({
    conversationId: uuid,
    clientId: uuid,
    kind: z
      .enum([
        "TEXT",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        "FILE",
        "GIF",
        "CONTACT",
        "LOCATION",
      ])
      .default("TEXT"),
    text: z.string().max(10000).default(""),
    mediaId: uuid.optional(),
    replyToId: uuid.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.kind === "TEXT"
        ? v.text.trim().length > 0
        : ["CONTACT", "LOCATION"].includes(v.kind)
          ? v.text.length > 0
          : !!v.mediaId,
    "Message content required",
  );
export const receiptSchema = z
  .object({ conversationId: uuid, sequence: z.number().int().nonnegative() })
  .strict();
export const signalSchema = z
  .object({ callId: uuid, data: z.string().max(64000) })
  .strict();
export type MessageInput = z.infer<typeof messageSchema>;

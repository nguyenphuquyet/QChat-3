import argon2 from "argon2";
import nodemailer from "nodemailer";
import { z } from "zod";
import { registerSchema, loginSchema } from "../../../../packages/contracts";
import { db } from "../services/db";
import {
  createSession,
  rotateSession,
  secretToken,
  digest,
} from "../security/auth";
import { requireCondition } from "../security/errors";
export async function authRoute(action: string, body: unknown) {
  if (action === "register") {
    const v = registerSchema.parse(body);
    const user = await db.user.create({
      data: {
        qchatId: v.qchatId,
        email: v.email,
        nickname: v.nickname,
        passwordHash: await argon2.hash(v.password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        }),
      },
    });
    return createSession(user.id, v.deviceName);
  }
  if (action === "login") {
    const v = loginSchema.parse(body);
    const u = await db.user.findFirst({
      where: {
        OR: [
          { email: v.identifier.toLowerCase() },
          { qchatId: v.identifier.toLowerCase() },
        ],
      },
    });
    const hash = u?.passwordHash ?? (await argon2.hash(secretToken()));
    const valid = await argon2.verify(hash, v.password);
    requireCondition(u && valid && !u.disabled, 401, "INVALID_CREDENTIALS");
    return createSession(u.id, v.deviceName);
  }
  if (action === "refresh")
    return rotateSession(
      z
        .object({ refreshToken: z.string().min(32).max(200) })
        .strict()
        .parse(body).refreshToken,
    );
  if (action === "forgot-password" || action === "send-verification") {
    const { email } = z.object({ email: z.email() }).strict().parse(body);
    requireCondition(process.env.SMTP_HOST, 503, "EMAIL_NOT_CONFIGURED");
    const u = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (u) {
      const token = secretToken();
      await db.accountToken.create({
        data: {
          userId: u.id,
          hash: digest(token),
          kind: action,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await nodemailer
        .createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_TLS === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        })
        .sendMail({
          from: process.env.SMTP_FROM,
          to: u.email,
          subject: "QChat account verification",
          text: `Enter this one-time token in QChat (expires in one hour): ${token}`,
        });
    }
    return { ok: true };
  }
  if (action === "reset-password" || action === "verify-email") {
    const v = z
      .object({
        token: z.string().min(32).max(200),
        password: z.string().min(12).max(128).optional(),
      })
      .strict()
      .parse(body);
    if (action === "reset-password")
      requireCondition(v.password, 400, "PASSWORD_REQUIRED");
    const passwordHash = v.password
      ? await argon2.hash(v.password, { type: argon2.argon2id })
      : undefined;
    await db.$transaction(async (tx) => {
      const t = await tx.accountToken.findUnique({
        where: { hash: digest(v.token) },
      });
      requireCondition(
        t &&
          t.expiresAt > new Date() &&
          t.kind ===
            (action === "reset-password"
              ? "forgot-password"
              : "send-verification"),
        400,
        "INVALID_TOKEN",
      );
      await tx.accountToken.delete({ where: { id: t.id } });
      await tx.user.update({
        where: { id: t.userId },
        data:
          action === "reset-password"
            ? { passwordHash }
            : { emailVerified: true },
      });
      if (action === "reset-password")
        await tx.userSession.updateMany({
          where: { userId: t.userId },
          data: { revokedAt: new Date() },
        });
    });
    return { ok: true };
  }
  return undefined;
}

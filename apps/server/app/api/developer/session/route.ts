import { cookies } from "next/headers";
import { z } from "zod";
import { authRoute } from "../../../../src/modules/auth";
import { db } from "../../../../src/services/db";
import { digest } from "../../../../src/security/auth";
import { rateLimit } from "../../../../src/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieName = "qchat_developer";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function sessionUser(user: {
  id: string;
  nickname: string;
  qchatId: string;
  email: string;
  role: string;
}) {
  return {
    userId: user.id,
    nickname: user.nickname,
    qchatId: user.qchatId,
    email: user.email,
    role: user.role,
    reviewer: user.role === "ADMIN",
  };
}

/// The Developer Center never receives an access token in JavaScript. Only the
/// refresh secret lives in an httpOnly cookie and the proxy route exchanges it
/// server-side for each request.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-real-ip") ?? "unknown";
    await rateLimit(`developer-login:${ip}`, 20);
    const body = z
      .object({
        identifier: z.string().trim().min(1).max(254),
        password: z.string().min(1).max(128),
      })
      .strict()
      .parse(await request.json());
    const result = await authRoute("login", {
      ...body,
      deviceName: "Developer Center",
    });
    if (!result || !("refreshToken" in result))
      return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    const user = await db.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        nickname: true,
        qchatId: true,
        email: true,
        role: true,
        disabled: true,
      },
    });
    if (!user || user.disabled)
      return Response.json({ error: "ACCOUNT_DISABLED" }, { status: 403 });
    const store = await cookies();
    store.set(cookieName, result.refreshToken, cookieOptions);
    return Response.json(sessionUser(user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function GET() {
  try {
    const store = await cookies();
    const token = store.get(cookieName)?.value;
    if (!token) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const session = await db.userSession.findUnique({
      where: { refreshHash: digest(token) },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            qchatId: true,
            email: true,
            role: true,
            disabled: true,
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.user.disabled ||
      (session.expiresAt !== null && session.expiresAt <= new Date())
    ) {
      store.delete(cookieName);
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return Response.json(sessionUser(session.user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token)
    await db.userSession.updateMany({
      where: { refreshHash: digest(token) },
      data: { revokedAt: new Date() },
    });
  store.delete(cookieName);
  return Response.json({ ok: true });
}

function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: number }).status)
      : 500;
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "SERVICE_ERROR";
  if (status >= 500) console.error("Developer session failed", { code });
  return Response.json({ error: code }, { status });
}

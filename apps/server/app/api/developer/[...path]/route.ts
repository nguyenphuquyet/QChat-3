import { cookies } from "next/headers";
import { z } from "zod";
import { handle } from "../../../../src/services/api";
import { miniAppPreview, uploadBuild } from "../../../../src/modules/miniapps";
import { accessToken, digest } from "../../../../src/security/auth";
import { ApiError } from "../../../../src/security/errors";
import { db } from "../../../../src/services/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieName = "qchat_developer";
const uploadPath =
  /^miniapps\/developer\/apps\/(mp_[a-z0-9]{12,24})\/builds$/;

async function session() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  const record = await db.userSession.findUnique({
    where: { refreshHash: digest(token) },
    include: { user: { select: { id: true, role: true, disabled: true } } },
  });
  if (
    !record ||
    record.revokedAt ||
    record.user.disabled ||
    (record.expiresAt !== null && record.expiresAt <= new Date())
  )
    return null;
  return {
    userId: record.userId,
    role: record.user.role,
    token: await accessToken(record.userId, record.id),
  };
}

function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "VALIDATION_ERROR",
        issues: error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
        })),
      },
      { status: 400 },
    );
  if (error instanceof ApiError)
    return Response.json({ error: error.code }, { status: error.status });
  console.error("Developer proxy failed", {
    type: error instanceof Error ? error.name : "Unknown",
  });
  return Response.json({ error: "SERVICE_ERROR" }, { status: 500 });
}

async function proxy(request: Request, path: string[]) {
  const joined = path.join("/");
  if (!joined.startsWith("miniapps")) return new Response(null, { status: 404 });
  const user = await session();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const method = request.method;
  if (!["GET", "HEAD"].includes(method) && request.headers.get("x-qchat-csrf") !== "1")
    return Response.json({ error: "CSRF_REQUIRED" }, { status: 403 });

  const url = new URL(request.url);
  try {
    const previewMatch =
      method === "GET"
        ? /^miniapps\/review\/versions\/([0-9a-f-]{36})\/preview(?:\/(.*))?$/.exec(
            joined,
          )
        : null;
    if (previewMatch) {
      const file = await miniAppPreview(
        user.userId,
        user.role,
        previewMatch[1],
        previewMatch[2] ?? "",
      );
      return new Response(new Uint8Array(file.bytes), {
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.bytes.length),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          // The frame runs with an opaque origin. CORS stays open so Vite's
          // module scripts and fonts load inside that sandbox; the endpoint
          // still requires the reviewer's httpOnly session cookie.
          "Access-Control-Allow-Origin": "*",
          "Content-Security-Policy":
            "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads",
        },
      });
    }
    const uploadMatch = method === "POST" ? uploadPath.exec(joined) : null;
    if (uploadMatch)
      return Response.json(await uploadBuild(user.userId, uploadMatch[1], await request.formData()), {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      });
    const body =
      ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();
    const headers = new Headers({ Authorization: `Bearer ${user.token}` });
    if (body) headers.set("Content-Type", "application/json");
    if (process.env.WEB_ORIGIN) headers.set("Origin", process.env.WEB_ORIGIN);
    const internal = new URL(
      `http://developer.internal/api/${joined}${url.search}`,
    );
    const response = await handle(
      new Request(internal, { method, headers, body }),
    );
    const result = new Response(response.body, response);
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}
export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}
export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await context.params).path);
}

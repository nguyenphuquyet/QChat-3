import { z } from "zod";
import { handle } from "../../../src/services/api";
import { authenticate } from "../../../src/security/auth";
import { ApiError } from "../../../src/security/errors";
import { buildKeyAuth, uploadBuild } from "../../../src/modules/miniapps";
import {
  readBuild,
  verifyBlobToken,
} from "../../../src/services/miniapp-storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadPath = /^\/api\/miniapps\/developer\/apps\/(mp_[a-z0-9]{12,24})\/builds$/;

function errorResponse(error: unknown) {
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
  console.error("Mini App request failed", {
    type: error instanceof Error ? error.name : "Unknown",
    message: error instanceof Error ? error.message : undefined,
  });
  return Response.json({ error: "SERVICE_ERROR" }, { status: 500 });
}

/// Builds are uploaded as multipart/form-data because a base64 body would
/// exceed the JSON limit. The file is fully validated before it is stored.
async function upload(request: Request, appId: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== process.env.WEB_ORIGIN)
    return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 21 * 1024 * 1024)
    return Response.json({ error: "BUILD_TOO_LARGE" }, { status: 413 });
  try {
    const form = await request.formData();
    // CI can upload with a per-app API key instead of a user session. The key
    // is scoped to one app and never grants Developer Center access.
    const apiKey = request.headers.get("x-qchat-key");
    let result;
    if (apiKey) {
      const app = await buildKeyAuth(apiKey);
      if (!app || app.appId !== appId) throw new ApiError(403, "FORBIDDEN");
      result = await uploadBuild(app.developerId, appId, form);
    } else {
      const auth = await authenticate(
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
      );
      result = await uploadBuild(auth.userId, appId, form);
    }
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/// Signed download for the filesystem storage adapter. The signature covers the
/// storage key and expiry, so the internal path is never exposed and the link
/// stops working after two minutes.
async function blob(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!verifyBlobToken(key, exp, sig))
    return new Response(null, { status: 403 });
  try {
    const bytes = await readBuild(key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": 'attachment; filename="miniapp.zip"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

async function cors(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/miniapps/blob")
    return blob(request);
  const uploadMatch =
    request.method === "POST" ? uploadPath.exec(url.pathname) : null;
  if (uploadMatch) return upload(request, uploadMatch[1]);
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS" && origin !== process.env.WEB_ORIGIN)
    return new Response(null, { status: 403 });
  const response =
    request.method === "OPTIONS"
      ? new Response(null, { status: 204 })
      : await handle(request);
  if (origin === process.env.WEB_ORIGIN) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Vary", "Origin");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-QChat-CSRF, X-QChat-Key",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
  }
  return response;
}
export const GET = cors;
export const POST = cors;
export const PATCH = cors;
export const DELETE = cors;
export const OPTIONS = cors;

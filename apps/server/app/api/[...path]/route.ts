import { handle } from "../../../src/services/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function cors(request: Request) {
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
      "Authorization, Content-Type",
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

import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../services/db";
import { ApiError } from "./errors";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const secretToken = () => randomBytes(48).toString("base64url");
function key() {
  const k = process.env.JWT_SECRET;
  if (!k || k.length < 32)
    throw new Error("JWT_SECRET must have at least 32 characters");
  return new TextEncoder().encode(k);
}
export async function accessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("qchat")
    .setAudience("qchat-client")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
}
export async function authenticate(token: string) {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key(), {
      issuer: "qchat",
      audience: "qchat-client",
      algorithms: ["HS256"],
    }));
  } catch {
    throw new ApiError(401, "UNAUTHORIZED");
  }
  if (typeof payload.sub !== "string" || typeof payload.sid !== "string")
    throw new ApiError(401, "UNAUTHORIZED");
  const session = await db.userSession.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    (session.expiresAt !== null && session.expiresAt <= new Date()) ||
    session.user.disabled
  )
    throw new ApiError(401, "SESSION_REVOKED");
  return {
    userId: session.userId,
    sessionId: session.id,
    role: session.user.role,
  };
}
export async function createSession(userId: string, deviceName: string) {
  const refreshToken = secretToken();
  const s = await db.userSession.create({
    data: {
      userId,
      deviceName,
      refreshHash: digest(refreshToken),
      expiresAt: null,
    },
  });
  return { accessToken: await accessToken(userId, s.id), refreshToken, userId };
}
export async function refreshSession(token: string) {
  const hash = digest(token);
  // A retry after a lost response must not revoke the user's session.
  // Keep the high-entropy refresh secret stable and store only its hash.
  const result = await db.userSession.findUnique({
    where: { refreshHash: hash },
    include: { user: true },
  });
  if (
    !result ||
    result.revokedAt ||
    result.user.disabled ||
    (result.expiresAt !== null && result.expiresAt <= new Date())
  )
    throw new ApiError(401, "INVALID_REFRESH");
  return {
    accessToken: await accessToken(result.userId, result.id),
    refreshToken: token,
    userId: result.userId,
  };
}

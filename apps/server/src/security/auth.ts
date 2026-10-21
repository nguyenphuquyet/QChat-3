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
    session.expiresAt <= new Date() ||
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
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  return { accessToken: await accessToken(userId, s.id), refreshToken, userId };
}
export async function rotateSession(token: string) {
  const hash = digest(token);
  const refreshToken = secretToken();
  const result = await db.$transaction(async (tx) => {
    const s = await tx.userSession.findFirst({
      where: { OR: [{ refreshHash: hash }, { previousHash: hash }] },
      include: { user: true },
    });
    if (!s || s.revokedAt || s.expiresAt <= new Date() || s.user.disabled)
      return null;
    if (s.previousHash === hash) {
      await tx.userSession.update({
        where: { id: s.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    const updated = await tx.userSession.updateMany({
      where: { id: s.id, refreshHash: hash, revokedAt: null },
      data: { refreshHash: digest(refreshToken), previousHash: hash },
    });
    return updated.count ? s : null;
  });
  if (!result) throw new ApiError(401, "INVALID_REFRESH");
  return {
    accessToken: await accessToken(result.userId, result.id),
    refreshToken,
    userId: result.userId,
  };
}

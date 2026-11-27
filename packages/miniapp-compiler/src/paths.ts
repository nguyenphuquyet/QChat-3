/**
 * Package path resolution shared by the WXML and WXSS compilers.
 *
 * A Mini App is a flat package. A relative reference is resolved against the
 * referring file and must stay inside the package root: an absolute path, a
 * drive letter, a backslash or a `..` that climbs above the root is rejected
 * before any file is read.
 */
export function resolvePackagePath(from: string, request: string): string | null {
  if (typeof request !== "string" || request.length === 0 || request.length > 512) return null;
  if (request.startsWith("/") || request.includes("\\") || request.includes("\0")) return null;
  if (/^[A-Za-z]:/.test(request)) return null;
  const base = request.startsWith(".")
    ? from.slice(0, Math.max(0, from.lastIndexOf("/") + 1)) + request
    : request;
  const segments: string[] = [];
  for (const segment of base.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length === 0 ? null : segments.join("/");
}

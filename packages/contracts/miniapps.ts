import { z } from "zod";

/// Permissions a Mini App can request in its manifest. The Flutter host maps
/// each id to a native capability and asks the user before first use; the
/// server only accepts builds that stay inside this list.
export const miniappPermissions = [
  {
    id: "toast",
    title: "Hiện thông báo ngắn",
    description: "Hiển thị toast trong QChat.",
    sensitive: false,
  },
  {
    id: "user.profile",
    title: "Thông tin hồ sơ",
    description: "Đọc nickname, QChat ID và ảnh đại diện của bạn.",
    sensitive: true,
  },
  {
    id: "media.choose",
    title: "Chọn ảnh",
    description: "Mở thư viện ảnh để chọn một ảnh.",
    sensitive: true,
  },
  {
    id: "share",
    title: "Chia sẻ nội dung",
    description: "Chia sẻ văn bản hoặc liên kết ra ngoài QChat.",
    sensitive: true,
  },
  {
    id: "storage",
    title: "Lưu trữ riêng",
    description: "Lưu dữ liệu nhỏ trong vùng riêng của Mini App.",
    sensitive: false,
  },
  {
    id: "qchat.api",
    title: "Dữ liệu QChat",
    description: "Gọi một số API chỉ đọc của QChat qua host.",
    sensitive: true,
  },
  {
    id: "network",
    title: "Mạng ngoài",
    description: "Gọi HTTPS tới các tên miền khai báo trong manifest.",
    sensitive: true,
  },
] as const;

export const miniappPermissionIds = miniappPermissions.map((item) => item.id);
export type MiniappPermission = (typeof miniappPermissions)[number]["id"];

export const miniappCategories = [
  "utilities",
  "social",
  "productivity",
  "entertainment",
  "education",
  "finance",
  "health",
  "shopping",
  "tools",
  "games",
  "news",
  "travel",
] as const;
export type MiniappCategory = (typeof miniappCategories)[number];

export const appIdPattern = /^mp_[a-z0-9]{12,24}$/;
export const appIdSchema = z.string().regex(appIdPattern);
export const semverPattern = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,20})?$/;
export const semverSchema = z.string().regex(semverPattern);
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https:\/\/[^\s]+$/i.test(value), {
    message: "HTTPS URL required",
  });

/// `manifest.json` for a web Mini App package. The app id is assigned by the
/// server from the app record, so it must not appear in the upload.
///
/// A web package is a static site: `index.html` is the entry, every other file
/// lives under `assets/`, and the Flutter host serves the verified directory to
/// a WebView over a loopback HTTP server. No remote code is ever loaded.
export const webappManifestSchema = z
  .object({
    schemaVersion: z.literal(3),
    format: z.literal("webapp"),
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(500).default(""),
    version: semverSchema,
    entry: z.literal("index.html"),
    minRuntimeVersion: semverSchema.default("2.0.0"),
    requestedPermissions: z
      .array(z.enum(miniappPermissionIds as [string, ...string[]]))
      .max(miniappPermissionIds.length)
      .default([]),
    /// Optional accent colour a host may use for the status bar or splash.
    themeColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict();
export type WebappManifest = z.infer<typeof webappManifestSchema>;

/// Metadata written by the packager. It repeats the entry hash and lists every
/// payload file so the server and the device can verify the archive before any
/// code is served to the WebView.
export const webappMetadataSchema = z
  .object({
    formatVersion: z.literal(2),
    builderVersion: z.string().min(1).max(40),
    version: semverSchema,
    entry: z.literal("index.html"),
    builtAt: z.string().datetime(),
    entrySha256: z.string().regex(/^[a-f0-9]{64}$/),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1).max(300),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            size: z.number().int().min(0),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export type WebappMetadata = z.infer<typeof webappMetadataSchema>;

export const runtimeVersion = "2.0.0";

/// Paths a Mini App may read through `qchat.request`. Anything else is
/// rejected by the host before a QChat token is ever used.
export const miniappApiAllowlist: Record<string, MiniappPermission> = {
  "/users/me": "user.profile",
  "/friends": "user.profile",
  "/conversations": "qchat.api",
};

/// Extensions allowed anywhere under `assets/`. They are the files a static web
/// build produces; executables, server scripts and archives stay rejected.
export const webappAssetExtensions = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".map",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".wav",
  ".mp4",
  ".webm",
  ".vtt",
  ".wasm",
]);

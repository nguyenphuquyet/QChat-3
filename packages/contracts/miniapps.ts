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

/// `qchat.manifest.json` that every uploaded build must contain at its root.
export const miniappManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    appId: appIdSchema,
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(500).default(""),
    version: semverSchema,
    entry: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._/-]+\.html?$/)
      .refine(
        (value) =>
          !value.startsWith("/") &&
          value
            .split("/")
            .every((part) => part !== "" && part !== "." && part !== ".."),
        { message: "Entry must be a relative file path" },
      ),
    minRuntimeVersion: semverSchema.default("1.0.0"),
    requestedPermissions: z
      .array(z.enum(miniappPermissionIds as [string, ...string[]]))
      .max(miniappPermissionIds.length)
      .default([]),
    buildHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export type MiniappManifest = z.infer<typeof miniappManifestSchema>;

export const runtimeVersion = "1.0.0";

/// Paths a Mini App may read through `QChat.request`. Anything else is
/// rejected by the host before a QChat token is ever used.
export const miniappApiAllowlist: Record<string, MiniappPermission> = {
  "/users/me": "user.profile",
  "/friends": "user.profile",
  "/conversations": "qchat.api",
};

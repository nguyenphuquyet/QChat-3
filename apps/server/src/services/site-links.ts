import { db } from "./db";

/// Landing page links are stored in PostgreSQL so an administrator can change
/// them from the admin console without rebuilding the application.
export const linkPlatforms = ["web", "android", "ios", "github"] as const;
export type LinkPlatform = (typeof linkPlatforms)[number];
export type SiteLink = {
  platform: LinkPlatform;
  label: string;
  url: string;
  note: string;
  enabled: boolean;
};

const repository = "https://github.com/nguyenphuquyet/QChat-3";
const workflow = `${repository}/actions/workflows/flutter.yml`;

const defaults: Record<LinkPlatform, Omit<SiteLink, "platform">> = {
  web: {
    label: "Web",
    url: "",
    note: "Ứng dụng chat trên trình duyệt đang được hoàn thiện. Liên kết sẽ xuất hiện khi bạn cấu hình.",
    enabled: false,
  },
  android: {
    label: "Android",
    url: workflow,
    note: "Tải APK trong mục Artifacts của workflow Flutter app (qchat-android-<commit>).",
    enabled: true,
  },
  ios: {
    label: "iOS",
    url: workflow,
    note: "IPA chưa ký (qchat-ios-unsigned-<commit>); cần ký bằng chứng chỉ của bạn trước khi cài lên iPhone.",
    enabled: true,
  },
  github: {
    label: "GitHub",
    url: repository,
    note: "Mã nguồn QChat và các bản build tự động.",
    enabled: true,
  },
};

export function defaultSiteLinks(): SiteLink[] {
  return linkPlatforms.map((platform) => ({ platform, ...defaults[platform] }));
}

export function isLinkPlatform(value: string): value is LinkPlatform {
  return (linkPlatforms as readonly string[]).includes(value);
}

/// Returns every platform in a stable order, using the stored value when it
/// exists and the built-in fallback otherwise. A database failure must never
/// break the public landing page.
export async function readSiteLinks(): Promise<SiteLink[]> {
  try {
    const rows = await db.siteLink.findMany();
    const stored = new Map(rows.map((row) => [row.platform, row]));
    return linkPlatforms.map((platform) => {
      const row = stored.get(platform);
      return row
        ? {
            platform,
            label: row.label,
            url: row.url,
            note: row.note,
            enabled: row.enabled,
          }
        : { platform, ...defaults[platform] };
    });
  } catch {
    return defaultSiteLinks();
  }
}

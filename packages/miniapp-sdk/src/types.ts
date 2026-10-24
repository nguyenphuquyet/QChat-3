export type MiniAppPermission =
  | "toast"
  | "user.profile"
  | "media.choose"
  | "share"
  | "storage"
  | "qchat.api";

export type MiniAppCategory =
  | "utilities"
  | "social"
  | "productivity"
  | "entertainment"
  | "education"
  | "finance"
  | "health"
  | "shopping"
  | "tools"
  | "games"
  | "news"
  | "travel";

export type AppInfo = {
  appId: string;
  name: string;
  version: string;
  entry: string;
  runtimeVersion: string;
  minRuntimeVersion: string;
  permissions: MiniAppPermission[];
};

export type UserInfo = {
  id: string;
  qchatId: string;
  nickname: string;
  avatarUrl: string | null;
};

export type ToastOptions = {
  /// Milliseconds, clamped by the host.
  duration?: number;
  icon?: "success" | "error" | "none";
};

export type ChooseImageOptions = {
  /// Preferred maximum edge in pixels. The host may downscale the image.
  maxWidth?: number;
  maxHeight?: number;
  /// JPEG quality between 0.1 and 1.
  quality?: number;
};

export type ChosenImage = {
  /// A data URL (`data:image/...;base64,...`) so the WebView never receives a
  /// local filesystem path.
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
};

export type SharePayload = {
  text?: string;
  url?: string;
  title?: string;
};

export type ShareResult = {
  shared: boolean;
};

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean>;
  body?: unknown;
};

export type SystemInfo = {
  platform: "android" | "ios" | "web" | "unknown";
  osVersion: string;
  appVersion: string;
  runtimeVersion: string;
  locale: string;
  theme: "light" | "dark";
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  safeAreaTop: number;
  safeAreaBottom: number;
};

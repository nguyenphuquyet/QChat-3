export type MiniAppPermission = "toast" | "user.profile" | "media.choose" | "share" | "storage" | "qchat.api";
export type MiniAppCategory = "utilities" | "social" | "productivity" | "entertainment" | "education" | "finance" | "health" | "shopping" | "tools" | "games" | "news" | "travel";
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
    duration?: number;
    icon?: "success" | "error" | "none";
};
export type ChooseImageOptions = {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
};
export type ChosenImage = {
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
//# sourceMappingURL=types.d.ts.map
export interface AppInfo {
    appId: string;
    name: string;
    version: string;
    runtimeVersion: string;
    minRuntimeVersion: string;
    permissions?: string[];
}
export interface SystemInfo {
    platform: "android" | "ios" | "web" | "windows" | "linux" | "macos" | "test" | string;
    osVersion?: string;
    appVersion?: string;
    runtimeVersion?: string;
    locale?: string;
    theme?: "light" | "dark";
    screenWidth: number;
    screenHeight: number;
    pixelRatio?: number;
    safeAreaTop?: number;
    safeAreaBottom?: number;
}
export interface UserInfo {
    id: string;
    qchatId: string;
    nickname: string;
    avatarUrl?: string | null;
}
export interface ChosenImage {
    dataUrl: string;
    mimeType: string;
    width: number;
    height: number;
    size: number;
}
export declare function getAppInfo(): Promise<AppInfo>;
export declare function getSystemInfo(): Promise<SystemInfo>;
/** Requires the `user.profile` permission. */
export declare function getUserInfo(): Promise<UserInfo>;
/** Requires the `media.choose` permission. */
export declare function chooseImage(options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}): Promise<ChosenImage>;
/** Requires the `share` permission. */
export declare function share(options: {
    text?: string;
    url?: string;
    title?: string;
}): Promise<boolean>;
//# sourceMappingURL=app.d.ts.map
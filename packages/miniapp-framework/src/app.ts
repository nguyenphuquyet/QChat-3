import { callHost } from "./host.js";

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

export function getAppInfo(): Promise<AppInfo> {
  return callHost<AppInfo>("getAppInfo");
}

export function getSystemInfo(): Promise<SystemInfo> {
  return callHost<SystemInfo>("getSystemInfo");
}

/** Requires the `user.profile` permission. */
export function getUserInfo(): Promise<UserInfo> {
  return callHost<UserInfo>("getUserInfo");
}

/** Requires the `media.choose` permission. */
export function chooseImage(options: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
} = {}): Promise<ChosenImage> {
  return callHost<ChosenImage>("chooseImage", options);
}

/** Requires the `share` permission. */
export async function share(options: {
  text?: string;
  url?: string;
  title?: string;
}): Promise<boolean> {
  const result = await callHost<{ shared: boolean }>("share", options);
  return result.shared === true;
}

import { callHost } from "./host.js";

/** Navigate to another screen or page inside the same mini app. */
export function navigateTo(path: string): Promise<void> {
  return callHost<void>("navigateTo", { path });
}

export function navigateBack(): Promise<void> {
  return callHost<void>("navigateBack");
}

export function closeMiniApp(): Promise<void> {
  return callHost<void>("closeMiniApp");
}

/** Requires the `toast` permission. */
export function showToast(
  message: string,
  options: { icon?: "success" | "error" | "none"; duration?: number } = {},
): Promise<void> {
  return callHost<void>("showToast", {
    message,
    icon: options.icon ?? "none",
    duration: options.duration ?? 2200,
  });
}

export function openExternal(url: string): Promise<void> {
  return callHost<void>("navigateTo", { path: url, external: true });
}

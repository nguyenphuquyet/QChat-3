import { callHost } from "./host.js";
/** Navigate to another screen or page inside the same mini app. */
export function navigateTo(path) {
    return callHost("navigateTo", { path });
}
export function navigateBack() {
    return callHost("navigateBack");
}
export function closeMiniApp() {
    return callHost("closeMiniApp");
}
/** Requires the `toast` permission. */
export function showToast(message, options = {}) {
    return callHost("showToast", {
        message,
        icon: options.icon ?? "none",
        duration: options.duration ?? 2200,
    });
}
export function openExternal(url) {
    return callHost("navigateTo", { path: url, external: true });
}
//# sourceMappingURL=navigation.js.map
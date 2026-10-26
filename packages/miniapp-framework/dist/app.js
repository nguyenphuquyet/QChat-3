import { callHost } from "./host.js";
export function getAppInfo() {
    return callHost("getAppInfo");
}
export function getSystemInfo() {
    return callHost("getSystemInfo");
}
/** Requires the `user.profile` permission. */
export function getUserInfo() {
    return callHost("getUserInfo");
}
/** Requires the `media.choose` permission. */
export function chooseImage(options = {}) {
    return callHost("chooseImage", options);
}
/** Requires the `share` permission. */
export async function share(options) {
    const result = await callHost("share", options);
    return result.shared === true;
}
//# sourceMappingURL=app.js.map
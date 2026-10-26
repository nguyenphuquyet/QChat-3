import { h, Fragment } from "./runtime.js";
export { Fragment };
function create(type, props, key) {
    const next = { ...(props ?? {}) };
    if (key !== undefined)
        next.key = key;
    return h(type, next);
}
export function jsx(type, props, key) {
    return create(type, props, key);
}
export const jsxs = jsx;
export const jsxDEV = jsx;
//# sourceMappingURL=jsx-runtime.js.map
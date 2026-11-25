/// The built-in component set.
///
/// QChat registers WeChat's built-in tags as ordinary glass-easel custom
/// components. There is no public implementation of these components in the
/// official toolchain, so `builtin/<tag>/<tag>.*` in this package is QChat's
/// implementation; the build pipeline around it is the official one.
///
/// The map is injected into every *user* page and component config. It is
/// deliberately not written into `app.json`: the official plugin merges
/// `app.json` `usingComponents` into every component, including the built-ins
/// themselves, and an `input` built-in whose template contains `<input>` would
/// then resolve to itself.
export const BUILTIN_COMPONENTS = [
    "view",
    "text",
    "button",
    "image",
    "scroll-view",
    "input",
    "textarea",
    "switch",
    "checkbox",
    "checkbox-group",
    "radio",
    "radio-group",
    "slider",
    "navigator",
    "progress",
];
/** Staged directory, relative to the staged `src` root. */
export const BUILTIN_DIR = "__qchat__/builtin";
/** Staged host runtime path, relative to the staged `src` root. */
export const HOST_ENTRY = "__qchat__/host.js";
/// `usingComponents` entries for the built-in set, rooted at the staged
/// `src` directory so they resolve from any page or component depth.
export function builtinUsingComponents() {
    const map = {};
    for (const name of BUILTIN_COMPONENTS) {
        map[name] = `/${BUILTIN_DIR}/${name}/${name}`;
    }
    return map;
}
/// The `usingComponents` map a page or component receives at build time.
///
/// Built-ins are added first so an author declaration with the same tag wins.
export function withBuiltins(usingComponents) {
    return { ...builtinUsingComponents(), ...(usingComponents ?? {}) };
}
//# sourceMappingURL=builtin.js.map
export declare const BUILTIN_COMPONENTS: readonly ["view", "text", "button", "image", "scroll-view", "input", "textarea", "switch", "checkbox", "checkbox-group", "radio", "radio-group", "slider", "navigator", "progress", "swiper", "swiper-item", "picker", "form", "label", "rich-text"];
export type BuiltinComponent = (typeof BUILTIN_COMPONENTS)[number];
/** Staged directory, relative to the staged `src` root. */
export declare const BUILTIN_DIR = "__qchat__/builtin";
/** Staged host runtime path, relative to the staged `src` root. */
export declare const HOST_ENTRY = "__qchat__/host.js";
export declare function builtinUsingComponents(): Record<string, string>;
export declare function withBuiltins(usingComponents: Record<string, string> | undefined): Record<string, string>;
//# sourceMappingURL=builtin.d.ts.map
/**
 * The shared contract surface. Every runtime module imports from here and never
 * redefines a version, an error code, a permission or a component.
 */

export * from "./version.js";
export * from "./errors.js";
export * from "./validate.js";
export * from "./bridge.js";
export * from "./lifecycle.js";
export * from "./permissions.js";
export * from "./components.js";
export * from "./apis.js";
export * from "./manifest.js";
export * from "./renderer.js";
export * from "./theme.js";
export * from "./performance.js";
export * from "./wxs.js";

/// Ambient declarations for the official glass-easel webpack integration.
///
/// `glass-easel-miniprogram-webpack-plugin` ships JavaScript plus its original
/// TypeScript sources, but no declaration files and no `types` entry in its
/// `package.json`. The declarations below describe exactly the surface the
/// builder uses; loader values are absolute paths, not loader functions.

declare module "glass-easel-miniprogram-webpack-plugin" {
  import type { WebpackPluginInstance } from "webpack";

  /** Absolute path of the official `.wxml` loader. */
  export const GlassEaselMiniprogramWxmlLoader: string;
  /** Absolute path of the official `.wxss` loader. */
  export const GlassEaselMiniprogramWxssLoader: string;
  /** Absolute path of the official `.wxs` loader. */
  export const GlassEaselMiniprogramWxsLoader: string;

  export interface GlassEaselMiniprogramWebpackPluginOptions {
    /** Compile with debug information. */
    dev?: boolean;
    /** The mini-program-shaped source directory, absolute. */
    path?: string;
    /** Files matching this pattern are copied to the webpack output. */
    resourceFilePattern?: RegExp;
    /** The page loaded on startup, e.g. `pages/index/index`. */
    defaultEntry?: string;
    /** Do not inject the DOM bootstrap; the host drives glass-easel itself. */
    customBootstrap?: boolean;
    /** Do not prefix generated component class names. */
    disableClassPrefix?: boolean;
    /** Prefix for custom component host elements. */
    tagNamePrefix?: string;
  }

  export class GlassEaselMiniprogramWebpackPlugin implements WebpackPluginInstance {
    constructor(options?: GlassEaselMiniprogramWebpackPluginOptions);
    apply(compiler: unknown): void;
  }
}

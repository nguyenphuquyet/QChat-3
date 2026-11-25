/// Public surface of the QChat Mini Program toolchain.
///
/// A Mini Program is a WeChat-shaped project (`app.json`, `app.js`, `app.wxss`,
/// `pages/**`, `components/**`). QChat does not compile WXML or WXSS: it
/// orchestrates the official `glass-easel-miniprogram-webpack-plugin` and its
/// template/stylesheet compilers, then packages the output into the verified
/// `.japp` container the Flutter host serves.
///
/// [buildMiniProgram] is the supported entry point. [loadMiniProgram] exposes the
/// validated project model for editors and the CLI.
export { BUILDER_VERSION, BuildError, METADATA_FORMAT_VERSION, PACKAGE_ENTRY, PACKAGE_FORMAT, PACKAGE_SCHEMA_VERSION, RUNTIME_VERSION, buildAppConfig, buildMiniProgram, readPackageManifest, renderIndexHtml, } from "./builder.js";
export { MiniProgramError, inlineWxss, loadMiniProgram, resolveComponentBase, rewriteWxmlAssets, stripBom, toPosix, } from "./wechat.js";
export { crc32, readZip, writeZip } from "./zip.js";
//# sourceMappingURL=index.js.map
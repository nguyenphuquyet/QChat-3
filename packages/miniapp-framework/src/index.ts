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

export {
  BUILDER_VERSION,
  BuildError,
  METADATA_FORMAT_VERSION,
  PACKAGE_ENTRY,
  PACKAGE_FORMAT,
  PACKAGE_SCHEMA_VERSION,
  RUNTIME_VERSION,
  buildAppConfig,
  buildMiniProgram,
  readPackageManifest,
  renderIndexHtml,
  type AppConfig,
  type BuildDiagnostic,
  type BuildOptions,
  type BuiltMiniProgram,
  type MiniProgramManifest,
  type MiniProgramMetadata,
} from "./builder.js";
export {
  MiniProgramError,
  inlineWxss,
  loadMiniProgram,
  resolveComponentBase,
  rewriteWxmlAssets,
  stripBom,
  toPosix,
  type AppJson,
  type LoadOptions,
  type ManifestOverrides,
  type MiniProgramAsset,
  type MiniProgramComponent,
  type MiniProgramPage,
  type MiniProgramProgram,
  type MiniProgramScript,
  type MiniProgramTemplate,
  type PageJson,
  type ProjectConfig,
  type TabBarConfig,
  type TabBarItem,
  type WindowConfig,
} from "./wechat.js";
export { crc32, readZip, writeZip, type ZipEntry, type ZipEntryInput } from "./zip.js";

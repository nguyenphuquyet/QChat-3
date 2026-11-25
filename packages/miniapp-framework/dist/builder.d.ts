import { type AppJson, type ManifestOverrides, type MiniProgramComponent, type MiniProgramPage, type MiniProgramProgram, type PageJson, type TabBarConfig, type WindowConfig } from "./wechat.js";
export declare const PACKAGE_FORMAT = "webapp";
export declare const PACKAGE_SCHEMA_VERSION = 3;
export declare const PACKAGE_ENTRY = "index.html";
export declare const RUNTIME_VERSION = "2.0.0";
export declare const BUILDER_VERSION = "4.0.0";
export declare const METADATA_FORMAT_VERSION = 2;
export type BuildDiagnostic = {
    severity: "error" | "warning";
    code: string;
    message: string;
    file?: string;
    line?: number;
    column?: number;
};
export declare class BuildError extends Error {
    readonly code: string;
    readonly diagnostics: BuildDiagnostic[];
    constructor(code: string, message: string, diagnostics?: BuildDiagnostic[]);
}
export type MiniProgramManifest = {
    schemaVersion: 3;
    format: "webapp";
    name: string;
    description: string;
    version: string;
    entry: "index.html";
    minRuntimeVersion: string;
    requestedPermissions: string[];
    themeColor?: string;
};
export type MiniProgramMetadata = {
    formatVersion: 2;
    builderVersion: string;
    version: string;
    entry: "index.html";
    builtAt: string;
    entrySha256: string;
    files: Array<{
        path: string;
        sha256: string;
        size: number;
    }>;
};
export type AppConfig = {
    format: "qchat-miniprogram";
    formatVersion: 1;
    appId: string | null;
    entry: string;
    pages: Array<{
        route: string;
        config: PageJson;
        usingComponents: Record<string, string>;
    }>;
    components: Array<{
        id: string;
        config: PageJson;
        usingComponents: Record<string, string>;
    }>;
    window: WindowConfig;
    tabBar: TabBarConfig | null;
    subPackages: AppJson["subpackages"] | null;
    networkTimeout: AppJson["networkTimeout"] | null;
    permission: AppJson["permission"] | null;
    requiredPrivateInfos: string[];
    style: string | null;
    sitemapLocation: string | null;
    lazyCodeLoading: string | null;
    usingComponents: Record<string, string>;
    sdkVersion: string;
    generatedAt: string;
};
export type BuildOptions = {
    projectDir: string;
    /** Output file. Defaults to `<projectDir>/dist/<name>-<version>.japp`. */
    outFile?: string;
    /** Unpacked output directory. Defaults to a temporary directory. */
    outDir?: string;
    overrides?: ManifestOverrides;
    /** Fixed build timestamp, used by tests for reproducible archives. */
    date?: Date;
    compress?: boolean;
    mode?: "development" | "production" | "none";
    minify?: boolean;
    sourceMap?: boolean;
    /** Prefix for custom component host elements. Defaults to `wx-`. */
    tagNamePrefix?: string;
};
export type BuiltMiniProgram = {
    outFile: string;
    outDir: string;
    bytes: Buffer;
    manifest: MiniProgramManifest;
    metadata: MiniProgramMetadata;
    files: string[];
    appConfig: AppConfig;
    appConfigJson: string;
    appService: Buffer;
    appWxss: Buffer;
    indexHtml: string;
    diagnostics: BuildDiagnostic[];
    warnings: string[];
    project: MiniProgramProgram;
    durationMs: number;
};
export declare function buildAppConfig(project: MiniProgramProgram, manifest: MiniProgramManifest, date: Date): AppConfig;
export declare function renderIndexHtml(manifest: MiniProgramManifest, appConfigJson: string): string;
export declare function buildMiniProgram(options: BuildOptions): Promise<BuiltMiniProgram>;
export declare function readPackageManifest(file: string): Promise<MiniProgramManifest>;
export type { MiniProgramComponent, MiniProgramPage };
//# sourceMappingURL=builder.d.ts.map
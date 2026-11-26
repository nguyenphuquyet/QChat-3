export type WindowConfig = {
    navigationBarTitleText?: string;
    navigationBarBackgroundColor?: string;
    navigationBarTextStyle?: "black" | "white";
    navigationStyle?: "default" | "custom";
    backgroundColor?: string;
    backgroundTextStyle?: "dark" | "light";
    enablePullDownRefresh?: boolean;
    onReachBottomDistance?: number;
    disableScroll?: boolean;
    navigationBarShadow?: {
        color?: string;
    } | boolean;
    homeButton?: boolean;
    [key: string]: unknown;
};
export type TabBarItem = {
    pagePath: string;
    text?: string;
    iconPath?: string;
    selectedIconPath?: string;
};
export type TabBarConfig = {
    color?: string;
    selectedColor?: string;
    backgroundColor?: string;
    borderStyle?: "black" | "white";
    position?: "bottom" | "top";
    list: TabBarItem[];
    custom?: boolean;
};
export type AppJson = {
    pages: string[];
    window?: WindowConfig;
    tabBar?: TabBarConfig;
    usingComponents?: Record<string, string>;
    subpackages?: Array<{
        root: string;
        pages: string[];
    }>;
    subPackages?: Array<{
        root: string;
        pages: string[];
    }>;
    networkTimeout?: {
        request?: number;
        connectSocket?: number;
        uploadFile?: number;
        downloadFile?: number;
    };
    permission?: Record<string, {
        desc?: string;
    }>;
    requiredPrivateInfos?: string[];
    style?: string;
    sitemapLocation?: string;
    lazyCodeLoading?: string;
    [key: string]: unknown;
};
export type PageJson = WindowConfig & {
    usingComponents?: Record<string, string>;
    component?: boolean;
    styleIsolation?: string;
};
export type ProjectConfig = {
    appid?: string;
    projectname?: string;
    version?: string;
    description?: string;
    miniprogramRoot?: string;
    compileType?: string;
    setting?: Record<string, unknown>;
    [key: string]: unknown;
};
export type ManifestOverrides = {
    name?: string;
    description?: string;
    version?: string;
    minRuntimeVersion?: string;
    requestedPermissions?: string[];
    requestDomains?: string[];
    themeColor?: string;
};
export type SourceLocation = {
    /** Path relative to the project root, using `/`. */
    file?: string;
    line?: number;
    column?: number;
};
export declare class MiniProgramError extends Error {
    readonly code: string;
    readonly location: SourceLocation;
    constructor(code: string, message: string, location?: SourceLocation);
}
export type MiniProgramPage = {
    route: string;
    /** Absolute path without the extension. */
    base: string;
    /** Project-relative paths of the page files. */
    files: {
        js: string;
        wxml: string;
        json: string | null;
        wxss: string | null;
    };
    config: PageJson;
    usingComponents: Record<string, string>;
};
export type MiniProgramComponent = {
    /** Project-relative path without the extension, e.g. `components/card/card`. */
    id: string;
    /** Absolute path without the extension. */
    base: string;
    files: {
        js: string;
        wxml: string;
        json: string | null;
        wxss: string | null;
    };
    config: PageJson;
    usingComponents: Record<string, string>;
};
export type MiniProgramTemplate = {
    /** Page route or component id. */
    id: string;
    /** Project-relative `.wxml` path. */
    file: string;
    source: string;
};
export type MiniProgramScript = {
    /** Project-relative `.wxs` path without the extension. */
    id: string;
    file: string;
    source: string;
};
export type MiniProgramAsset = {
    /** Project-relative path, using `/`. */
    relative: string;
    /** Absolute source path. */
    source: string;
    /** Output path inside the archive. */
    output: string;
};
export type MiniProgramProgram = {
    root: string;
    app: AppJson;
    projectConfig: ProjectConfig;
    manifest: ManifestOverrides;
    pages: MiniProgramPage[];
    components: MiniProgramComponent[];
    templates: MiniProgramTemplate[];
    scripts: MiniProgramScript[];
    /** Every file that must be copied to the build staging directory. */
    files: string[];
    /** Non-code files copied into the package under `assets/`. */
    assets: MiniProgramAsset[];
    /** WXML/WXSS content rewritten for the QChat container, by project-relative path. */
    rewritten: Map<string, string>;
    permissions: string[];
    warnings: string[];
};
export declare function toPosix(value: string): string;
export declare function stripBom(text: string): string;
export declare function resolveComponentBase(spec: string, fromFile: string, root: string): string;
export declare function rewriteWxmlAssets(source: string, file: string, assets: Set<string>): string;
export declare function inlineWxss(source: string, file: string, readSource: (relative: string) => Promise<string | null>, seen?: Set<string>): Promise<string>;
export type LoadOptions = {
    projectDir: string;
    /** Overrides used when the project has no manifest.json. */
    overrides?: ManifestOverrides;
};
export declare function loadMiniProgram(options: LoadOptions): Promise<MiniProgramProgram>;
//# sourceMappingURL=wechat.d.ts.map
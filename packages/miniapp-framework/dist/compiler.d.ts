import { type QappManifest, type QappMetadata } from "./manifest.js";
import { type ZipEntry } from "./zip.js";
export declare const COMPILER_VERSION = "1.0.0";
export declare const SDK_VERSION = "1.0.0";
export interface CompileOptions {
    projectDir: string;
    outfile?: string;
    minify?: boolean;
    /** Run `tsc --noEmit` before bundling. Defaults to true. */
    typecheck?: boolean;
    /** Fixed timestamp for reproducible packages. */
    now?: Date;
    onStage?: (stage: string) => void;
}
export interface CompileResult {
    bytes: Buffer;
    manifest: QappManifest;
    metadata: QappMetadata;
    appJs: string;
    entries: ZipEntry[];
    warnings: string[];
}
/**
 * The QuickJS global declarations every qapp project type-checks against.
 *
 * In the package they sit beside the SDK (`<sdk>/types/qchat-env.d.ts`), but a
 * packaged Studio copies the CLI into `resources/qapp`, so the typings are also
 * accepted inside the CLI directory. `null` means the installation is
 * incomplete: a project would then fail on `console`, `setTimeout`, `URL`…
 */
export declare function envTypingPath(): string | null;
export declare function sha256(bytes: Buffer | string): string;
export declare function readProjectManifest(projectDir: string): Promise<{
    manifest: QappManifest;
    file: string;
    raw: Record<string, unknown>;
}>;
export declare function findTypeScript(): string | null;
export declare function typecheckProject(projectDir: string): {
    skipped: boolean;
    output: string;
    warnings: string[];
};
/**
 * Bundles one entry file exactly like the compiler does. Used by
 * `bundleProject` and by the framework tests, so the test harness runs the same
 * output a device would.
 */
export declare function bundleEntry(sourcePath: string, options?: {
    minify?: boolean;
    metafile?: boolean;
}): Promise<{
    appJs: string;
    metafile?: unknown;
}>;
export declare function bundleProject(projectDir: string, options?: {
    minify?: boolean;
}): Promise<{
    appJs: string;
    manifest: QappManifest;
    source: string;
}>;
export declare function compileProject(options: CompileOptions): Promise<CompileResult>;
export interface QappInspection {
    manifest: QappManifest;
    metadata: QappMetadata;
    sha256: string;
    size: number;
    files: Array<{
        name: string;
        size: number;
        sha256: string;
    }>;
}
/**
 * Turns a display name into a file-safe slug. Vietnamese names must keep their
 * meaning: `Cà Phê Nhà` becomes `ca-phe-nha`, not `c-ph-nh`.
 */
export declare function slugName(name: string): string;
export declare function validateQapp(bytes: Buffer, expected?: {
    version?: string;
}): QappInspection;
//# sourceMappingURL=compiler.d.ts.map
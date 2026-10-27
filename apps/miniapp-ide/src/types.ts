export interface CliInfo {
  ready: boolean;
  nodePath: string | null;
  nodeVersion: string | null;
  cliPath: string | null;
  cliVersion: string | null;
  workspace: string | null;
  platform: string;
  arch: string;
  error: string | null;
}

export interface CliOutput {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface FsEntry {
  name: string;
  path: string;
  relative: string;
  isDir: boolean;
  size: number;
  modifiedMs: number | null;
}

export interface Artifact {
  path: string;
  name: string;
  size: number;
  modifiedMs: number | null;
}

export interface ProjectManifest {
  schemaVersion: number;
  format: string;
  name: string;
  description?: string;
  version: string;
  entry: string;
  sdkVersion: string;
  minRuntimeVersion: string;
  requestedPermissions: string[];
  source?: string;
  [key: string]: unknown;
}

export interface InspectFile {
  name: string;
  size: number;
  sha256: string;
}

export interface InspectResult {
  manifest: ProjectManifest;
  metadata: {
    formatVersion: number;
    compilerVersion: string;
    sdkVersion: string;
    version: string;
    entry: string;
    builtAt: string;
    appSha256: string;
    files: { path: string; sha256: string; size: number }[];
  };
  sha256: string;
  size: number;
  files: InspectFile[];
}

export interface Project {
  path: string;
  name: string;
  manifest: ProjectManifest | null;
  isQapp: boolean;
}

/** Size + mtime snapshot used to detect edits made outside the studio. */
export interface FileStamp {
  path: string;
  exists: boolean;
  size: number;
  modifiedMs: number | null;
}

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  saved: string;
  language: string;
  /** Last modification time observed on disk; `undefined` until first stat. */
  diskModifiedMs?: number | null;
  /** The file changed on disk while this tab still has unsaved edits. */
  externalChange?: boolean;
  /** The file no longer exists on disk (deleted or moved outside). */
  missing?: boolean;
}

export type LogStream = "stdout" | "stderr" | "system";

export type Language = "vi" | "zh" | "en";

export type Theme = "dark" | "light";

export interface LogEntry {
  id: string;
  at: number;
  stream: LogStream;
  text: string;
}

export interface DevLog {
  stream: "stdout" | "stderr";
  line: string;
}

export interface DevExit {
  code: number;
}

export interface Settings {
  nodePath: string;
  cliPath: string;
  projectsDir: string;
  autoSave: boolean;
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
  confirmDelete: boolean;
  language: Language;
  theme: Theme;
}

export interface NewProjectInput {
  name: string;
  directory: string;
  description: string;
  version: string;
  template: "starter" | "counter" | "blank";
  permissions: string[];
}

export interface PermissionInfo {
  id: string;
  label: string;
  description: string;
  tone: "violet" | "mint" | "amber" | "sky" | "rose";
}

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

/** A Mini App folder discovered by the smart open-project resolver. */
export interface ProjectCandidate {
  path: string;
  name: string;
  version: string | null;
}

export interface ProjectManifest {
  name: string;
  version: string;
  description?: string;
  requestedPermissions?: string[];
  themeColor?: string;
  minRuntimeVersion?: string;
  /** Present only in a built package's manifest, not in the authoring file. */
  schemaVersion?: number;
  format?: string;
  entry?: string;
  sdkVersion?: string;
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

/// One message forwarded by the host runtime's development channel
/// (`window.parent.postMessage({ source: "qchat-miniapp", ... })`).
export type DevEventPayload =
  | {
      type: "console";
      level: "log" | "info" | "warn" | "error" | "debug";
      message: string;
      at: number;
    }
  | {
      type: "network";
      phase: "request" | "response" | "error";
      method: string;
      url: string;
      status?: number | null;
      durationMs?: number;
      message?: string;
      at: number;
    }
  | {
      type: "error";
      message: string;
      file?: string;
      line?: number;
      column?: number;
      at: number;
    };

export type DevEvent = DevEventPayload & { id: string };

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

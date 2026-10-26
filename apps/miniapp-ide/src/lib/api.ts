import { invoke } from "@tauri-apps/api/core";
import { documentDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { DEFAULT_PROJECTS_FOLDER, joinPath } from "./utils";
import type {
  Artifact,
  CliInfo,
  CliOutput,
  FileStamp,
  FsEntry,
  InspectResult,
} from "../types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function desktopOnly<T>(value: T): Promise<T> {
  return Promise.reject(
    new Error(
      "The desktop runtime is not available. Run `corepack pnpm tauri dev` inside apps/miniapp-ide.",
    ),
  );
}

export const api = {
  isDesktop: isTauri,

  async defaultProjectsDir(): Promise<string> {
    if (!isTauri()) return "";
    try {
      return joinPath(await documentDir(), DEFAULT_PROJECTS_FOLDER);
    } catch {
      return "";
    }
  },

  detectCli(node = "", cli = ""): Promise<CliInfo> {
    if (!isTauri()) {
      return Promise.resolve({
        ready: false,
        nodePath: null,
        nodeVersion: null,
        cliPath: null,
        cliVersion: null,
        workspace: null,
        platform: navigator.platform || "browser",
        arch: "",
        error:
          "Browser preview mode. Start the desktop app with `corepack pnpm tauri dev` to use the CLI.",
      });
    }
    return invoke<CliInfo>("detect_cli", { node, cli });
  },

  runCli(
    args: string[],
    cwd = "",
    node = "",
    cli = "",
  ): Promise<CliOutput> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<CliOutput>("run_cli", { args, cwd, node, cli });
  },

  startDev(cwd: string, node = "", cli = ""): Promise<number> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<number>("start_dev", { cwd, node, cli });
  },

  stopDev(): Promise<void> {
    if (!isTauri()) return Promise.resolve();
    return invoke<void>("stop_dev");
  },

  listTree(root: string): Promise<FsEntry[]> {
    if (!isTauri()) return desktopOnly([] as FsEntry[]);
    return invoke<FsEntry[]>("list_tree", { root });
  },

  /** Size + mtime snapshot of the given files; missing files come back with `exists: false`. */
  fileStamps(paths: string[]): Promise<FileStamp[]> {
    if (!isTauri() || paths.length === 0) return Promise.resolve([]);
    return invoke<FileStamp[]>("file_stamps", { paths });
  },

  /** Hex hash of the folder structure, used to detect external adds/removes/renames. */
  treeSignature(root: string): Promise<string> {
    if (!isTauri()) return Promise.resolve("");
    return invoke<string>("tree_signature", { root });
  },

  readText(path: string): Promise<string> {
    if (!isTauri()) return desktopOnly("");
    return invoke<string>("read_text_file", { path });
  },

  writeText(path: string, contents: string): Promise<void> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<void>("write_text_file", { path, contents });
  },

  createEntry(path: string, directory: boolean): Promise<void> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<void>("create_entry", { path, directory });
  },

  ensureDirectory(path: string): Promise<void> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<void>("ensure_directory", { path });
  },

  renameEntry(path: string, next: string): Promise<void> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<void>("rename_entry", { path, next });
  },

  deleteEntry(path: string): Promise<void> {
    if (!isTauri()) return desktopOnly(undefined as never);
    return invoke<void>("delete_entry", { path });
  },

  listArtifacts(project: string): Promise<Artifact[]> {
    if (!isTauri()) return Promise.resolve([]);
    return invoke<Artifact[]>("list_artifacts", { project });
  },

  async pickDirectory(defaultPath?: string): Promise<string | null> {
    if (!isTauri()) return null;
    const result = await open({
      directory: true,
      multiple: false,
      defaultPath: defaultPath || undefined,
      title: "Choose a folder",
    });
    return typeof result === "string" ? result : null;
  },

  async pickFile(defaultPath?: string): Promise<string | null> {
    if (!isTauri()) return null;
    const result = await open({
      directory: false,
      multiple: false,
      defaultPath: defaultPath || undefined,
      title: "Choose a file",
    });
    return typeof result === "string" ? result : null;
  },

  async pickPackage(defaultPath?: string): Promise<string | null> {
    if (!isTauri()) return null;
    const result = await open({
      directory: false,
      multiple: false,
      defaultPath: defaultPath || undefined,
      filters: [{ name: "QChat Mini App", extensions: ["japp"] }],
      title: "Choose a .japp package",
    });
    return typeof result === "string" ? result : null;
  },

  async reveal(path: string): Promise<void> {
    if (!isTauri()) return;
    try {
      await revealItemInDir(path);
    } catch {
      // Some platforms cannot reveal a file that has not been built yet.
    }
  },

  async openUrl(url: string): Promise<void> {
    if (!isTauri()) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await openUrl(url);
    } catch {
      // Ignore a browser/mail handler that is not installed.
    }
  },
};

export async function inspectPackage(
  cliPath: string,
  nodePath: string,
  artifact: string,
): Promise<InspectResult> {
  const result = await api.runCli(["inspect", artifact], "", nodePath, cliPath);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "Package inspection failed");
  }
  const start = result.stdout.indexOf("{");
  if (start < 0) throw new Error("The CLI did not return inspection JSON");
  return JSON.parse(result.stdout.slice(start)) as InspectResult;
}

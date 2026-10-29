// Produces everything the live preview needs to run an app: the raw bundle the
// QuickJS runtime would execute, plus the packaged assets as data URLs.
//
// `qchat bundle` exists for exactly this: it runs the same esbuild pipeline as
// `qchat build` but stops before the zip, so the preview can never drift from
// the shipped app.
import { api } from "../api";
import { basename, joinPath, slugify } from "../utils";
import type { FsEntry, Project, Settings } from "../../types";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ASSETS_BYTES = 12 * 1024 * 1024;

export interface QappPreviewAppInfo {
  appId: string;
  name: string;
  version: string;
  runtimeVersion: string;
  minRuntimeVersion: string;
  permissions: string[];
}

export interface QappPreviewBundle {
  appJs: string;
  assets: Record<string, string>;
  appInfo: QappPreviewAppInfo;
  builtAt: number;
}

function firstLines(text: string, limit = 800): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
}

async function loadAssets(projectPath: string): Promise<Record<string, string>> {
  const root = joinPath(projectPath, "assets");
  let entries: FsEntry[];
  try {
    entries = await api.listTree(root);
  } catch {
    // No assets folder: nothing to resolve.
    return {};
  }
  const assets: Record<string, string> = {};
  let total = 0;
  for (const entry of entries) {
    if (entry.isDir) continue;
    const extension = entry.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = IMAGE_TYPES[extension];
    if (!mime) continue;
    if (entry.size > MAX_ASSET_BYTES) continue;
    if (total + entry.size > MAX_ASSETS_BYTES) break;
    try {
      const base64 = await api.readBinary(entry.path);
      const relative = entry.relative.replace(/\\/g, "/");
      assets[`assets/${relative}`] = `data:${mime};base64,${base64}`;
      total += entry.size;
    } catch {
      // An unreadable asset falls back to the renderer's placeholder box.
    }
  }
  return assets;
}

export async function loadPreviewBundle(
  project: Project,
  settings: Settings,
): Promise<QappPreviewBundle> {
  if (!api.isDesktop()) {
    throw new Error(
      "Live preview needs the desktop Studio (`corepack pnpm tauri dev`); the browser build cannot run the CLI.",
    );
  }
  const manifest = project.manifest;
  if (!manifest) throw new Error("This folder has no manifest.json, so there is nothing to run.");
  const result = await api.runCli(
    ["bundle", "--dir", project.path, "--no-typecheck"],
    project.path,
    settings.nodePath,
    settings.cliPath,
  );
  if (result.code !== 0) {
    throw new Error(firstLines(result.stderr || result.stdout) || "qchat bundle failed");
  }
  const appJs = await api.readText(joinPath(project.path, "dist", "app.js"));
  if (!appJs.trim()) throw new Error("qchat bundle wrote an empty app.js");
  const assets = await loadAssets(project.path);
  return {
    appJs,
    assets,
    builtAt: Date.now(),
    appInfo: {
      // The marketplace assigns the real id; the folder name is the closest
      // stable thing a local project has, and it keeps preview storage apart.
      appId: `preview.${slugify(basename(project.path)) || "app"}`,
      name: manifest.name,
      version: manifest.version,
      runtimeVersion: manifest.sdkVersion,
      minRuntimeVersion: manifest.minRuntimeVersion,
      permissions: manifest.requestedPermissions ?? [],
    },
  };
}

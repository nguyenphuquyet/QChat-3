import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type {
  Artifact,
  CliInfo,
  DevExit,
  DevLog,
  EditorTab,
  FsEntry,
  InspectResult,
  LogStream,
  NewProjectInput,
  Project,
  ProjectManifest,
  Settings,
} from "../types";
import { api, inspectPackage } from "./api";
import { translate } from "./i18n";
import { TEMPLATE_LABELS } from "./templates";
import {
  basename,
  dirname,
  errorMessage,
  joinPath,
  languageFor,
  parseCommandLine,
  slugify,
  splitLines,
} from "./utils";

export interface RecentProject {
  path: string;
  name: string;
  version: string;
  openedAt: number;
}

export interface Problem {
  id: string;
  severity: "error" | "warning" | "info";
  text: string;
  source: string;
}

type BottomTab = "output" | "problems" | "terminal";
type SidebarTab = "project" | "build" | "packages";
type ValidationState =
  | { status: "idle"; text: string; at: number | null }
  | { status: "running"; text: string; at: number | null }
  | { status: "pass"; text: string; at: number }
  | { status: "fail"; text: string; at: number };

const DEFAULT_SETTINGS: Settings = {
  nodePath: "",
  cliPath: "",
  projectsDir: "",
  autoSave: true,
  fontSize: 13,
  minimap: false,
  wordWrap: true,
  confirmDelete: true,
  language: "vi",
  theme: "dark",
};

let logCounter = 0;
/** Guards `pollDisk` against overlapping ticks (slow disks, big trees). */
let diskPollInFlight = false;
function nextId(prefix: string): string {
  logCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${logCounter}`;
}

function makeLog(stream: LogStream, text: string) {
  return {
    id: nextId("log"),
    at: Date.now(),
    stream,
    text,
  };
}

function parseProblems(source: string): Problem[] {
  const seen = new Set<string>();
  const problems: Problem[] = [];
  for (const raw of splitLines(source)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const isError = /\b(error|failed|failure|cannot|invalid|rejected)\b/.test(lower);
    const isWarning = /\b(warn|warning|deprecated)\b/.test(lower);
    if (!isError && !isWarning) continue;
    if (/^0 (errors?|warnings?)/.test(lower)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({
      id: nextId("problem"),
      severity: isError ? "error" : "warning",
      text: line,
      source,
    });
    if (problems.length >= 60) break;
  }
  return problems;
}

function outputProblems(stdout: string, stderr: string, source: string): Problem[] {
  return [...parseProblems(stderr), ...parseProblems(stdout)];
}

async function readManifest(path: string): Promise<ProjectManifest | null> {
  try {
    const raw = await api.readText(joinPath(path, "manifest.json"));
    const parsed = JSON.parse(raw) as ProjectManifest;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.requestedPermissions)) parsed.requestedPermissions = [];
    return parsed;
  } catch {
    return null;
  }
}

export interface StudioState {
  booted: boolean;
  cli: CliInfo | null;
  detecting: boolean;
  settings: Settings;
  recent: RecentProject[];
  lastProject: string | null;

  project: Project | null;
  tree: FsEntry[];
  treeLoading: boolean;
  /** Structure hash of the open project, refreshed by the disk watcher. */
  treeSignature: string | null;
  /** Last observed mtime per watched file (open tabs + manifest.json). */
  diskStamps: Record<string, number | null>;
  tabs: EditorTab[];
  activePath: string | null;
  cursor: { line: number; column: number };

  artifacts: Artifact[];
  activeArtifact: string | null;
  inspection: InspectResult | null;
  inspecting: boolean;

  logs: { id: string; at: number; stream: LogStream; text: string }[];
  problems: Problem[];
  bottomTab: BottomTab;
  sidebarTab: SidebarTab;
  sidebarOpen: boolean;
  bottomOpen: boolean;
  previewOpen: boolean;

  buildStatus: "idle" | "running" | "success" | "error";
  buildMessage: string;
  lastBuildAt: number | null;
  validation: ValidationState;
  devPid: number | null;
  devRunning: boolean;
  terminalHistory: string[];

  bootstrap: () => Promise<void>;
  detect: () => Promise<CliInfo | null>;
  updateSettings: (patch: Partial<Settings>) => void;
  openProject: (path: string) => Promise<void>;
  closeProject: () => void;
  refreshTree: () => Promise<void>;
  refreshArtifacts: () => Promise<void>;
  /** One watcher tick: picks up files edited outside the studio. */
  pollDisk: () => Promise<void>;
  /** Force-reload a tab from disk, discarding local edits. */
  reloadTabFromDisk: (path: string) => Promise<void>;
  /** Keep the local edits and drop the "changed outside" warning. */
  dismissExternalChange: (path: string) => void;
  openFile: (path: string) => Promise<void>;
  setActive: (path: string) => void;
  updateTab: (path: string, content: string) => void;
  saveActive: () => Promise<void>;
  saveFile: (path: string) => Promise<void>;
  /** Write every tab with unsaved edits (used by auto save + before build). */
  saveAllDirty: () => Promise<void>;
  closeTab: (path: string) => void;
  createProject: (input: NewProjectInput) => Promise<string>;
  buildProject: (noTypecheck?: boolean) => Promise<void>;
  runTests: () => Promise<void>;
  validateArtifact: (path: string) => Promise<void>;
  inspectArtifact: (path: string) => Promise<void>;
  startDev: () => Promise<void>;
  stopDev: () => Promise<void>;
  appendLog: (stream: LogStream, text: string) => void;
  clearLogs: () => void;
  handleDevLog: (event: DevLog) => void;
  handleDevExit: (event: DevExit) => void;
  setBottomTab: (tab: BottomTab) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setSidebarOpen: (open: boolean) => void;
  setBottomOpen: (open: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setCursor: (line: number, column: number) => void;
  runTerminal: (command: string) => Promise<void>;
  createEntry: (parent: string, name: string, directory: boolean) => Promise<void>;
  renameEntry: (path: string, next: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  saveManifest: (manifest: ProjectManifest) => Promise<void>;
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      booted: false,
      cli: null,
      detecting: false,
      settings: DEFAULT_SETTINGS,
      recent: [],
      lastProject: null,

      project: null,
      tree: [],
      treeLoading: false,
      treeSignature: null,
      diskStamps: {},
      tabs: [],
      activePath: null,
      cursor: { line: 1, column: 1 },

      artifacts: [],
      activeArtifact: null,
      inspection: null,
      inspecting: false,

      logs: [],
      problems: [],
      bottomTab: "output",
      sidebarTab: "project",
      sidebarOpen: true,
      bottomOpen: true,
      previewOpen: true,

      buildStatus: "idle",
      buildMessage: "",
      lastBuildAt: null,
      validation: { status: "idle", text: "", at: null },
      devPid: null,
      devRunning: false,
      terminalHistory: [],

      async bootstrap() {
        if (get().booted) return;
        set({ booted: true, detecting: true });
        try {
          if (!get().settings.projectsDir) {
            const projectsDir = await api.defaultProjectsDir();
            if (projectsDir) {
              set({ settings: { ...get().settings, projectsDir } });
            }
          }
          const info = await api.detectCli(
            get().settings.nodePath,
            get().settings.cliPath,
          );
          set({ cli: info, detecting: false });
          get().appendLog(
            info.ready ? "system" : "stderr",
            info.ready
              ? `QChat CLI ${info.cliVersion ?? ""} ready\nNode ${info.nodeVersion ?? ""}\n${info.cliPath ?? ""}`
              : info.error || translate(get().settings.language, "store.cliNotFound"),
          );
          const last = get().lastProject;
          if (last && info.ready) {
            try {
              await get().openProject(last);
            } catch {
              set({ lastProject: null });
            }
          }
        } catch (error) {
          set({ detecting: false, cli: null });
          get().appendLog("stderr", errorMessage(error));
        }
      },

      async detect() {
        set({ detecting: true });
        try {
          const info = await api.detectCli(
            get().settings.nodePath,
            get().settings.cliPath,
          );
          set({ cli: info, detecting: false });
          get().appendLog(
            info.ready ? "system" : "stderr",
            info.ready
              ? translate(get().settings.language, "store.cliDetected", {
                  version: info.cliVersion ?? "",
                  path: info.cliPath ?? "",
                })
              : info.error || translate(get().settings.language, "store.cliNotFound"),
          );
          return info;
        } catch (error) {
          set({ detecting: false });
          get().appendLog("stderr", errorMessage(error));
          return null;
        }
      },

      updateSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
      },

      async openProject(path) {
        set({
          project: null,
          treeLoading: true,
          treeSignature: null,
          diskStamps: {},
          tabs: [],
          activePath: null,
        });
        try {
          const manifest = await readManifest(path);
          const project: Project = {
            path,
            name: manifest?.name || basename(path),
            manifest,
            isQapp: Boolean(manifest && manifest.format === "qapp"),
          };
          const [tree, artifacts] = await Promise.all([
            api.listTree(path),
            api.listArtifacts(path),
          ]);
          const recentEntry: RecentProject = {
            path,
            name: project.name,
            version: manifest?.version || "",
            openedAt: Date.now(),
          };
          set({
            project,
            tree,
            treeLoading: false,
            artifacts,
            inspection: null,
            activeArtifact: artifacts[0]?.path ?? null,
            lastProject: path,
            recent: [
              recentEntry,
              ...get().recent.filter((item) => item.path !== path),
            ].slice(0, 10),
            buildStatus: "idle",
            buildMessage: "",
            problems: [],
            validation: { status: "idle", text: "", at: null },
          });
          const preferred =
            tree.find((entry) => entry.relative === "src/main.tsx")?.path ||
            tree.find((entry) => entry.relative === "manifest.json")?.path;
          if (preferred) await get().openFile(preferred);
        } catch (error) {
          set({ treeLoading: false });
          throw error;
        }
      },

      closeProject() {
        set({
          project: null,
          tree: [],
          treeSignature: null,
          diskStamps: {},
          tabs: [],
          activePath: null,
          artifacts: [],
          inspection: null,
          activeArtifact: null,
          lastProject: null,
        });
      },

      async refreshTree() {
        const project = get().project;
        if (!project) return;
        set({ treeLoading: true });
        try {
          const tree = await api.listTree(project.path);
          set({ tree, treeLoading: false });
        } catch (error) {
          set({ treeLoading: false });
          get().appendLog("stderr", errorMessage(error));
        }
      },

      async refreshArtifacts() {
        const project = get().project;
        if (!project) return;
        try {
          const artifacts = await api.listArtifacts(project.path);
          set({ artifacts });
          if (!get().activeArtifact && artifacts[0]) {
            set({ activeArtifact: artifacts[0].path });
          }
        } catch (error) {
          get().appendLog("stderr", errorMessage(error));
        }
      },

      /**
       * One watcher tick. Files can be edited outside the studio (another
       * editor, `qapp` on the CLI, git checkout...), so we poll cheap
       * size+mtime stamps for the open tabs plus manifest.json, and a
       * structure hash for the explorer.
       *
       * - a clean tab is updated in place and the change is announced;
       * - a tab with unsaved edits is only flagged, never overwritten;
       * - a deleted/moved file is flagged as missing.
       */
      async pollDisk() {
        const project = get().project;
        if (!project || !api.isDesktop()) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        if (diskPollInFlight) return;
        diskPollInFlight = true;
        const language = get().settings.language;
        const sameProject = () => get().project?.path === project.path;

        try {
          const signature = await api.treeSignature(project.path);
          if (!sameProject()) return;
          if (get().treeSignature === null) {
            set({ treeSignature: signature });
          } else if (get().treeSignature !== signature) {
            set({ treeSignature: signature });
            await get().refreshTree();
            await get().refreshArtifacts();
            if (!sameProject()) return;
          }

          const manifestPath = joinPath(project.path, "manifest.json");
          const watched = Array.from(
            new Set([manifestPath, ...get().tabs.map((tab) => tab.path)]),
          );
          const stamps = await api.fileStamps(watched);
          if (!sameProject()) return;

          for (const stamp of stamps) {
            const baseline = get().diskStamps[stamp.path];
            const onDisk = stamp.exists ? stamp.modifiedMs : null;
            const record = (value: number | null) =>
              set({ diskStamps: { ...get().diskStamps, [stamp.path]: value } });
            const patchTab = (values: Partial<EditorTab>) =>
              set({
                tabs: get().tabs.map((item) =>
                  item.path === stamp.path ? { ...item, ...values } : item,
                ),
              });

            // manifest.json is watched even when it is not open in a tab.
            if (stamp.path === manifestPath && !get().tabs.some((tab) => tab.path === manifestPath)) {
              record(onDisk);
              if (baseline === undefined || baseline === onDisk || !stamp.exists) continue;
              const manifest = await readManifest(project.path);
              const current = get().project;
              if (!manifest || !current || current.path !== project.path) continue;
              if (JSON.stringify(current.manifest ?? null) === JSON.stringify(manifest)) continue;
              set({
                project: { ...current, manifest, name: manifest.name, isQapp: manifest.format === "qapp" },
              });
              toast.info(translate(language, "sync.manifestReloaded"));
              continue;
            }

            const tab = get().tabs.find((item) => item.path === stamp.path);
            if (!tab) {
              record(onDisk);
              continue;
            }

            if (!stamp.exists) {
              record(null);
              if (baseline !== undefined && baseline !== null && !tab.missing) {
                patchTab({ missing: true, externalChange: true });
                toast.error(translate(language, "sync.missing", { name: tab.name }));
              }
              continue;
            }

            // First observation (or the file came back): only take a baseline.
            if (baseline === undefined || baseline === null) {
              record(onDisk);
              if (tab.missing) patchTab({ missing: false, externalChange: false });
              continue;
            }

            if (baseline === onDisk) continue;

            if (tab.content !== tab.saved) {
              record(onDisk);
              if (!tab.externalChange) {
                patchTab({ externalChange: true, missing: false });
                toast.warning(translate(language, "sync.conflict", { name: tab.name }), {
                  action: {
                    label: translate(language, "sync.reload"),
                    onClick: () => void get().reloadTabFromDisk(stamp.path),
                  },
                });
              }
              continue;
            }

            let fresh: string | null = null;
            try {
              fresh = await api.readText(stamp.path);
            } catch {
              fresh = null;
            }
            record(onDisk);
            if (fresh === null) continue;

            const latest = get().tabs.find((item) => item.path === stamp.path);
            if (!latest) continue;
            if (latest.content !== latest.saved) {
              // The user started typing while we were reading: never clobber it.
              if (!latest.externalChange) {
                set({
                  tabs: get().tabs.map((item) =>
                    item.path === stamp.path
                      ? { ...item, externalChange: true, missing: false }
                      : item,
                  ),
                });
                toast.warning(translate(language, "sync.conflict", { name: latest.name }));
              }
              continue;
            }
            if (fresh === latest.content) {
              set({
                tabs: get().tabs.map((item) =>
                  item.path === stamp.path
                    ? { ...item, externalChange: false, missing: false }
                    : item,
                ),
              });
              continue;
            }

            set({
              tabs: get().tabs.map((item) =>
                item.path === stamp.path
                  ? { ...item, content: fresh, saved: fresh, externalChange: false, missing: false }
                  : item,
              ),
            });
            if (stamp.path === manifestPath) {
              try {
                const manifest = JSON.parse(fresh) as ProjectManifest;
                const current = get().project;
                if (manifest && current) {
                  if (!Array.isArray(manifest.requestedPermissions)) {
                    manifest.requestedPermissions = [];
                  }
                  set({
                    project: {
                      ...current,
                      manifest,
                      name: manifest.name,
                      isQapp: manifest.format === "qapp",
                    },
                  });
                }
              } catch {
                // An in-progress (invalid) manifest on disk: keep the text only.
              }
            }
            toast.info(translate(language, "sync.reloaded", { name: latest.name }));
          }
        } catch {
          // Transient failures (folder removed, permissions) are ignored: the
          // next tick retries.
        } finally {
          diskPollInFlight = false;
        }
      },

      async reloadTabFromDisk(path) {
        const language = get().settings.language;
        try {
          const content = await api.readText(path);
          set({
            tabs: get().tabs.map((item) =>
              item.path === path
                ? { ...item, content, saved: content, externalChange: false, missing: false }
                : item,
            ),
          });
          const [stamp] = await api.fileStamps([path]);
          set({
            diskStamps: {
              ...get().diskStamps,
              [path]: stamp && stamp.exists ? stamp.modifiedMs : null,
            },
          });
          if (basename(path) === "manifest.json") {
            const manifest = await readManifest(get().project?.path ?? "");
            const current = get().project;
            if (manifest && current) {
              set({
                project: { ...current, manifest, name: manifest.name, isQapp: manifest.format === "qapp" },
              });
            }
          }
          toast.success(translate(language, "sync.reloaded", { name: basename(path) }));
        } catch (error) {
          toast.error(errorMessage(error));
        }
      },

      dismissExternalChange(path) {
        set({
          tabs: get().tabs.map((item) =>
            item.path === path ? { ...item, externalChange: false } : item,
          ),
        });
      },

      async openFile(path) {
        const existing = get().tabs.find((tab) => tab.path === path);
        if (existing) {
          set({ activePath: path });
          return;
        }
        try {
          const content = await api.readText(path);
          const tab: EditorTab = {
            path,
            name: basename(path),
            content,
            saved: content,
            language: languageFor(path),
          };
          set({ tabs: [...get().tabs, tab], activePath: path });
          // Remember the on-disk mtime so the watcher only reacts to changes
          // made after the file was opened.
          const [stamp] = await api.fileStamps([path]);
          if (stamp) {
            set({
              diskStamps: { ...get().diskStamps, [path]: stamp.exists ? stamp.modifiedMs : null },
            });
          }
        } catch (error) {
          get().appendLog("stderr", translate(get().settings.language, "store.cannotOpen", {
            path,
            error: errorMessage(error),
          }));
          throw error;
        }
      },

      setActive(path) {
        set({ activePath: path });
      },

      updateTab(path, content) {
        set({
          tabs: get().tabs.map((tab) =>
            tab.path === path ? { ...tab, content } : tab,
          ),
        });
      },

      async saveActive() {
        const path = get().activePath;
        if (path) await get().saveFile(path);
      },

      async saveFile(path) {
        const tab = get().tabs.find((item) => item.path === path);
        if (!tab) return;
        if (tab.content === tab.saved) return;
        try {
          await api.writeText(path, tab.content);
          set({
            tabs: get().tabs.map((item) =>
              item.path === path
                ? { ...item, saved: item.content, externalChange: false, missing: false }
                : item,
            ),
          });
          const [stamp] = await api.fileStamps([path]);
          set({
            diskStamps: {
              ...get().diskStamps,
              [path]: stamp && stamp.exists ? stamp.modifiedMs : null,
            },
          });
          if (basename(path) === "manifest.json") {
            const manifest = await readManifest(get().project?.path ?? "");
            const current = get().project;
            if (manifest && current) {
              set({
                project: { ...current, manifest, name: manifest.name },
              });
            }
          }
        } catch (error) {
          get().appendLog("stderr", translate(get().settings.language, "store.cannotSave", {
            path,
            error: errorMessage(error),
          }));
          throw error;
        }
      },

      async saveAllDirty() {
        const dirty = get().tabs.filter((tab) => tab.content !== tab.saved);
        for (const tab of dirty) {
          try {
            await get().saveFile(tab.path);
          } catch {
            // saveFile already logged the failure; keep saving the rest.
          }
        }
      },

      closeTab(path) {
        const tab = get().tabs.find((item) => item.path === path);
        if (tab && tab.content !== tab.saved) {
          if (
            !window.confirm(
              translate(get().settings.language, "store.discardChanges", {
                name: tab.name,
              }),
            )
          ) {
            return;
          }
        }
        const tabs = get().tabs.filter((item) => item.path !== path);
        let activePath = get().activePath;
        if (activePath === path) {
          activePath = tabs.length ? tabs[Math.max(0, tabs.length - 1)].path : null;
        }
        set({ tabs, activePath });
      },

      async createProject(input) {
        const cli = get().cli;
        const language = get().settings.language;
        if (!cli?.ready) throw new Error(translate(language, "store.cliNotReady"));
        const name = slugify(input.name);
        const directory = input.directory.replace(/[\\/]+$/, "");
        if (!name) throw new Error(translate(language, "store.enterName"));
        if (!directory) throw new Error(translate(language, "store.chooseLocation"));
        // Scaffold exactly one folder below the chosen location: <location>/<name>.
        const projectPath = joinPath(directory, name);
        // The parent folder may not exist yet (for example the default projects
        // folder). Create it first so the CLI has a valid working directory.
        await api.ensureDirectory(directory);
        get().appendLog("system", `$ qapp create ${name} --dir ${projectPath}`);
        const result = await api.runCli(
          ["create", name, "--dir", projectPath],
          directory,
          get().settings.nodePath,
          get().settings.cliPath,
        );
        if (result.stdout) get().appendLog("stdout", result.stdout);
        if (result.stderr) get().appendLog("stderr", result.stderr);
        if (result.code !== 0) {
          throw new Error(result.stderr.trim() || translate(language, "store.createFailed"));
        }

        const manifestPath = joinPath(projectPath, "manifest.json");
        const raw = await api.readText(manifestPath);
        const manifest = JSON.parse(raw) as ProjectManifest;
        manifest.name = name;
        manifest.description = input.description;
        manifest.version = input.version;
        manifest.requestedPermissions = input.permissions;
        if (input.permissions.includes("network")) {
          manifest.networkDomains = input.networkDomains;
        } else {
          delete manifest.networkDomains;
        }
        await api.writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        await api.writeText(
          joinPath(projectPath, "src", "main.tsx"),
          TEMPLATE_LABELS[input.template].source,
        );
        get().appendLog("system", translate(language, "store.created", { path: projectPath }));
        await get().openProject(projectPath);
        return projectPath;
      },

      async buildProject(noTypecheck = false) {
        const project = get().project;
        const language = get().settings.language;
        if (!project) throw new Error(translate(language, "store.openFirst"));
        if (!get().cli?.ready) throw new Error(translate(language, "store.cliNotReadyShort"));
        // The CLI reads the files from disk: flush unsaved editors first.
        if (get().settings.autoSave) await get().saveAllDirty();
        set({
          buildStatus: "running",
          buildMessage: translate(
            language,
            noTypecheck ? "store.bundling" : "store.typechecking",
          ),
          bottomOpen: true,
          bottomTab: "output",
        });
        const args = ["build", "--dir", project.path];
        if (noTypecheck) args.push("--no-typecheck");
        get().appendLog("system", `$ qapp ${args.join(" ")}`);
        try {
          const result = await api.runCli(
            args,
            project.path,
            get().settings.nodePath,
            get().settings.cliPath,
          );
          if (result.stdout) get().appendLog("stdout", result.stdout);
          if (result.stderr) get().appendLog("stderr", result.stderr);
          const problems = outputProblems(result.stdout, result.stderr, "build");
          if (result.code !== 0) {
            set({
              buildStatus: "error",
              buildMessage: translate(language, "store.buildFailedCheck"),
              problems,
            });
            throw new Error(result.stderr.trim() || translate(language, "store.buildFailed"));
          }
          const artifacts = await api.listArtifacts(project.path);
          set({ artifacts, lastBuildAt: Date.now(), problems });
          const manifest = project.manifest;
          const expected = manifest
            ? `dist/${slugify(manifest.name)}-${manifest.version}.japp`.toLowerCase()
            : "";
          const match =
            artifacts.find((item) =>
              item.path.replace(/\\/g, "/").toLowerCase().endsWith(expected),
            ) ?? artifacts[0];
          if (match) {
            set({ activeArtifact: match.path, sidebarTab: "packages" });
            await get().inspectArtifact(match.path);
          }
          set({
            buildStatus: "success",
            buildMessage: match
              ? translate(language, "store.built", { name: match.name })
              : translate(language, "store.buildCompleted"),
          });
        } catch (error) {
          set({
            buildStatus: "error",
            buildMessage: errorMessage(error),
          });
          throw error;
        }
      },

      async runTests() {
        const project = get().project;
        const language = get().settings.language;
        if (!project) throw new Error(translate(language, "store.openFirst"));
        if (get().settings.autoSave) await get().saveAllDirty();
        set({ bottomOpen: true, bottomTab: "output", buildStatus: "running" });
        const args = ["test", "--dir", project.path];
        get().appendLog("system", `$ qapp ${args.join(" ")}`);
        try {
          const result = await api.runCli(
            args,
            project.path,
            get().settings.nodePath,
            get().settings.cliPath,
          );
          if (result.stdout) get().appendLog("stdout", result.stdout);
          if (result.stderr) get().appendLog("stderr", result.stderr);
          const problems = outputProblems(result.stdout, result.stderr, "test");
          set({ problems });
          if (result.code !== 0) {
            set({ buildStatus: "error", buildMessage: translate(language, "store.testsFailed") });
            throw new Error(result.stderr.trim() || translate(language, "store.testsFailed"));
          }
          set({ buildStatus: "success", buildMessage: translate(language, "store.testPassed") });
        } catch (error) {
          set({ buildStatus: "error", buildMessage: errorMessage(error) });
          throw error;
        }
      },

      async validateArtifact(path) {
        set({
          bottomOpen: true,
          bottomTab: "output",
          validation: { status: "running", text: "", at: null },
        });
        get().appendLog("system", `$ qapp validate ${path}`);
        const result = await api.runCli(
          ["validate", path],
          get().project?.path ?? "",
          get().settings.nodePath,
          get().settings.cliPath,
        );
        if (result.stdout) get().appendLog("stdout", result.stdout);
        if (result.stderr) get().appendLog("stderr", result.stderr);
        if (result.code === 0) {
          set({
            validation: {
              status: "pass",
              text: result.stdout.trim(),
              at: Date.now(),
            },
            problems: outputProblems(result.stdout, result.stderr, "validate"),
          });
        } else {
          const invalidPackage = translate(
            get().settings.language,
            "store.invalidPackage",
          );
          set({
            validation: {
              status: "fail",
              text: result.stderr.trim() || invalidPackage,
              at: Date.now(),
            },
            problems: outputProblems(result.stdout, result.stderr, "validate"),
          });
          throw new Error(result.stderr.trim() || invalidPackage);
        }
      },

      async inspectArtifact(path) {
        set({ inspecting: true, activeArtifact: path, sidebarTab: "packages" });
        try {
          const inspection = await inspectPackage(
            get().settings.cliPath,
            get().settings.nodePath,
            path,
          );
          set({ inspection, inspecting: false });
        } catch (error) {
          set({ inspecting: false });
          get().appendLog("stderr", errorMessage(error));
          throw error;
        }
      },

      async startDev() {
        const project = get().project;
        if (!project) throw new Error(translate(get().settings.language, "store.openFirst"));
        if (get().devRunning) return;
        if (get().settings.autoSave) await get().saveAllDirty();
        set({ bottomOpen: true, bottomTab: "output" });
        get().appendLog("system", `$ qapp dev --dir ${project.path}`);
        try {
          const pid = await api.startDev(
            project.path,
            get().settings.nodePath,
            get().settings.cliPath,
          );
          set({ devPid: pid, devRunning: true, buildStatus: "running" });
        } catch (error) {
          get().appendLog("stderr", errorMessage(error));
          throw error;
        }
      },

      async stopDev() {
        await api.stopDev();
        set({ devPid: null, devRunning: false, buildStatus: "idle" });
        get().appendLog("system", translate(get().settings.language, "store.devStopped"));
      },

      appendLog(stream, text) {
        const lines = text.replace(/\r\n/g, "\n").split("\n");
        while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
        if (!lines.length || (lines.length === 1 && !lines[0])) return;
        const entries = lines.map((line) => makeLog(stream, line));
        set({ logs: [...get().logs, ...entries].slice(-2500) });
      },

      clearLogs() {
        set({ logs: [] });
      },

      handleDevLog(event) {
        const lines = splitLines(event.line);
        for (const line of lines) get().appendLog(event.stream, line);
        if (/Built .+ in \d+ ms/.test(event.line)) {
          window.setTimeout(() => {
            void get().refreshArtifacts();
          }, 300);
        }
      },

      handleDevExit(event) {
        set({ devRunning: false, devPid: null });
        get().appendLog(
          event.code === 0 ? "system" : "stderr",
          translate(get().settings.language, "store.devExited", { code: event.code }),
        );
      },

      setBottomTab(tab) {
        set({ bottomTab: tab });
      },

      setSidebarTab(tab) {
        set({ sidebarTab: tab });
      },

      setSidebarOpen(open) {
        set({ sidebarOpen: open });
      },

      setBottomOpen(open) {
        set({ bottomOpen: open });
      },

      setPreviewOpen(open) {
        set({ previewOpen: open });
      },

      setCursor(line, column) {
        set({ cursor: { line, column } });
      },

      async runTerminal(command) {
        const trimmed = command.trim();
        if (!trimmed) return;
        const tokens = parseCommandLine(trimmed);
        if (!tokens.length) return;
        if (tokens[0] === "qapp" || tokens[0] === "qchat") tokens.shift();
        if (!tokens.length) {
          get().appendLog(
            "stderr",
            translate(get().settings.language, "store.typeCommand"),
          );
          return;
        }
        set({
          terminalHistory: [trimmed, ...get().terminalHistory].slice(0, 30),
          bottomTab: "output",
        });
        get().appendLog("system", `$ qapp ${tokens.join(" ")}`);
        try {
          const result = await api.runCli(
            tokens,
            get().project?.path ?? "",
            get().settings.nodePath,
            get().settings.cliPath,
          );
          if (result.stdout) get().appendLog("stdout", result.stdout);
          if (result.stderr) get().appendLog("stderr", result.stderr);
          set({ problems: outputProblems(result.stdout, result.stderr, "terminal") });
          if (tokens[0] === "build" || tokens[0] === "dev" || tokens[0] === "package") {
            await get().refreshArtifacts();
          }
          if (result.code !== 0) {
            get().appendLog(
              "system",
              translate(get().settings.language, "store.processExited", {
                code: result.code,
              }),
            );
          }
        } catch (error) {
          get().appendLog("stderr", errorMessage(error));
        }
      },

      async createEntry(parent, name, directory) {
        const path = joinPath(parent, name);
        await api.createEntry(path, directory);
        await get().refreshTree();
        if (!directory) await get().openFile(path);
      },

      async renameEntry(path, next) {
        const target = joinPath(dirname(path), next);
        await api.renameEntry(path, target);
        set({
          tabs: get().tabs.map((tab) =>
            tab.path === path
              ? {
                  ...tab,
                  path: target,
                  name: basename(target),
                  language: languageFor(target),
                }
              : tab,
          ),
          activePath: get().activePath === path ? target : get().activePath,
        });
        await get().refreshTree();
      },

      async deleteEntry(path) {
        await api.deleteEntry(path);
        set({
          tabs: get().tabs.filter((tab) => tab.path !== path),
          activePath:
            get().activePath === path ? null : get().activePath,
        });
        await get().refreshTree();
        await get().refreshArtifacts();
      },

      async saveManifest(manifest) {
        const project = get().project;
        if (!project) throw new Error(translate(get().settings.language, "store.openFirst"));
        await api.writeText(
          joinPath(project.path, "manifest.json"),
          `${JSON.stringify(manifest, null, 2)}\n`,
        );
        set({
          project: { ...project, manifest, name: manifest.name },
          tabs: get().tabs.map((tab) =>
            tab.name === "manifest.json"
              ? {
                  ...tab,
                  content: `${JSON.stringify(manifest, null, 2)}\n`,
                  saved: `${JSON.stringify(manifest, null, 2)}\n`,
                }
              : tab,
          ),
        });
        await get().refreshTree();
      },
    }),
    {
      name: "qchat-miniapp-studio",
      partialize: (state) => ({
        settings: state.settings,
        recent: state.recent,
        lastProject: state.lastProject,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(saved.settings ?? {}),
          },
        };
      },
    },
  ),
);

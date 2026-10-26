import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  FolderTree,
  Hammer,
  PanelBottom,
  PanelRight,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { api } from "../lib/api";
import { runAction } from "../lib/feedback";
import { cn } from "../lib/utils";
import type { StudioCommands } from "./TitleBar";

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void | Promise<unknown>;
  disabled?: boolean;
  group: string;
}

export function CommandPalette({
  open,
  onClose,
  commands: studio,
}: {
  open: boolean;
  onClose: () => void;
  commands: StudioCommands;
}) {
  const project = useStudio((state) => state.project);
  const cli = useStudio((state) => state.cli);
  const devRunning = useStudio((state) => state.devRunning);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const buildProject = useStudio((state) => state.buildProject);
  const runTests = useStudio((state) => state.runTests);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const refreshTree = useStudio((state) => state.refreshTree);
  const clearLogs = useStudio((state) => state.clearLogs);
  const setPreviewOpen = useStudio((state) => state.setPreviewOpen);
  const previewOpen = useStudio((state) => state.previewOpen);
  const setBottomOpen = useStudio((state) => state.setBottomOpen);
  const bottomOpen = useStudio((state) => state.bottomOpen);
  const sidebarOpen = useStudio((state) => state.sidebarOpen);
  const setSidebarOpen = useStudio((state) => state.setSidebarOpen);
  const setBottomTab = useStudio((state) => state.setBottomTab);

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const all = useMemo<Command[]>(() => {
    const canBuild = Boolean(project && cli?.ready);
    return [
      {
        id: "new",
        label: "New mini app",
        hint: "Scaffold a TSX project",
        icon: <FilePlus2 size={14} />,
        shortcut: "Ctrl N",
        group: "Project",
        run: studio.newProject,
      },
      {
        id: "open",
        label: "Open project",
        hint: "Choose a folder",
        icon: <FolderOpen size={14} />,
        shortcut: "Ctrl O",
        group: "Project",
        run: studio.openProject,
      },
      {
        id: "settings-project",
        label: "Edit project manifest",
        hint: "Name, version, permissions",
        icon: <Settings size={14} />,
        group: "Project",
        disabled: !project,
        run: studio.projectSettings,
      },
      {
        id: "build",
        label: "Build .japp package",
        hint: "Typecheck, bundle and verify",
        icon: <Hammer size={14} />,
        shortcut: "Ctrl B",
        group: "Build",
        disabled: !canBuild,
        run: () => runAction(() => buildProject(false), "Package built successfully"),
      },
      {
        id: "quick-build",
        label: "Build without typecheck",
        hint: "Faster bundle for iteration",
        icon: <Zap size={14} />,
        shortcut: "Ctrl ⇧ B",
        group: "Build",
        disabled: !canBuild,
        run: () => runAction(() => buildProject(true), "Bundle built"),
      },
      {
        id: "test",
        label: "Test runtime",
        hint: "Compile and dispatch a host event",
        icon: <FlaskConical size={14} />,
        shortcut: "Ctrl T",
        group: "Build",
        disabled: !canBuild,
        run: () => runAction(() => runTests(), "Runtime test passed"),
      },
      {
        id: "validate",
        label: "Validate package",
        hint: activeArtifact ? "Check the selected .japp" : "Choose a .japp to validate",
        icon: <ShieldCheck size={14} />,
        group: "Build",
        disabled: !canBuild,
        run: async () => {
          if (activeArtifact) {
            await runAction(() => validateArtifact(activeArtifact), "Package is valid");
            return;
          }
          const path = await api.pickPackage(project?.path);
          if (path) await runAction(() => validateArtifact(path), "Package is valid");
        },
      },
      {
        id: "dev",
        label: devRunning ? "Stop dev watcher" : "Start dev watcher",
        hint: "Rebuild on file changes",
        icon: devRunning ? <Square size={14} /> : <Play size={14} />,
        shortcut: "F5",
        group: "Run",
        disabled: !canBuild,
        run: () =>
          devRunning
            ? stopDev()
            : runAction(() => startDev(), "Dev watcher started"),
      },
      {
        id: "terminal",
        label: "Open terminal",
        hint: "Run qapp commands",
        icon: <TerminalSquare size={14} />,
        group: "Run",
        run: () => {
          setBottomOpen(true);
          setBottomTab("terminal");
        },
      },
      {
        id: "refresh",
        label: "Refresh explorer",
        hint: "Reload the project tree",
        icon: <RefreshCw size={14} />,
        group: "View",
        disabled: !project,
        run: () => refreshTree(),
      },
      {
        id: "preview",
        label: previewOpen ? "Hide device panel" : "Show device panel",
        hint: "Package and runtime summary",
        icon: <PanelRight size={14} />,
        group: "View",
        run: () => setPreviewOpen(!previewOpen),
      },
      {
        id: "bottom",
        label: bottomOpen ? "Hide output panel" : "Show output panel",
        hint: "Logs, problems and terminal",
        icon: <PanelBottom size={14} />,
        group: "View",
        run: () => setBottomOpen(!bottomOpen),
      },
      {
        id: "sidebar",
        label: sidebarOpen ? "Hide sidebar" : "Show sidebar",
        hint: "Explorer, build and packages",
        icon: <FolderTree size={14} />,
        group: "View",
        run: () => setSidebarOpen(!sidebarOpen),
      },
      {
        id: "clear",
        label: "Clear output",
        hint: "Remove all CLI logs",
        icon: <Trash2 size={14} />,
        group: "View",
        run: clearLogs,
      },
      {
        id: "settings",
        label: "Studio settings",
        hint: "CLI paths and editor preferences",
        icon: <Settings size={14} />,
        group: "Tools",
        run: studio.settings,
      },
      {
        id: "docs",
        label: "Open mini app documentation",
        hint: "Package format and runtime APIs",
        icon: <Boxes size={14} />,
        group: "Help",
        run: () =>
          api.openUrl(
            "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md",
          ),
      },
      {
        id: "about",
        label: "About QChat Studio",
        hint: "Version and runtime information",
        icon: <Sparkles size={14} />,
        group: "Help",
        run: studio.about,
      },
    ];
  }, [
    activeArtifact,
    bottomOpen,
    buildProject,
    clearLogs,
    devRunning,
    previewOpen,
    project,
    refreshTree,
    runTests,
    setBottomOpen,
    setBottomTab,
    setPreviewOpen,
    setSidebarOpen,
    sidebarOpen,
    startDev,
    stopDev,
    studio,
    validateArtifact,
    cli?.ready,
  ]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return all;
    return all.filter((command) =>
      `${command.label} ${command.hint} ${command.group}`.toLowerCase().includes(value),
    );
  }, [all, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const command = filtered[index];
        if (command && !command.disabled) {
          onClose();
          void command.run();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, index, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/55 px-6 pt-[14vh] backdrop-blur-[5px] animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="glass h-fit w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/10 shadow-panel animate-slide-up"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4">
          <Search size={15} className="shrink-0 text-studio-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[12.5px] text-studio-100 outline-none placeholder:text-studio-500"
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="max-h-[52vh] overflow-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-studio-500">
              <Wand2 size={13} /> No matching commands
            </div>
          ) : (
            filtered.map((command, itemIndex) => (
              <div key={command.id}>
                {itemIndex === 0 || filtered[itemIndex - 1].group !== command.group ? (
                  <div className="px-2 pb-1 pt-2 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-studio-600">
                    {command.group}
                  </div>
                ) : null}
                <button
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    itemIndex === index ? "bg-accent-500/[0.13] text-white" : "text-studio-300 hover:bg-white/[0.04]",
                    command.disabled && "opacity-40",
                  )}
                  onMouseEnter={() => setIndex(itemIndex)}
                  onClick={() => {
                    if (command.disabled) return;
                    onClose();
                    void command.run();
                  }}
                  disabled={command.disabled}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      itemIndex === index
                        ? "bg-accent-500/20 text-accent-300"
                        : "bg-white/[0.04] text-studio-500",
                    )}
                  >
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium">{command.label}</span>
                    <span className="block truncate text-[9px] text-studio-500">{command.hint}</span>
                  </span>
                  {command.shortcut ? <span className="kbd">{command.shortcut}</span> : null}
                  <X
                    size={10}
                    className={cn("text-studio-600 opacity-0", itemIndex === index && "opacity-100")}
                  />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex h-8 items-center justify-between border-t border-white/[0.06] px-3 text-[8.5px] text-studio-600">
          <span className="flex items-center gap-2">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
            <span className="kbd">↵</span> run
          </span>
          <span>{filtered.length} commands</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

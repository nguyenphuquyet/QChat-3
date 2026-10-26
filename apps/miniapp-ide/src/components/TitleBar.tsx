import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Boxes,
  ChevronDown,
  CircleHelp,
  Command,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  FolderTree,
  Hammer,
  Info,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Play,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  TerminalSquare,
  Wand2,
  X,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { runAction } from "../lib/feedback";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export interface StudioCommands {
  newProject: () => void;
  openProject: () => void;
  settings: () => void;
  projectSettings: () => void;
  about: () => void;
  palette: () => void;
}

function Menu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={cn(
          "rounded px-2 py-1 text-[11.5px] font-medium text-studio-300 transition hover:bg-white/[0.06] hover:text-white",
          open && "bg-white/[0.07] text-white",
        )}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div
          className="glass absolute left-0 top-full z-40 mt-1 w-60 rounded-xl border border-white/10 p-1.5 shadow-panel animate-slide-up"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Item({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={cn("menu-item", danger && "text-rose-300 hover:text-rose-200")}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex w-4 shrink-0 justify-center text-studio-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut ? <span className="kbd">{shortcut}</span> : null}
    </button>
  );
}

export function TitleBar({ commands }: { commands: StudioCommands }) {
  const project = useStudio((state) => state.project);
  const cli = useStudio((state) => state.cli);
  const settings = useStudio((state) => state.settings);
  const devRunning = useStudio((state) => state.devRunning);
  const buildStatus = useStudio((state) => state.buildStatus);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const sidebarTab = useStudio((state) => state.sidebarTab);
  const sidebarOpen = useStudio((state) => state.sidebarOpen);
  const bottomOpen = useStudio((state) => state.bottomOpen);
  const previewOpen = useStudio((state) => state.previewOpen);
  const setSidebarTab = useStudio((state) => state.setSidebarTab);
  const setSidebarOpen = useStudio((state) => state.setSidebarOpen);
  const setBottomOpen = useStudio((state) => state.setBottomOpen);
  const setPreviewOpen = useStudio((state) => state.setPreviewOpen);
  const buildProject = useStudio((state) => state.buildProject);
  const runTests = useStudio((state) => state.runTests);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const refreshTree = useStudio((state) => state.refreshTree);
  const clearLogs = useStudio((state) => state.clearLogs);
  const saveActive = useStudio((state) => state.saveActive);
  const closeProject = useStudio((state) => state.closeProject);
  const detect = useStudio((state) => state.detect);

  const canBuild = Boolean(project && cli?.ready);
  const running = buildStatus === "running";

  const build = (noTypecheck = false) =>
    void runAction(
      () => buildProject(noTypecheck),
      noTypecheck ? "Bundle built without typecheck" : "Package built successfully",
    );

  const test = () => void runAction(() => runTests(), "Runtime test passed");

  const toggleDev = () => {
    if (devRunning) {
      void stopDev();
    } else {
      void runAction(() => startDev(), "Dev watcher started");
    }
  };

  const validate = () => {
    if (activeArtifact) {
      void runAction(() => validateArtifact(activeArtifact), "Package is valid");
      return;
    }
    void api.pickPackage(project?.path).then((path) => {
      if (path) void runAction(() => validateArtifact(path), "Package is valid");
    });
  };

  return (
    <header className="relative z-30 shrink-0 border-b border-white/[0.065] bg-studio-950/80 backdrop-blur-xl">
      <div className="flex h-8 items-center gap-1 border-b border-white/[0.045] px-2">
        <div className="mr-2 flex items-center gap-2 pl-1">
          <div className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-accent-400 via-accent-600 to-cyan-400 shadow-glow">
            <TerminalSquare size={12} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-studio-100">
            QChat <span className="text-studio-400">Studio</span>
          </span>
        </div>

        <Menu label="File">
          <Item icon={<FilePlus2 size={13} />} label="New Mini App…" shortcut="Ctrl N" onClick={commands.newProject} />
          <Item icon={<FolderOpen size={13} />} label="Open Project…" shortcut="Ctrl O" onClick={commands.openProject} />
          <div className="menu-separator" />
          <Item icon={<Save size={13} />} label="Save" shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<X size={13} />} label="Close Project" onClick={closeProject} disabled={!project} />
        </Menu>

        <Menu label="Edit">
          <Item icon={<Save size={13} />} label="Save Active File" shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <Item icon={<RefreshCw size={13} />} label="Refresh Explorer" onClick={() => void refreshTree()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<Wand2 size={13} />} label="Command Palette…" shortcut="Ctrl K" onClick={commands.palette} />
        </Menu>

        <Menu label="View">
          <Item icon={<PanelLeft size={13} />} label="Toggle Sidebar" onClick={() => setSidebarOpen(!sidebarOpen)} />
          <Item icon={<PanelRight size={13} />} label="Toggle Device Panel" onClick={() => setPreviewOpen(!previewOpen)} />
          <Item icon={<PanelBottom size={13} />} label="Toggle Output Panel" onClick={() => setBottomOpen(!bottomOpen)} />
          <div className="menu-separator" />
          <Item icon={<Boxes size={13} />} label="Project Explorer" onClick={() => setSidebarTab("project")} />
          <Item icon={<Hammer size={13} />} label="Build Overview" onClick={() => setSidebarTab("build")} />
          <Item icon={<ShieldCheck size={13} />} label="Packages" onClick={() => setSidebarTab("packages")} />
        </Menu>

        <Menu label="Build">
          <Item icon={<Hammer size={13} />} label="Build .japp" shortcut="Ctrl B" onClick={() => build(false)} disabled={!canBuild || running} />
          <Item icon={<Hammer size={13} />} label="Build without typecheck" shortcut="Ctrl ⇧ B" onClick={() => build(true)} disabled={!canBuild || running} />
          <div className="menu-separator" />
          <Item icon={<FlaskConical size={13} />} label="Test Runtime" shortcut="Ctrl T" onClick={test} disabled={!canBuild || running} />
          <Item icon={<ShieldCheck size={13} />} label="Validate Package" onClick={validate} disabled={!canBuild} />
          <div className="menu-separator" />
          <Item icon={<FolderTree size={13} />} label="Reveal Build Folder" onClick={() => project && void api.reveal(`${project.path}/dist`)} disabled={!project} />
        </Menu>

        <Menu label="Run">
          <Item
            icon={devRunning ? <Square size={13} /> : <Play size={13} />}
            label={devRunning ? "Stop Dev Watcher" : "Start Dev Watcher"}
            shortcut="F5"
            onClick={toggleDev}
            disabled={!canBuild}
          />
          <Item icon={<TerminalSquare size={13} />} label="Open Terminal" onClick={() => setBottomOpen(true)} />
          <Item icon={<RefreshCw size={13} />} label="Re-detect CLI" onClick={() => void detect()} />
        </Menu>

        <Menu label="Tools">
          <Item icon={<Settings size={13} />} label="CLI & Studio Settings…" onClick={commands.settings} />
          <Item icon={<Sparkles size={13} />} label="Project Settings…" onClick={commands.projectSettings} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<RefreshCw size={13} />} label="Refresh Explorer" onClick={() => void refreshTree()} disabled={!project} />
          <Item icon={<X size={13} />} label="Clear Output" onClick={clearLogs} />
        </Menu>

        <Menu label="Help">
          <Item icon={<BookOpen size={13} />} label="Mini App Documentation" onClick={() => void api.openUrl("https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md")} />
          <Item icon={<CircleHelp size={13} />} label="Package Format" onClick={() => void api.openUrl("https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md#package-format")} />
          <div className="menu-separator" />
          <Item icon={<Info size={13} />} label="About QChat Studio" onClick={commands.about} />
        </Menu>

        <div className="ml-auto flex items-center gap-2 pr-1">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              cli?.ready
                ? "border-mint-400/20 bg-mint-400/10 text-mint-400"
                : "border-amber-400/20 bg-amber-400/10 text-amber-300",
            )}
            title={cli?.error || cli?.cliPath || "CLI status"}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cli?.ready ? "bg-mint-400" : "bg-amber-400", !cli?.ready && "animate-pulse")} />
            {cli?.ready ? `CLI ${cli.cliVersion?.split(" ")[0] ?? ""}` : "CLI missing"}
          </span>
          <span className="text-[10px] text-studio-500">v1.0.0</span>
        </div>
      </div>

      <div className="flex h-[46px] items-center gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-studio-300">
            <FolderTree size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[12.5px] font-semibold text-studio-100">
                {project?.name ?? "No project open"}
              </span>
              {project?.manifest ? (
                <span className="chip chip-accent text-[9px]">v{project.manifest.version}</span>
              ) : null}
            </div>
            <div className="max-w-[330px] truncate font-mono text-[9.5px] text-studio-500">
              {project?.path ?? "Create a mini app or open a folder to begin"}
            </div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-white/[0.065]" />

        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-primary h-7 px-3"
            onClick={() => build(false)}
            disabled={!canBuild || running}
            title="Build a .japp package (Ctrl+B)"
          >
            {running ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Hammer size={13} />
            )}
            Build
            <span className="kbd ml-1 border-white/20 bg-white/10 text-white/80">⌘B</span>
          </button>
          <button
            className="btn btn-secondary h-7 px-2"
            onClick={() => build(true)}
            disabled={!canBuild || running}
            title="Skip TypeScript check while bundling"
          >
            <Hammer size={12} />
            <span className="hidden 2xl:inline">Quick build</span>
          </button>
          <button
            className={cn("btn h-7 px-3", devRunning ? "btn-danger" : "btn-secondary")}
            onClick={toggleDev}
            disabled={!canBuild}
            title="Toggle dev watcher (F5)"
          >
            {devRunning ? <Square size={12} /> : <Play size={12} />}
            {devRunning ? "Stop" : "Dev"}
          </button>
          <button
            className="btn btn-secondary h-7 px-2"
            onClick={test}
            disabled={!canBuild || running}
            title="Compile and run a host event test (Ctrl+T)"
          >
            <FlaskConical size={12} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="flex h-7 items-center gap-2 rounded-lg border border-white/[0.075] bg-white/[0.03] px-2.5 text-[11px] text-studio-400 transition hover:border-white/15 hover:text-studio-200"
            onClick={commands.palette}
            title="Command palette (Ctrl+K)"
          >
            <Command size={12} />
            <span className="hidden md:inline">Commands</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <button
            className={cn("icon-btn", previewOpen && "bg-white/[0.07] text-white")}
            onClick={() => setPreviewOpen(!previewOpen)}
            title="Toggle device panel"
          >
            <PanelRight size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={commands.settings}
            title="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

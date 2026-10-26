import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  FolderTree,
  Hammer,
  Info,
  Languages,
  Moon,
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
  Sun,
  TerminalSquare,
  Wand2,
  X,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { runAction } from "../lib/feedback";
import { api } from "../lib/api";
import { LANGUAGES } from "../lib/i18n";
import { useI18n } from "../lib/useI18n";
import { cn } from "../lib/utils";
import { WindowControls, useWindowDrag } from "./WindowChrome";

export interface StudioCommands {
  newProject: () => void;
  openProject: () => void;
  settings: () => void;
  projectSettings: () => void;
  about: () => void;
  palette: () => void;
  /** Opens the in-app developer documentation, optionally on a section id. */
  docs: (docId?: string) => void;
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
  const updateSettings = useStudio((state) => state.updateSettings);
  const drag = useWindowDrag();
  const { t } = useI18n();
  const language = settings.language;
  const theme = settings.theme;

  const canBuild = Boolean(project && cli?.ready);
  const running = buildStatus === "running";

  const build = (noTypecheck = false) =>
    void runAction(
      () => buildProject(noTypecheck),
      noTypecheck ? t("common.bundleBuilt") : t("common.packageBuilt"),
    );

  const test = () => void runAction(() => runTests(), t("common.runtimePassed"));

  const toggleDev = () => {
    if (devRunning) {
      void stopDev();
    } else {
      void runAction(() => startDev(), t("common.devStarted"));
    }
  };

  const validate = () => {
    if (activeArtifact) {
      void runAction(() => validateArtifact(activeArtifact), t("common.packageValid"));
      return;
    }
    void api.pickPackage(project?.path).then((path) => {
      if (path)
        void runAction(() => validateArtifact(path), t("common.packageValid"));
    });
  };

  return (
    <header className="relative z-30 shrink-0 border-b border-white/[0.065] bg-studio-950/80 backdrop-blur-xl">
      <div
        className="flex h-9 items-center gap-1 border-b border-white/[0.045] pl-2 pr-0"
        {...drag}
      >
        <div className="mr-2 flex items-center gap-2 pl-1">
          <div className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-accent-400 via-accent-600 to-cyan-400 shadow-glow" data-keep-white>
            <TerminalSquare size={12} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-studio-100">
            QChat <span className="text-studio-400">Studio</span>
          </span>
        </div>

        <Menu label={t("menu.file")}>
          <Item icon={<FilePlus2 size={13} />} label={t("title.newProject")} shortcut="Ctrl N" onClick={commands.newProject} />
          <Item icon={<FolderOpen size={13} />} label={t("title.openProject")} shortcut="Ctrl O" onClick={commands.openProject} />
          <div className="menu-separator" />
          <Item icon={<Save size={13} />} label={t("title.save")} shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<X size={13} />} label={t("title.closeProject")} onClick={closeProject} disabled={!project} />
        </Menu>

        <Menu label={t("menu.edit")}>
          <Item icon={<Save size={13} />} label={t("title.saveActive")} shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <Item icon={<RefreshCw size={13} />} label={t("title.refreshExplorer")} onClick={() => void refreshTree()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<Wand2 size={13} />} label={t("title.commandPalette")} shortcut="Ctrl K" onClick={commands.palette} />
        </Menu>

        <Menu label={t("menu.view")}>
          <Item icon={<PanelLeft size={13} />} label={t("title.toggleSidebar")} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <Item icon={<PanelRight size={13} />} label={t("title.toggleDevice")} onClick={() => setPreviewOpen(!previewOpen)} />
          <Item icon={<PanelBottom size={13} />} label={t("title.toggleOutput")} onClick={() => setBottomOpen(!bottomOpen)} />
          <div className="menu-separator" />
          <Item icon={<Boxes size={13} />} label={t("title.projectExplorer")} onClick={() => setSidebarTab("project")} />
          <Item icon={<Hammer size={13} />} label={t("title.buildOverview")} onClick={() => setSidebarTab("build")} />
          <Item icon={<ShieldCheck size={13} />} label={t("title.packages")} onClick={() => setSidebarTab("packages")} />
        </Menu>

        <Menu label={t("menu.build")}>
          <Item icon={<Hammer size={13} />} label={t("title.buildJapp")} shortcut="Ctrl B" onClick={() => build(false)} disabled={!canBuild || running} />
          <Item icon={<Hammer size={13} />} label={t("title.buildNoTypecheck")} shortcut="Ctrl ⇧ B" onClick={() => build(true)} disabled={!canBuild || running} />
          <div className="menu-separator" />
          <Item icon={<FlaskConical size={13} />} label={t("title.testRuntime")} shortcut="Ctrl T" onClick={test} disabled={!canBuild || running} />
          <Item icon={<ShieldCheck size={13} />} label={t("title.validatePackage")} onClick={validate} disabled={!canBuild} />
          <div className="menu-separator" />
          <Item icon={<FolderTree size={13} />} label={t("title.revealDist")} onClick={() => project && void api.reveal(`${project.path}/dist`)} disabled={!project} />
        </Menu>

        <Menu label={t("menu.run")}>
          <Item
            icon={devRunning ? <Square size={13} /> : <Play size={13} />}
            label={devRunning ? t("title.stopDev") : t("title.startDev")}
            shortcut="F5"
            onClick={toggleDev}
            disabled={!canBuild}
          />
          <Item icon={<TerminalSquare size={13} />} label={t("title.openTerminal")} onClick={() => setBottomOpen(true)} />
          <Item icon={<RefreshCw size={13} />} label={t("title.redetectCli")} onClick={() => void detect()} />
        </Menu>

        <Menu label={t("menu.tools")}>
          <Item icon={<Settings size={13} />} label={t("title.cliSettings")} onClick={commands.settings} />
          <Item icon={<Sparkles size={13} />} label={t("title.projectSettings")} onClick={commands.projectSettings} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<RefreshCw size={13} />} label={t("title.refreshExplorer")} onClick={() => void refreshTree()} disabled={!project} />
          <Item icon={<X size={13} />} label={t("title.clearOutput")} onClick={clearLogs} />
        </Menu>

        <Menu label={t("menu.help")}>
          <Item icon={<BookOpen size={13} />} label={t("title.docs")} onClick={() => commands.docs()} />
          <Item icon={<CircleHelp size={13} />} label={t("title.packageFormat")} onClick={() => commands.docs("miniapps")} />
          <div className="menu-separator" />
          <Item icon={<Info size={13} />} label={t("title.about")} onClick={commands.about} />
        </Menu>

        <div className="ml-auto flex items-center gap-2 pl-3 pr-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              cli?.ready
                ? "border-mint-400/20 bg-mint-400/10 text-mint-400"
                : "border-amber-400/20 bg-amber-400/10 text-amber-300",
            )}
            title={cli?.error || cli?.cliPath || t("title.cliStatus")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", cli?.ready ? "bg-mint-400" : "bg-amber-400", !cli?.ready && "animate-pulse")} />
            {cli?.ready ? `CLI ${cli.cliVersion?.split(" ")[0] ?? ""}` : t("title.cliMissing")}
          </span>
          <span className="text-[10px] text-studio-500">v1.0.0</span>
        </div>
        <WindowControls className="ml-1" />
      </div>

      <div className="flex h-[46px] items-center gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2" {...drag}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-studio-300">
            <FolderTree size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[12.5px] font-semibold text-studio-100">
                {project?.name ?? t("title.noProject")}
              </span>
              {project?.manifest ? (
                <span className="chip chip-accent text-[9px]">v{project.manifest.version}</span>
              ) : null}
            </div>
            <div className="max-w-[330px] truncate font-mono text-[9.5px] text-studio-500">
              {project?.path ?? t("title.hint")}
            </div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-white/[0.065]" />

        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-primary h-7 px-3"
            onClick={() => build(false)}
            disabled={!canBuild || running}
            title={t("title.buildTitle")}
          >
            {running ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Hammer size={13} />
            )}
            {t("common.build")}
            <span className="kbd ml-1 border-white/20 bg-white/10 text-white/80">⌘B</span>
          </button>
          <button
            className="btn btn-secondary h-7 px-2"
            onClick={() => build(true)}
            disabled={!canBuild || running}
            title={t("title.quickBuildTitle")}
          >
            <Hammer size={12} />
            <span className="hidden 2xl:inline">{t("title.quickBuild")}</span>
          </button>
          <button
            className={cn("btn h-7 px-3", devRunning ? "btn-danger" : "btn-secondary")}
            onClick={toggleDev}
            disabled={!canBuild}
            title={t("title.devTitle")}
          >
            {devRunning ? <Square size={12} /> : <Play size={12} />}
            {devRunning ? t("common.stop") : t("common.dev")}
          </button>
          <button
            className="btn btn-secondary h-7 px-2"
            onClick={test}
            disabled={!canBuild || running}
            title={t("title.testTitle")}
          >
            <FlaskConical size={12} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            className="flex h-7 items-center gap-2 rounded-lg border border-white/[0.075] bg-white/[0.03] px-2.5 text-[11px] text-studio-400 transition hover:border-white/15 hover:text-studio-200"
            onClick={commands.palette}
            title={t("title.paletteTitle")}
          >
            <Command size={12} />
            <span className="hidden md:inline">{t("title.commands")}</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <Menu label={LANGUAGES.find((item) => item.id === language)?.short ?? "VI"}>
            <div className="px-2 pb-1 pt-1.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-studio-600">
              {t("title.language")}
            </div>
            {LANGUAGES.map((item) => (
              <Item
                key={item.id}
                icon={
                  item.id === language ? (
                    <Check size={13} className="text-accent-300" />
                  ) : (
                    <Languages size={13} />
                  )
                }
                label={item.label}
                onClick={() => updateSettings({ language: item.id })}
              />
            ))}
          </Menu>
          <button
            className="icon-btn"
            onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
            title={theme === "dark" ? t("title.switchToLight") : t("title.switchToDark")}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className={cn("icon-btn", previewOpen && "bg-white/[0.07] text-white")}
            onClick={() => setPreviewOpen(!previewOpen)}
            title={t("title.toggleDeviceTitle")}
          >
            <PanelRight size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={commands.settings}
            title={t("common.settings")}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

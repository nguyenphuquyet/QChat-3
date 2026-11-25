import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Boxes,
  Check,
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
  Search,
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

/** Only one menu bar dropdown may be open at a time. */
const MenuContext = createContext<{
  open: string | null;
  setOpen: (id: string | null) => void;
}>({ open: null, setOpen: () => {} });

function Menu({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const { open: openId, setOpen } = useContext(MenuContext);
  const open = openId === id;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative h-full" ref={ref}>
      <button
        className={cn(
          "h-full px-2 text-[12px] text-studio-200 transition-colors hover:bg-white/[0.08]",
          open && "bg-white/[0.1]",
        )}
        onClick={() => setOpen(open ? null : id)}
        onMouseEnter={() => {
          // Once a menu is open, hovering the neighbours switches to them,
          // exactly like a desktop menu bar.
          if (openId !== null && openId !== id) setOpen(id);
        }}
      >
        {label}
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-40 min-w-[230px] border border-white/10 bg-studio-900 p-1 shadow-panel animate-slide-up"
          onClick={() => setOpen(null)}
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
      className={cn("menu-item", danger && "text-rose-300 hover:text-white")}
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
  const sidebarTab = useStudio((state) => state.sidebarTab);
  const sidebarOpen = useStudio((state) => state.sidebarOpen);
  const bottomOpen = useStudio((state) => state.bottomOpen);
  const previewOpen = useStudio((state) => state.previewOpen);
  const setSidebarTab = useStudio((state) => state.setSidebarTab);
  const setSidebarOpen = useStudio((state) => state.setSidebarOpen);
  const setBottomOpen = useStudio((state) => state.setBottomOpen);
  const setPreviewOpen = useStudio((state) => state.setPreviewOpen);
  const buildProject = useStudio((state) => state.buildProject);
  const validateProject = useStudio((state) => state.validateProject);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const canBuild = Boolean(project && cli?.ready);
  const running = buildStatus === "running";

  const build = () =>
    void runAction(
      () => buildProject(),
      t("common.packageBuilt"),
    );

  const toggleDev = () => {
    if (devRunning) {
      void stopDev();
    } else {
      void runAction(() => startDev(), t("common.devStarted"));
    }
  };

  const validate = () =>
    void runAction(() => validateProject(), t("common.projectValid"));

  /** Compact icon button used by the title bar tool groups. */
  const tool = (
    key: string,
    icon: ReactNode,
    title: string,
    onClick: () => void,
    options: { disabled?: boolean; active?: boolean; danger?: boolean } = {},
  ) => (
    <button
      key={key}
      className={cn(
        "flex h-[26px] min-w-[26px] items-center justify-center gap-1.5 rounded-[3px] px-1.5 text-[11px] transition-colors",
        options.disabled
          ? "cursor-not-allowed text-studio-500"
          : options.active
            ? "bg-white/[0.12] text-studio-100"
            : options.danger
              ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
              : "text-studio-300 hover:bg-white/[0.08] hover:text-studio-100",
      )}
      onClick={onClick}
      disabled={options.disabled}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );

  return (
    <MenuContext.Provider value={{ open: openMenu, setOpen: setOpenMenu }}>
    <header
      className="relative z-30 flex h-9 shrink-0 items-stretch border-b border-white/[0.07] bg-studio-750"
      {...drag}
    >
      {/* App mark */}
      <div className="flex shrink-0 items-center pl-2.5 pr-1.5">
        <div
          className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-accent-500"
          data-keep-white
          title="QChat Mini App Studio"
        >
          <TerminalSquare size={11} className="text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Menu bar */}
      <div className="flex h-full shrink-0 items-stretch">
        <Menu id="file" label={t("menu.file")}>
          <Item icon={<FilePlus2 size={13} />} label={t("title.newProject")} shortcut="Ctrl N" onClick={commands.newProject} />
          <Item icon={<FolderOpen size={13} />} label={t("title.openProject")} shortcut="Ctrl O" onClick={commands.openProject} />
          <div className="menu-separator" />
          <Item icon={<Save size={13} />} label={t("title.save")} shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<X size={13} />} label={t("title.closeProject")} onClick={closeProject} disabled={!project} />
        </Menu>

        <Menu id="edit" label={t("menu.edit")}>
          <Item icon={<Save size={13} />} label={t("title.saveActive")} shortcut="Ctrl S" onClick={() => void saveActive()} disabled={!project} />
          <Item icon={<RefreshCw size={13} />} label={t("title.refreshExplorer")} onClick={() => void refreshTree()} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<Wand2 size={13} />} label={t("title.commandPalette")} shortcut="Ctrl K" onClick={commands.palette} />
        </Menu>

        <Menu id="view" label={t("menu.view")}>
          <Item icon={<PanelLeft size={13} />} label={t("title.toggleSidebar")} onClick={() => setSidebarOpen(!sidebarOpen)} />
          <Item icon={<PanelBottom size={13} />} label={t("title.toggleOutput")} onClick={() => setBottomOpen(!bottomOpen)} />
          <Item icon={<PanelRight size={13} />} label={t("title.toggleDevice")} onClick={() => setPreviewOpen(!previewOpen)} />
          <div className="menu-separator" />
          <Item icon={<Boxes size={13} />} label={t("title.projectExplorer")} onClick={() => setSidebarTab("project")} />
          <Item icon={<Hammer size={13} />} label={t("title.buildOverview")} onClick={() => setSidebarTab("build")} />
          <Item icon={<ShieldCheck size={13} />} label={t("title.packages")} onClick={() => setSidebarTab("packages")} />
          <div className="menu-separator" />
          <Item
            icon={theme === "dark" ? <Moon size={13} /> : <Sun size={13} />}
            label={theme === "dark" ? t("title.switchToLight") : t("title.switchToDark")}
            onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
          />
        </Menu>

        <Menu id="build" label={t("menu.build")}>
          <Item icon={<Hammer size={13} />} label={t("title.buildJapp")} shortcut="Ctrl B" onClick={build} disabled={!canBuild || running} />
          <div className="menu-separator" />
          <Item icon={<ShieldCheck size={13} />} label={t("build.validateProject")} shortcut="Ctrl T" onClick={validate} disabled={!canBuild || running} />
          <div className="menu-separator" />
          <Item icon={<FolderTree size={13} />} label={t("title.revealDist")} onClick={() => project && void api.reveal(`${project.path}/dist`)} disabled={!project} />
        </Menu>

        <Menu id="run" label={t("menu.run")}>
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

        <Menu id="tools" label={t("menu.tools")}>
          <Item icon={<Settings size={13} />} label={t("title.cliSettings")} onClick={commands.settings} />
          <Item icon={<Sparkles size={13} />} label={t("title.projectSettings")} onClick={commands.projectSettings} disabled={!project} />
          <div className="menu-separator" />
          <Item icon={<RefreshCw size={13} />} label={t("title.refreshExplorer")} onClick={() => void refreshTree()} disabled={!project} />
          <Item icon={<X size={13} />} label={t("title.clearOutput")} onClick={clearLogs} />
        </Menu>

        <Menu id="help" label={t("menu.help")}>
          <Item icon={<BookOpen size={13} />} label={t("title.docs")} onClick={() => commands.docs()} />
          <Item icon={<CircleHelp size={13} />} label={t("title.packageFormat")} onClick={() => commands.docs("miniapps")} />
          <div className="menu-separator" />
          <Item icon={<Info size={13} />} label={t("title.about")} onClick={commands.about} />
        </Menu>
      </div>

      {/* Command center */}
      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        <button
          className="flex h-[22px] w-full max-w-[520px] items-center justify-center gap-2 rounded-[4px] border border-white/10 bg-white/[0.06] px-2.5 text-[11px] text-studio-300 transition-colors hover:border-white/20 hover:text-studio-200"
          onClick={commands.palette}
          title={project?.path ?? t("title.hint")}
        >
          <Search size={11} className="shrink-0" />
          <span className="truncate">
            {project
              ? `${project.name}${project.manifest ? ` · v${project.manifest.version}` : ""}`
              : t("title.noProject")}
          </span>
          <span className="kbd ml-1 shrink-0">Ctrl K</span>
        </button>
      </div>

      {/* Build / run tools */}
      <div className="flex shrink-0 items-center gap-1 px-1">
        <button
          className={cn(
            "flex h-[26px] items-center gap-1.5 rounded-[3px] px-2 text-[11px] font-medium transition-colors",
            canBuild && !running
              ? "bg-accent-500 text-white hover:bg-accent-600"
              : "cursor-not-allowed bg-accent-500/40 text-white/60",
          )}
          onClick={() => build()}
          disabled={!canBuild || running}
          title={t("title.buildTitle")}
        >
          {running ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Hammer size={13} />
          )}
          {t("common.build")}
        </button>
        {tool("dev", devRunning ? <Square size={13} /> : <Play size={13} />, devRunning ? t("title.stopDev") : t("title.devTitle"), toggleDev, {
          disabled: !canBuild,
          danger: devRunning,
        })}
        {tool("validate", <ShieldCheck size={13} />, t("build.validateProject"), validate, { disabled: !canBuild || running })}
      </div>

      {/* Right side: CLI status, language, theme, layout, settings */}
      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        <button
          className="flex h-[26px] items-center gap-1.5 rounded-[3px] px-1.5 text-[10px] text-studio-300 hover:bg-white/[0.08]"
          onClick={commands.settings}
          title={cli?.error || cli?.cliPath || t("title.cliStatus")}
        >
          <span
            className={cn("h-2 w-2 rounded-full", cli?.ready ? "bg-mint-400" : "bg-amber-400")}
          />
          <span className="hidden 2xl:inline">
            {cli?.ready ? `CLI ${cli.cliVersion?.split(" ")[0] ?? ""}` : t("title.cliMissing")}
          </span>
        </button>

        <Menu id="language" label={LANGUAGES.find((item) => item.id === language)?.short ?? "VI"}>
          <div className="px-2 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-studio-500">
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

        {tool("theme", theme === "dark" ? <Sun size={14} /> : <Moon size={14} />, theme === "dark" ? t("title.switchToLight") : t("title.switchToDark"), () =>
          updateSettings({ theme: theme === "dark" ? "light" : "dark" }),
        )}
        {tool("sidebar", <PanelLeft size={14} />, t("title.toggleSidebar"), () => setSidebarOpen(!sidebarOpen), { active: sidebarOpen })}
        {tool("panel", <PanelBottom size={14} />, t("title.toggleOutput"), () => setBottomOpen(!bottomOpen), { active: bottomOpen })}
        {tool("preview", <PanelRight size={14} />, t("title.toggleDeviceTitle"), () => setPreviewOpen(!previewOpen), { active: previewOpen })}
        {tool("settings", <Settings size={14} />, t("common.settings"), commands.settings)}
        {tool("palette", <Command size={14} />, t("title.paletteTitle"), commands.palette)}
      </div>

      <WindowControls />
    </header>
    </MenuContext.Provider>
  );
}

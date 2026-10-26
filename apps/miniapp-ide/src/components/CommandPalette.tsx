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
import { useI18n } from "../lib/useI18n";
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
  const { t } = useI18n();

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const all = useMemo<Command[]>(() => {
    const canBuild = Boolean(project && cli?.ready);
    return [
      {
        id: "new",
        label: t("palette.new"),
        hint: t("palette.newHint"),
        icon: <FilePlus2 size={14} />,
        shortcut: "Ctrl N",
        group: t("palette.groupProject"),
        run: studio.newProject,
      },
      {
        id: "open",
        label: t("palette.open"),
        hint: t("palette.openHint"),
        icon: <FolderOpen size={14} />,
        shortcut: "Ctrl O",
        group: t("palette.groupProject"),
        run: studio.openProject,
      },
      {
        id: "settings-project",
        label: t("palette.editManifest"),
        hint: t("palette.editManifestHint"),
        icon: <Settings size={14} />,
        group: t("palette.groupProject"),
        disabled: !project,
        run: studio.projectSettings,
      },
      {
        id: "build",
        label: t("palette.build"),
        hint: t("palette.buildHint"),
        icon: <Hammer size={14} />,
        shortcut: "Ctrl B",
        group: t("palette.groupBuild"),
        disabled: !canBuild,
        run: () => runAction(() => buildProject(false), t("common.packageBuilt")),
      },
      {
        id: "quick-build",
        label: t("palette.quickBuild"),
        hint: t("palette.quickBuildHint"),
        icon: <Zap size={14} />,
        shortcut: "Ctrl ⇧ B",
        group: t("palette.groupBuild"),
        disabled: !canBuild,
        run: () => runAction(() => buildProject(true), t("common.bundleBuilt")),
      },
      {
        id: "test",
        label: t("palette.test"),
        hint: t("palette.testHint"),
        icon: <FlaskConical size={14} />,
        shortcut: "Ctrl T",
        group: t("palette.groupBuild"),
        disabled: !canBuild,
        run: () => runAction(() => runTests(), t("common.runtimePassed")),
      },
      {
        id: "validate",
        label: t("palette.validate"),
        hint: activeArtifact ? t("palette.validateHintSelected") : t("palette.validateHintPick"),
        icon: <ShieldCheck size={14} />,
        group: t("palette.groupBuild"),
        disabled: !canBuild,
        run: async () => {
          if (activeArtifact) {
            await runAction(() => validateArtifact(activeArtifact), t("common.packageValid"));
            return;
          }
          const path = await api.pickPackage(project?.path);
          if (path) await runAction(() => validateArtifact(path), t("common.packageValid"));
        },
      },
      {
        id: "dev",
        label: devRunning ? t("palette.devStop") : t("palette.devStart"),
        hint: t("palette.devHint"),
        icon: devRunning ? <Square size={14} /> : <Play size={14} />,
        shortcut: "F5",
        group: t("palette.groupRun"),
        disabled: !canBuild,
        run: () =>
          devRunning
            ? stopDev()
            : runAction(() => startDev(), t("common.devStarted")),
      },
      {
        id: "terminal",
        label: t("palette.terminal"),
        hint: t("palette.terminalHint"),
        icon: <TerminalSquare size={14} />,
        group: t("palette.groupRun"),
        run: () => {
          setBottomOpen(true);
          setBottomTab("terminal");
        },
      },
      {
        id: "refresh",
        label: t("palette.refresh"),
        hint: t("palette.refreshHint"),
        icon: <RefreshCw size={14} />,
        group: t("palette.groupView"),
        disabled: !project,
        run: () => refreshTree(),
      },
      {
        id: "preview",
        label: previewOpen ? t("palette.hidePreview") : t("palette.showPreview"),
        hint: t("palette.previewHint"),
        icon: <PanelRight size={14} />,
        group: t("palette.groupView"),
        run: () => setPreviewOpen(!previewOpen),
      },
      {
        id: "bottom",
        label: bottomOpen ? t("palette.hideBottom") : t("palette.showBottom"),
        hint: t("palette.bottomHint"),
        icon: <PanelBottom size={14} />,
        group: t("palette.groupView"),
        run: () => setBottomOpen(!bottomOpen),
      },
      {
        id: "sidebar",
        label: sidebarOpen ? t("palette.hideSidebar") : t("palette.showSidebar"),
        hint: t("palette.sidebarHint"),
        icon: <FolderTree size={14} />,
        group: t("palette.groupView"),
        run: () => setSidebarOpen(!sidebarOpen),
      },
      {
        id: "clear",
        label: t("palette.clear"),
        hint: t("palette.clearHint"),
        icon: <Trash2 size={14} />,
        group: t("palette.groupView"),
        run: clearLogs,
      },
      {
        id: "settings",
        label: t("palette.settings"),
        hint: t("palette.settingsHint"),
        icon: <Settings size={14} />,
        group: t("palette.groupTools"),
        run: studio.settings,
      },
      {
        id: "docs",
        label: t("palette.docs"),
        hint: t("palette.docsHint"),
        icon: <Boxes size={14} />,
        group: t("palette.groupHelp"),
        run: () =>
          api.openUrl(
            "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md",
          ),
      },
      {
        id: "about",
        label: t("palette.about"),
        hint: t("palette.aboutHint"),
        icon: <Sparkles size={14} />,
        group: t("palette.groupHelp"),
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
    t,
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
            placeholder={t("palette.placeholder")}
            className="h-12 min-w-0 flex-1 bg-transparent text-[12.5px] text-studio-100 outline-none placeholder:text-studio-500"
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="max-h-[52vh] overflow-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-studio-500">
              <Wand2 size={13} /> {t("palette.empty")}
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
            <span className="kbd">↓</span> {t("palette.navigate")}
            <span className="kbd">↵</span> {t("palette.run")}
          </span>
          <span>{t("palette.commandsCount", { count: filtered.length })}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

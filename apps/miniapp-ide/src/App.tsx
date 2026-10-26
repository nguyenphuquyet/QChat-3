import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { ActivityBar } from "./components/ActivityBar";
import { AboutDialog } from "./components/AboutDialog";
import { BottomPanel } from "./components/BottomPanel";
import { CommandPalette } from "./components/CommandPalette";
import { EditorArea, Welcome } from "./components/EditorArea";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { PreviewPanel } from "./components/PreviewPanel";
import { ProjectSettingsDialog } from "./components/ProjectSettingsDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TitleBar, type StudioCommands } from "./components/TitleBar";
import { WindowResizeHandles } from "./components/WindowChrome";
import { api } from "./lib/api";
import { runAction } from "./lib/feedback";
import { useStudio } from "./lib/store";
import { cn } from "./lib/utils";
import type { DevExit, DevLog } from "./types";

const SIDEBAR_MIN = 190;
const SIDEBAR_MAX = 460;
const PREVIEW_MIN = 280;
const PREVIEW_MAX = 520;
const BOTTOM_MIN = 110;
const BOTTOM_MAX = 620;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function Resizer({
  orientation,
  onStart,
  className,
}: {
  orientation: "vertical" | "horizontal";
  onStart: (event: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "group relative z-10 shrink-0",
        orientation === "vertical"
          ? "w-[3px] cursor-col-resize"
          : "h-[3px] cursor-row-resize",
        className,
      )}
      onMouseDown={onStart}
    >
      <div
        className={cn(
          "absolute bg-transparent transition-colors duration-150 group-hover:bg-accent-500/70",
          orientation === "vertical"
            ? "inset-y-0 left-0 w-full"
            : "inset-x-0 top-0 h-full",
        )}
      />
    </div>
  );
}

export default function App() {
  const bootstrap = useStudio((state) => state.bootstrap);
  const project = useStudio((state) => state.project);
  const settings = useStudio((state) => state.settings);
  const sidebarOpen = useStudio((state) => state.sidebarOpen);
  const bottomOpen = useStudio((state) => state.bottomOpen);
  const previewOpen = useStudio((state) => state.previewOpen);
  const setBottomOpen = useStudio((state) => state.setBottomOpen);
  const setPreviewOpen = useStudio((state) => state.setPreviewOpen);
  const openProject = useStudio((state) => state.openProject);
  const saveActive = useStudio((state) => state.saveActive);
  const buildProject = useStudio((state) => state.buildProject);
  const runTests = useStudio((state) => state.runTests);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const devRunning = useStudio((state) => state.devRunning);
  const handleDevLog = useStudio((state) => state.handleDevLog);
  const handleDevExit = useStudio((state) => state.handleDevExit);

  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [previewWidth, setPreviewWidth] = useState(336);
  const [bottomHeight, setBottomHeight] = useState(210);
  const [bottomMax, setBottomMax] = useState(false);
  const [dialog, setDialog] = useState<null | "new" | "settings" | "project" | "about">(
    null,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dragCleanup = useRef<(() => void) | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);

  const commands: StudioCommands = {
    newProject: () => setDialog("new"),
    openProject: () => {
      void (async () => {
        const path = await api.pickDirectory(
          project?.path || settings.projectsDir || undefined,
        );
        if (!path) return;
        await runAction(() => openProject(path));
      })();
    },
    settings: () => setDialog("settings"),
    projectSettings: () => setDialog("project"),
    about: () => setDialog("about"),
    palette: () => setPaletteOpen(true),
  };

  // Boot: detect the CLI and reopen the last project once.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Tauri dev-watcher event bridge.
  useEffect(() => {
    if (!api.isDesktop()) return;
    const disposers: Array<() => void> = [];
    let cancelled = false;
    void (async () => {
      try {
        const unlistenLog = await listen<DevLog>("qapp-dev-log", (event) => {
          handleDevLog(event.payload);
        });
        const unlistenExit = await listen<DevExit>("qapp-dev-exit", (event) => {
          handleDevExit(event.payload);
        });
        if (cancelled) {
          unlistenLog();
          unlistenExit();
          return;
        }
        disposers.push(unlistenLog, unlistenExit);
      } catch {
        // Events are unavailable outside a packaged/dev Tauri shell.
      }
    })();
    return () => {
      cancelled = true;
      for (const dispose of disposers) dispose();
    };
  }, [handleDevLog, handleDevExit]);

  // Close native dev watcher when the window goes away.
  useEffect(() => {
    const onUnload = () => {
      if (api.isDesktop()) void api.stopDev();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const beginResize = useCallback(
    (
      axis: "x" | "y",
      direction: 1 | -1,
      initial: number,
      apply: (value: number) => void,
      min: number,
      max: number,
    ) =>
      (event: React.MouseEvent) => {
        event.preventDefault();
        const start = axis === "x" ? event.clientX : event.clientY;
        document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
        const onMove = (moveEvent: MouseEvent) => {
          const delta =
            (axis === "x" ? moveEvent.clientX : moveEvent.clientY) - start;
          apply(clamp(initial + delta * direction, min, max));
        };
        const finish = () => {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", finish);
          dragCleanup.current = null;
        };
        dragCleanup.current = finish;
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", finish);
      },
    [],
  );

  useEffect(() => () => dragCleanup.current?.(), []);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        if (!project) return;
        if (devRunning) void stopDev();
        else void runAction(() => startDev(), "Dev watcher started");
        return;
      }
      if (mod && key === "b") {
        event.preventDefault();
        if (!project) return;
        void runAction(
          () => buildProject(event.shiftKey),
          event.shiftKey ? "Bundle built without typecheck" : "Package built successfully",
        );
        return;
      }
      if (mod && key === "t") {
        event.preventDefault();
        if (!project) return;
        void runAction(() => runTests(), "Runtime test passed");
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        void saveActive();
        return;
      }
      if (mod && key === "n") {
        event.preventDefault();
        setDialog("new");
        return;
      }
      if (mod && key === "o") {
        event.preventDefault();
        commands.openProject();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    devRunning,
    buildProject,
    runTests,
    saveActive,
    startDev,
    stopDev,
  ]);

  // Persist compact workspace preferences.
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const name = project?.name ? `${project.name} — QChat Studio` : "QChat Mini App Studio";
    document.title = name;
  }, [project?.name]);

  const maximizeBottom = () => {
    if (bottomMax) {
      setBottomMax(false);
      setBottomHeight(210);
    } else {
      setBottomMax(true);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-950 text-studio-100">
      <TitleBar commands={commands} />

      <div className="flex min-h-0 flex-1">
        <ActivityBar
          onPalette={() => setPaletteOpen(true)}
          onSettings={() => setDialog("settings")}
          onAbout={() => setDialog("about")}
        />

        {sidebarOpen ? (
          <>
            <div
              className="min-h-0 shrink-0 overflow-hidden"
              style={{ width: sidebarWidth }}
            >
              <Sidebar onSettings={() => setDialog("settings")} />
            </div>
            <Resizer
              orientation="vertical"
              onStart={beginResize(
                "x",
                1,
                sidebarWidth,
                setSidebarWidth,
                SIDEBAR_MIN,
                SIDEBAR_MAX,
              )}
            />
          </>
        ) : null}

        <main className="flex min-w-0 min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {project ? (
              <EditorArea />
            ) : (
              <Welcome commands={commands} />
            )}
          </div>

          {bottomOpen ? (
            <>
              {!bottomMax ? (
                <Resizer
                  orientation="horizontal"
                  onStart={beginResize(
                    "y",
                    -1,
                    bottomHeight,
                    setBottomHeight,
                    BOTTOM_MIN,
                    BOTTOM_MAX,
                  )}
                />
              ) : null}
              <div
                className={cn("min-h-0 shrink-0", bottomMax && "flex-1")}
                style={bottomMax ? undefined : { height: bottomHeight }}
              >
                <BottomPanel
                  height={bottomMax ? undefined : bottomHeight}
                  maximized={bottomMax}
                  onMaximize={maximizeBottom}
                />
              </div>
            </>
          ) : null}
        </main>

        {previewOpen ? (
          <>
            <Resizer
              orientation="vertical"
              onStart={beginResize(
                "x",
                -1,
                previewWidth,
                setPreviewWidth,
                PREVIEW_MIN,
                PREVIEW_MAX,
              )}
            />
            <div
              className="min-h-0 shrink-0 overflow-hidden"
              style={{ width: previewWidth }}
            >
              <PreviewPanel onClose={() => setPreviewOpen(false)} />
            </div>
          </>
        ) : null}
      </div>

      <StatusBar onSettings={() => setDialog("settings")} />

      <NewProjectDialog open={dialog === "new"} onClose={closeDialog} />
      <SettingsDialog open={dialog === "settings"} onClose={closeDialog} />
      <ProjectSettingsDialog open={dialog === "project"} onClose={closeDialog} />
      <AboutDialog open={dialog === "about"} onClose={closeDialog} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {!bottomOpen ? (
        <button
          className="fixed bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-studio-900/90 px-3 py-1 text-[10px] text-studio-300 shadow-panel backdrop-blur transition hover:text-white"
          onClick={() => setBottomOpen(true)}
        >
          Show panel
        </button>
      ) : null}

      <WindowResizeHandles />

      <Toaster
        theme="dark"
        position="bottom-right"
        offset={38}
        closeButton
        toastOptions={{
          style: {
            background: "rgba(14, 18, 26, 0.94)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: "#e6e9f2",
            fontSize: "12px",
            backdropFilter: "blur(18px)",
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

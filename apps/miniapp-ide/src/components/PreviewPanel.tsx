import {
  BatteryFull,
  Boxes,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FolderOpen,
  Hammer,
  Info,
  Loader2,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  Square,
  TriangleAlert,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStudio } from "../lib/store";
import { api } from "../lib/api";
import { runAction } from "../lib/feedback";
import { useI18n } from "../lib/useI18n";
import {
  cn,
  errorMessage,
  formatBytes,
  permissionTone,
  timeAgo,
} from "../lib/utils";
import { QappPreview } from "../lib/qapp/runtime";
import { QappFrameView } from "../lib/qapp/render";
import { DARK_THEME, LIGHT_THEME } from "../lib/qapp/style";
import { loadPreviewBundle, type QappPreviewBundle } from "../lib/qapp/preview";
import type { QappDevice, QappFrame, QappPreviewLog } from "../lib/qapp/types";

/** The device a Mini App actually runs on: an iPhone 14-class screen. */
const DEVICE: QappDevice = {
  width: 390,
  height: 844,
  pixelRatio: 3,
  safeAreaTop: 47,
  safeAreaBottom: 34,
  theme: "light",
};

const FRAME_PADDING = 3;
const FRAME_WIDTH = DEVICE.width + FRAME_PADDING * 2;
const FRAME_HEIGHT = DEVICE.height + FRAME_PADDING * 2;

function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-7 pt-[13px] text-[12px] font-semibold text-white [mix-blend-mode:difference]">
      <span className="tracking-tight">9:41</span>
      <span className="flex items-center gap-1.5">
        <Signal size={12} strokeWidth={2.6} />
        <Wifi size={13} strokeWidth={2.4} />
        <BatteryFull size={16} strokeWidth={1.8} />
      </span>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[7px] z-30 flex justify-center">
      <span className="h-[5px] w-[134px] rounded-full bg-white [mix-blend-mode:difference]" />
    </div>
  );
}

function PhoneShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-[44px] border border-white/[0.12] bg-gradient-to-b from-studio-700/80 to-studio-900 p-[3px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" data-keep-white data-keep-dark>
      <div className="absolute -inset-6 -z-10 rounded-[60px] bg-accent-500/[0.08] blur-3xl" />
      <div className="relative overflow-hidden rounded-[41px] border border-black/50 bg-[#07090d]">
        <div className="absolute left-1/2 top-2 z-40 h-[24px] w-[96px] -translate-x-1/2 rounded-full bg-black">
          <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-studio-800" />
        </div>
        {children}
      </div>
    </div>
  );
}

function LivePreview() {
  const project = useStudio((state) => state.project);
  const settings = useStudio((state) => state.settings);
  const previewRevision = useStudio((state) => state.previewRevision);
  const { t, language } = useI18n();

  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<QappPreview | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const requestRef = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const [scale, setScale] = useState(0.68);
  const [bundle, setBundle] = useState<QappPreviewBundle | null>(null);
  const [phase, setPhase] = useState<"idle" | "bundling" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<QappFrame | null>(null);
  const [logs, setLogs] = useState<QappPreviewLog[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (runningRef.current) {
      queuedRef.current = true;
      return;
    }
    const state = useStudio.getState();
    const current = state.project;
    if (!current?.manifest) {
      setPhase("idle");
      return;
    }
    runningRef.current = true;
    const request = ++requestRef.current;
    setPhase("bundling");
    setError(null);
    try {
      if (state.settings.autoSave) await state.saveAllDirty();
      const next = await loadPreviewBundle(current, state.settings);
      if (request !== requestRef.current) return;
      setBundle(next);
      setLogs([]);
      setFrame(null);
      setPhase("ready");
    } catch (failure) {
      if (request !== requestRef.current) return;
      setError(errorMessage(failure));
      setPhase("error");
    } finally {
      runningRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void refresh();
      }
    }
    // Reads the live store, so it never closes over a stale project or setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First mount, project switch, save and successful builds all land here.
  useEffect(() => {
    if (!project?.manifest) {
      setBundle(null);
      setFrame(null);
      setPhase("idle");
      return;
    }
    if (!api.isDesktop()) {
      setPhase("error");
      setError(t("preview.needsDesktop"));
      return;
    }
    const timer = window.setTimeout(() => void refresh(), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.path, project?.manifest?.version, previewRevision]);

  // Fit the 390 × 844 stage into whatever width the panel has.
  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      if (!width) return;
      setScale(Math.min(1, Math.max(0.32, (width - 4) / FRAME_WIDTH)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // One runtime per bundle: the iframe is recreated so no module state survives
  // a reload, which is what a fresh app launch looks like on a device.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !bundle) return;
    const dark = useStudio.getState().settings.theme === "dark";
    const device: QappDevice = { ...DEVICE, theme: dark ? "dark" : "light" };
    const preview = new QappPreview(host, {
      appJs: bundle.appJs,
      appInfo: bundle.appInfo,
      device,
      locale: language === "vi" ? "vi-VN" : language === "zh" ? "zh-CN" : "en-US",
      onFrame: (next) => {
        setFrame(next);
        setPhase("ready");
      },
      onLog: (entry) => {
        setLogs((previous) => [...previous.slice(-79), entry]);
      },
      onError: (failure) => {
        setError(failure.message);
        setLogs((previous) => [
          ...previous.slice(-79),
          { level: "error", message: failure.message },
        ]);
      },
      onToast: (message) => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        setToastMessage(message);
        toastTimer.current = window.setTimeout(() => setToastMessage(null), 2200);
      },
      onClose: () => {
        setLogs((previous) => [
          ...previous.slice(-79),
          { level: "info", message: t("preview.closed") },
        ]);
      },
    });
    previewRef.current = preview;
    return () => {
      preview.dispose();
      previewRef.current = null;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, language, settings.theme]);

  const theme = settings.theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const frameRoot = frame?.root ?? null;
  const renderContext = {
    colors: theme,
    device: { ...DEVICE, theme: settings.theme === "dark" ? ("dark" as const) : ("light" as const) },
    assets: bundle?.assets ?? {},
    emit: (id: string, event: string, payload: unknown) =>
      previewRef.current?.dispatch(id, event, payload),
  };

  if (!project?.manifest) {
    return (
      <div className="flex flex-col items-center" ref={shellRef}>
        <div className="flex h-[300px] w-full max-w-[260px] flex-col items-center justify-center gap-3 rounded-[32px] border border-white/10 bg-white/[0.02] px-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-studio-500">
            <Smartphone size={22} />
          </div>
          <div className="text-[11px] font-medium text-studio-300">{t("preview.noApp")}</div>
          <div className="text-[9.5px] leading-4 text-studio-500">
            {t("preview.noAppHint")}
          </div>
        </div>
      </div>
    );
  }

  const busy = phase === "bundling";

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[8.5px] font-semibold tracking-[0.16em] text-studio-500">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              busy && "bg-amber-300",
              !busy && phase === "ready" && "bg-mint-400",
              !busy && phase === "error" && "bg-rose-400",
            )}
          />
          {t("preview.live")}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="icon-btn h-6 w-6"
            title={t("preview.reload")}
            onClick={() => void refresh()}
            disabled={busy}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      <div ref={shellRef} className="w-full">
        <div
          className="relative mx-auto"
          style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: FRAME_WIDTH,
              height: FRAME_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <PhoneShell>
              <div
                style={{ width: DEVICE.width, height: DEVICE.height, background: theme.background }}
                className="relative"
              >
                {/* The sandbox runs the app's JavaScript; it never paints. The
                    React tree below is what the user sees and touches. */}
                <div
                  ref={hostRef}
                  className="pointer-events-none absolute inset-0 opacity-0"
                  aria-hidden
                />
                <div className="absolute inset-0 overflow-hidden">
                  {frameRoot ? (
                    <div className="absolute inset-0">
                      <QappFrameView root={frameRoot} ctx={renderContext} />
                    </div>
                  ) : null}
                </div>
                <StatusBar />
                <HomeIndicator />

                {!frameRoot && busy ? (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
                    style={{ background: theme.background, color: theme.muted }}
                  >
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-[11px]">{t("preview.building")}</span>
                  </div>
                ) : null}

                {!frameRoot && !busy && phase === "error" ? (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-7 text-center"
                    style={{ background: theme.background, color: theme.ink }}
                  >
                    <TriangleAlert size={22} className="text-rose-400" />
                    <div className="text-[12px] font-semibold">{t("preview.failedToRun")}</div>
                    <div className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words text-[9.5px] leading-4 text-studio-500">
                      {error}
                    </div>
                    <button
                      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-white/80"
                      onClick={() => void refresh()}
                    >
                      {t("preview.retry")}
                    </button>
                  </div>
                ) : null}

                {toastMessage ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-[54px] z-30 flex justify-center px-6">
                    <div className="max-w-[280px] rounded-lg bg-black/75 px-3 py-2 text-center text-[11px] leading-4 text-white shadow-lg">
                      {toastMessage}
                    </div>
                  </div>
                ) : null}
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>

      <div className="mt-2 flex w-full items-center justify-between gap-2">
        <div className="min-w-0 text-[8.5px] text-studio-600">
          {phase === "error" && bundle ? (
            <span className="line-clamp-2 text-rose-300/80">{error}</span>
          ) : phase === "bundling" ? (
            <span className="text-amber-300/80">{t("preview.buildingShort")}</span>
          ) : (
            <span>{t("preview.hint")}</span>
          )}
        </div>
        <button
          className="flex shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8.5px] text-studio-400"
          onClick={() => setConsoleOpen((open) => !open)}
          title={t("preview.console")}
        >
          {t("preview.console")}
          <span className={cn("font-mono", logs.length ? "text-studio-300" : "text-studio-600")}>
            {logs.length}
          </span>
        </button>
      </div>

      {consoleOpen ? (
        <div className="mt-2 w-full rounded-lg border border-white/[0.06] bg-black/30 p-2">
          {logs.length === 0 ? (
            <div className="py-1 text-center text-[8.5px] text-studio-600">
              {t("preview.consoleEmpty")}
            </div>
          ) : (
            <div className="max-h-[140px] space-y-0.5 overflow-auto font-mono text-[8.5px] leading-3.5">
              {logs.slice(-40).map((entry, index) => (
                <div
                  key={`${index}-${entry.message.slice(0, 12)}`}
                  className={cn(
                    "break-words",
                    String(entry.level) === "error" && "text-rose-300",
                    String(entry.level) === "warn" && "text-amber-300",
                    String(entry.level) !== "error" && String(entry.level) !== "warn" && "text-studio-400",
                  )}
                >
                  <span className="text-studio-600">{String(entry.level)}</span> {entry.message}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PreviewPanel({ onClose }: { onClose: () => void }) {
  const project = useStudio((state) => state.project);
  const inspection = useStudio((state) => state.inspection);
  const buildStatus = useStudio((state) => state.buildStatus);
  const buildMessage = useStudio((state) => state.buildMessage);
  const devRunning = useStudio((state) => state.devRunning);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const artifacts = useStudio((state) => state.artifacts);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const buildProject = useStudio((state) => state.buildProject);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const manifest = inspection?.manifest ?? project?.manifest;
  const { t, language } = useI18n();
  const ready = Boolean(project && manifest);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-studio-950/45">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.05] px-3">
        <div className="flex items-center gap-2">
          <Smartphone size={13} className="text-studio-400" />
          <span className="text-[10px] font-semibold tracking-[0.14em] text-studio-400">
            {t("preview.device")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="chip text-[8.5px]">QChat 1.0</span>
          <button className="icon-btn h-6 w-6" onClick={onClose} title={t("preview.close")}>
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <LivePreview />

        <div className="mt-3 flex gap-1.5">
          <button
            className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-accent-400 to-accent-600 text-[8.5px] font-semibold text-white shadow-glow disabled:opacity-50"
            onClick={() => void runAction(() => buildProject(false), t("common.packageBuilt"))}
            disabled={!ready || buildStatus === "running"}
          >
            <Hammer size={9} /> {t("common.build")}
          </button>
          <button
            className={cn(
              "flex h-7 items-center justify-center gap-1 rounded-lg border px-2 text-[8.5px] font-semibold disabled:opacity-50",
              devRunning
                ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                : "border-white/10 bg-white/[0.04] text-white/70",
            )}
            onClick={() => {
              if (devRunning) void stopDev();
              else void runAction(() => startDev(), t("common.devStarted"));
            }}
            disabled={!ready}
          >
            {devRunning ? <Square size={8} /> : <Play size={8} />}
            {devRunning ? t("common.stop") : t("common.dev")}
          </button>
        </div>
        {buildMessage ? (
          <div className="mt-1.5 text-center text-[8.5px] leading-3.5 text-studio-600">
            {devRunning ? (
              <span className="text-mint-400/80">{t("preview.devRunning")}</span>
            ) : (
              buildMessage
            )}
          </div>
        ) : null}

        <div className="mt-4 space-y-2.5">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] text-studio-500">
                <Package size={11} /> {t("preview.artifact")}
              </span>
              {activeArtifact ? (
                <span className="flex items-center gap-1 text-[8.5px] font-medium text-mint-400">
                  <Check size={9} /> {t("preview.ready")}
                </span>
              ) : (
                <span className="text-[8.5px] text-studio-600">{t("common.none")}</span>
              )}
            </div>
            {activeArtifact ? (
              <>
                <div className="mt-2 truncate font-mono text-[9.5px] text-studio-300" title={activeArtifact}>
                  {activeArtifact.split(/[\\/]/).pop()}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[8.5px] text-studio-500">
                  <span>{inspection ? formatBytes(inspection.size) : "—"}</span>
                  <span>
                    {timeAgo(
                      artifacts.find((item) => item.path === activeArtifact)?.modifiedMs,
                      language,
                    )}
                  </span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    className="btn btn-secondary h-6 flex-1 text-[9px]"
                    onClick={() =>
                      void runAction(
                        () => validateArtifact(activeArtifact),
                        t("common.packageValid"),
                      )
                    }
                  >
                    <ShieldCheck size={10} /> {t("common.validate")}
                  </button>
                  <button
                    className="btn btn-secondary h-6 px-2"
                    onClick={() => void api.reveal(activeArtifact)}
                  >
                    <FolderOpen size={10} />
                  </button>
                  {inspection ? (
                    <button
                      className="btn btn-secondary h-6 px-2"
                      onClick={() => {
                        void navigator.clipboard.writeText(inspection.sha256);
                        toast.success(t("common.shaCopied"));
                      }}
                      title={t("common.copy")}
                    >
                      <Copy size={10} />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-white/[0.08] px-2 py-3 text-center text-[9px] leading-4 text-studio-600">
                {t("preview.buildArtifactHint")}
              </div>
            )}
          </div>

          {inspection ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] text-studio-500">
                  <Boxes size={11} /> {t("preview.packageFiles")}
                </span>
                <span className="text-[8.5px] text-studio-600">
                  {t("common.entries", { count: inspection.files.length })}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {inspection.files.slice(0, 6).map((file) => (
                  <div key={file.name} className="flex items-center gap-2 text-[9px]">
                    <span className="h-1 w-1 rounded-full bg-accent-400/60" />
                    <span className="min-w-0 flex-1 truncate font-mono text-studio-400">
                      {file.name}
                    </span>
                    <span className="text-studio-600">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[8px] text-studio-600">
                <Clock3 size={9} />
                {t("preview.builtAt", {
                  date: new Date(inspection.metadata.builtAt).toLocaleString(
                    language === "vi" ? "vi-VN" : language === "zh" ? "zh-CN" : "en-US",
                  ),
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-accent-500/15 bg-accent-500/[0.045] p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] text-accent-300">
              <Info size={11} /> {t("preview.ship")}
            </div>
            <ol className="mt-2 space-y-1.5">
              {[t("preview.ship1"), t("preview.ship2"), t("preview.ship3"), t("preview.ship4")].map(
                (step, index) => (
                  <li key={step} className="flex items-start gap-1.5 text-[9px] leading-4 text-studio-400">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-[7.5px] text-studio-300">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ),
              )}
            </ol>
            <button
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 text-[9px] font-medium text-studio-300 transition hover:border-white/15 hover:text-white"
              onClick={() =>
                void api.openUrl(
                  "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPP-DEVELOPER-GUIDE.md",
                )
              }
            >
              {t("preview.docs")} <ChevronRight size={9} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-white/[0.05] px-3 text-[8.5px] text-studio-600">
        <span>{manifest ? `${manifest.name} · v${manifest.version}` : t("preview.noManifest")}</span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              buildStatus === "success" ? "bg-mint-400" : "bg-studio-600",
            )}
          />
          {buildStatus}
        </span>
      </div>
    </aside>
  );
}

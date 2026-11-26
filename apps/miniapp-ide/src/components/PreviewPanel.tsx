import {
  BatteryFull,
  Boxes,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FolderOpen,
  Globe2,
  Hammer,
  Info,
  Loader2,
  Moon,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  Square,
  Sun,
  Terminal,
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
  formatBytes,
  permissionTone,
  timeAgo,
} from "../lib/utils";
import type { DevEvent } from "../types";

/** The device a Mini App actually runs on: an iPhone 14-class screen. */
const DEVICE = {
  width: 390,
  height: 844,
  safeAreaTop: 47,
  safeAreaBottom: 34,
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

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[44px] border border-white/[0.12] bg-studio-800 p-[3px]"
      data-keep-white
      data-keep-dark
    >
      <div className="relative overflow-hidden rounded-[41px] border border-black/50 bg-[#07090d]">
        <div className="absolute left-1/2 top-2 z-40 h-[24px] w-[96px] -translate-x-1/2 rounded-full bg-black">
          <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-studio-800" />
        </div>
        {children}
      </div>
    </div>
  );
}

type PreviewTab = "simulator" | "console" | "network";

function devEventTone(event: DevEvent): string {
  if (event.type === "error") return "text-rose-300";
  if (event.type === "console") {
    if (event.level === "error") return "text-rose-300";
    if (event.level === "warn") return "text-amber-300";
    return "text-studio-400";
  }
  if (event.phase === "error") return "text-rose-300";
  if (event.phase === "request") return "text-studio-400";
  return "text-mint-400/80";
}

function describeDevEvent(event: DevEvent): string {
  if (event.type === "console") {
    return `${event.level}  ${event.message}`;
  }
  if (event.type === "error") {
    const where = event.file
      ? ` (${event.file}${event.line ? `:${event.line}` : ""})`
      : "";
    return `error  ${event.message}${where}`;
  }
  if (event.phase === "request") {
    return `${event.method} ${event.url}`;
  }
  if (event.phase === "error") {
    return `${event.method} ${event.url} — ${event.message ?? "failed"}`;
  }
  return `${event.method} ${event.url} — ${event.status ?? "?"}${
    typeof event.durationMs === "number" ? ` · ${event.durationMs} ms` : ""
  }`;
}

function LivePreview() {
  const project = useStudio((state) => state.project);
  const devRunning = useStudio((state) => state.devRunning);
  const devUrl = useStudio((state) => state.devUrl);
  const devRevision = useStudio((state) => state.devRevision);
  const devEvents = useStudio((state) => state.devEvents);
  const reloadDev = useStudio((state) => state.reloadDev);
  const clearDevEvents = useStudio((state) => state.clearDevEvents);
  const appendDevEvent = useStudio((state) => state.appendDevEvent);
  const startDev = useStudio((state) => state.startDev);
  const { t } = useI18n();

  const shellRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.68);
  const [tab, setTab] = useState<PreviewTab>("simulator");
  /*
   * The simulated device has its own appearance: switching the Studio to dark
   * must not repaint the Mini App, exactly like flipping a phone's system theme
   * does not change the IDE. The toggle below is the device's system setting.
   */
  const [deviceTheme, setDeviceTheme] = useState<"light" | "dark">("light");

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

  // The host runtime forwards console, network and error events from the real
  // page. Only messages from the dev server's origin are accepted.
  useEffect(() => {
    let origin = "";
    try {
      origin = new URL(devUrl).origin;
    } catch {
      origin = "";
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string } | null;
      if (!data || data.source !== "qchat-miniapp") return;
      if (origin && event.origin && event.origin !== origin) return;
      const payload = { ...(data as Record<string, unknown>) };
      delete payload.source;
      if (typeof payload.type !== "string") return;
      appendDevEvent(payload as never);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appendDevEvent, devUrl]);

  const consoleEvents = devEvents.filter(
    (event) => event.type === "console" || event.type === "error",
  );
  const networkEvents = devEvents.filter((event) => event.type === "network");
  const events = tab === "network" ? networkEvents : consoleEvents;

  if (!project) {
    return (
      <div className="flex flex-col items-center" ref={shellRef}>
        <div className="flex h-[300px] w-full max-w-[260px] flex-col items-center justify-center gap-3 rounded-[32px] border border-white/10 bg-white/[0.02] px-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-studio-500">
            <Smartphone size={22} />
          </div>
          <div className="text-[11px] font-medium text-studio-300">{t("preview.noApp")}</div>
          <div className="text-[9.5px] leading-4 text-studio-500">{t("preview.noAppHint")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[8.5px] font-semibold tracking-[0.16em] text-studio-500">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              devRunning ? "bg-mint-400" : "bg-studio-600",
            )}
          />
          {t("preview.live")}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="icon-btn h-6 w-6"
            title={
              deviceTheme === "dark" ? t("title.switchToLight") : t("title.switchToDark")
            }
            onClick={() => setDeviceTheme(deviceTheme === "dark" ? "light" : "dark")}
          >
            {deviceTheme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <button
            className="icon-btn h-6 w-6"
            title={t("preview.reload")}
            onClick={() => reloadDev()}
            disabled={!devRunning}
          >
            <RefreshCw size={12} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            title={t("preview.openBrowser")}
            onClick={() => void api.openUrl(devUrl)}
            disabled={!devRunning}
          >
            <ExternalLink size={12} />
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
                style={{
                  width: DEVICE.width,
                  height: DEVICE.height,
                  background: deviceTheme === "dark" ? "#111318" : "#ffffff",
                }}
                className="relative"
              >
                {devRunning ? (
                  <iframe
                    key={devRevision}
                    src={devUrl}
                    title={t("preview.simulator")}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-7 text-center">
                    <Smartphone size={22} className="text-studio-500" />
                    <div className="text-[12px] font-semibold text-studio-200">
                      {t("preview.noDev")}
                    </div>
                    <div className="text-[9.5px] leading-4 text-studio-500">
                      {t("preview.noDevHint")}
                    </div>
                    <button
                      className="mt-1 flex items-center gap-1 rounded bg-accent-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-accent-600"
                      onClick={() => void runAction(() => startDev(), t("common.devStarted"))}
                    >
                      <Play size={10} /> {t("common.dev")}
                    </button>
                  </div>
                )}
                <StatusBar />
                <HomeIndicator />
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>

      <div className="mt-2 flex w-full items-center justify-between gap-2">
        <div className="min-w-0 text-[8.5px] text-studio-600">
          {devRunning ? (
            <span className="font-mono">{devUrl}</span>
          ) : (
            <span>{t("preview.hint")}</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex w-full items-center gap-1 border-b border-white/[0.06] pb-1">
        {(
          [
            ["simulator", t("preview.simulator"), null],
            ["console", t("preview.console"), consoleEvents.length],
            ["network", t("preview.network"), networkEvents.length],
          ] as Array<[PreviewTab, string, number | null]>
        ).map(([id, label, count]) => (
          <button
            key={id}
            className={cn(
              "flex items-center gap-1 rounded px-1.5 py-0.5 text-[8.5px] transition",
              tab === id
                ? "bg-white/[0.08] text-studio-100"
                : "text-studio-500 hover:text-studio-300",
            )}
            onClick={() => setTab(id)}
          >
            {label}
            {count !== null ? (
              <span className={cn("font-mono", count ? "text-studio-300" : "text-studio-600")}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
        {tab !== "simulator" ? (
          <button
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[8.5px] text-studio-500 hover:text-studio-300"
            onClick={() => clearDevEvents()}
            title={t("preview.clearEvents")}
          >
            <X size={9} /> {t("preview.clearEvents")}
          </button>
        ) : null}
      </div>

      {tab !== "simulator" ? (
        <div className="mt-1 w-full rounded border border-white/[0.06] bg-black/30 p-2">
          {events.length === 0 ? (
            <div className="py-1 text-center text-[8.5px] text-studio-600">
              {tab === "network" ? t("preview.networkEmpty") : t("preview.consoleEmpty")}
            </div>
          ) : (
            <div className="max-h-[140px] space-y-0.5 overflow-auto font-mono text-[8.5px] leading-3.5">
              {events.slice(-80).map((event) => (
                <div key={event.id} className={cn("break-words", devEventTone(event))}>
                  {describeDevEvent(event)}
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
  const validateProject = useStudio((state) => state.validateProject);
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
            className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-accent-500 text-[8.5px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
            onClick={() => void runAction(() => buildProject(), t("common.packageBuilt"))}
            disabled={!ready || buildStatus === "running"}
          >
            <Hammer size={9} /> {t("common.build")}
          </button>
          <button
            className={cn(
              "flex h-7 items-center justify-center gap-1 rounded border px-2 text-[8.5px] font-semibold disabled:opacity-50",
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
          <div className="rounded border border-white/[0.07] bg-white/[0.02] p-3">
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
                      void runAction(() => validateProject(), t("common.projectValid"))
                    }
                  >
                    <ShieldCheck size={10} /> {t("common.validateProject")}
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
              <div className="mt-2 rounded border border-dashed border-white/[0.08] px-2 py-3 text-center text-[9px] leading-4 text-studio-600">
                {t("preview.buildArtifactHint")}
              </div>
            )}
          </div>

          {inspection ? (
            <div className="rounded border border-white/[0.07] bg-white/[0.02] p-3">
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

          <div className="rounded border border-accent-500/15 bg-accent-500/[0.045] p-3">
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
              className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-white/[0.08] bg-white/[0.04] py-1.5 text-[9px] font-medium text-studio-300 transition hover:border-white/15 hover:text-white"
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

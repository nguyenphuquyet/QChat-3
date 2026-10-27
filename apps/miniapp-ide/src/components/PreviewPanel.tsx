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
  Package,
  Play,
  ShieldCheck,
  Signal,
  Smartphone,
  Square,
  Wifi,
  X,
} from "lucide-react";
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

function PhonePreview() {
  const project = useStudio((state) => state.project);
  const inspection = useStudio((state) => state.inspection);
  const buildStatus = useStudio((state) => state.buildStatus);
  const buildMessage = useStudio((state) => state.buildMessage);
  const devRunning = useStudio((state) => state.devRunning);
  const buildProject = useStudio((state) => state.buildProject);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const { t } = useI18n();

  const manifest = inspection?.manifest ?? project?.manifest;
  const permissions = manifest?.requestedPermissions ?? [];
  const ready = Boolean(project && manifest);

  return (
    <div className="flex flex-col items-center">
      <div className="relative rounded-[38px] border border-white/[0.12] bg-gradient-to-b from-studio-700/80 to-studio-900 p-[3px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" data-keep-white data-keep-dark>
        <div className="absolute -inset-6 -z-10 rounded-[60px] bg-accent-500/[0.08] blur-3xl" />
        <div className="relative overflow-hidden rounded-[35px] border border-black/50 bg-[#07090d]">
          <div className="absolute left-1/2 top-2 z-20 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black">
            <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-studio-700" />
          </div>

          <div className="flex h-[560px] w-[286px] flex-col">
            <div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[9px] text-white/80">
              <span className="font-semibold">9:41</span>
              <div className="flex items-center gap-1">
                <Signal size={9} />
                <Wifi size={9} />
                <BatteryFull size={11} />
              </div>
            </div>

            {!manifest ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-studio-500">
                  <Smartphone size={22} />
                </div>
                <div className="text-[11px] font-medium text-studio-300">{t("preview.noApp")}</div>
                <div className="text-[9.5px] leading-4 text-studio-500">
                  {t("preview.noAppHint")}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="relative overflow-hidden px-4 pb-4 pt-5">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent-500/20 blur-2xl" />
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-accent-400 via-accent-600 to-cyan-400 text-[14px] font-bold text-white shadow-glow">
                      {manifest.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white">
                        {manifest.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[8.5px] text-white/45">
                        <span>v{manifest.version}</span>
                        <span>·</span>
                        <span>qapp</span>
                        <span className="rounded bg-mint-400/15 px-1 py-[1px] text-[7.5px] font-semibold text-mint-400">
                          SDK {manifest.sdkVersion}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[9.5px] leading-4 text-white/50">
                    {manifest.description || t("preview.defaultDesc")}
                  </p>
                </div>

                <div className="mx-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[7.5px] font-semibold tracking-[0.15em] text-white/35">
                      {t("preview.package")}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7.5px] font-semibold",
                        buildStatus === "success"
                          ? "bg-mint-400/12 text-mint-400"
                          : buildStatus === "error"
                            ? "bg-rose-400/12 text-rose-300"
                            : "bg-white/[0.06] text-white/40",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1 w-1 rounded-full",
                          buildStatus === "success" && "bg-mint-400",
                          buildStatus === "error" && "bg-rose-400",
                          buildStatus !== "success" && buildStatus !== "error" && "bg-white/30",
                        )}
                      />
                      {buildStatus === "success"
                        ? t("preview.verified")
                        : buildStatus === "error"
                          ? t("preview.failed")
                          : t("preview.notBuilt")}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[7.5px] uppercase tracking-wider text-white/30">{t("preview.size")}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-white/80">
                        {inspection ? formatBytes(inspection.size) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[7.5px] uppercase tracking-wider text-white/30">{t("preview.files")}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-white/80">
                        {inspection ? inspection.files.length : "—"}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[7.5px] uppercase tracking-wider text-white/30">{t("preview.sha")}</div>
                      <div className="mt-0.5 truncate font-mono text-[8.5px] text-white/60">
                        {inspection ? inspection.sha256 : t("preview.hashHint")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-3 mt-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="text-[7.5px] font-semibold tracking-[0.15em] text-white/35">
                    {t("preview.permissions")}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {permissions.length === 0 ? (
                      <span className="text-[8.5px] text-white/35">{t("preview.noPermissions")}</span>
                    ) : (
                      permissions.map((permission) => (
                        <span
                          key={permission}
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[7.5px] font-medium",
                            permissionTone(permission) === "sky" &&
                              "border-sky-400/20 bg-sky-400/10 text-sky-300",
                            permissionTone(permission) === "mint" &&
                              "border-mint-400/20 bg-mint-400/10 text-mint-400",
                            permissionTone(permission) === "amber" &&
                              "border-amber-400/20 bg-amber-400/10 text-amber-300",
                            permissionTone(permission) === "rose" &&
                              "border-rose-400/20 bg-rose-400/10 text-rose-300",
                            permissionTone(permission) === "violet" &&
                              "border-accent-400/20 bg-accent-400/10 text-accent-300",
                          )}
                        >
                          {permission}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 px-3 text-[8px] leading-3 text-white/30">
                  <Info size={9} className="shrink-0" />
                  {t("preview.staticNote")}
                </div>

                <div className="mt-auto flex gap-1.5 px-3 pb-4 pt-3">
                  <button
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-accent-400 to-accent-600 text-[8.5px] font-semibold text-white shadow-glow"
                    onClick={() =>
                      void runAction(
                        () => buildProject(false),
                        t("common.packageBuilt"),
                      )
                    }
                    disabled={!ready || buildStatus === "running"}
                  >
                    <Hammer size={9} /> {t("common.build")}
                  </button>
                  <button
                    className={cn(
                      "flex h-7 items-center justify-center gap-1 rounded-lg border px-2 text-[8.5px] font-semibold",
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
              </div>
            )}

            <div className="flex h-5 items-center justify-center pb-1">
              <span className="h-1 w-24 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-[8.5px] text-studio-600">
        {devRunning ? (
          <span className="text-mint-400/80">{t("preview.devRunning")}</span>
        ) : buildMessage ? (
          buildMessage
        ) : (
          t("preview.devicePreview")
        )}
      </div>
    </div>
  );
}

export function PreviewPanel({ onClose }: { onClose: () => void }) {
  const project = useStudio((state) => state.project);
  const inspection = useStudio((state) => state.inspection);
  const buildStatus = useStudio((state) => state.buildStatus);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const artifacts = useStudio((state) => state.artifacts);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const manifest = inspection?.manifest ?? project?.manifest;
  const { t, language } = useI18n();

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
        <PhonePreview />

        <div className="mt-5 space-y-2.5">
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
              {[
                t("preview.ship1"),
                t("preview.ship2"),
                t("preview.ship3"),
                t("preview.ship4"),
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-1.5 text-[9px] leading-4 text-studio-400">
                  <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-[7.5px] text-studio-300">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <button
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 text-[9px] font-medium text-studio-300 transition hover:border-white/15 hover:text-white"
              onClick={() =>
                void api.openUrl(
                  "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md",
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

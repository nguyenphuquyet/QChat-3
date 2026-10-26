import {
  ArrowUpRight,
  Boxes,
  Check,
  CircleAlert,
  CircleDashed,
  Clock3,
  Cpu,
  FileCode2,
  FolderOpen,
  Hammer,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
  TriangleAlert,
  Zap,
} from "lucide-react";
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
import { ProjectTree } from "./ProjectTree";
import { Spinner } from "./ui";

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-white/[0.07] bg-white/[0.022] p-3", className)}>
      {children}
    </div>
  );
}

function PipelineStep({
  state,
  title,
  detail,
}: {
  state: "done" | "active" | "idle" | "error";
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          state === "done" && "border-mint-400/30 bg-mint-400/10 text-mint-400",
          state === "active" && "border-accent-400/40 bg-accent-500/15 text-accent-300",
          state === "idle" && "border-white/10 bg-white/[0.03] text-studio-500",
          state === "error" && "border-rose-400/30 bg-rose-400/10 text-rose-300",
        )}
      >
        {state === "done" ? (
          <Check size={11} strokeWidth={3} />
        ) : state === "active" ? (
          <Spinner size={11} />
        ) : state === "error" ? (
          <CircleAlert size={11} />
        ) : (
          <CircleDashed size={11} />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-studio-200">{title}</div>
        <div className="mt-0.5 text-[10px] leading-4 text-studio-500">{detail}</div>
      </div>
    </div>
  );
}

export function BuildSidebar({ onSettings }: { onSettings: () => void }) {
  const project = useStudio((state) => state.project);
  const cli = useStudio((state) => state.cli);
  const buildStatus = useStudio((state) => state.buildStatus);
  const buildMessage = useStudio((state) => state.buildMessage);
  const lastBuildAt = useStudio((state) => state.lastBuildAt);
  const devRunning = useStudio((state) => state.devRunning);
  const problems = useStudio((state) => state.problems);
  const validation = useStudio((state) => state.validation);
  const artifacts = useStudio((state) => state.artifacts);
  const buildProject = useStudio((state) => state.buildProject);
  const runTests = useStudio((state) => state.runTests);
  const startDev = useStudio((state) => state.startDev);
  const stopDev = useStudio((state) => state.stopDev);
  const refreshArtifacts = useStudio((state) => state.refreshArtifacts);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const setSidebarTab = useStudio((state) => state.setSidebarTab);
  const { t, language } = useI18n();

  const ready = Boolean(project && cli?.ready);
  const running = buildStatus === "running";
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const warnings = problems.length - errors;
  const latest = artifacts[0];

  const stepState = (index: number): "done" | "active" | "idle" | "error" => {
    if (running) {
      if (index === 0) return "active";
      return "idle";
    }
    if (buildStatus === "error") return index <= 1 ? "error" : "idle";
    if (buildStatus === "success") return "done";
    return "idle";
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.05] px-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-studio-400">
          {t("build.panelTitle")}
        </span>
        <button
          className="icon-btn h-6 w-6"
          onClick={() => void refreshArtifacts()}
          title={t("build.refreshPackages")}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {!project ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[11px] leading-5 text-studio-500">
            {t("build.noProject")}
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-xl border border-accent-500/20 bg-gradient-to-br from-accent-500/[0.14] via-transparent to-mint-400/[0.06] p-3.5">
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent-500/20 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-[0.16em] text-accent-300">
                  {t("build.pipeline")}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    buildStatus === "success" && "bg-mint-400/10 text-mint-400",
                    buildStatus === "running" && "bg-accent-500/15 text-accent-300",
                    buildStatus === "error" && "bg-rose-400/10 text-rose-300",
                    buildStatus === "idle" && "bg-white/[0.06] text-studio-400",
                  )}
                >
                  {buildStatus === "running" ? <Spinner size={9} /> : null}
                  {buildStatus.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-[15px] font-semibold text-white">
                {buildStatus === "success"
                  ? t("build.statusSuccess")
                  : buildStatus === "running"
                    ? t("build.statusRunning")
                    : buildStatus === "error"
                      ? t("build.statusError")
                      : t("build.statusIdle")}
              </div>
              <p className="mt-1 min-h-8 text-[10.5px] leading-4 text-studio-400">
                {buildMessage || t("build.pipelineHint")}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  className="btn btn-primary h-7 flex-1 px-2 text-[10.5px]"
                  onClick={() =>
                    void runAction(() => buildProject(false), t("common.packageBuilt"))
                  }
                  disabled={!ready || running}
                >
                  <Hammer size={11} /> {t("build.buildJapp")}
                </button>
                <button
                  className="btn btn-secondary h-7 px-2 text-[10.5px]"
                  onClick={() =>
                    void runAction(() => buildProject(true), t("common.bundleBuilt"))
                  }
                  disabled={!ready || running}
                  title={t("build.skipTypecheck")}
                >
                  <Zap size={11} />
                </button>
                <button
                  className={cn("btn h-7 px-2 text-[10.5px]", devRunning ? "btn-danger" : "btn-secondary")}
                  onClick={() => {
                    if (devRunning) void stopDev();
                    else void runAction(() => startDev(), t("common.devStarted"));
                  }}
                  disabled={!ready}
                  title={devRunning ? t("bottom.stopDev") : t("build.watchTitle")}
                >
                  {devRunning ? <Square size={10} /> : <Play size={10} />}
                </button>
              </div>
            </div>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-[0.15em] text-studio-500">
                  {t("build.pipelineTitle")}
                </span>
                {lastBuildAt ? (
                  <span className="flex items-center gap-1 text-[9px] text-studio-500">
                    <Clock3 size={9} /> {timeAgo(lastBuildAt, language)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-2.5">
                <PipelineStep
                  state={stepState(0)}
                  title={t("build.stepTypescript")}
                  detail={t("build.stepTypescriptDetail")}
                />
                <PipelineStep
                  state={stepState(1)}
                  title={t("build.stepEsbuild")}
                  detail={t("build.stepEsbuildDetail")}
                />
                <PipelineStep
                  state={stepState(2)}
                  title={t("build.stepPackage")}
                  detail={t("build.stepPackageDetail")}
                />
                <PipelineStep
                  state={stepState(3)}
                  title={
                    buildStatus === "success"
                      ? t("build.stepVerified")
                      : t("build.stepVerification")
                  }
                  detail={t("build.stepVerifyDetail")}
                />
              </div>
              <button
                className="btn btn-secondary mt-3 h-7 w-full text-[10.5px]"
                onClick={() => void runAction(() => runTests(), t("common.runtimePassed"))}
                disabled={!ready || running}
              >
                <Terminal size={11} /> {t("build.runHostTest")}
              </button>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Card className="p-2.5">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-studio-500">
                  <CircleAlert size={10} className="text-rose-300" /> {t("build.errors")}
                </div>
                <div className={cn("mt-1 text-lg font-semibold", errors ? "text-rose-300" : "text-studio-200")}>
                  {errors}
                </div>
              </Card>
              <Card className="p-2.5">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-studio-500">
                  <TriangleAlert size={10} className="text-amber-300" /> {t("build.warnings")}
                </div>
                <div className={cn("mt-1 text-lg font-semibold", warnings ? "text-amber-300" : "text-studio-200")}>
                  {warnings}
                </div>
              </Card>
            </div>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-[0.15em] text-studio-500">
                  {t("build.latestPackage")}
                </span>
                <button
                  className="text-[9px] font-semibold text-accent-300 hover:text-accent-200"
                  onClick={() => setSidebarTab("packages")}
                >
                  {t("build.viewAll")}
                </button>
              </div>
              {latest ? (
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-left transition hover:border-white/12"
                  onClick={() => {
                    void runAction(
                      () => useStudio.getState().inspectArtifact(latest.path),
                      t("common.packageInspected"),
                    );
                  }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint-400/10 text-mint-400">
                    <Package size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] font-medium text-studio-200">
                      {latest.name}
                    </span>
                    <span className="text-[9px] text-studio-500">
                      {formatBytes(latest.size)} · {timeAgo(latest.modifiedMs, language)}
                    </span>
                  </span>
                  <ArrowUpRight size={12} className="text-studio-500" />
                </button>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[10px] text-studio-500">
                  {t("build.noJapp")}
                </div>
              )}
              {validation.status !== "idle" ? (
                <div
                  className={cn(
                    "mt-2 flex items-start gap-2 rounded-lg border p-2 text-[9.5px] leading-4",
                    validation.status === "pass" && "border-mint-400/20 bg-mint-400/[0.06] text-mint-400",
                    validation.status === "fail" && "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
                    validation.status === "running" && "border-accent-500/20 bg-accent-500/[0.06] text-accent-300",
                  )}
                >
                  {validation.status === "pass" ? <ShieldCheck size={12} /> : <CircleAlert size={12} />}
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                    {validation.status === "running" ? t("build.validating") : validation.text || validation.status}
                  </span>
                </div>
              ) : null}
              <button
                className="btn btn-secondary mt-2 h-7 w-full text-[10px]"
                disabled={!activeArtifact}
                onClick={() => {
                  if (activeArtifact) {
                    void runAction(() => validateArtifact(activeArtifact), t("common.packageValid"));
                  }
                }}
              >
                <ShieldCheck size={11} /> {t("build.validateLatest")}
              </button>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-[0.15em] text-studio-500">
                  {t("build.environment")}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    cli?.ready ? "bg-mint-400" : "bg-amber-400",
                  )}
                />
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center gap-2 text-studio-400">
                  <Cpu size={11} className="text-studio-500" />
                  <span className="w-14 shrink-0">{t("settings.node")}</span>
                  <span className="truncate font-mono text-studio-300">
                    {cli?.nodeVersion || t("build.notFound")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-studio-400">
                  <Terminal size={11} className="text-studio-500" />
                  <span className="w-14 shrink-0">{t("settings.cli")}</span>
                  <span className="truncate font-mono text-studio-300">
                    {cli?.cliVersion || t("build.notFound")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-studio-400">
                  <FolderOpen size={11} className="text-studio-500" />
                  <span className="w-14 shrink-0">{t("build.workspace")}</span>
                  <span className="truncate font-mono text-studio-300" title={cli?.workspace ?? ""}>
                    {cli?.workspace || "—"}
                  </span>
                </div>
              </div>
              {!cli?.ready ? (
                <button
                  className="btn btn-secondary mt-2 h-7 w-full text-[10px]"
                  onClick={onSettings}
                >
                  {t("build.configureCli")}
                </button>
              ) : null}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export function PackagesSidebar() {
  const artifacts = useStudio((state) => state.artifacts);
  const activeArtifact = useStudio((state) => state.activeArtifact);
  const inspection = useStudio((state) => state.inspection);
  const inspecting = useStudio((state) => state.inspecting);
  const inspectArtifact = useStudio((state) => state.inspectArtifact);
  const validateArtifact = useStudio((state) => state.validateArtifact);
  const project = useStudio((state) => state.project);
  const { t, language } = useI18n();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.05] px-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-studio-400">
          {t("packages.title")}
        </span>
        <span className="text-[9px] text-studio-500">
          {t("packages.count", { count: artifacts.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2.5">
        {artifacts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[11px] leading-5 text-studio-500">
            {t("packages.empty")}
            <br />
            {t("packages.emptyHint")}
          </div>
        ) : (
          <div className="space-y-1.5">
            {artifacts.map((artifact) => (
              <div key={artifact.path}>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border p-2 text-left transition",
                    activeArtifact === artifact.path
                      ? "border-accent-500/30 bg-accent-500/[0.09]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/12",
                  )}
                  onClick={() => void runAction(() => inspectArtifact(artifact.path))}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint-400/10 text-mint-400">
                    <Package size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] font-medium text-studio-200">
                      {artifact.name}
                    </span>
                    <span className="text-[9px] text-studio-500">
                      {formatBytes(artifact.size)} · {timeAgo(artifact.modifiedMs, language)}
                    </span>
                  </span>
                  {inspecting && activeArtifact === artifact.path ? (
                    <Spinner size={11} className="text-accent-300" />
                  ) : (
                    <Boxes size={11} className="text-studio-500" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {inspection ? (
          <div className="mt-3 space-y-2.5">
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[9px] font-semibold tracking-[0.14em] text-studio-500">
                    {t("packages.inspection")}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-white">
                    {inspection.manifest.name}
                  </div>
                  <div className="text-[10px] text-studio-400">
                    v{inspection.manifest.version} · {formatBytes(inspection.size)}
                  </div>
                </div>
                <span className="chip chip-mint">{t("packages.valid")}</span>
              </div>
              <div className="mt-3 space-y-1.5 text-[9.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-studio-500">{t("packages.sha")}</span>
                  <span className="max-w-[170px] truncate font-mono text-studio-300" title={inspection.sha256}>
                    {inspection.sha256}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-studio-500">{t("packages.built")}</span>
                  <span className="text-studio-300">
                    {new Date(inspection.metadata.builtAt).toLocaleString(language === "vi" ? "vi-VN" : language === "zh" ? "zh-CN" : "en-US")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-studio-500">{t("packages.runtime")}</span>
                  <span className="text-studio-300">{inspection.manifest.minRuntimeVersion}</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(inspection.manifest.requestedPermissions.length
                  ? inspection.manifest.requestedPermissions
                  : [t("packages.noPermissions")]
                ).map((permission) => (
                  <span key={permission} className={cn("chip", permissionTone(permission) === "mint" && "chip-mint")}>
                    {permission}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-1.5">
                <button
                  className="btn btn-secondary h-7 flex-1 text-[10px]"
                  onClick={() => {
                    if (activeArtifact) {
                      void runAction(() => validateArtifact(activeArtifact), t("common.packageValid"));
                    }
                  }}
                >
                  <ShieldCheck size={11} /> {t("packages.validate")}
                </button>
                <button
                  className="btn btn-secondary h-7 px-2"
                  onClick={() => activeArtifact && void api.reveal(activeArtifact)}
                  title={t("packages.reveal")}
                >
                  <ArrowUpRight size={11} />
                </button>
              </div>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-[0.14em] text-studio-500">
                  {t("packages.files")}
                </span>
                <span className="text-[9px] text-studio-500">{inspection.files.length}</span>
              </div>
              <div className="space-y-1">
                {inspection.files.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-2 rounded-md px-1 py-1 text-[9.5px] hover:bg-white/[0.03]"
                  >
                    <FileCode2 size={11} className="shrink-0 text-studio-500" />
                    <span className="min-w-0 flex-1 truncate font-mono text-studio-300">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-studio-500">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : artifacts.length ? (
          <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[10px] leading-4 text-studio-500">
            {t("packages.selectHint")}
          </div>
        ) : null}

        {project ? (
          <button
            className="btn btn-ghost mt-3 h-7 w-full text-[10px]"
            onClick={() => void api.reveal(`${project.path}/dist`)}
          >
            <FolderOpen size={11} /> {t("packages.openDist")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar({ onSettings }: { onSettings: () => void }) {
  const tab = useStudio((state) => state.sidebarTab);
  return (
    <aside className="flex h-full min-h-0 flex-col bg-studio-900/65">
      {tab === "project" ? <ProjectTree /> : null}
      {tab === "build" ? <BuildSidebar onSettings={onSettings} /> : null}
      {tab === "packages" ? <PackagesSidebar /> : null}
    </aside>
  );
}

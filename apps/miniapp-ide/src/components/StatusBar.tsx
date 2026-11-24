import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  Loader2,
  Radio,
  Settings,
  TerminalSquare,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { useI18n } from "../lib/useI18n";
import { basename } from "../lib/utils";

export function StatusBar({ onSettings }: { onSettings: () => void }) {
  const cli = useStudio((state) => state.cli);
  const project = useStudio((state) => state.project);
  const cursor = useStudio((state) => state.cursor);
  const settings = useStudio((state) => state.settings);
  const buildStatus = useStudio((state) => state.buildStatus);
  const buildMessage = useStudio((state) => state.buildMessage);
  const devRunning = useStudio((state) => state.devRunning);
  const activePath = useStudio((state) => state.activePath);
  const tabs = useStudio((state) => state.tabs);
  const active = tabs.find((tab) => tab.path === activePath);
  const dirty = Boolean(active && active.content !== active.saved);
  const { t } = useI18n();

  return (
    <footer
      className="relative z-30 flex h-[22px] shrink-0 items-center gap-3 bg-accent-500 px-2.5 text-[10px] text-white/90"
      data-keep-white
    >
      <button
        className="flex items-center gap-1.5 px-1 py-0.5 transition hover:bg-white/15"
        onClick={onSettings}
        title={cli?.error || cli?.cliPath || t("status.cliStatus")}
      >
        {cli?.ready ? (
          <CircleCheck size={11} className="text-white" />
        ) : (
          <CircleAlert size={11} className="text-amber-300" />
        )}
        <span className={cli?.ready ? "text-white" : "text-amber-200"}>
          {cli?.ready ? t("status.cliConnected") : t("status.cliOffline")}
        </span>
      </button>

      <span className="h-3 w-px bg-white/25" />

      <span className="flex min-w-0 items-center gap-1.5">
        <TerminalSquare size={10} className="shrink-0" />
        <span className="truncate">
          {project ? project.name : t("app.title")}
          {project ? <span className="text-white/60"> / {basename(project.path)}</span> : null}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-3">
        {devRunning ? (
          <span className="flex items-center gap-1 text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {t("status.watching")}
          </span>
        ) : null}
        {buildStatus === "running" ? (
          <span className="flex items-center gap-1 text-white">
            <Loader2 size={10} className="animate-spin" /> {t("status.building")}
          </span>
        ) : buildStatus === "error" ? (
          <span className="flex max-w-[260px] items-center gap-1 truncate text-white" title={buildMessage}>
            <CircleAlert size={10} /> {buildMessage || t("status.buildFailed")}
          </span>
        ) : buildStatus === "success" ? (
          <span className="flex items-center gap-1 text-white">
            <CircleCheck size={10} /> {t("status.verified")}
          </span>
        ) : null}

        {active ? (
          <>
            <span className="hidden items-center gap-1 sm:flex">
              <CircleDot size={9} className={dirty ? "text-amber-300" : "text-white"} />
              {dirty ? t("status.modified") : t("status.saved")}
            </span>
            <span className="hidden font-mono text-white/90 md:inline">
              {t("common.lnCol", { line: cursor.line, column: cursor.column })}
            </span>
            <span className="hidden text-white/70 lg:inline">{t("status.spaces")}</span>
            <span className="hidden font-mono text-white/70 xl:inline">
              {active.language}
            </span>
          </>
        ) : null}
        <span className="hidden text-white/70 sm:inline">UTF-8</span>
        <span className="hidden items-center gap-1 text-white/70 md:flex">
          <Radio size={9} /> {settings.fontSize}px
        </span>
        <button
          className="flex items-center gap-1 px-1 py-0.5 text-white/90 transition hover:bg-white/15 hover:text-white"
          onClick={onSettings}
        >
          <Settings size={9} /> {t("status.sdk")}
        </button>
      </div>
    </footer>
  );
}

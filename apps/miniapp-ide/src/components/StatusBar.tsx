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
    <footer className="relative z-30 flex h-[25px] shrink-0 items-center gap-3 border-t border-white/[0.07] bg-studio-950/90 px-2.5 text-[9px] text-studio-500">
      <button
        className="flex items-center gap-1.5 rounded px-1 py-0.5 transition hover:bg-white/[0.05] hover:text-studio-300"
        onClick={onSettings}
        title={cli?.error || cli?.cliPath || t("status.cliStatus")}
      >
        {cli?.ready ? (
          <CircleCheck size={11} className="text-mint-400" />
        ) : (
          <CircleAlert size={11} className="text-amber-400" />
        )}
        <span className={cli?.ready ? "text-studio-300" : "text-amber-300"}>
          {cli?.ready ? t("status.cliConnected") : t("status.cliOffline")}
        </span>
      </button>

      <span className="h-3 w-px bg-white/[0.07]" />

      <span className="flex min-w-0 items-center gap-1.5">
        <TerminalSquare size={10} className="shrink-0" />
        <span className="truncate">
          {project ? project.name : t("app.title")}
          {project ? <span className="text-studio-600"> / {basename(project.path)}</span> : null}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-3">
        {devRunning ? (
          <span className="flex items-center gap-1 text-mint-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
            {t("status.watching")}
          </span>
        ) : null}
        {buildStatus === "running" ? (
          <span className="flex items-center gap-1 text-accent-300">
            <Loader2 size={10} className="animate-spin" /> {t("status.building")}
          </span>
        ) : buildStatus === "error" ? (
          <span className="flex max-w-[260px] items-center gap-1 truncate text-rose-300" title={buildMessage}>
            <CircleAlert size={10} /> {buildMessage || t("status.buildFailed")}
          </span>
        ) : buildStatus === "success" ? (
          <span className="flex items-center gap-1 text-mint-400">
            <CircleCheck size={10} /> {t("status.verified")}
          </span>
        ) : null}

        {active ? (
          <>
            <span className="hidden items-center gap-1 sm:flex">
              <CircleDot size={9} className={dirty ? "text-amber-300" : "text-mint-400"} />
              {dirty ? t("status.modified") : t("status.saved")}
            </span>
            <span className="hidden font-mono text-studio-400 md:inline">
              {t("common.lnCol", { line: cursor.line, column: cursor.column })}
            </span>
            <span className="hidden text-studio-500 lg:inline">{t("status.spaces")}</span>
            <span className="hidden font-mono text-studio-500 xl:inline">
              {active.language}
            </span>
          </>
        ) : null}
        <span className="hidden text-studio-500 sm:inline">UTF-8</span>
        <span className="hidden items-center gap-1 text-studio-500 md:flex">
          <Radio size={9} /> {settings.fontSize}px
        </span>
        <button
          className="flex items-center gap-1 rounded px-1 py-0.5 text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-200"
          onClick={onSettings}
        >
          <Settings size={9} /> {t("status.sdk")}
        </button>
      </div>
    </footer>
  );
}

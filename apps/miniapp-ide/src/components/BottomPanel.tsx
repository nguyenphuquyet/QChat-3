import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleAlert,
  Clock3,
  Eraser,
  Maximize2,
  Minimize2,
  Play,
  Square,
  Terminal as TerminalIcon,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { useI18n } from "../lib/useI18n";
import { cn, clockTime } from "../lib/utils";

export function BottomPanel({
  height,
  onMaximize,
  maximized,
}: {
  height?: number;
  onMaximize: () => void;
  maximized: boolean;
}) {
  const logs = useStudio((state) => state.logs);
  const problems = useStudio((state) => state.problems);
  const tab = useStudio((state) => state.bottomTab);
  const setTab = useStudio((state) => state.setBottomTab);
  const setOpen = useStudio((state) => state.setBottomOpen);
  const clearLogs = useStudio((state) => state.clearLogs);
  const buildStatus = useStudio((state) => state.buildStatus);
  const devRunning = useStudio((state) => state.devRunning);
  const runTerminal = useStudio((state) => state.runTerminal);
  const stopDev = useStudio((state) => state.stopDev);
  const [command, setCommand] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalHistory = useStudio((state) => state.terminalHistory);
  const outputRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (tab !== "output" || !stickRef.current) return;
    const node = outputRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs, tab]);

  useEffect(() => {
    if (tab === "terminal") {
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [tab]);

  const errors = problems.filter((problem) => problem.severity === "error").length;
  const warnings = problems.length - errors;
  const running = buildStatus === "running";

  const execute = () => {
    const value = command.trim();
    if (!value) return;
    setCommand("");
    setHistoryIndex(-1);
    void runTerminal(value);
  };

  return (
    <section
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col border-t border-white/[0.065] bg-studio-950/75",
        height === undefined && "flex-1",
      )}
      style={height === undefined ? undefined : { height }}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-white/[0.05] px-1.5">
        <div className="flex items-stretch gap-0.5">
          <button
            className={cn(
              "relative flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold uppercase tracking-wider transition",
              tab === "output" ? "bg-white/[0.06] text-studio-100" : "text-studio-500 hover:text-studio-300",
            )}
            onClick={() => setTab("output")}
          >
            {t("bottom.output")}
            {logs.length ? <span className="rounded bg-white/[0.07] px-1 text-[8.5px] text-studio-400">{logs.length}</span> : null}
          </button>
          <button
            className={cn(
              "flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold uppercase tracking-wider transition",
              tab === "problems" ? "bg-white/[0.06] text-studio-100" : "text-studio-500 hover:text-studio-300",
            )}
            onClick={() => setTab("problems")}
          >
            {t("bottom.problems")}
            {problems.length ? (
              <span
                className={cn(
                  "rounded px-1 text-[8.5px]",
                  errors ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-300",
                )}
              >
                {problems.length}
              </span>
            ) : null}
          </button>
          <button
            className={cn(
              "flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold uppercase tracking-wider transition",
              tab === "terminal" ? "bg-white/[0.06] text-studio-100" : "text-studio-500 hover:text-studio-300",
            )}
            onClick={() => setTab("terminal")}
          >
            {t("bottom.terminal")}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5 pr-1">
          {running ? (
            <span className="flex items-center gap-1.5 text-[9px] font-medium text-accent-300">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-accent-400/30 border-t-accent-300" />
              {t("bottom.working")}
            </span>
          ) : null}
          {devRunning ? (
            <button
              className="flex items-center gap-1 rounded-full border border-mint-400/20 bg-mint-400/[0.08] px-2 py-0.5 text-[9px] font-semibold text-mint-400"
              onClick={() => void stopDev()}
              title={t("bottom.stopDev")}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
              {t("bottom.watching")}
              <Square size={7} />
            </button>
          ) : null}
          <button className="icon-btn h-6 w-6" onClick={clearLogs} title={t("bottom.clear")}>
            <Eraser size={12} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={onMaximize}
            title={maximized ? t("bottom.restore") : t("bottom.maximize")}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button className="icon-btn h-6 w-6" onClick={() => setOpen(false)} title={t("bottom.hide")}>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {tab === "output" ? (
        <div
          ref={outputRef}
          className="min-h-0 flex-1 overflow-auto px-3 py-2"
          onScroll={(event) => {
            const node = event.currentTarget;
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
          }}
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 text-[10.5px] text-studio-600">
              <TerminalIcon size={13} /> {t("bottom.emptyOutput")}
            </div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="flex gap-2 py-[1px]">
                <span className="w-[58px] shrink-0 select-none text-right font-mono text-[9px] leading-[1.65] text-studio-600">
                  {clockTime(entry.at)}
                </span>
                <span
                  className={cn(
                    "mt-[6px] h-1 w-1 shrink-0 rounded-full",
                    entry.stream === "stderr" && "bg-rose-400",
                    entry.stream === "stdout" && "bg-mint-400",
                    entry.stream === "system" && "bg-accent-400",
                  )}
                />
                <span
                  className={cn(
                    "output-line min-w-0 flex-1",
                    entry.stream === "stderr" && "text-rose-300/90",
                    entry.stream === "stdout" && "text-studio-300",
                    entry.stream === "system" && "text-accent-300/90",
                  )}
                >
                  {entry.text}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "problems" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {problems.length === 0 ? (
            <div className="flex h-full items-center justify-center gap-2 text-[10.5px] text-studio-600">
              <CircleAlert size={13} /> {t("bottom.noProblems")}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.035]">
              {problems.map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-start gap-2.5 px-3 py-2 transition hover:bg-white/[0.025]"
                >
                  {problem.severity === "error" ? (
                    <XCircle size={13} className="mt-0.5 shrink-0 text-rose-400" />
                  ) : (
                    <TriangleAlert size={13} className="mt-0.5 shrink-0 text-amber-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="select-text font-mono text-[10px] leading-4 text-studio-300">
                      {problem.text}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[8.5px] uppercase tracking-wider text-studio-600">
                      <span>{problem.source}</span>
                      <span>·</span>
                      <span>{problem.severity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "terminal" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[10px] leading-[1.65]">
            {terminalHistory.length === 0 ? (
              <div className="mb-2 text-studio-600">
                {t("bottom.terminalHint")}
              </div>
            ) : (
              terminalHistory
                .slice()
                .reverse()
                .map((item, index) => (
                  <div key={`${item}-${index}`} className="flex gap-1.5 text-studio-400">
                    <span className="text-mint-400">❯</span>
                    <span className="break-all">{item}</span>
                  </div>
                ))
            )}
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-studio-600">
              <Clock3 size={9} /> {t("bottom.terminalNote")}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-white/[0.05] px-3 py-2">
            <span className="font-mono text-[10px] text-mint-400">qapp</span>
            <input
              ref={inputRef}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  execute();
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  const next = Math.min(historyIndex + 1, terminalHistory.length - 1);
                  if (next >= 0) {
                    setHistoryIndex(next);
                    setCommand(terminalHistory[next]);
                  }
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  const next = Math.max(historyIndex - 1, -1);
                  setHistoryIndex(next);
                  setCommand(next < 0 ? "" : terminalHistory[next]);
                }
              }}
              placeholder="build --dir ."
              className="min-w-0 flex-1 bg-transparent font-mono text-[10.5px] text-studio-200 outline-none placeholder:text-studio-600"
            />
            <button
              className="flex h-6 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-[9px] font-semibold text-studio-300 transition hover:border-white/15 hover:text-white"
              onClick={execute}
            >
              <Play size={9} /> {t("bottom.run")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  ArrowRight,
  Boxes,
  Braces,
  Check,
  ChevronRight,
  Command,
  Cpu,
  FileCode2,
  FileJson2,
  FilePlus2,
  FileText,
  FolderOpen,
  Hammer,
  Image as ImageIcon,
  Package,
  Rocket,
  Save,
  Settings,
  Sparkles,
  Terminal,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { api } from "../lib/api";
import { useI18n } from "../lib/useI18n";
import { cn, basename, languageFor, timeAgo } from "../lib/utils";
import { runAction } from "../lib/feedback";
import { configureMonaco, monaco } from "../lib/monaco";
import { Spinner } from "./ui";
import type { StudioCommands } from "./TitleBar";

function TabIcon({ language }: { language: string }) {
  switch (language) {
    case "typescript":
    case "javascript":
      return <FileCode2 size={13} className="text-cyan-300" />;
    case "json":
      return <FileJson2 size={13} className="text-amber-300" />;
    case "markdown":
    case "plaintext":
      return <FileText size={13} className="text-studio-300" />;
    case "image":
      return <ImageIcon size={13} className="text-rose-300" />;
    default:
      return <FileCode2 size={13} className="text-studio-300" />;
  }
}

export function Welcome({ commands }: { commands: StudioCommands }) {
  const cli = useStudio((state) => state.cli);
  const recent = useStudio((state) => state.recent);
  const openProject = useStudio((state) => state.openProject);
  const settings = useStudio((state) => state.settings);
  const detecting = useStudio((state) => state.detecting);
  const desktop = api.isDesktop();
  const { t, language } = useI18n();

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-auto">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -left-24 -top-32 h-[420px] w-[420px] rounded-full bg-accent-600/[0.13] blur-[100px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[360px] w-[360px] rounded-full bg-mint-500/[0.06] blur-[110px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-1 flex-col justify-center px-10 py-10">
        <div className="grid gap-10 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-slide-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-500/25 bg-accent-500/[0.08] px-3 py-1 text-[10px] font-semibold tracking-wide text-accent-300">
              <Sparkles size={12} />
              {t("welcome.badge")}
            </div>
            <h1 className="max-w-[600px] text-[42px] font-semibold leading-[1.06] tracking-[-0.035em] text-white">
              {t("welcome.hero1")}
              <br />
              <span className="gradient-text">{t("welcome.hero2")}</span>
            </h1>
            <p className="mt-4 max-w-[500px] text-[13.5px] leading-6 text-studio-400">
              {t("welcome.desc")}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button className="btn btn-primary h-9 px-4 text-[12px]" onClick={commands.newProject}>
                <FilePlus2 size={15} /> {t("welcome.new")}
              </button>
              <button className="btn btn-secondary h-9 px-4 text-[12px]" onClick={commands.openProject}>
                <FolderOpen size={15} /> {t("welcome.open")}
              </button>
              <button
                className="btn btn-ghost h-9 px-3 text-[11px]"
                onClick={commands.palette}
              >
                <Command size={14} /> {t("welcome.commands")}
                <span className="kbd ml-1">Ctrl K</span>
              </button>
            </div>

            <div className="mt-9">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9.5px] font-semibold tracking-[0.16em] text-studio-500">
                  {t("welcome.recent")}
                </span>
                {recent.length ? (
                  <span className="text-[9px] text-studio-600">
                    {t("welcome.savedCount", { count: recent.length })}
                  </span>
                ) : null}
              </div>
              {recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.09] bg-white/[0.015] px-4 py-5 text-[11px] leading-5 text-studio-500">
                  {t("welcome.noRecent")}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  {recent.slice(0, 4).map((item) => (
                    <button
                      key={item.path}
                      className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[0.045]"
                      onClick={() => void runAction(() => openProject(item.path))}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-gradient-to-br from-accent-500/20 to-cyan-400/10 text-[10px] font-bold text-accent-200">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-medium text-studio-200">
                            {item.name}
                          </span>
                          {item.version ? (
                            <span className="chip text-[8.5px]">v{item.version}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[9px] text-studio-500">
                          {item.path}
                        </span>
                      </span>
                      <span className="shrink-0 text-[9px] text-studio-600">
                        {timeAgo(item.openedAt, language)}
                      </span>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-studio-600 transition group-hover:translate-x-0.5 group-hover:text-studio-300"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 animate-slide-up" style={{ animationDelay: "70ms" }}>
            <div className="panel relative overflow-hidden rounded-2xl p-4 shadow-panel">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-500/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-semibold tracking-[0.16em] text-studio-500">
                  {t("welcome.status")}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold",
                    cli?.ready
                      ? "bg-mint-400/10 text-mint-400"
                      : "bg-amber-400/10 text-amber-300",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      cli?.ready ? "bg-mint-400" : "bg-amber-400",
                    )}
                  />
                  {detecting
                    ? t("welcome.detecting")
                    : cli?.ready
                      ? t("welcome.ready")
                      : t("welcome.needsSetup")}
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <StatusRow
                  icon={<Terminal size={12} />}
                  label={t("welcome.cli")}
                  value={cli?.cliVersion || t("common.notDetected")}
                  ok={Boolean(cli?.ready)}
                />
                <StatusRow
                  icon={<Cpu size={12} />}
                  label={t("welcome.node")}
                  value={cli?.nodeVersion || t("common.notDetected")}
                  ok={Boolean(cli?.nodeVersion)}
                />
                <StatusRow
                  icon={<Braces size={12} />}
                  label={t("welcome.ts")}
                  value={t("welcome.tsValue")}
                  ok={Boolean(cli?.ready)}
                />
                <StatusRow
                  icon={<Boxes size={12} />}
                  label={t("welcome.packages")}
                  value={t("welcome.packagesValue")}
                  ok
                />
              </div>

              {!desktop ? (
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[10px] leading-4 text-amber-200/90">
                  {t("welcome.browserWarning")}
                </div>
              ) : !cli?.ready ? (
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[10px] leading-4 text-amber-200/90">
                  {cli?.error || t("welcome.cliMissing")}
                </div>
              ) : null}

              <div className="mt-3 flex gap-1.5">
                <button
                  className="btn btn-secondary h-7 flex-1 text-[10px]"
                  onClick={commands.settings}
                >
                  <Settings size={11} /> {t("welcome.configure")}
                </button>
                <button
                  className="btn btn-secondary h-7 px-2 text-[10px]"
                  onClick={() => void useStudio.getState().detect()}
                >
                  <Zap size={11} /> {t("welcome.detect")}
                </button>
              </div>
            </div>

            <div className="panel rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Rocket size={14} className="text-mint-400" />
                <span className="text-[11.5px] font-semibold text-studio-100">{t("welcome.steps")}</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  [t("welcome.stepCreate"), t("welcome.stepCreateDetail")],
                  [t("welcome.stepBuild"), t("welcome.stepBuildDetail")],
                  [t("welcome.stepRelease"), t("welcome.stepReleaseDetail")],
                ].map(([title, detail], index) => (
                  <div key={title} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] font-mono text-[9px] text-studio-300">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[10.5px] font-medium text-studio-200">{title}</span>
                      <span className="text-[9.5px] leading-4 text-studio-500">{detail}</span>
                    </span>
                  </div>
                ))}
              </div>
              <button
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] py-1.5 text-[10px] font-medium text-studio-300 transition hover:border-white/15 hover:text-white"
                onClick={() =>
                  void api.openUrl(
                    "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md",
                  )
                }
              >
                {t("welcome.guide")} <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-9 grid gap-2 border-t border-white/[0.055] pt-5 sm:grid-cols-3">
          <MiniFeature
            icon={<Hammer size={13} />}
            title={t("welcome.featCompiler")}
            detail={t("welcome.featCompilerDetail")}
          />
          <MiniFeature
            icon={<Package size={13} />}
            title={t("welcome.featPackage")}
            detail={t("welcome.featPackageDetail")}
          />
          <MiniFeature
            icon={<Cpu size={13} />}
            title={t("welcome.featRuntime")}
            detail={t("welcome.featRuntimeDetail")}
          />
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className={cn("text-studio-500", ok && "text-mint-400/80")}>{icon}</span>
      <span className="w-24 shrink-0 text-studio-400">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[9.5px] text-studio-300">
        {value}
      </span>
      {ok ? <Check size={10} className="shrink-0 text-mint-400" /> : null}
    </div>
  );
}

function MiniFeature({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-accent-300">
        {icon}
      </span>
      <span>
        <span className="block text-[10.5px] font-medium text-studio-200">{title}</span>
        <span className="text-[9.5px] text-studio-500">{detail}</span>
      </span>
    </div>
  );
}

export function EditorArea() {
  const project = useStudio((state) => state.project);
  const tabs = useStudio((state) => state.tabs);
  const activePath = useStudio((state) => state.activePath);
  const settings = useStudio((state) => state.settings);
  const updateTab = useStudio((state) => state.updateTab);
  const saveFile = useStudio((state) => state.saveFile);
  const saveActive = useStudio((state) => state.saveActive);
  const closeTab = useStudio((state) => state.closeTab);
  const setActive = useStudio((state) => state.setActive);
  const setCursor = useStudio((state) => state.setCursor);
  const openFile = useStudio((state) => state.openFile);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { t } = useI18n();

  const active = useMemo(
    () => tabs.find((tab) => tab.path === activePath) ?? null,
    [tabs, activePath],
  );
  const dirty = active ? active.content !== active.saved : false;

  useEffect(() => {
    configureMonaco();
  }, []);

  useEffect(() => {
    if (!settings.autoSave || !active || active.content === active.saved) return;
    const timer = window.setTimeout(() => {
      void saveFile(active.path);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings.autoSave, active?.path, active?.content, active?.saved, saveFile]);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveActive();
    });
    editor.onDidChangeCursorPosition((event) => {
      setCursor(event.position.lineNumber, event.position.column);
    });
    editor.focus();
  };

  if (!project) return null;

  const relative = active
    ? active.path.startsWith(project.path)
      ? active.path.slice(project.path.length + 1)
      : basename(active.path)
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-900/45">
      <div className="flex h-[38px] shrink-0 items-stretch overflow-x-auto border-b border-white/[0.06] bg-studio-950/35">
        {tabs.length === 0 ? (
          <div className="flex items-center px-3 text-[10.5px] text-studio-500">
            {t("editor.noFile")}
          </div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.path === activePath;
            const tabDirty = tab.content !== tab.saved;
            return (
              <div
                key={tab.path}
                className={cn("tab group min-w-[120px] max-w-[210px] shrink-0", isActive && "tab-active")}
                onClick={() => setActive(tab.path)}
                title={tab.path}
              >
                <TabIcon language={tab.language} />
                <span className="truncate">{tab.name}</span>
                {tabDirty ? (
                  <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
                ) : null}
                <button
                  className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-studio-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.path);
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })
        )}
        <div className="flex flex-1 items-center justify-end gap-0.5 px-2">
          <button
            className="icon-btn h-6 w-6"
            onClick={() => void saveActive()}
            disabled={!active || !dirty}
            title={t("editor.save")}
          >
            <Save size={13} className={cn(dirty && "text-accent-300")} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => {
              editorRef.current?.getAction("editor.action.formatDocument")?.run();
            }}
            disabled={!active}
            title={t("editor.format")}
          >
            <Wand2 size={13} />
          </button>
        </div>
      </div>

      {active ? (
        <>
          <div className="flex h-7 shrink-0 items-center gap-1 border-b border-white/[0.045] px-3 text-[9.5px] text-studio-500">
            <span className="text-studio-400">{project.name}</span>
            {relative.split(/[\\/]/).map((part, index) => (
              <span key={`${part}-${index}`} className="flex items-center gap-1">
                <ChevronRight size={9} className="text-studio-600" />
                <span className={index === relative.split(/[\\/]/).length - 1 ? "text-studio-300" : ""}>
                  {part}
                </span>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-2 text-[9px]">
              {dirty ? (
                <span className="flex items-center gap-1 text-amber-300/90">
                  <span className="h-1 w-1 rounded-full bg-amber-300" /> {t("common.unsaved")}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-studio-500">
                  <Check size={9} className="text-mint-400" /> {t("common.saved")}
                </span>
              )}
              <span className="font-mono text-studio-500">{languageFor(active.path)}</span>
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            <Editor
              path={active.path}
              language={active.language}
              value={active.content}
              theme={settings.theme === "light" ? "qchat-studio-light" : "qchat-studio"}
              onMount={onMount}
              onChange={(value) => updateTab(active.path, value ?? "")}
              loading={
                <div className="flex h-full items-center justify-center gap-2 text-[11px] text-studio-500">
                  <Spinner /> {t("common.loadingEditor")}
                </div>
              }
              options={{
                fontSize: settings.fontSize,
                fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
                fontLigatures: true,
                minimap: { enabled: settings.minimap, scale: 0.75 },
                wordWrap: settings.wordWrap ? "on" : "off",
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                renderLineHighlight: "line",
                padding: { top: 14, bottom: 20 },
                lineNumbersMinChars: 3,
                glyphMargin: false,
                folding: true,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                tabSize: 2,
                automaticLayout: true,
                stickyScroll: { enabled: false },
                scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                contextmenu: true,
                quickSuggestions: true,
              }}
            />
          </div>
        </>
      ) : (
        <EmptyEditor />
      )}
    </div>
  );
}

function EmptyEditor() {
  const project = useStudio((state) => state.project);
  const tree = useStudio((state) => state.tree);
  const openFile = useStudio((state) => state.openFile);
  const buildProject = useStudio((state) => state.buildProject);
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-studio-900/20 p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-accent-500/15 to-cyan-400/5 text-accent-300">
        <FileCode2 size={24} />
      </div>
      <div className="text-center">
        <div className="text-[13px] font-semibold text-studio-200">{t("editor.noEditor")}</div>
        <div className="mt-1 text-[11px] text-studio-500">
          {t("editor.choose")}
        </div>
      </div>
      <div className="flex gap-2">
        {tree.find((entry) => entry.relative === "src/main.tsx") ? (
          <button
            className="btn btn-primary h-7 text-[10.5px]"
            onClick={() => {
              const entry = tree.find((item) => item.relative === "src/main.tsx");
              if (entry) void openFile(entry.path);
            }}
          >
            <FileCode2 size={12} /> {t("editor.openMain")}
          </button>
        ) : null}
        <button
          className="btn btn-secondary h-7 text-[10.5px]"
          onClick={() => void runAction(() => buildProject(false), t("common.packageBuilt"))}
          disabled={!project}
        >
          <Hammer size={12} /> {t("editor.buildProject")}
        </button>
      </div>
    </div>
  );
}



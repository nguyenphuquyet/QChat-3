import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Cpu,
  FolderOpen,
  Info,
  Languages,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Sun,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "../lib/store";
import { api } from "../lib/api";
import { LANGUAGES } from "../lib/i18n";
import { useI18n } from "../lib/useI18n";
import { cn, joinPath } from "../lib/utils";
import type { Settings as StudioSettings } from "../types";
import { Dialog, DialogHeader, Spinner, Toggle } from "./ui";

const DEFAULTS: StudioSettings = {
  nodePath: "",
  cliPath: "",
  projectsDir: "",
  autoSave: false,
  fontSize: 13,
  minimap: false,
  wordWrap: true,
  confirmDelete: true,
  language: "vi",
  theme: "dark",
};

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useStudio((state) => state.settings);
  const cli = useStudio((state) => state.cli);
  const detecting = useStudio((state) => state.detecting);
  const updateSettings = useStudio((state) => state.updateSettings);
  const detect = useStudio((state) => state.detect);
  const desktop = api.isDesktop();
  const { t } = useI18n();

  const [draft, setDraft] = useState<StudioSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const set = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const apply = async (close: boolean) => {
    setSaving(true);
    updateSettings(draft);
    const info = await detect();
    setSaving(false);
    if (info?.ready) toast.success(t("settings.cliConnectedToast"));
    else toast.error(info?.error || t("settings.cliNotFoundToast"));
    if (close) onClose();
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t("common.copied"));
  };

  return (
    <Dialog open={open} onClose={onClose} width="max-w-3xl">
      <DialogHeader
        icon={<Settings size={16} />}
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        onClose={onClose}
      />

      <div className="max-h-[72vh] overflow-auto">
        <div className="grid gap-0 md:grid-cols-[1fr_280px]">
          <div className="space-y-5 p-5">
            <section>
              <div className="label">{t("settings.appearance")}</div>
              <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-studio-400">
                    <Languages size={11} /> {t("settings.language")}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LANGUAGES.map((item) => {
                      const active = draft.language === item.id;
                      return (
                        <button
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium transition",
                            active
                              ? "border-accent-500/40 bg-accent-500/[0.12] text-accent-300"
                              : "border-white/[0.07] bg-white/[0.02] text-studio-300 hover:border-white/15 hover:text-studio-100",
                          )}
                          onClick={() => set("language", item.id)}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="text-[8.5px] font-semibold opacity-70">{item.short}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[9px] leading-4 text-studio-500">
                    {t("settings.languageHint")}
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-studio-400">
                    <Sun size={11} /> {t("settings.theme")}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      ["dark", t("settings.themeDark"), <Moon key="dark" size={12} />],
                      ["light", t("settings.themeLight"), <Sun key="light" size={12} />],
                    ] as const).map(([value, label, icon]) => {
                      const active = draft.theme === value;
                      return (
                        <button
                          key={value}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-medium transition",
                            active
                              ? "border-accent-500/40 bg-accent-500/[0.12] text-accent-300"
                              : "border-white/[0.07] bg-white/[0.02] text-studio-300 hover:border-white/15 hover:text-studio-100",
                          )}
                          onClick={() => set("theme", value)}
                        >
                          {icon}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[9px] leading-4 text-studio-500">
                    {t("settings.themeHint")}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">QChat CLI</span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-semibold",
                    cli?.ready
                      ? "bg-mint-400/10 text-mint-400"
                      : "bg-amber-400/10 text-amber-300",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", cli?.ready ? "bg-mint-400" : "bg-amber-400")} />
                  {cli?.ready ? t("settings.cliConnected") : t("settings.cliNotConnected")}
                </span>
              </div>

              <label className="label" htmlFor="node-path">{t("settings.nodeExe")}</label>
              <div className="flex gap-1.5">
                <input
                  id="node-path"
                  className="field font-mono text-[10px]"
                  value={draft.nodePath}
                  onChange={(event) => set("nodePath", event.target.value)}
                  placeholder={t("settings.nodePlaceholder")}
                />
                <button
                  className="btn btn-secondary h-[34px] px-2.5"
                  onClick={() => {
                    void api.pickFile(draft.nodePath).then((path) => {
                      if (path) set("nodePath", path);
                    });
                  }}
                  title={t("common.browse")}
                >
                  <FolderOpen size={12} />
                </button>
              </div>

              <label className="label mt-3" htmlFor="cli-path">{t("settings.cliScript")}</label>
              <div className="flex gap-1.5">
                <input
                  id="cli-path"
                  className="field font-mono text-[10px]"
                  value={draft.cliPath}
                  onChange={(event) => set("cliPath", event.target.value)}
                  placeholder={t("settings.cliPlaceholder")}
                />
                <button
                  className="btn btn-secondary h-[34px] px-2.5"
                  onClick={() => {
                    void api.pickFile(draft.cliPath).then((path) => {
                      if (path) set("cliPath", path);
                    });
                  }}
                  title={t("common.browse")}
                >
                  <FolderOpen size={12} />
                </button>
              </div>

              <label className="label mt-3" htmlFor="projects-dir">{t("settings.defaultLocation")}</label>
              <div className="flex gap-1.5">
                <input
                  id="projects-dir"
                  className="field font-mono text-[10px]"
                  value={draft.projectsDir}
                  onChange={(event) => set("projectsDir", event.target.value)}
                  placeholder={t("settings.defaultLocationPlaceholder")}
                />
                <button
                  className="btn btn-secondary h-[34px] px-2.5"
                  onClick={() => {
                    void api.pickDirectory(draft.projectsDir).then((path) => {
                      if (path) set("projectsDir", path);
                    });
                  }}
                  title={t("common.browse")}
                >
                  <FolderOpen size={12} />
                </button>
              </div>
            </section>

            <section>
              <div className="label">{t("settings.editor")}</div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-1">
                <Toggle
                  checked={draft.autoSave}
                  onChange={(value) => set("autoSave", value)}
                  label={t("settings.autoSave")}
                  description={t("settings.autoSaveDesc")}
                />
                <Toggle
                  checked={draft.wordWrap}
                  onChange={(value) => set("wordWrap", value)}
                  label={t("settings.wordWrap")}
                  description={t("settings.wordWrapDesc")}
                />
                <Toggle
                  checked={draft.minimap}
                  onChange={(value) => set("minimap", value)}
                  label={t("settings.minimap")}
                  description={t("settings.minimapDesc")}
                />
                <Toggle
                  checked={draft.confirmDelete}
                  onChange={(value) => set("confirmDelete", value)}
                  label={t("settings.confirmDelete")}
                  description={t("settings.confirmDeleteDesc")}
                />
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                <span className="text-[10px] text-studio-400">{t("settings.fontSize")}</span>
                <input
                  type="range"
                  min={11}
                  max={18}
                  step={1}
                  value={draft.fontSize}
                  onChange={(event) => set("fontSize", Number(event.target.value))}
                  className="h-1 flex-1 accent-[#7c6cff]"
                />
                <span className="w-8 text-right font-mono text-[10px] text-studio-200">
                  {draft.fontSize}px
                </span>
              </div>
            </section>

            <section>
              <div className="label">{t("settings.commands")}</div>
              <div className="space-y-1.5">
                {[
                  "corepack pnpm install",
                  "corepack pnpm --filter @mna/qchat build",
                ].map((command) => (
                  <div
                    key={command}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5"
                  >
                    <Terminal size={11} className="shrink-0 text-mint-400" />
                    <code className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-studio-300">
                      {command}
                    </code>
                    <button className="icon-btn h-5 w-5" onClick={() => void copy(command)}>
                      <Copy size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="border-t border-white/[0.065] bg-black/15 p-5 md:border-l md:border-t-0">
            <div className="label">{t("settings.detected")}</div>
            <div className="space-y-2.5">
              <InfoRow icon={<Cpu size={11} />} label={t("settings.node")} value={cli?.nodeVersion || t("common.notDetected")} ok={Boolean(cli?.nodeVersion)} />
              <InfoRow icon={<Terminal size={11} />} label={t("settings.cli")} value={cli?.cliVersion || t("common.notDetected")} ok={Boolean(cli?.ready)} />
              <InfoRow icon={<Settings size={11} />} label={t("settings.platform")} value={`${cli?.platform || "—"} ${cli?.arch || ""}`} ok />
            </div>

            <div className="mt-3">
              <div className="text-[8.5px] uppercase tracking-wider text-studio-500">{t("settings.resolvedCli")}</div>
              <div className="mt-1 break-all rounded-lg border border-white/[0.06] bg-black/20 p-2 font-mono text-[8.5px] leading-4 text-studio-400">
                {cli?.cliPath || t("common.notFound")}
              </div>
            </div>

            {cli?.workspace ? (
              <div className="mt-3">
                <div className="text-[8.5px] uppercase tracking-wider text-studio-500">{t("settings.workspace")}</div>
                <div className="mt-1 break-all rounded-lg border border-white/[0.06] bg-black/20 p-2 font-mono text-[8.5px] leading-4 text-studio-400">
                  {cli.workspace}
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-studio-500">
                <Info size={10} /> {t("settings.freshCheckout")}
              </div>
              <p className="mt-1.5 text-[9px] leading-4 text-studio-500">
                {t("settings.freshCheckoutDesc")}
              </p>
              <p className="mt-1.5 break-all font-mono text-[8.5px] leading-4 text-studio-400">
                {joinPath(cli?.workspace || "…", "packages", "miniapp-framework", "dist", "cli.js")}
              </p>
              <button
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 text-[9px] font-medium text-studio-300 transition hover:border-white/15 hover:text-white"
                onClick={() => void copy(joinPath(cli?.workspace || "", "packages", "miniapp-framework", "dist", "cli.js"))}
              >
                <Copy size={10} /> {t("settings.copyCliPath")}
              </button>
            </div>

            {!desktop ? (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[9px] leading-4 text-amber-200/90">
                <CircleAlert size={12} className="mt-0.5 shrink-0" />
                {t("settings.browserWarning")}
              </div>
            ) : cli?.error ? (
              <div className="mt-3 flex gap-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-2.5 text-[9px] leading-4 text-rose-200/90">
                <CircleAlert size={12} className="mt-0.5 shrink-0" />
                {cli.error}
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.065] px-5 py-3">
        <button
          className="btn btn-ghost h-8 px-2 text-[10px]"
          onClick={() => setDraft(DEFAULTS)}
          title={t("settings.resetTitle")}
        >
          <RotateCcw size={11} /> {t("common.reset")}
        </button>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost h-8 px-3" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-secondary h-8 px-3"
            onClick={() => void apply(false)}
            disabled={saving}
          >
            {saving ? <Spinner size={11} /> : <RefreshCw size={11} />} {t("settings.applyDetect")}
          </button>
          <button
            className="btn btn-primary h-8 px-4"
            onClick={() => void apply(true)}
            disabled={saving}
          >
            {saving ? <Spinner size={11} /> : <Save size={11} />} {t("settings.save")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function InfoRow({
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
    <div className="flex items-center gap-2">
      <span className={cn("shrink-0", ok ? "text-mint-400" : "text-studio-500")}>{icon}</span>
      <span className="w-14 shrink-0 text-[9px] text-studio-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[9px] text-studio-300">
        {value}
      </span>
      {ok ? <Check size={9} className="shrink-0 text-mint-400" /> : null}
    </div>
  );
}

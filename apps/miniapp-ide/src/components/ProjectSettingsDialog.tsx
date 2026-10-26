import { useEffect, useState } from "react";
import {
  Check,
  FileJson2,
  Globe2,
  Info,
  Plus,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "../lib/store";
import { PERMISSIONS } from "../lib/permissions";
import { useI18n } from "../lib/useI18n";
import { cn, errorMessage } from "../lib/utils";
import type { ProjectManifest } from "../types";
import { Dialog, DialogHeader, Spinner } from "./ui";

export function ProjectSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const project = useStudio((state) => state.project);
  const saveManifest = useStudio((state) => state.saveManifest);
  const [draft, setDraft] = useState<ProjectManifest | null>(null);
  const [domainDraft, setDomainDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    if (open && project?.manifest) {
      setDraft(JSON.parse(JSON.stringify(project.manifest)) as ProjectManifest);
      setDomainDraft("");
      setError("");
    }
  }, [open, project?.manifest]);

  if (!draft) return null;

  const networkEnabled = draft.requestedPermissions.includes("network");
  const domains = draft.networkDomains ?? [];
  const versionValid = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(draft.version);
  const nameValid = draft.name.trim().length > 0 && draft.name.length <= 80;
  const networkValid = !networkEnabled || domains.length > 0;
  const canSave = nameValid && versionValid && networkValid && !saving;

  const patch = (values: Partial<ProjectManifest>) => {
    setDraft((current) => (current ? { ...current, ...values } : current));
  };

  const togglePermission = (id: string) => {
    const selected = draft.requestedPermissions.includes(id);
    const next = selected
      ? draft.requestedPermissions.filter((item) => item !== id)
      : [...draft.requestedPermissions, id];
    if (!next.includes("network")) {
      patch({ requestedPermissions: next, networkDomains: [] });
      return;
    }
    patch({ requestedPermissions: next });
  };

  const addDomain = () => {
    const value = domainDraft
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!value) return;
    if (!/^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
      toast.error(t("new.domainError"));
      return;
    }
    if (domains.includes(value)) {
      setDomainDraft("");
      return;
    }
    if (domains.length >= 10) {
      toast.error(t("new.domainMax"));
      return;
    }
    patch({ networkDomains: [...domains, value] });
    setDomainDraft("");
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await saveManifest({
        ...draft,
        name: draft.name.trim(),
        requestedPermissions: draft.requestedPermissions,
        networkDomains: networkEnabled ? domains : [],
      });
      toast.success(t("psettings.updated"));
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} width="max-w-2xl">
      <DialogHeader
        icon={<FileJson2 size={16} />}
        title={t("psettings.title")}
        subtitle={t("psettings.subtitle")}
        onClose={onClose}
      />

      <div className="max-h-[70vh] overflow-auto p-5">
        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="chip chip-accent">
            {t("psettings.schema", { schema: draft.schemaVersion })}
          </span>
          <span className="chip chip-mint">{draft.format}</span>
          <span className="chip">{t("psettings.entry", { entry: draft.entry })}</span>
          <span className="chip">{t("psettings.sdk", { sdk: draft.sdkVersion })}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="manifest-name">{t("psettings.name")}</label>
            <input
              id="manifest-name"
              className={cn("field", !nameValid && "border-rose-400/40")}
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              maxLength={80}
            />
          </div>
          <div>
            <label className="label" htmlFor="manifest-version">{t("psettings.version")}</label>
            <input
              id="manifest-version"
              className={cn("field font-mono", !versionValid && "border-rose-400/40")}
              value={draft.version}
              onChange={(event) => patch({ version: event.target.value })}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="label" htmlFor="manifest-description">{t("psettings.description")}</label>
          <textarea
            id="manifest-description"
            className="field min-h-[60px] resize-none text-[11px]"
            value={draft.description ?? ""}
            onChange={(event) => patch({ description: event.target.value })}
            maxLength={500}
          />
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="manifest-runtime">{t("psettings.minRuntime")}</label>
            <input
              id="manifest-runtime"
              className="field font-mono"
              value={draft.minRuntimeVersion}
              onChange={(event) => patch({ minRuntimeVersion: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="manifest-sdk">{t("psettings.sdkVersion")}</label>
            <input
              id="manifest-sdk"
              className="field font-mono opacity-70"
              value={draft.sdkVersion}
              readOnly
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">{t("psettings.permissions")}</span>
            <span className="text-[9px] text-studio-500">
              {t("psettings.declared", { count: draft.requestedPermissions.length })}
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PERMISSIONS.map((permission) => {
              const selected = draft.requestedPermissions.includes(permission.id);
              return (
                <button
                  key={permission.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2 text-left transition",
                    selected
                      ? "border-accent-500/30 bg-accent-500/[0.07]"
                      : "border-white/[0.06] bg-white/[0.015] hover:border-white/12",
                  )}
                  onClick={() => togglePermission(permission.id)}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected
                        ? "border-accent-400/40 bg-accent-500/20 text-accent-300"
                        : "border-white/10 bg-white/[0.03]",
                    )}
                  >
                    {selected ? <Check size={9} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium text-studio-200">
                      {t(`perm.${permission.id}.label`, undefined, permission.label)}
                    </span>
                    <span className="block truncate text-[8.5px] text-studio-500">
                      {permission.id}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {networkEnabled ? (
          <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.045] p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300">
              <Globe2 size={10} /> {t("psettings.networkAllowlist")}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                className="field h-8 text-[10.5px]"
                value={domainDraft}
                onChange={(event) => setDomainDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addDomain();
                  }
                }}
                placeholder="api.example.com"
              />
              <button className="btn btn-secondary h-8 px-2" onClick={addDomain}>
                <Plus size={12} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {domains.map((domain) => (
                <span
                  key={domain}
                  className="flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[8.5px] text-sky-300"
                >
                  {domain}
                  <button onClick={() => patch({ networkDomains: domains.filter((item) => item !== domain) })}>
                    <X size={8} />
                  </button>
                </span>
              ))}
            </div>
            {!networkValid ? (
              <div className="mt-1.5 text-[8.5px] text-amber-300">
                {t("psettings.networkRequired")}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[9px] leading-4 text-studio-500">
          <Info size={11} className="mt-0.5 shrink-0" />
          {t("psettings.serverNote")}
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-2.5 text-[10px] leading-4 text-rose-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.065] px-5 py-3">
        <span className="flex items-center gap-1.5 text-[9px] text-studio-500">
          <Sparkles size={10} className="text-accent-300" /> {t("psettings.changesNote")}
        </span>
        <div className="flex gap-2">
          <button className="btn btn-ghost h-8 px-3" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary h-8 px-4" onClick={() => void save()} disabled={!canSave}>
            {saving ? <Spinner size={11} /> : <Save size={11} />} {t("psettings.save")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

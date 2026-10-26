import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Calculator,
  Check,
  Code2,
  File,
  FolderOpen,
  Globe2,
  HardDrive,
  Image,
  Info,
  Loader2,
  MessageSquare,
  Plus,
  Shield,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "../lib/store";
import { PERMISSIONS } from "../lib/permissions";
import { TEMPLATE_LABELS } from "../lib/templates";
import { api } from "../lib/api";
import { useI18n } from "../lib/useI18n";
import { cn, dirname, errorMessage, joinPath, slugify, DEFAULT_PROJECTS_FOLDER } from "../lib/utils";
import type { PermissionInfo } from "../types";
import { Dialog, DialogHeader, Spinner } from "./ui";

const TEMPLATE_ICONS = {
  starter: <Sparkles size={16} />,
  counter: <Calculator size={16} />,
  blank: <File size={16} />,
};

function PermissionIcon({ permission }: { permission: PermissionInfo }) {
  switch (permission.id) {
    case "toast":
      return <Bell size={13} />;
    case "storage":
      return <HardDrive size={13} />;
    case "user.profile":
      return <User size={13} />;
    case "media.choose":
      return <Image size={13} />;
    case "share":
      return <MessageSquare size={13} />;
    case "qchat.api":
      return <Code2 size={13} />;
    case "network":
      return <Globe2 size={13} />;
    default:
      return <Shield size={13} />;
  }
}

export function NewProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useStudio((state) => state.settings);
  const cli = useStudio((state) => state.cli);
  const createProject = useStudio((state) => state.createProject);
  const desktop = api.isDesktop();
  const { t } = useI18n();

  const [name, setName] = useState("my-mini-app");
  const [directory, setDirectory] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [template, setTemplate] = useState<"starter" | "counter" | "blank">("starter");
  const [permissions, setPermissions] = useState<string[]>(["toast", "storage"]);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainDraft, setDomainDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const defaultDirectory = useMemo(() => {
    if (settings.projectsDir) return settings.projectsDir;
    if (cli?.workspace) return joinPath(dirname(cli.workspace), DEFAULT_PROJECTS_FOLDER);
    return "";
  }, [settings.projectsDir, cli?.workspace]);

  useEffect(() => {
    if (!open) return;
    setDirectory((current) => current || defaultDirectory);
    setError("");
  }, [open, defaultDirectory]);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setError("");
    setDescription(t("preview.defaultDesc"));
  }, [open, t]);

  // `name` keeps exactly what the user typed so the field can be cleared and
  // edited freely; the slug derived from it is what actually lands on disk.
  const slug = slugify(name);
  const nameValid = /^[a-z][a-z0-9._-]{1,40}$/.test(slug);
  const versionValid = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
  const networkEnabled = permissions.includes("network");
  const domainsValid = !networkEnabled || domains.length > 0;
  const projectPath = directory && slug ? joinPath(directory, slug) : "";
  const canCreate =
    desktop &&
    Boolean(cli?.ready) &&
    Boolean(directory) &&
    nameValid &&
    versionValid &&
    domainsValid &&
    !creating;

  const togglePermission = (id: string) => {
    setPermissions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const addDomain = () => {
    const value = domainDraft.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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
    setDomains([...domains, value]);
    setDomainDraft("");
  };

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError("");
    try {
      await createProject({
        name: slug,
        directory,
        description,
        version,
        template,
        permissions,
        networkDomains: domains,
      });
      toast.success(t("new.createdToast", { name: slug }));
      // Start the next "New mini app" from a clean slate instead of reusing a
      // name that now exists on disk.
      setName("my-mini-app");
      setVersion("1.0.0");
      setPermissions(["toast", "storage"]);
      setDomains([]);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={creating ? () => undefined : onClose} width="max-w-4xl" closeOnBackdrop={!creating}>
      <DialogHeader
        icon={<Sparkles size={16} />}
        title={t("new.title")}
        subtitle={t("new.subtitle")}
        onClose={creating ? () => undefined : onClose}
      />

      <div className="grid max-h-[72vh] grid-cols-1 overflow-auto md:grid-cols-[230px_1fr]">
        <div className="border-b border-white/[0.065] p-4 md:border-b-0 md:border-r">
          <div className="label">{t("new.template")}</div>
          <div className="space-y-1.5">
            {(Object.keys(TEMPLATE_LABELS) as Array<keyof typeof TEMPLATE_LABELS>).map((key) => {
              const item = TEMPLATE_LABELS[key];
              const selected = template === key;
              return (
                <button
                  key={key}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition",
                    selected
                      ? "border-accent-500/40 bg-accent-500/[0.09]"
                      : "border-white/[0.06] bg-white/[0.015] hover:border-white/12 hover:bg-white/[0.03]",
                  )}
                  onClick={() => setTemplate(key)}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      selected
                        ? "border-accent-400/30 bg-accent-500/15 text-accent-300"
                        : "border-white/[0.07] bg-white/[0.03] text-studio-400",
                    )}
                  >
                    {TEMPLATE_ICONS[key]}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-studio-200">
                      {t(`template.${key}.title`, undefined, item.title)}
                      {selected ? <Check size={10} className="text-accent-300" /> : null}
                    </span>
                    <span className="mt-0.5 block text-[9.5px] leading-4 text-studio-500">
                      {t(`template.${key}.description`, undefined, item.description)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-studio-500">
              <Info size={10} /> {t("new.whatHappens")}
            </div>
            <div className="mt-2 space-y-1.5 text-[9px] leading-4 text-studio-500">
              <div className="flex gap-1.5">
                <span className="text-accent-400">1</span> {t("new.what1")}
              </div>
              <div className="flex gap-1.5">
                <span className="text-accent-400">2</span> {t("new.what2")}
              </div>
              <div className="flex gap-1.5">
                <span className="text-accent-400">3</span> {t("new.what3")}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[9px] leading-4",
              cli?.ready
                ? "border-mint-400/15 bg-mint-400/[0.05] text-mint-400"
                : "border-amber-400/15 bg-amber-400/[0.05] text-amber-300",
            )}
          >
            <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", cli?.ready ? "bg-mint-400" : "bg-amber-400")} />
            {cli?.ready
              ? t("new.cliReady", { version: cli.cliVersion ?? "" })
              : t("new.cliMissing")}
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="project-name">{t("new.name")}</label>
              <input
                id="project-name"
                className={cn("field", name && !nameValid && "border-rose-400/40")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My Mini App"
                maxLength={64}
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1 text-[9px] text-studio-500">
                {t("new.nameHint")}
              </p>
              {slug && slug !== name ? (
                <p className="mt-1 truncate text-[9px] text-accent-300/90" title={slug}>
                  {t("new.slugPreview", { slug })}
                </p>
              ) : null}
              {!name.trim() ? (
                <p className="mt-1 text-[9px] text-rose-300/90">{t("new.nameRequired")}</p>
              ) : null}
            </div>
            <div>
              <label className="label" htmlFor="project-version">{t("new.version")}</label>
              <input
                id="project-version"
                className={cn("field", version && !versionValid && "border-rose-400/40")}
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.0.0"
              />
              <p className="mt-1 text-[9px] text-studio-500">{t("new.versionHint")}</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="project-dir">{t("new.location")}</label>
            <div className="flex gap-1.5">
              <input
                id="project-dir"
                className="field font-mono text-[10.5px]"
                value={directory}
                onChange={(event) => setDirectory(event.target.value)}
                placeholder={t("new.locationPlaceholder")}
              />
              <button
                className="btn btn-secondary h-[34px] px-2.5"
                onClick={() => {
                  void api.pickDirectory(directory || defaultDirectory).then((path) => {
                    if (path) setDirectory(path);
                  });
                }}
                title={t("new.browse")}
              >
                <FolderOpen size={13} />
              </button>
            </div>
            <p className="mt-1 truncate font-mono text-[9px] text-studio-500" title={projectPath}>
              {projectPath
                ? t("new.createsOne", { path: projectPath })
                : t("new.noDestination")}
            </p>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="project-description">{t("new.description")}</label>
            <textarea
              id="project-description"
              className="field min-h-[58px] resize-none text-[11px]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">{t("new.permissions")}</span>
              <span className="text-[9px] text-studio-500">
                {t("new.permCount", { count: permissions.length })}
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => {
                const selected = permissions.includes(permission.id);
                return (
                  <button
                    key={permission.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2 text-left transition",
                      selected
                        ? "border-accent-500/30 bg-accent-500/[0.07]"
                        : "border-white/[0.06] bg-white/[0.015] hover:border-white/12",
                    )}
                    onClick={() => togglePermission(permission.id)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        selected ? "bg-accent-500/15 text-accent-300" : "bg-white/[0.04] text-studio-500",
                      )}
                    >
                      <PermissionIcon permission={permission} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-studio-200">
                        {t(`perm.${permission.id}.label`, undefined, permission.label)}
                        {selected ? <Check size={9} className="text-accent-300" /> : null}
                      </span>
                      <span className="mt-0.5 block text-[8.5px] leading-3 text-studio-500">
                        {t(`perm.${permission.id}.description`, undefined, permission.description)}
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
                <Globe2 size={10} /> {t("new.networkAllowlist")}
              </div>
              <p className="mt-1 text-[9px] leading-4 text-studio-500">
                {t("new.networkHint")}
              </p>
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
              {domains.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {domains.map((domain) => (
                    <span
                      key={domain}
                      className="flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 font-mono text-[8.5px] text-sky-300"
                    >
                      {domain}
                      <button onClick={() => setDomains(domains.filter((item) => item !== domain))}>
                        <X size={8} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {!domainsValid ? (
                <div className="mt-1.5 text-[8.5px] text-amber-300">
                  {t("new.domainRequired")}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-2.5 text-[10px] leading-4 text-rose-200">
              {error}
            </div>
          ) : null}

          {!desktop ? (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-[9.5px] leading-4 text-amber-200/90">
              {t("new.desktopRequired")}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <span className="text-[9px] text-studio-500">
              {t("new.permissionsSummary", {
                count: permissions.length,
                template: t(`template.${template}.title`, undefined, template),
              })}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-ghost h-8 px-3" onClick={onClose} disabled={creating}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary h-8 px-4" onClick={() => void create()} disabled={!canCreate}>
                {creating ? <Spinner size={12} /> : <ArrowRight size={12} />}
                {creating ? t("new.creating") : t("new.create")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {creating ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-studio-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-studio-900 px-8 py-6 shadow-panel">
            <Loader2 size={22} className="animate-spin text-accent-300" />
            <div className="text-[12px] font-semibold text-white">
              {t("new.creatingTitle", { name: slug || name })}
            </div>
            <div className="text-center text-[9.5px] leading-4 text-studio-500">
              {t("new.creatingHint1")}
              <br />
              {t("new.creatingHint2")}
            </div>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

import {
  Boxes,
  Code2,
  Cpu,
  ExternalLink,
  MonitorSmartphone,
  Rocket,
  TerminalSquare,
} from "lucide-react";
import { api } from "../lib/api";
import { useStudio } from "../lib/store";
import { useI18n } from "../lib/useI18n";
import { Dialog } from "./ui";

export function AboutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const cli = useStudio((state) => state.cli);
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} width="max-w-md">
      <div className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="flex items-start justify-between">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 via-accent-600 to-cyan-400 shadow-glow"
            data-keep-white
          >
            <TerminalSquare size={26} className="text-white" strokeWidth={2.4} />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-white">
          {t("app.title")}
        </h2>
        <p className="mt-1 text-[11px] text-studio-400">
          {t("about.version")}
        </p>
        <p className="mt-3 text-[11px] leading-5 text-studio-400">
          {t("about.desc")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Feature
            icon={<Boxes size={12} />}
            title={t("about.compiler")}
            detail={t("about.compilerDetail")}
          />
          <Feature
            icon={<Cpu size={12} />}
            title={t("about.runtime")}
            detail={t("about.runtimeDetail")}
          />
          <Feature
            icon={<MonitorSmartphone size={12} />}
            title={t("about.target")}
            detail={t("about.targetDetail")}
          />
          <Feature
            icon={<Rocket size={12} />}
            title={t("about.packages")}
            detail={t("about.packagesDetail")}
          />
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-2.5 font-mono text-[9px] leading-4 text-studio-500">
          <div className="flex justify-between gap-3">
            <span>CLI</span>
            <span className="truncate text-studio-300">{cli?.cliVersion || t("about.notConnected")}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span>Node</span>
            <span className="truncate text-studio-300">{cli?.nodeVersion || t("about.notConnected")}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="btn btn-secondary h-8 flex-1 text-[10px]"
            onClick={() =>
              void api.openUrl(
                "https://github.com/nguyenphuquyet/QChat-3/blob/main/docs/MINIAPPS.md",
              )
            }
          >
            <ExternalLink size={11} /> {t("about.docs")}
          </button>
          <button
            className="btn btn-secondary h-8 flex-1 text-[10px]"
            onClick={() => void api.openUrl("https://github.com/nguyenphuquyet/QChat-3")}
          >
            <Code2 size={11} /> {t("about.repo")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Feature({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
      <div className="flex items-center gap-1.5 text-[9px] font-medium text-studio-200">
        <span className="text-accent-300">{icon}</span> {title}
      </div>
      <div className="mt-0.5 text-[8.5px] text-studio-500">{detail}</div>
    </div>
  );
}

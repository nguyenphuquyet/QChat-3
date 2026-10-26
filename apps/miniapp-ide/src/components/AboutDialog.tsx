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
import { Dialog } from "./ui";

export function AboutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const cli = useStudio((state) => state.cli);
  return (
    <Dialog open={open} onClose={onClose} width="max-w-md">
      <div className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent-500/15 blur-3xl" />
        <div className="flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 via-accent-600 to-cyan-400 shadow-glow">
            <TerminalSquare size={26} className="text-white" strokeWidth={2.4} />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <h2 className="mt-4 text-[20px] font-semibold tracking-tight text-white">
          QChat Mini App Studio
        </h2>
        <p className="mt-1 text-[11px] text-studio-400">
          Version 1.0.0 · Tauri + React + TypeScript
        </p>
        <p className="mt-3 text-[11px] leading-5 text-studio-400">
          A desktop IDE for the QChat mini app platform. Write TSX, compile with
          the real qapp CLI, inspect immutable .japp packages and ship native
          QuickJS apps.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Feature icon={<Boxes size={12} />} title="qapp compiler" detail="SDK 1.0 · schema v2" />
          <Feature icon={<Cpu size={12} />} title="Runtime" detail="QuickJS → Flutter" />
          <Feature icon={<MonitorSmartphone size={12} />} title="Target" detail="QChat 1.0" />
          <Feature icon={<Rocket size={12} />} title="Packages" detail="Immutable .japp" />
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/20 p-2.5 font-mono text-[9px] leading-4 text-studio-500">
          <div className="flex justify-between gap-3">
            <span>CLI</span>
            <span className="truncate text-studio-300">{cli?.cliVersion || "not connected"}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span>Node</span>
            <span className="truncate text-studio-300">{cli?.nodeVersion || "not connected"}</span>
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
            <ExternalLink size={11} /> Documentation
          </button>
          <button
            className="btn btn-secondary h-8 flex-1 text-[10px]"
            onClick={() => void api.openUrl("https://github.com/nguyenphuquyet/QChat-3")}
          >
            <Code2 size={11} /> Repository
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

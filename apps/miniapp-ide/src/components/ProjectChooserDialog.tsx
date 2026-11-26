import { FolderOpen, FolderTree } from "lucide-react";
import { useI18n } from "../lib/useI18n";
import { cn } from "../lib/utils";
import type { ProjectCandidate } from "../types";
import { Dialog, DialogHeader } from "./ui";

/**
 * Shown when the folder the user picked is not itself a Mini App but holds
 * several of them. Picking a project opens it; the footer keeps the old
 * "open whatever folder I picked" behaviour available.
 */
export function ProjectChooserDialog({
  open,
  picked,
  candidates,
  onPick,
  onOpenPicked,
  onClose,
}: {
  open: boolean;
  picked: string;
  candidates: ProjectCandidate[];
  onPick: (candidate: ProjectCandidate) => void;
  onOpenPicked: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onClose={onClose} width="max-w-lg">
      <DialogHeader
        icon={<FolderTree size={16} />}
        title={t("chooser.title")}
        subtitle={t("chooser.subtitle")}
        onClose={onClose}
      />
      <div className="p-3">
        <div className="max-h-[46vh] space-y-1 overflow-auto">
          {candidates.map((candidate) => (
            <button
              key={candidate.path}
              className={cn(
                "flex w-full items-center gap-3 rounded border border-transparent px-2.5 py-2 text-left",
                "hover:border-accent-500/30 hover:bg-accent-500/[0.08]",
              )}
              onClick={() => onPick(candidate)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-white/[0.03] text-accent-300">
                <FolderOpen size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[12px] font-medium text-studio-100">
                    {candidate.name}
                  </span>
                  {candidate.version ? (
                    <span className="chip text-[8.5px]">v{candidate.version}</span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[9px] text-studio-500">
                  {candidate.path}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 truncate font-mono text-[9px] text-studio-500" title={picked}>
          {picked}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-studio-500">{t("chooser.hint")}</p>

        <div className="mt-3 flex justify-end gap-2 border-t border-white/[0.07] pt-3">
          <button className="btn btn-ghost h-7 text-[10.5px]" onClick={onOpenPicked}>
            <FolderOpen size={11} /> {t("chooser.openFolder")}
          </button>
          <button className="btn btn-secondary h-7 text-[10.5px]" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

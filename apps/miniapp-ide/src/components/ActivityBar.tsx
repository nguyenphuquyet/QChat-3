import {
  BookOpen,
  Boxes,
  CircleHelp,
  FolderTree,
  Hammer,
  Search,
  Settings,
  TerminalSquare,
} from "lucide-react";
import { useStudio } from "../lib/store";
import { useI18n } from "../lib/useI18n";
import { cn } from "../lib/utils";

export function ActivityBar({
  onPalette,
  onSettings,
  onAbout,
  onDocs,
}: {
  onPalette: () => void;
  onSettings: () => void;
  onAbout: () => void;
  onDocs: () => void;
}) {
  const sidebarTab = useStudio((state) => state.sidebarTab);
  const sidebarOpen = useStudio((state) => state.sidebarOpen);
  const setSidebarTab = useStudio((state) => state.setSidebarTab);
  const setSidebarOpen = useStudio((state) => state.setSidebarOpen);
  const setBottomOpen = useStudio((state) => state.setBottomOpen);
  const setBottomTab = useStudio((state) => state.setBottomTab);
  const cli = useStudio((state) => state.cli);
  const project = useStudio((state) => state.project);
  const { t } = useI18n();

  const select = (tab: "project" | "build" | "packages") => {
    if (sidebarOpen && sidebarTab === tab) {
      setSidebarOpen(false);
      return;
    }
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

  return (
    <nav className="relative z-20 flex w-[52px] shrink-0 flex-col items-center border-r border-white/[0.065] bg-studio-950/55 py-2">
      <div className="flex flex-col items-center gap-0.5">
        <button
          className={cn(
            "group relative flex h-10 w-10 items-center justify-center rounded-xl transition",
            sidebarOpen && sidebarTab === "project"
              ? "bg-accent-500/12 text-accent-300"
              : "text-studio-400 hover:bg-white/[0.05] hover:text-studio-100",
          )}
          onClick={() => select("project")}
          title={t("activity.project")}
        >
          {sidebarOpen && sidebarTab === "project" ? (
            <span className="absolute -left-2 h-5 w-[2px] rounded-full bg-accent-400" />
          ) : null}
          <FolderTree size={19} strokeWidth={1.8} />
        </button>
        <button
          className={cn(
            "group relative flex h-10 w-10 items-center justify-center rounded-xl transition",
            sidebarOpen && sidebarTab === "build"
              ? "bg-accent-500/12 text-accent-300"
              : "text-studio-400 hover:bg-white/[0.05] hover:text-studio-100",
          )}
          onClick={() => select("build")}
          title={t("activity.build")}
        >
          {sidebarOpen && sidebarTab === "build" ? (
            <span className="absolute -left-2 h-5 w-[2px] rounded-full bg-accent-400" />
          ) : null}
          <Hammer size={19} strokeWidth={1.8} />
        </button>
        <button
          className={cn(
            "group relative flex h-10 w-10 items-center justify-center rounded-xl transition",
            sidebarOpen && sidebarTab === "packages"
              ? "bg-accent-500/12 text-accent-300"
              : "text-studio-400 hover:bg-white/[0.05] hover:text-studio-100",
          )}
          onClick={() => select("packages")}
          title={t("activity.packages")}
        >
          {sidebarOpen && sidebarTab === "packages" ? (
            <span className="absolute -left-2 h-5 w-[2px] rounded-full bg-accent-400" />
          ) : null}
          <Boxes size={19} strokeWidth={1.8} />
        </button>
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-100"
          onClick={onPalette}
          title={t("activity.search")}
        >
          <Search size={19} strokeWidth={1.8} />
        </button>
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-100"
          onClick={onDocs}
          title={t("activity.docs")}
        >
          <BookOpen size={19} strokeWidth={1.8} />
        </button>
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-100"
          onClick={() => {
            setBottomOpen(true);
            setBottomTab("terminal");
          }}
          title={t("activity.terminal")}
        >
          <TerminalSquare size={19} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-auto flex flex-col items-center gap-0.5">
        <div
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]"
          title={project ? t("activity.projectTitle", { name: project.name }) : t("activity.noProject")}
        >
          {project?.manifest ? (
            <span className="text-[10px] font-bold text-accent-300">
              {project.name.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-studio-600" />
          )}
        </div>
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-100"
          onClick={onSettings}
          title={t("activity.settings")}
        >
          <Settings size={19} strokeWidth={1.8} />
        </button>
        <button
          className="group flex h-10 w-10 items-center justify-center rounded-xl text-studio-400 transition hover:bg-white/[0.05] hover:text-studio-100"
          onClick={onAbout}
          title={t("activity.about")}
        >
          <CircleHelp size={19} strokeWidth={1.8} />
        </button>
        <button
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg"
          title={cli?.ready ? t("activity.cliConnected") : t("activity.cliMissing")}
          onClick={onSettings}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              cli?.ready ? "bg-mint-400 shadow-[0_0_8px_rgba(72,229,181,0.8)]" : "bg-amber-400",
            )}
          />
        </button>
      </div>
    </nav>
  );
}

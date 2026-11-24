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

  /** One 48px rail button: a 2px accent bar marks the active view. */
  const rail = (
    key: string,
    icon: React.ReactNode,
    title: string,
    onClick: () => void,
    active = false,
  ) => (
    <button
      key={key}
      className={cn(
        "relative flex h-12 w-12 items-center justify-center border-l-2 transition-colors",
        active
          ? "border-accent-500 text-studio-100"
          : "border-transparent text-studio-400 hover:text-studio-100",
      )}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );

  return (
    <nav className="relative z-20 flex w-12 shrink-0 flex-col items-center border-r border-white/[0.07] bg-studio-900">
      {rail("project", <FolderTree size={22} strokeWidth={1.5} />, t("activity.project"), () => select("project"), sidebarOpen && sidebarTab === "project")}
      {rail("search", <Search size={22} strokeWidth={1.5} />, t("activity.search"), onPalette)}
      {rail("build", <Hammer size={22} strokeWidth={1.5} />, t("activity.build"), () => select("build"), sidebarOpen && sidebarTab === "build")}
      {rail("packages", <Boxes size={22} strokeWidth={1.5} />, t("activity.packages"), () => select("packages"), sidebarOpen && sidebarTab === "packages")}
      {rail("docs", <BookOpen size={22} strokeWidth={1.5} />, t("activity.docs"), onDocs)}
      {rail(
        "terminal",
        <TerminalSquare size={22} strokeWidth={1.5} />,
        t("activity.terminal"),
        () => {
          setBottomOpen(true);
          setBottomTab("terminal");
        },
      )}

      <div className="mt-auto flex flex-col items-center pb-1">
        <div
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] bg-white/[0.03]"
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
        {rail("settings", <Settings size={22} strokeWidth={1.5} />, t("activity.settings"), onSettings)}
        {rail("about", <CircleHelp size={22} strokeWidth={1.5} />, t("activity.about"), onAbout)}
        <button
          className="flex h-8 w-8 items-center justify-center"
          title={cli?.ready ? t("activity.cliConnected") : t("activity.cliMissing")}
          onClick={onSettings}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              cli?.ready ? "bg-mint-400" : "bg-amber-400",
            )}
          />
        </button>
      </div>
    </nav>
  );
}

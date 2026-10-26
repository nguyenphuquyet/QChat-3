import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsDownUp,
  File,
  FileCode2,
  FileJson2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  LockKeyhole,
  Package,
  RefreshCw,
  Trash2,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "../lib/store";
import { useI18n } from "../lib/useI18n";
import type { FsEntry } from "../types";
import { cn, errorMessage, formatBytes } from "../lib/utils";

interface TreeNode {
  entry: FsEntry;
  children: TreeNode[];
}

function buildTree(entries: FsEntry[]): TreeNode[] {
  const directories = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const entry of entries) {
    const node: TreeNode = { entry, children: [] };
    const parts = entry.relative.split("/");
    const parentRelative = parts.slice(0, -1).join("/");
    const parent = parentRelative ? directories.get(parentRelative) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
    if (entry.isDir) directories.set(entry.relative, node);
  }
  return roots;
}

function FileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) {
    return <FileCode2 size={14} className="text-cyan-300" />;
  }
  if (lower.endsWith(".json")) return <FileJson2 size={14} className="text-amber-300" />;
  if (lower.endsWith(".md")) return <FileText size={14} className="text-studio-300" />;
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
    return <Image size={14} className="text-rose-300" />;
  }
  if (lower.endsWith(".japp")) return <Package size={14} className="text-mint-400" />;
  if (lower.endsWith(".lock")) return <LockKeyhole size={14} className="text-studio-500" />;
  return <File size={14} className="text-studio-400" />;
}

function Row({
  node,
  depth,
  expanded,
  toggle,
  activePath,
  dirty,
  onOpen,
  onContext,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  activePath: string | null;
  dirty: Set<string>;
  onOpen: (path: string) => void;
  onContext: (event: React.MouseEvent, entry: FsEntry) => void;
}) {
  const isOpen = expanded.has(node.entry.relative);
  const isActive = activePath === node.entry.path;
  return (
    <>
      <button
        className={cn(
          "group flex h-[26px] w-full items-center gap-1.5 rounded-md pr-2 text-left text-[11.5px] transition",
          isActive
            ? "bg-accent-500/12 text-white"
            : "text-studio-300 hover:bg-white/[0.045] hover:text-studio-100",
        )}
        style={{ paddingLeft: 6 + depth * 13 }}
        onClick={() => {
          if (node.entry.isDir) toggle(node.entry.relative);
          else onOpen(node.entry.path);
        }}
        onContextMenu={(event) => onContext(event, node.entry)}
        title={node.entry.relative}
      >
        {node.entry.isDir ? (
          <ChevronRight
            size={12}
            className={cn(
              "shrink-0 text-studio-500 transition-transform",
              isOpen && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {node.entry.isDir ? (
          isOpen ? (
            <FolderOpen size={14} className="shrink-0 text-accent-400/90" />
          ) : (
            <Folder size={14} className="shrink-0 text-studio-400" />
          )
        ) : (
          <span className="shrink-0">
            <FileIcon name={node.entry.name} />
          </span>
        )}
        <span className="truncate">{node.entry.name}</span>
        {dirty.has(node.entry.path) ? (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
        ) : null}
      </button>
      {node.entry.isDir && isOpen
        ? node.children.map((child) => (
            <Row
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              activePath={activePath}
              dirty={dirty}
              onOpen={onOpen}
              onContext={onContext}
            />
          ))
        : null}
    </>
  );
}

export function ProjectTree() {
  const project = useStudio((state) => state.project);
  const tree = useStudio((state) => state.tree);
  const treeLoading = useStudio((state) => state.treeLoading);
  const tabs = useStudio((state) => state.tabs);
  const activePath = useStudio((state) => state.activePath);
  const openFile = useStudio((state) => state.openFile);
  const refreshTree = useStudio((state) => state.refreshTree);
  const createEntry = useStudio((state) => state.createEntry);
  const renameEntry = useStudio((state) => state.renameEntry);
  const deleteEntry = useStudio((state) => state.deleteEntry);
  const settings = useStudio((state) => state.settings);
  const { t } = useI18n();

  const [expanded, setExpanded] = useState<Set<string>>(new Set(["src", "assets"]));
  const [filter, setFilter] = useState("");
  const [context, setContext] = useState<{
    x: number;
    y: number;
    entry: FsEntry;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(new Set(["src", "assets"]));
    setFilter("");
  }, [project?.path]);

  useEffect(() => {
    if (!context) return;
    const close = () => setContext(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [context]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return tree;
    const query = filter.trim().toLowerCase();
    return tree.filter(
      (entry) =>
        entry.relative.toLowerCase().includes(query) ||
        entry.isDir,
    );
  }, [tree, filter]);

  const treeNodes = useMemo(() => buildTree(filtered), [filtered]);
  const dirty = useMemo(
    () =>
      new Set(
        tabs.filter((tab) => tab.content !== tab.saved).map((tab) => tab.path),
      ),
    [tabs],
  );

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const newEntry = async (directory: boolean, parent?: string) => {
    if (!project) return;
    const base = parent ?? project.path;
    const name = window.prompt(
      directory ? t("tree.newFolderName") : t("tree.newFileName"),
      directory ? "components" : "src/components/Card.tsx",
    );
    if (!name?.trim()) return;
    try {
      await createEntry(base, name.trim(), directory);
      toast.success(directory ? t("tree.folderCreated") : t("tree.fileCreated"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const rename = async (entry: FsEntry) => {
    const next = window.prompt(t("tree.renamePrompt", { name: entry.name }), entry.name);
    if (!next?.trim() || next.trim() === entry.name) return;
    try {
      await renameEntry(entry.path, next.trim());
      toast.success(t("tree.renamed"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (entry: FsEntry) => {
    if (
      settings.confirmDelete &&
      !window.confirm(
        t("tree.deletePrompt", { name: entry.name }) +
          (entry.isDir ? t("tree.deleteFolderNote") : ""),
      )
    ) {
      return;
    }
    try {
      await deleteEntry(entry.path);
      toast.success(t("tree.deleted"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onContext = (event: React.MouseEvent, entry: FsEntry) => {
    event.preventDefault();
    event.stopPropagation();
    setContext({ x: event.clientX, y: event.clientY, entry });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.05] px-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-studio-400">
          {t("tree.explorer")}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            className="icon-btn h-6 w-6"
            onClick={() => void newEntry(false)}
            disabled={!project}
            title={t("tree.newFile")}
          >
            <FilePlus2 size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => void newEntry(true)}
            disabled={!project}
            title={t("tree.newFolder")}
          >
            <FolderPlus size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => void refreshTree()}
            disabled={!project || treeLoading}
            title={t("common.refresh")}
          >
            <RefreshCw size={13} className={cn(treeLoading && "animate-spin")} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => setExpanded(new Set())}
            title={t("tree.collapseAll")}
          >
            <ChevronsDownUp size={13} />
          </button>
        </div>
      </div>

      <div className="border-b border-white/[0.045] px-2 py-1.5">
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-studio-500"
          />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("tree.filter")}
            className="h-6 w-full rounded-md border border-white/[0.06] bg-black/20 pl-7 pr-2 text-[11px] text-studio-200 outline-none placeholder:text-studio-600 focus:border-accent-500/40"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1.5 py-1.5">
        {!project ? (
          <div className="px-3 py-8 text-center text-[11px] leading-5 text-studio-500">
            {t("tree.noProject")}
            <br />
            {t("tree.noProjectHint")}
          </div>
        ) : treeLoading ? (
          <div className="space-y-1.5 p-2">
            {[70, 55, 82, 46, 64].map((width) => (
              <div
                key={width}
                className="h-4 animate-pulse rounded bg-white/[0.045]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : treeNodes.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] leading-5 text-studio-500">
            {filter ? t("tree.noMatch") : t("tree.empty")}
          </div>
        ) : (
          treeNodes.map((node) => (
            <Row
              key={node.entry.path}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              activePath={activePath}
              dirty={dirty}
              onOpen={(path) => void openFile(path)}
              onContext={onContext}
            />
          ))
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.05] px-3 text-[9.5px] text-studio-500">
        <span>{t("common.files", { count: tree.filter((entry) => !entry.isDir).length })}</span>
        <span>{tree.length ? formatBytes(tree.reduce((sum, entry) => sum + (entry.isDir ? 0 : entry.size), 0)) : "0 B"}</span>
      </div>

      {context ? (
        <div
          ref={menuRef}
          className="glass fixed z-50 w-48 rounded-lg border border-white/10 p-1 shadow-panel animate-fade-in"
          style={{ left: context.x, top: context.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {context.entry.isDir ? (
            <>
              <button
                className="menu-item"
                onClick={() => {
                  setContext(null);
                  void newEntry(false, context.entry.path);
                }}
              >
                <FilePlus2 size={13} /> {t("tree.newFile")}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setContext(null);
                  void newEntry(true, context.entry.path);
                }}
              >
                <FolderPlus size={13} /> {t("tree.newFolder")}
              </button>
              <div className="menu-separator" />
            </>
          ) : null}
          <button
            className="menu-item"
            onClick={() => {
              setContext(null);
              void rename(context.entry);
            }}
          >
            <Pencil size={13} /> {t("common.rename")}
          </button>
          <button
            className="menu-item text-rose-300"
            onClick={() => {
              setContext(null);
              void remove(context.entry);
            }}
          >
            <Trash2 size={13} /> {t("common.delete")}
          </button>
          <div className="menu-separator" />
          <button
            className="menu-item"
            onClick={() => {
              setContext(null);
              void import("../lib/api").then(({ api }) => api.reveal(context.entry.path));
            }}
          >
            <Folder size={13} /> {t("tree.reveal")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

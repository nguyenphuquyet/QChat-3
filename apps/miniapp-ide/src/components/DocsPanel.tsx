import { BookOpen, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOC_GROUPS, findDoc, type DocGroup, type DocSection } from "../lib/docs";
import { Markdown } from "../lib/markdown";
import { useI18n } from "../lib/useI18n";
import { cn } from "../lib/utils";
import { Dialog, DialogHeader } from "./ui";

/** Loose matching so "cau hinh" also finds "cấu hình". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sectionGroup(section: DocSection): DocGroup {
  return (
    DOC_GROUPS.find((group) => group.sections.some((item) => item.id === section.id)) ??
    DOC_GROUPS[0]
  );
}

export function DocsPanel({
  open,
  onClose,
  initialDocId,
}: {
  open: boolean;
  onClose: () => void;
  initialDocId?: string | null;
}) {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string>(DOC_GROUPS[0].sections[0].id);
  const [query, setQuery] = useState("");
  const articleRef = useRef<HTMLDivElement | null>(null);

  // Open on the requested section (or the first one) with a clean search box.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    if (initialDocId && findDoc(initialDocId)) setActiveId(initialDocId);
  }, [open, initialDocId]);

  const needle = normalize(query.trim());
  const groups = useMemo(() => {
    if (!needle) return DOC_GROUPS;
    return DOC_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.filter((section) =>
        normalize(`${section.title}\n${section.summary}\n${section.content}`).includes(needle),
      ),
    })).filter((group) => group.sections.length > 0);
  }, [needle]);

  const active = findDoc(activeId) ?? DOC_GROUPS[0].sections[0];
  const builtin = sectionGroup(active).id === "studio";

  // Changing section resets the article, never the navigation list, so the
  // sidebar keeps its scroll position while browsing.
  useEffect(() => {
    const node = articleRef.current;
    if (node) node.scrollTop = 0;
  }, [active.id]);

  return (
    <Dialog open={open} onClose={onClose} width="max-w-5xl">
      <DialogHeader
        icon={<BookOpen size={16} />}
        title={t("docs.title", undefined, "Tài liệu phát triển")}
        subtitle={t(
          "docs.subtitle",
          undefined,
          "Hướng dẫn xây dựng mini app qapp và vận hành QChat Mini App Studio.",
        )}
        onClose={onClose}
      />

      <div className="flex h-[78vh] max-h-[720px] min-h-0">
        <aside className="flex w-[250px] shrink-0 flex-col border-r border-white/[0.06] bg-black/20">
          <div className="border-b border-white/[0.06] p-2.5">
            <div className="relative">
              <Search
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-studio-500"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("docs.search", undefined, "Tìm tài liệu...")}
                aria-label={t("docs.search", undefined, "Tìm tài liệu...")}
                className="h-8 w-full rounded-lg border border-white/[0.07] bg-black/25 pl-7 pr-2 text-[11px] text-studio-200 outline-none transition placeholder:text-studio-500 focus:border-accent-500/40"
              />
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            {groups.map((group) => (
              <div key={group.id} className="mb-1.5">
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-studio-500">
                  {t(group.titleKey, undefined, group.id === "studio" ? "Studio" : "Mini App")}
                </div>
                {group.sections.map((section) => {
                  const isActive = section.id === active.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveId(section.id)}
                      title={section.summary}
                      className={cn(
                        "group relative flex w-full items-center rounded-lg py-1.5 pl-3 pr-2 text-left text-[11px] transition",
                        isActive
                          ? "bg-accent-500/12 text-accent-300"
                          : "text-studio-400 hover:bg-white/[0.05] hover:text-studio-100",
                      )}
                    >
                      {isActive ? (
                        <span className="absolute left-0 h-3.5 w-[2px] rounded-full bg-accent-400" />
                      ) : null}
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 ? (
              <p className="px-2 py-6 text-center text-[10.5px] text-studio-500">
                {t("docs.empty", undefined, "Không tìm thấy tài liệu phù hợp.")}
              </p>
            ) : null}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold tracking-tight text-white">
                {active.title}
              </h3>
              <p className="mt-0.5 text-[10.5px] leading-4 text-studio-500">{active.summary}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                builtin
                  ? "border-accent-500/30 bg-accent-500/10 text-accent-300"
                  : "border-white/[0.08] bg-white/[0.03] text-studio-400",
              )}
            >
              {builtin
                ? t("docs.builtin", undefined, "Có sẵn")
                : t("docs.repo", undefined, "Từ repo")}
            </span>
          </div>

          <div ref={articleRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <Markdown key={active.id} source={active.content} />
            <p className="mt-6 border-t border-white/[0.06] pt-2 text-[10px] text-studio-600">
              {t("docs.updated", undefined, "Cập nhật theo mã nguồn hiện tại của repo.")}
            </p>
          </div>
        </section>
      </div>
    </Dialog>
  );
}

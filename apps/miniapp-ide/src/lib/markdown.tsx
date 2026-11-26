// A tiny, dependency-free markdown renderer for the in-app developer docs.
//
// Safety first: this component never builds an HTML string and never calls
// `dangerouslySetInnerHTML`. Every block and every inline span becomes a real
// React element, so markdown text — including the imported repository docs —
// cannot inject markup. Only http(s)/mailto links become anchors, and they are
// handed to the Tauri opener instead of navigating the WebView.
import type { ReactElement, ReactNode } from "react";
import { api } from "./api";
import { cn } from "./utils";

const LINK_CLASS =
  "text-accent-300 underline decoration-dotted underline-offset-2 transition-colors hover:text-accent-400";

const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,4})\s+(.*?)\s*#*\s*$/;
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_RE = /^\s*```\s*([\w#+.-]*)\s*$/;
const FENCE_END_RE = /^\s*```\s*$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const TABLE_SEPARATOR_RE = /^:?-{1,}:?$/;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;
// code | bold | italic | [text](url) | bare autolink
const INLINE_PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+)/g;

const HEADING_CLASS: Record<number, string> = {
  1: "mt-1 mb-2 text-[15px] font-semibold tracking-tight text-white",
  2: "mt-5 mb-2 text-[12.5px] font-semibold tracking-tight text-studio-100",
  3: "mt-3.5 mb-1.5 text-[11.5px] font-semibold text-studio-200",
  4: "mt-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-studio-400",
};

function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  return null;
}

function DocLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      href={url}
      className={LINK_CLASS}
      onClick={(event) => {
        event.preventDefault();
        void api.openUrl(url);
      }}
    >
      {children}
    </a>
  );
}

function linkToken(token: string): { label: string; url: string } | null {
  if (!token.startsWith("[")) return null;
  const parts = LINK_RE.exec(token);
  if (!parts) return null;
  const url = safeUrl(parts[2]);
  return url ? { label: parts[1], url } : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  INLINE_PATTERN.lastIndex = 0;
  let match = INLINE_PATTERN.exec(text);

  while (match) {
    const token = match[0];
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const key = `${keyPrefix}-i${index}`;
    index += 1;

    const link = linkToken(token);
    if (link) {
      nodes.push(
        <DocLink key={key} url={link.url}>
          {link.label}
        </DocLink>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/[0.07] px-1 py-px font-mono text-[10.5px] text-accent-300"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-studio-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic text-studio-200">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      // Bare autolink. Trailing sentence punctuation stays outside the anchor.
      const trailing = TRAILING_PUNCTUATION_RE.exec(token)?.[0] ?? "";
      const trimmed = trailing ? token.slice(0, token.length - trailing.length) : token;
      const url = safeUrl(trimmed);
      if (url) {
        nodes.push(
          <DocLink key={key} url={url}>
            {trimmed}
          </DocLink>,
        );
        if (trailing) nodes.push(trailing);
        INLINE_PATTERN.lastIndex = match.index + trimmed.length;
      } else {
        nodes.push(token);
      }
    }

    cursor = INLINE_PATTERN.lastIndex;
    match = INLINE_PATTERN.exec(text);
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index];
  if (!header || !header.includes("|")) return false;
  const separator = lines[index + 1];
  if (!separator || !separator.includes("|")) return false;
  const cells = splitRow(separator);
  return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_RE.test(cell));
}

function renderTable(lines: string[], start: number, keyPrefix: string): [ReactElement, number] {
  const header = splitRow(lines[start]);
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
    rows.push(splitRow(lines[i]));
    i += 1;
  }

  const table = (
    <div
      key={keyPrefix}
      className="my-2.5 overflow-x-auto rounded-lg border border-white/[0.07]"
    >
      <table className="w-full border-collapse text-[10.5px]">
        <thead className="bg-white/[0.03]">
          <tr>
            {header.map((cell, index) => {
              const key = `${keyPrefix}-h${index}`;
              return (
                <th
                  key={key}
                  className="border-b border-white/[0.08] px-2.5 py-1.5 text-left font-semibold text-studio-200"
                >
                  {renderInline(cell, key)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const cells = row.slice(0, header.length);
            while (cells.length < header.length) cells.push("");
            return (
              <tr key={`${keyPrefix}-r${rowIndex}`}>
                {cells.map((cell, cellIndex) => {
                  const key = `${keyPrefix}-r${rowIndex}c${cellIndex}`;
                  return (
                    <td
                      key={key}
                      className="border-b border-white/[0.04] px-2.5 py-1.5 align-top text-studio-300"
                    >
                      {renderInline(cell, key)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return [table, i];
}

function parseList(
  lines: string[],
  start: number,
  indent: number,
  keyPrefix: string,
): [ReactElement, number] {
  const first = ORDERED_RE.exec(lines[start]);
  const ordered = first !== null;
  const startAt = first ? Number(first[2]) : 1;
  const items: { key: string; children: ReactNode[] }[] = [];
  let i = start;

  while (i < lines.length) {
    const numbered = ORDERED_RE.exec(lines[i]);
    const bullet = numbered ? null : BULLET_RE.exec(lines[i]);
    let text: string | null = null;
    let lineIndent = -1;
    if (numbered) {
      text = numbered[3];
      lineIndent = numbered[1].length;
    } else if (bullet) {
      text = bullet[2];
      lineIndent = bullet[1].length;
    }

    if (text === null || lineIndent < indent) break;

    if (lineIndent > indent) {
      if (!items.length) break;
      const [nested, next] = parseList(lines, i, lineIndent, `${keyPrefix}-n${items.length - 1}`);
      items[items.length - 1].children.push(nested);
      i = next;
      continue;
    }

    const itemKey = `${keyPrefix}-${items.length}`;
    items.push({ key: itemKey, children: [renderInline(text, itemKey)] });
    i += 1;
  }

  const children = items.map((item) => (
    <li key={item.key} className="leading-[1.7] text-studio-300">
      {item.children}
    </li>
  ));
  const className = cn(
    "my-2 space-y-1 pl-4 marker:text-studio-600",
    ordered ? "list-decimal" : "list-disc",
  );

  return ordered
    ? [
        <ol key={keyPrefix} start={startAt === 1 ? undefined : startAt} className={className}>
          {children}
        </ol>,
        i,
      ]
    : [
        <ul key={keyPrefix} className={className}>
          {children}
        </ul>,
        i,
      ];
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  if (!line.trim()) return true;
  return (
    FENCE_RE.test(line) ||
    RULE_RE.test(line) ||
    HEADING_RE.test(line) ||
    QUOTE_RE.test(line) ||
    BULLET_RE.test(line) ||
    ORDERED_RE.test(line) ||
    isTableStart(lines, index)
  );
}

function parseBlocks(lines: string[], keyPrefix = "md"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const key = `${keyPrefix}-${i}`;

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const language = fence[1];
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_END_RE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <div key={key} className="my-2.5">
          {language ? (
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-studio-600">
              {language}
            </div>
          ) : null}
          <pre className="overflow-x-auto rounded-lg border border-white/[0.07] bg-black/30 p-2.5">
            <code className="font-mono text-[10.5px] leading-[1.65] text-studio-200">
              {code.join("\n")}
            </code>
          </pre>
        </div>,
      );
      continue;
    }

    if (RULE_RE.test(line)) {
      nodes.push(<hr key={key} className="my-3 border-white/[0.07]" />);
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const className = HEADING_CLASS[level] ?? HEADING_CLASS[4];
      const content = renderInline(heading[2], key);
      if (level === 1) {
        nodes.push(
          <h1 key={key} className={className}>
            {content}
          </h1>,
        );
      } else if (level === 2) {
        nodes.push(
          <h2 key={key} className={className}>
            {content}
          </h2>,
        );
      } else if (level === 3) {
        nodes.push(
          <h3 key={key} className={className}>
            {content}
          </h3>,
        );
      } else {
        nodes.push(
          <h4 key={key} className={className}>
            {content}
          </h4>,
        );
      }
      i += 1;
      continue;
    }

    if (isTableStart(lines, i)) {
      const [table, next] = renderTable(lines, i, key);
      nodes.push(table);
      i = next;
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      const quoted: string[] = [];
      while (i < lines.length) {
        const quotedLine = QUOTE_RE.exec(lines[i]);
        if (!quotedLine) break;
        quoted.push(quotedLine[1]);
        i += 1;
      }
      nodes.push(
        <blockquote
          key={key}
          className="my-2.5 rounded-r-lg border-l-2 border-accent-500/40 bg-accent-500/[0.06] py-1 pl-3 pr-2 text-studio-300"
        >
          {parseBlocks(quoted, `${key}-q`)}
        </blockquote>,
      );
      continue;
    }

    if (BULLET_RE.test(line) || ORDERED_RE.test(line)) {
      const indent = /^(\s*)/.exec(line)?.[1].length ?? 0;
      const [list, next] = parseList(lines, i, indent, key);
      nodes.push(list);
      i = next;
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && !startsBlock(lines, i)) {
      paragraph.push(lines[i]);
      i += 1;
    }
    nodes.push(
      <p key={key} className="my-2 text-[11.5px] leading-[1.75] text-studio-300">
        {renderInline(paragraph.join(" "), key)}
      </p>,
    );
  }

  return nodes;
}

/**
 * Renders a small, safe subset of markdown (headings, code fences, tables,
 * lists, quotes, rules and inline formatting) as React elements.
 */
export function Markdown({ source }: { source: string }): ReactElement {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  return <div className="select-text">{parseBlocks(lines)}</div>;
}

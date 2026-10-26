import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export function dirname(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const index = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return index < 0 ? normalized : normalized.slice(0, index);
}

export function joinPath(base: string, ...parts: string[]): string {
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...parts.map((part) => part.replace(/^[\\/]+/, ""))].join(
    separator,
  );
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "miniapp"
  );
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function timeAgo(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "unknown";
  const delta = Math.max(0, now - ms);
  const seconds = Math.floor(delta / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function clockTime(ms = Date.now()): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function languageFor(path: string): string {
  const name = basename(path).toLowerCase();
  if (name === "manifest.json" || name === "permissions.json" || name === "metadata.json") {
    return "json";
  }
  const extension = name.includes(".") ? name.split(".").pop() || "" : "";
  switch (extension) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    case "yaml":
    case "yml":
      return "yaml";
    case "svg":
    case "xml":
      return "xml";
    case "sh":
      return "shell";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return "image";
    default:
      return "plaintext";
  }
}

export function parseCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) args.push(current);
  return args;
}

export function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export function permissionTone(
  permission: string,
): "violet" | "mint" | "amber" | "sky" | "rose" {
  switch (permission) {
    case "network":
      return "sky";
    case "user.profile":
      return "amber";
    case "storage":
      return "mint";
    case "media.choose":
      return "rose";
    default:
      return "violet";
  }
}

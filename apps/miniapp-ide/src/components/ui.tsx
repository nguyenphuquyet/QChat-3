import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin", className)} />;
}

export function Dialog({
  open,
  onClose,
  children,
  width = "max-w-2xl",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-[6px] animate-fade-in"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "panel relative w-full overflow-hidden rounded-2xl shadow-panel animate-slide-up",
          width,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  icon,
  title,
  subtitle,
  onClose,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.065] px-6 py-5">
      {icon ? (
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent-500/25 bg-accent-500/10 text-accent-300">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-studio-400">{subtitle}</p> : null}
      </div>
      <button className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-2">
      <span>
        <span className="block text-xs font-medium text-studio-200">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-studio-400">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-accent-500/60 bg-accent-600"
            : "border-white/10 bg-studio-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

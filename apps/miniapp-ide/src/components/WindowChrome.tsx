import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

const DRAG_IGNORE_SELECTOR =
  "button, a, input, textarea, select, label, [data-no-drag]";

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(DRAG_IGNORE_SELECTOR));
}

/** Tracks the native maximized state so the chrome can swap the restore icon. */
function useWindowState() {
  const desktop = api.isDesktop();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    const win = getCurrentWindow();
    let cancelled = false;
    let dispose: (() => void) | undefined;

    const sync = async () => {
      try {
        const value = await win.isMaximized();
        if (!cancelled) setMaximized(value);
      } catch {
        // Window state is unavailable outside the desktop runtime.
      }
    };

    void sync();
    void win
      .onResized(() => {
        void sync();
      })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else dispose = unlisten;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [desktop]);

  return { desktop, maximized };
}

/**
 * Drag handlers for the custom title bar. Buttons, inputs and menus keep
 * receiving their own events; everything else moves the window. The second
 * click of a double click toggles maximize, mirroring a native caption.
 */
export function useWindowDrag() {
  const desktop = api.isDesktop();

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!desktop || event.button !== 0 || isInteractive(event.target)) return;
      event.preventDefault();
      if (event.detail === 2) {
        void getCurrentWindow().toggleMaximize();
        return;
      }
      void getCurrentWindow().startDragging();
    },
    [desktop],
  );

  return { onMouseDown };
}

export function WindowControls({ className }: { className?: string }) {
  const { desktop, maximized } = useWindowState();
  if (!desktop) return null;
  const win = getCurrentWindow();

  return (
    <div className={cn("flex h-full shrink-0 items-stretch", className)} data-no-drag>
      <button
        className="window-control"
        onClick={() => void win.minimize()}
        title="Minimize"
        aria-label="Minimize window"
      >
        <Minus size={14} strokeWidth={1.8} />
      </button>
      <button
        className="window-control"
        onClick={() => void win.toggleMaximize()}
        title={maximized ? "Restore" : "Maximize"}
        aria-label={maximized ? "Restore window" : "Maximize window"}
      >
        {maximized ? <Copy size={11} strokeWidth={2} /> : <Square size={10} strokeWidth={2} />}
      </button>
      <button
        className="window-control window-control-close"
        onClick={() => void win.close()}
        title="Close"
        aria-label="Close window"
      >
        <X size={15} strokeWidth={1.7} />
      </button>
    </div>
  );
}

const RESIZE_EDGES: Array<{ direction: ResizeDirection; className: string }> = [
  { direction: "North", className: "inset-x-2 top-0 h-[3px] cursor-n-resize" },
  { direction: "South", className: "inset-x-2 bottom-0 h-[3px] cursor-s-resize" },
  { direction: "West", className: "inset-y-2 left-0 w-[3px] cursor-w-resize" },
  { direction: "East", className: "inset-y-2 right-0 w-[3px] cursor-e-resize" },
  { direction: "NorthWest", className: "left-0 top-0 h-2.5 w-2.5 cursor-nw-resize" },
  { direction: "NorthEast", className: "right-0 top-0 h-2.5 w-2.5 cursor-ne-resize" },
  { direction: "SouthWest", className: "bottom-0 left-0 h-2.5 w-2.5 cursor-sw-resize" },
  { direction: "SouthEast", className: "bottom-0 right-0 h-2.5 w-2.5 cursor-se-resize" },
];

/**
 * Invisible grab strips around a frameless window. Without them an undecorated
 * window cannot be resized from its edges on Windows and macOS.
 */
export function WindowResizeHandles() {
  const { desktop, maximized } = useWindowState();
  if (!desktop || maximized) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge.direction}
          className={cn("pointer-events-auto absolute", edge.className)}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void getCurrentWindow().startResizeDragging(edge.direction);
          }}
        />
      ))}
    </div>
  );
}

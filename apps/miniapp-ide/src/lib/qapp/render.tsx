// Turns a qapp render tree into DOM.
//
// This mirrors `apps/mobile/lib/features/miniapps/qapp/qapp_renderer.dart`:
// the same component names, the same defaults, the same event payloads. It is
// an approximation on purpose — the real UI is Flutter — so anything that
// cannot be reproduced (native scroll physics, TDesign's exact metrics) falls
// back to the closest CSS behaviour instead of pretending to be exact.
import {
  createElement,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  boxStyle,
  clampLines,
  fontWeight,
  qappColor,
  textStyle,
  type QappThemeColors,
} from "./style";
import { qappIcon } from "./icons";
import type { QappDevice, QappNode, QappStyle } from "./types";

export interface QappRenderContext {
  colors: QappThemeColors;
  device: QappDevice;
  /** Packaged `assets/…` path → data URL. */
  assets: Record<string, string>;
  emit: (id: string, event: string, payload: unknown) => void;
}

interface RenderOptions {
  /** The parent does not bound this axis, so `flex` cannot grow (Flutter). */
  relax?: "row" | "column" | null;
}

function styleOf(node: QappNode): QappStyle {
  const value = node.props.style;
  return value && typeof value === "object" ? (value as QappStyle) : {};
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

/** Text runs: every descendant string, concatenated. */
function textOf(node: QappNode): string {
  if (node.type === "#text") return asString(node.props.text);
  let text = "";
  for (const child of node.children ?? []) text += textOf(child);
  return text;
}

function eventsOf(node: QappNode): string[] {
  if (Array.isArray(node.events)) return node.events.map(String);
  const value = node.props.__events;
  return Array.isArray(value) ? value.map(String) : [];
}

function hasEvent(node: QappNode, event: string): boolean {
  return eventsOf(node).includes(event);
}

interface PressProps {
  role?: "button";
  tabIndex?: number;
  "aria-label"?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

function pressHandlers(
  node: QappNode,
  ctx: QappRenderContext,
  disabled: boolean,
  payload: unknown = { type: "press" },
): PressProps {
  if (disabled) return {};
  const events = eventsOf(node);
  const press = events.includes("press");
  const long = events.includes("longPress");
  if (!press && !long) return {};
  let timer: number | undefined;
  let longFired = false;
  const stop = () => {
    if (timer) window.clearTimeout(timer);
    timer = undefined;
  };
  return {
    role: press ? "button" : undefined,
    tabIndex: press ? 0 : undefined,
    "aria-label": asString(node.props.accessibleLabel) || undefined,
    onClick: (event) => {
      event.stopPropagation();
      if (longFired) {
        longFired = false;
        return;
      }
      if (press) ctx.emit(node.id, "press", payload);
    },
    onPointerDown: long
      ? () => {
          longFired = false;
          timer = window.setTimeout(() => {
            longFired = true;
            ctx.emit(node.id, "longPress", { type: "longPress" });
          }, 480);
        }
      : undefined,
    onPointerUp: long ? stop : undefined,
    onPointerLeave: long ? stop : undefined,
    onKeyDown: press
      ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            ctx.emit(node.id, "press", payload);
          }
        }
      : undefined,
  };
}

function withRelax(style: CSSProperties, relax: "row" | "column" | null | undefined) {
  if (relax !== "row" && relax !== "column") return style;
  return {
    ...style,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    // A child that asked to fill an unbounded axis also asked for `minHeight:0`
    // so it could shrink; keep it out of the way when it cannot grow.
    minHeight: undefined,
    minWidth: undefined,
  } as CSSProperties;
}

function alignItems(style: QappStyle): CSSProperties["alignItems"] {
  switch (style.alignItems) {
    case "start":
    case "flex-start":
      return "flex-start";
    case "end":
    case "flex-end":
      return "flex-end";
    case "center":
      return "center";
    case "baseline":
      return "baseline";
    default:
      return "stretch";
  }
}

const STACK_ALIGN: Record<string, { justify: CSSProperties["justifyItems"]; align: CSSProperties["alignItems"] }> = {
  topLeft: { justify: "start", align: "start" },
  topCenter: { justify: "center", align: "start" },
  topRight: { justify: "end", align: "start" },
  centerLeft: { justify: "start", align: "center" },
  center: { justify: "center", align: "center" },
  centerRight: { justify: "end", align: "center" },
  bottomLeft: { justify: "start", align: "end" },
  bottomCenter: { justify: "center", align: "end" },
  bottomRight: { justify: "end", align: "end" },
};

const TAG_TONES: Record<string, { background: string; color: string }> = {
  neutral: { background: "#f3f3f3", color: "#000000d9" },
  success: { background: "#e3f9e9", color: "#2ba471" },
  warning: { background: "#fff1e9", color: "#e37318" },
  danger: { background: "#fff0ed", color: "#d54941" },
  info: { background: "#ecf2fe", color: "#0052d9" },
};

const BUTTON_VARIANTS: Record<string, { background: string; color: string; border?: string }> = {
  primary: { background: "#0052d9", color: "#ffffff" },
  secondary: { background: "#f3f3f3", color: "#1d2129" },
  outline: { background: "transparent", color: "#0052d9", border: "#0052d9" },
  text: { background: "transparent", color: "#0052d9" },
  danger: { background: "#d54941", color: "#ffffff" },
};

const BUTTON_SIZE: Record<string, { height: number; padding: string; font: number; icon: number }> = {
  sm: { height: 32, padding: "0 12px", font: 14, icon: 14 },
  md: { height: 40, padding: "0 16px", font: 16, icon: 17 },
  lg: { height: 48, padding: "0 20px", font: 16, icon: 20 },
};

export function renderNode(
  node: QappNode,
  ctx: QappRenderContext,
  options: RenderOptions = {},
): ReactNode {
  const key = node.id;
  const style = styleOf(node);
  const relax = options.relax ?? null;
  const box = withRelax(boxStyle(style, ctx.colors), relax);

  switch (node.type) {
    case "#text": {
      const own = node.props.style as QappStyle | undefined;
      return (
        <span key={key} style={own ? textStyle(own, ctx.colors) : undefined}>
          {asString(node.props.text)}
        </span>
      );
    }

    case "Text": {
      const color = qappColor(style.color) ?? ctx.colors.ink;
      const lines = asNumber(node.props.numberOfLines) ?? asNumber(style.numberOfLines);
      const text = textStyle(style, ctx.colors, 15);
      return (
        <div
          key={key}
          data-node={key}
          style={{
            ...text,
            color,
            ...clampLines(lines),
            userSelect: node.props.selectable === true ? "text" : "none",
            minWidth: 0,
          }}
        >
          {renderInlineChildren(node, ctx)}
        </div>
      );
    }

    case "RichText": {
      const color = qappColor(style.color) ?? ctx.colors.ink;
      const lines = asNumber(node.props.numberOfLines) ?? asNumber(style.numberOfLines);
      return (
        <div
          key={key}
          data-node={key}
          style={{
            ...textStyle(style, ctx.colors, 15),
            color,
            ...clampLines(lines),
            userSelect: node.props.selectable === true ? "text" : "none",
            minWidth: 0,
          }}
        >
          {renderInlineChildren(node, ctx)}
        </div>
      );
    }

    case "Link": {
      const disabled = node.props.disabled === true;
      const color = qappColor(style.color) ?? (disabled ? ctx.colors.muted : ctx.colors.brand);
      const handlers = disabled
        ? {}
        : pressHandlers(node, ctx, false, {
            type: "press",
            href: asString(node.props.href),
            external: node.props.external === true,
          });
      return (
        <span
          key={key}
          {...handlers}
          style={{
            ...textStyle(style, ctx.colors, 15),
            color,
            textDecoration: style.textDecoration ?? "underline",
            cursor: disabled ? "default" : "pointer",
          }}
        >
          {renderInlineChildren(node, ctx)}
        </span>
      );
    }

    case "Badge":
      return <QappBadge key={key} node={node} ctx={ctx} />;

    case "Tag": {
      const tone = TAG_TONES[asString(node.props.tone) || "neutral"] ?? TAG_TONES.neutral;
      const size = asString(node.props.size) || "md";
      const metrics =
        size === "sm"
          ? { font: 11, padding: "1px 6px" }
          : size === "lg"
            ? { font: 14, padding: "3px 10px" }
            : { font: 12, padding: "2px 8px" };
      return (
        <span
          key={key}
          data-node={key}
          style={{
            ...box,
            display: "inline-flex",
            alignItems: "center",
            flex: "0 0 auto",
            alignSelf: "flex-start",
            width: "fit-content",
            padding: metrics.padding,
            borderRadius: 3,
            background: tone.background,
            color: tone.color,
            fontSize: metrics.font,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
          }}
        >
          {textOf(node)}
        </span>
      );
    }

    case "Avatar":
      return <QappAvatar key={key} node={node} ctx={ctx} />;

    case "Image":
      return <QappImage key={key} node={node} ctx={ctx} />;

    case "Icon": {
      const size = asNumber(node.props.size) ?? asNumber(style.fontSize) ?? 22;
      const color = qappColor(String(node.props.color ?? "")) ?? qappColor(style.color) ?? ctx.colors.ink;
      const Glyph = qappIcon(asString(node.props.name));
      return (
        <span
          key={key}
          data-node={key}
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            flex: "0 0 auto",
            color,
          }}
        >
          {Glyph ? <Glyph size={size} color={color} strokeWidth={1.9} /> : null}
        </span>
      );
    }

    case "View":
    case "Pressable": {
      const disabled = node.props.disabled === true;
      const handlers =
        node.type === "Pressable" || hasEvent(node, "press") || hasEvent(node, "longPress")
          ? pressHandlers(node, ctx, disabled)
          : {};
      return (
        <div
          key={key}
          data-node={key}
          {...handlers}
          style={{
            ...box,
            ...(handlers.role ? { cursor: disabled ? "default" : "pointer" } : null),
          }}
        >
          {renderChildren(node, ctx, relax)}
        </div>
      );
    }

    case "Button":
      return <QappButton key={key} node={node} ctx={ctx} relax={relax} />;

    case "ScrollView":
    case "ListView":
    case "GridView":
      return <QappScrollable key={key} node={node} ctx={ctx} style={box} />;

    case "Stack": {
      const alignment = STACK_ALIGN[asString(node.props.alignment) || "topLeft"] ?? STACK_ALIGN.topLeft;
      return (
        <div
          key={key}
          data-node={key}
          style={{
            ...box,
            // Absolutely positioned children must resolve against this Stack,
            // not against whatever happens to be positioned further up.
            position: (box.position as CSSProperties["position"]) ?? "relative",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: "minmax(0, 1fr)",
            gridTemplateAreas: '"stack"',
            justifyContent: alignment.justify,
            alignItems: alignment.align,
          }}
        >
          {(node.children ?? []).map((child) => {
            const positioned = child.type === "Positioned";
            return (
              <div
                key={child.id}
                style={{
                  gridArea: "stack",
                  minWidth: 0,
                  minHeight: 0,
                  alignSelf: positioned ? undefined : alignment.align,
                  justifySelf: positioned ? undefined : alignment.justify,
                  ...(positioned ? { position: "absolute", inset: 0 } : null),
                }}
              >
                {positioned ? renderPositioned(child, ctx) : renderNode(child, ctx)}
              </div>
            );
          })}
        </div>
      );
    }

    case "Positioned":
      return (
        <div key={key} style={{ position: "relative" }}>
          {renderPositioned(node, ctx)}
        </div>
      );

    case "Spacer": {
      const size = Math.min(400, Math.max(0, asNumber(node.props.size) ?? 0));
      if (size > 0) {
        return <div key={key} style={{ width: size, height: size, flex: "0 0 auto" }} />;
      }
      if (relax) return <div key={key} style={{ height: 8, flex: "0 0 auto" }} />;
      return (
        <div
          key={key}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            minWidth: 0,
            minHeight: 0,
          }}
        />
      );
    }

    case "Divider":
      return <QappDivider key={key} node={node} ctx={ctx} />;

    case "SafeArea":
      return <QappSafeArea key={key} node={node} ctx={ctx} relax={relax} />;

    case "ActivityIndicator": {
      const size = asNumber(node.props.size) ?? 24;
      const color =
        qappColor(String(node.props.color ?? "")) ?? qappColor(style.color) ?? ctx.colors.brand;
      return (
        <span
          key={key}
          data-node={key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: size,
            height: size,
            flex: "0 0 auto",
            border: `${Math.max(2, Math.round(size / 10))}px solid ${color}33`,
            borderTopColor: color,
            borderRadius: "50%",
            animation: "qapp-spin 800ms linear infinite",
            boxSizing: "border-box",
          }}
        />
      );
    }

    case "AnimatedView": {
      const kind = asString(node.props.animate) || "fadeIn";
      const duration = asNumber(node.props.duration) ?? 260;
      const animation =
        kind === "slideUp"
          ? "qapp-slide-up"
          : kind === "scaleIn"
            ? "qapp-scale-in"
            : "qapp-fade-in";
      return (
        <div
          key={key}
          data-node={key}
          style={{ ...box, animation: `${animation} ${duration}ms ease-out both` }}
        >
          {renderChildren(node, ctx, relax)}
        </div>
      );
    }

    case "CustomPaint":
      return <QappCustomPaint key={key} node={node} ctx={ctx} style={box} />;

    case "TextField":
      return <QappTextInput key={key} node={node} ctx={ctx} relax={relax} />;

    case "Checkbox":
      return <QappCheckbox key={key} node={node} ctx={ctx} />;

    case "Switch":
      return <QappSwitch key={key} node={node} ctx={ctx} />;

    case "Slider":
      return <QappSlider key={key} node={node} ctx={ctx} />;

    case "NavBar":
      return <QappNavBar key={key} node={node} ctx={ctx} />;

    case "TabBar":
      return <QappTabBar key={key} node={node} ctx={ctx} />;

    case "Modal":
    case "BottomSheet":
    case "Dialog":
      return <QappOverlay key={key} node={node} ctx={ctx} />;

    default:
      // A newer contract node the preview does not know yet: draw its children
      // so the app does not disappear entirely.
      return (
        <div key={key} data-node={key} style={box}>
          {renderChildren(node, ctx, relax)}
        </div>
      );
  }
}

/** A scroll container that can also report `endReached` and `scroll`. */
function QappScrollable({
  node,
  ctx,
  style,
}: {
  node: QappNode;
  ctx: QappRenderContext;
  style: CSSProperties;
}) {
  const styleValue = styleOf(node);
  const horizontal = node.type === "GridView" ? false : node.props.horizontal === true;
  const grid = node.type === "GridView" || node.props.grid === true;
  const gap = asNumber(styleValue.gap) ?? 0;
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEnd = useRef<string | null>(null);
  const lastScroll = useRef(0);

  const checkEnd = () => {
    const element = ref.current;
    if (!element || !hasEvent(node, "endReached")) return;
    const remaining = horizontal
      ? element.scrollWidth - element.scrollLeft - element.clientWidth
      : element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining > 240) return;
    if (lastEnd.current === node.id + ":" + (node.props.totalCount ?? "")) return;
    lastEnd.current = node.id + ":" + (node.props.totalCount ?? "");
    ctx.emit(node.id, "endReached", { type: "endReached" });
  };

  useEffect(() => {
    // A short list never scrolls, so its first frame is already at the end.
    const timer = window.setTimeout(checkEnd, 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.props.totalCount]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const x = Math.round(element.scrollLeft);
    const y = Math.round(element.scrollTop);
    const now = Date.now();
    if (hasEvent(node, "scroll") && now - lastScroll.current > 80) {
      lastScroll.current = now;
      ctx.emit(node.id, "scroll", { type: "scroll", x, y, value: { x, y } });
    }
    checkEnd();
  };

  const columns =
    grid && !horizontal ? Math.max(1, Math.min(12, Math.round(asNumber(node.props.numColumns) ?? 2))) : 0;

  return (
    <div
      ref={ref}
      data-node={node.id}
      onScroll={onScroll}
      style={{
        ...style,
        display: "block",
        overflowX: horizontal ? "auto" : "hidden",
        overflowY: horizontal ? "hidden" : "auto",
        scrollbarWidth: node.props.showsScrollIndicator === false ? "none" : "thin",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          display: grid && !horizontal ? "grid" : "flex",
          gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
          gridAutoRows: columns ? "auto" : undefined,
          flexDirection: horizontal ? "row" : "column",
          alignItems: horizontal ? "flex-start" : undefined,
          gap,
          minWidth: 0,
          minHeight: 0,
          width: horizontal ? "max-content" : undefined,
          boxSizing: "border-box",
        }}
      >
        {(node.children ?? []).map((child) =>
          renderNode(child, ctx, { relax: horizontal ? "row" : "column" }),
        )}
      </div>
    </div>
  );
}

function renderChildren(
  node: QappNode,
  ctx: QappRenderContext,
  relax?: "row" | "column" | null,
): ReactNode {
  return (node.children ?? []).map((child) => renderNode(child, ctx, { relax }));
}

function renderInline(node: QappNode, ctx: QappRenderContext): ReactNode {
  switch (node.type) {
    case "#text":
      return <span key={node.id}>{asString(node.props.text)}</span>;
    case "Text": {
      const style = styleOf(node);
      return (
        <span key={node.id} style={textStyle(style, ctx.colors, 15)}>
          {renderInlineChildren(node, ctx)}
        </span>
      );
    }
    case "Link": {
      const style = styleOf(node);
      const handlers = node.props.disabled === true
        ? {}
        : pressHandlers(node, ctx, false, {
            type: "press",
            href: asString(node.props.href),
            external: node.props.external === true,
          });
      return (
        <span
          key={node.id}
          {...handlers}
          style={{
            ...textStyle(style, ctx.colors, 15),
            color: qappColor(style.color) ?? ctx.colors.brand,
            textDecoration: style.textDecoration ?? "underline",
            cursor: "pointer",
          }}
        >
          {renderInlineChildren(node, ctx)}
        </span>
      );
    }
    default:
      return renderNode(node, ctx);
  }
}

function renderInlineChildren(node: QappNode, ctx: QappRenderContext): ReactNode {
  return (node.children ?? []).map((child) => renderInline(child, ctx));
}

function renderPositioned(node: QappNode, ctx: QappRenderContext): ReactNode {
  const style = styleOf(node);
  const box = boxStyle(style, ctx.colors);
  const sides: CSSProperties = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const value = asNumber(node.props[side]) ?? asNumber(style[side]);
    if (value !== undefined) sides[side] = value;
  }
  return (
    <div
      key={node.id}
      data-node={node.id}
      style={{
        ...box,
        position: "absolute",
        ...sides,
        // Flex children of a positioned box can grow: the box itself is sized.
        display: "flex",
        flexDirection: style.flexDirection === "row" ? "row" : "column",
      }}
    >
      {(node.children ?? []).map((child) => renderNode(child, ctx))}
    </div>
  );
}

function QappBadge({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const children = (node.children ?? []).map((child) => renderNode(child, ctx));
  const anchor = children.length ? children : null;
  const visible = node.props.visible !== false;
  const dot = node.props.dot === true;
  const count = asNumber(node.props.count) ?? 0;
  const max = Math.min(999, Math.max(1, Math.round(asNumber(node.props.max) ?? 99)));
  const label = dot ? "" : count > 0 ? (Math.floor(count) > max ? `${max}+` : String(Math.floor(count))) : "";
  if (!visible || (!dot && !label)) return <>{anchor}</>;
  return (
    <span style={{ ...boxStyle(style, ctx.colors), position: "relative", display: "inline-flex", flex: "0 0 auto" }}>
      {anchor}
      <span
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          transform: "translate(40%, -40%)",
          minWidth: dot ? 8 : 16,
          height: dot ? 8 : 16,
          padding: dot ? 0 : "0 4px",
          borderRadius: 999,
          background: "#fa5151",
          color: "#ffffff",
          fontSize: 10,
          lineHeight: "16px",
          fontWeight: 600,
          textAlign: "center",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function QappAvatar({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const size = Math.min(160, Math.max(16, asNumber(node.props.size) ?? asNumber(style.width) ?? 40));
  const name = asString(node.props.name);
  const src = asString(node.props.src);
  const image = resolveAsset(src, ctx);
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = words.map((word) => Array.from(word)[0] ?? "").join("").toUpperCase();
  return (
    <span
      style={{
        ...boxStyle(style, ctx.colors),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "0 0 auto",
        overflow: "hidden",
        borderRadius: node.props.shape === "rounded" ? size * 0.28 : size / 2,
        background: "#0f7b4529",
        color: ctx.colors.brand,
        fontSize: size * 0.38,
        fontWeight: 600,
      }}
    >
      {image ? (
        <img src={image} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : initials ? (
        initials
      ) : (
        (() => {
          const Glyph = qappIcon("me");
          return Glyph ? <Glyph size={size * 0.5} color={ctx.colors.brand} strokeWidth={1.9} /> : null;
        })()
      )}
    </span>
  );
}

function resolveAsset(src: string, ctx: QappRenderContext): string | null {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("assets/")) return ctx.assets[src] ?? null;
  return null;
}

function QappImage({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const width = asNumber(node.props.width) ?? asNumber(style.width);
  const height = asNumber(node.props.height) ?? asNumber(style.height);
  const radius = asNumber(node.props.borderRadius) ?? asNumber(style.borderRadius) ?? 0;
  const src = resolveAsset(asString(node.props.src), ctx);
  const [failed, setFailed] = useState(false);
  const fit = asString(node.props.fit) || "cover";
  const objectFit =
    fit === "contain" || fit === "fitWidth" || fit === "fitHeight"
      ? "contain"
      : fit === "fill"
        ? "fill"
        : "cover";
  const handlers = hasEvent(node, "press") ? pressHandlers(node, ctx, false) : {};
  return (
    <div
      data-node={node.id}
      {...handlers}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "block",
        overflow: "hidden",
        width,
        height,
        borderRadius: radius,
        cursor: handlers.role ? "pointer" : undefined,
      }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={{
            display: "block",
            width: width ?? "100%",
            height: height ?? (width ? "auto" : undefined),
            maxWidth: "100%",
            objectFit,
          }}
        />
      ) : (
        <div
          style={{
            width: width ?? 80,
            height: height ?? Math.round((width ?? 80) * 0.66),
            background: ctx.colors.fill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: ctx.colors.muted,
          }}
        >
          {(() => {
            const Glyph = qappIcon("image");
            return Glyph ? <Glyph size={18} color={ctx.colors.muted} strokeWidth={1.6} /> : null;
          })()}
        </div>
      )}
    </div>
  );
}

function QappButton({
  node,
  ctx,
  relax,
}: {
  node: QappNode;
  ctx: QappRenderContext;
  relax: "row" | "column" | null;
}) {
  const style = styleOf(node);
  const variant = asString(node.props.variant) || "primary";
  const palette = BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary;
  const size = asString(node.props.size) || "md";
  const metrics = BUTTON_SIZE[size] ?? BUTTON_SIZE.md;
  const disabled = node.props.disabled === true;
  const loading = node.props.loading === true;
  const handlers = pressHandlers(node, ctx, disabled || loading);
  const box = withRelax(boxStyle(style, ctx.colors), relax);
  const background = qappColor(style.backgroundColor) ?? palette.background;
  const foreground = qappColor(style.color) ?? palette.color;
  const radius = asNumber(style.borderRadius) ?? 6;
  const borderWidth = asNumber(style.borderWidth);
  const borderColor = qappColor(style.borderColor) ?? palette.border;
  const border =
    borderWidth && borderWidth > 0
      ? `${borderWidth}px solid ${borderColor ?? foreground}`
      : palette.border
        ? `1px solid ${borderColor ?? palette.border}`
        : undefined;
  const Glyph = qappIcon(asString(node.props.icon));
  return (
    <div
      data-node={node.id}
      {...handlers}
      aria-label={asString(node.props.accessibleLabel) || undefined}
      style={{
        ...box,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minHeight: metrics.height,
        minWidth: 64,
        padding: metrics.padding,
        borderRadius: radius,
        border,
        background,
        color: foreground,
        fontSize: metrics.font,
        fontWeight: 500,
        lineHeight: 1.2,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled || loading ? "default" : "pointer",
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      {loading ? (
        <span
          style={{
            width: metrics.icon,
            height: metrics.icon,
            borderRadius: "50%",
            border: `2px solid ${foreground}55`,
            borderTopColor: foreground,
            animation: "qapp-spin 800ms linear infinite",
            boxSizing: "border-box",
          }}
        />
      ) : Glyph ? (
        <Glyph size={metrics.icon} color={foreground} strokeWidth={2} />
      ) : null}
      {loading ? null : (
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {textOf(node)}
        </span>
      )}
    </div>
  );
}

function QappDivider({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const color = qappColor(String(node.props.color ?? "")) ?? qappColor(style.color) ?? ctx.colors.line;
  const thickness = Math.max(1, asNumber(node.props.thickness) ?? 1);
  const inset = asNumber(node.props.inset) ?? 0;
  const vertical = node.props.vertical === true;
  return (
    <div
      data-node={node.id}
      style={{
        flex: "0 0 auto",
        alignSelf: vertical ? "stretch" : undefined,
        width: vertical ? thickness : undefined,
        height: vertical ? undefined : thickness,
        marginLeft: vertical ? undefined : inset,
        marginTop: vertical ? inset : undefined,
        background: color,
        minWidth: vertical ? thickness : undefined,
        minHeight: vertical ? 1 : thickness,
      }}
    />
  );
}

function QappSafeArea({
  node,
  ctx,
  relax,
}: {
  node: QappNode;
  ctx: QappRenderContext;
  relax: "row" | "column" | null;
}) {
  const style = styleOf(node);
  const edges = Array.isArray(node.props.edges)
    ? (node.props.edges as string[])
    : ["top", "right", "bottom", "left"];
  const padding: CSSProperties = {};
  if (edges.includes("top")) padding.paddingTop = ctx.device.safeAreaTop;
  if (edges.includes("bottom")) padding.paddingBottom = ctx.device.safeAreaBottom;
  return (
    <div
      data-node={node.id}
      style={{
        ...withRelax(boxStyle(style, ctx.colors), relax),
        display: "flex",
        flexDirection: "column",
        ...padding,
      }}
    >
      {(node.children ?? []).map((child) => renderNode(child, ctx, { relax }))}
    </div>
  );
}

function QappTextInput({
  node,
  ctx,
  relax,
}: {
  node: QappNode;
  ctx: QappRenderContext;
  relax: "row" | "column" | null;
}) {
  const style = styleOf(node);
  const editable = node.props.editable !== false;
  const multiline = node.props.multiline === true;
  const maxLength = asNumber(node.props.maxLength);
  const initial = asString(node.props.value);
  const [text, setText] = useState(initial);
  const previous = useRef(initial);
  const box = withRelax(boxStyle(style, ctx.colors), relax);

  useEffect(() => {
    const next = asString(node.props.value);
    if (next !== previous.current) {
      previous.current = next;
      setText(next);
    }
  }, [node.props.value]);

  const type = asString(node.props.keyboardType);
  const radius = asNumber(style.borderRadius) ?? 8;
  const textColor = qappColor(style.color) ?? ctx.colors.ink;
  // The host draws a field's chrome exactly once. When the app styled one,
  // `boxStyle` already carries its fill, border, radius and padding, so the
  // preview only has to centre the editor inside them. When it did not, the
  // host paints TDesign's filled 48-point field (88 for a multiline box) with
  // a 12-point side inset, and the preview does the same.
  const appChrome =
    qappColor(style.backgroundColor) !== undefined ||
    style.gradient !== undefined ||
    style.borderWidth !== undefined ||
    style.borderColor !== undefined ||
    style.shadow === true;
  const chrome: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxSizing: "border-box",
    width: style.width === undefined ? "100%" : undefined,
    ...(appChrome
      ? {}
      : {
          minHeight: multiline ? 88 : 48,
          padding: multiline ? "10px 12px" : "0 12px",
          borderRadius: radius,
          background: ctx.colors.fill,
        }),
  };

  const change = (value: string) => {
    setText(value);
    if (hasEvent(node, "input")) ctx.emit(node.id, "input", value);
    if (hasEvent(node, "change")) {
      ctx.emit(node.id, "change", { type: "change", value, text: value });
    }
  };

  const common = {
    value: text,
    disabled: !editable,
    maxLength,
    placeholder: asString(node.props.placeholder),
    autoFocus: node.props.autoFocus === true,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      change(event.target.value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !multiline) {
        event.preventDefault();
        if (hasEvent(node, "submit")) {
          ctx.emit(node.id, "submit", { type: "submit", value: text, text });
        }
      }
    },
    onFocus: hasEvent(node, "focus") ? () => ctx.emit(node.id, "focus", { type: "focus" }) : undefined,
    onBlur: hasEvent(node, "blur") ? () => ctx.emit(node.id, "blur", { type: "blur" }) : undefined,
    style: {
      ...textStyle(style, ctx.colors, 15),
      color: textColor,
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      padding: 0,
      margin: 0,
      resize: "none" as const,
      fontFamily: "inherit",
    },
  };

  return (
    <div data-node={node.id} style={{ ...box, ...chrome }}>
      {multiline ? (
        <textarea {...common} rows={3} />
      ) : (
        <input
          {...common}
          type={type === "number" ? "number" : type === "phone" ? "tel" : type === "email" ? "email" : "text"}
          inputMode={
            type === "number" ? "decimal" : type === "phone" ? "tel" : type === "email" ? "email" : undefined
          }
        />
      )}
    </div>
  );
}

function QappCheckbox({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const prop = node.props.checked === true;
  const [checked, setChecked] = useState(prop);
  const previous = useRef(prop);
  useEffect(() => {
    if (prop !== previous.current) {
      previous.current = prop;
      setChecked(prop);
    }
  }, [prop]);
  const disabled = node.props.disabled === true;
  const toggle = () => {
    if (disabled) return;
    const next = !checked;
    setChecked(next);
    ctx.emit(node.id, "change", { type: "change", value: next });
  };
  const brand = ctx.colors.brand;
  return (
    <label
      data-node={node.id}
      onClick={toggle}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          flex: "0 0 auto",
          borderRadius: 4,
          border: `1.5px solid ${checked ? brand : "#c5c8ce"}`,
          background: checked ? brand : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 6.2 L4.7 8.8 L10 3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      {asString(node.props.label) ? (
        <span style={{ ...textStyle(style, ctx.colors, 15), color: qappColor(style.color) ?? ctx.colors.ink }}>
          {asString(node.props.label)}
        </span>
      ) : null}
    </label>
  );
}

function QappSwitch({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const prop = node.props.value === true;
  const [value, setValue] = useState(prop);
  const previous = useRef(prop);
  useEffect(() => {
    if (prop !== previous.current) {
      previous.current = prop;
      setValue(prop);
    }
  }, [prop]);
  const disabled = node.props.disabled === true;
  const brand = ctx.colors.brand;
  const toggle = () => {
    if (disabled) return;
    const next = !value;
    setValue(next);
    if (hasEvent(node, "change")) ctx.emit(node.id, "change", { type: "change", value: next });
    if (hasEvent(node, "valueChange")) {
      ctx.emit(node.id, "valueChange", { type: "valueChange", value: next });
    }
  };
  return (
    <button
      type="button"
      data-node={node.id}
      onClick={toggle}
      aria-pressed={value}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "flex",
        alignItems: "center",
        width: 44,
        height: 26,
        flex: "0 0 auto",
        padding: 2,
        borderRadius: 999,
        border: "none",
        background: value ? brand : "#d9dce0",
        boxSizing: "border-box",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "background 160ms ease",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transform: value ? "translateX(18px)" : "translateX(0)",
          transition: "transform 160ms ease",
        }}
      />
    </button>
  );
}

function QappSlider({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const min = asNumber(node.props.min) ?? 0;
  const max = asNumber(node.props.max) ?? 100;
  const step = asNumber(node.props.step) ?? 1;
  const prop = Math.min(max, Math.max(min, asNumber(node.props.value) ?? min));
  const [value, setValue] = useState(prop);
  const previous = useRef(prop);
  useEffect(() => {
    if (prop !== previous.current) {
      previous.current = prop;
      setValue(prop);
    }
  }, [prop]);
  const disabled = node.props.disabled === true;
  const snap = (raw: number) =>
    Math.min(max, Math.max(min, step > 0 ? Math.round((raw - min) / step) * step + min : raw));
  return (
    <input
      data-node={node.id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const next = snap(Number(event.target.value));
        setValue(next);
        if (hasEvent(node, "change")) ctx.emit(node.id, "change", { type: "change", value: next });
        if (hasEvent(node, "valueChange")) {
          ctx.emit(node.id, "valueChange", { type: "valueChange", value: next });
        }
      }}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "block",
        width: style.width === undefined ? "100%" : undefined,
        accentColor: qappColor(style.color) ?? ctx.colors.brand,
        cursor: disabled ? "default" : "pointer",
      }}
    />
  );
}

function QappNavBar({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const title = asString(node.props.title);
  const subtitle = asString(node.props.subtitle);
  const safeArea = node.props.safeArea !== false;
  const transparent = node.props.transparent === true;
  const border = node.props.border !== false && !transparent;
  const showBack = node.props.showBack === true && hasEvent(node, "back");
  const color = qappColor(style.color) ?? ctx.colors.ink;
  const BackIcon = qappIcon("arrowLeft");
  return (
    <div
      data-node={node.id}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "flex",
        flexDirection: "column",
        flex: "0 0 auto",
        paddingTop: safeArea ? ctx.device.safeAreaTop : undefined,
        background: transparent ? "transparent" : (qappColor(style.backgroundColor) ?? ctx.colors.surface),
        borderBottom: border ? `1px solid ${ctx.colors.line}` : undefined,
        backdropFilter: node.props.blur === true ? "blur(18px)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", minHeight: 52, padding: "0 12px 0 4px" }}>
        {showBack ? (
          <button
            type="button"
            onClick={() => ctx.emit(node.id, "back", { type: "back" })}
            aria-label="Back"
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {BackIcon ? <BackIcon size={22} color={color} strokeWidth={2} /> : null}
          </button>
        ) : null}
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {title ? (
            <div
              style={{
                ...textStyle(style, ctx.colors, 17),
                color,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: showBack ? "left" : "center",
              }}
            >
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div
              style={{
                fontSize: 12,
                color: ctx.colors.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: showBack ? "left" : "center",
                marginTop: 1,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {/* The host floats its own capsule over the right edge of a header. */}
        <div style={{ width: 88, flex: "0 0 auto" }} />
      </div>
      {(node.children ?? []).length ? (
        <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 10px" }}>
          {(node.children ?? []).map((child) => renderNode(child, ctx))}
        </div>
      ) : null}
    </div>
  );
}

function QappTabBar({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  const style = styleOf(node);
  const tabs = Array.isArray(node.props.tabs) ? (node.props.tabs as Record<string, unknown>[]) : [];
  const activeKey = node.props.activeKey == null ? null : asString(node.props.activeKey);
  let activeIndex = Math.round(asNumber(node.props.activeIndex) ?? 0);
  if (activeKey !== null) {
    const found = tabs.findIndex((tab) => asString(tab.key) === activeKey);
    if (found >= 0) activeIndex = found;
  }
  if (activeIndex < 0) activeIndex = 0;
  const height = asNumber(style.height) ?? 58;
  const safeArea = node.props.safeArea !== false;
  const active = qappColor(style.color) ?? ctx.colors.brand;
  const inactive = ctx.colors.muted;
  const topWidth = asNumber(style.borderTopWidth);
  return (
    <div
      data-node={node.id}
      style={{
        ...boxStyle(style, ctx.colors),
        display: "flex",
        flexDirection: "row",
        flex: "0 0 auto",
        background: qappColor(style.backgroundColor) ?? ctx.colors.surface,
        borderTop:
          topWidth === 0
            ? undefined
            : `${topWidth ?? 0.5}px solid ${qappColor(style.borderTopColor) ?? ctx.colors.line}`,
        paddingBottom: safeArea ? ctx.device.safeAreaBottom : undefined,
      }}
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;
        const color = selected ? active : inactive;
        const Glyph = qappIcon(asString(tab.icon));
        const badge = asString(tab.badge);
        return (
          <button
            key={asString(tab.key) || index}
            type="button"
            onClick={() => {
              if (!hasEvent(node, "change")) return;
              const key = asString(tab.key);
              ctx.emit(node.id, "change", {
                type: "change",
                index,
                key,
                value: { index, key, value: key },
              });
            }}
            style={{
              flex: "1 1 0",
              height,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              border: "none",
              background: "transparent",
              color,
              cursor: hasEvent(node, "change") ? "pointer" : "default",
              padding: 0,
            }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              {Glyph ? <Glyph size={22} color={color} strokeWidth={selected ? 2.1 : 1.8} /> : null}
              {badge ? (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    minWidth: 14,
                    height: 14,
                    padding: "0 3px",
                    borderRadius: 999,
                    background: "#fa5151",
                    color: "#ffffff",
                    fontSize: 9,
                    lineHeight: "14px",
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 10, lineHeight: "12px" }}>{asString(tab.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

function QappOverlay({ node, ctx }: { node: QappNode; ctx: QappRenderContext }) {
  if (node.props.visible !== true) return null;

  // Overlays cover the device, not the browser window: the preview is scaled
  // and lives inside a scrolling panel, so `fixed` would escape it.
  if (node.type === "Dialog") {
    const title = asString(node.props.title);
    const confirmText = asString(node.props.confirmText);
    const cancelText = asString(node.props.cancelText);
    const hasActions = confirmText !== "" || cancelText !== "";
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,.45)",
          animation: "qapp-fade-in 160ms ease-out both",
        }}
        onClick={() => {
          if (hasEvent(node, "close")) ctx.emit(node.id, "close", { type: "close" });
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 320,
            margin: "0 24px",
            padding: 18,
            borderRadius: 16,
            background: ctx.colors.surface,
            color: ctx.colors.ink,
            boxSizing: "border-box",
            animation: "qapp-scale-in 180ms ease-out both",
            boxShadow: "0 24px 60px rgba(0,0,0,.35)",
          }}
        >
          {title ? (
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{title}</div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5 }}>
            {(node.children ?? []).map((child) => renderNode(child, ctx))}
          </div>
          {hasActions ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              {cancelText ? (
                <button
                  type="button"
                  onClick={() => {
                    if (hasEvent(node, "close")) ctx.emit(node.id, "close", { type: "close" });
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: ctx.colors.muted,
                    fontSize: 15,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  {cancelText}
                </button>
              ) : null}
              {confirmText ? (
                <button
                  type="button"
                  onClick={() => {
                    if (hasEvent(node, "confirm")) ctx.emit(node.id, "confirm", { type: "confirm" });
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: ctx.colors.brand,
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  {confirmText}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (node.type === "BottomSheet") {
    const height = asNumber(node.props.height);
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div
          onClick={() => {
            if (hasEvent(node, "close")) ctx.emit(node.id, "close", { type: "close" });
          }}
          style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height,
            maxHeight: "92%",
            padding: "12px 16px",
            paddingBottom: 16 + ctx.device.safeAreaBottom,
            background: ctx.colors.surface,
            color: ctx.colors.ink,
            borderRadius: "18px 18px 0 0",
            boxSizing: "border-box",
            overflowY: "auto",
            animation: "qapp-slide-up 240ms ease-out both",
          }}
        >
          {(node.children ?? []).map((child) => renderNode(child, ctx, { relax: "column" }))}
        </div>
      </div>
    );
  }

  // Modal
  const transparent = node.props.transparent === true;
  const animation = asString(node.props.animationType) || "none";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: transparent ? "transparent" : "rgba(0,0,0,.45)",
        animation: animation === "none" ? undefined : "qapp-fade-in 180ms ease-out both",
      }}
      onClick={() => {
        if (hasEvent(node, "close")) ctx.emit(node.id, "close", { type: "close" });
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "100%",
          overflowY: "auto",
          animation:
            animation === "slide"
              ? "qapp-slide-up 240ms ease-out both"
              : animation === "fade"
                ? "qapp-fade-in 180ms ease-out both"
                : undefined,
        }}
      >
        {(node.children ?? []).map((child) => renderNode(child, ctx))}
      </div>
    </div>
  );
}

function QappCustomPaint({
  node,
  ctx,
  style,
}: {
  node: QappNode;
  ctx: QappRenderContext;
  style: CSSProperties;
}) {
  const draw = asString(node.props.draw);
  const styleValue = styleOf(node);
  const width = asNumber(node.props.width) ?? asNumber(styleValue.width) ?? 100;
  const height = asNumber(node.props.height) ?? asNumber(styleValue.height) ?? 100;
  const parsed = parseDraw(draw, ctx.colors);
  return (
    <span style={{ ...style, display: "inline-flex", flex: "0 0 auto", width, height }}>
      {parsed ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          <path
            d={parsed.d}
            fill={parsed.fill ?? "none"}
            stroke={parsed.stroke ?? (parsed.fill ? "none" : "#000000")}
            strokeWidth={parsed.strokeWidth}
            strokeLinecap={parsed.cap}
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function parseDraw(
  draw: string,
  colors: QappThemeColors,
): {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth: number;
  cap: "round" | "butt" | "square";
} | null {
  const tokens = draw.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let fill: string | undefined;
  let stroke: string | undefined;
  let strokeWidth = 2;
  let cap: "round" | "butt" | "square" = "round";
  let index = 0;
  for (; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.startsWith("fill:")) {
      fill = qappColor(token.slice(5)) ?? undefined;
      continue;
    }
    if (token.startsWith("stroke:")) {
      stroke = qappColor(token.slice(7)) ?? undefined;
      continue;
    }
    if (token.startsWith("strokeWidth:")) {
      const parsed = Number(token.slice(12));
      if (Number.isFinite(parsed)) strokeWidth = Math.min(64, Math.max(0.1, parsed));
      continue;
    }
    if (token.startsWith("cap:")) {
      const value = token.slice(4);
      cap = value === "butt" || value === "square" ? value : "round";
      continue;
    }
    break;
  }
  const commands = tokens.slice(index);
  if (!commands.length) return null;
  const valid = new Set(["M", "L", "Q", "C", "Z"]);
  for (const token of commands) {
    if (/^[A-Za-z]$/.test(token) && !valid.has(token.toUpperCase())) return null;
  }
  if (!valid.has((commands[0] ?? "").toUpperCase())) return null;
  void colors;
  return {
    d: commands.join(" "),
    fill,
    stroke: stroke ?? (fill ? undefined : "#000000"),
    strokeWidth,
    cap,
  };
}

/** The whole frame: everything is absolutely sized by its own styles. */
export function QappFrameView({
  root,
  ctx,
}: {
  root: QappNode | null;
  ctx: QappRenderContext;
}): ReactNode {
  if (!root) return null;
  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // Overlays (`Dialog`, `Modal`, `BottomSheet`) are absolutely positioned
        // against the frame, so the frame itself must be a containing block.
        position: "relative",
        // The device's base typography: everything that does not set its own
        // size or colour inherits this, exactly like the Flutter frame.
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 15,
        lineHeight: 1.3,
        color: ctx.colors.ink,
      },
    },
    renderNode(root, ctx),
  );
}

export { fontWeight };

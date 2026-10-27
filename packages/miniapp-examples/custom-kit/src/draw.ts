/**
 * Path strings for the `CustomPaint` node.
 *
 * The Flutter host only understands a small declarative language — absolute
 * `M/L/Q/C/Z` plus `fill:`, `stroke:` and `strokeWidth:` prefixes — so every
 * helper here returns one string in that language. Geometry is computed here,
 * in TS, because the host deliberately has no maths API.
 */

/** Round to two decimals and drop trailing zeros; keeps paths short. */
export function n(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Scale every coordinate of a path drawn on a 24×24 grid. */
export function scalePath(d: string, scale: number): string {
  return d.replace(/-?\d+(?:\.\d+)?/g, (match) => n(Number(match) * scale));
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Catmull-Rom through every point, emitted as cubic segments. A plain polyline
 * looks jagged at 2px, and the parser has no `S`, so the tangents are computed
 * here instead.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  const head = `M ${n(first.x)} ${n(first.y)}`;
  if (points.length === 1) return head;
  if (points.length === 2) {
    return `${head} L ${n(points[1].x)} ${n(points[1].y)}`;
  }
  const parts: string[] = [head];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    parts.push(
      `C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2.x)} ${n(p2.y)}`,
    );
  }
  return parts.join(" ");
}

/** Project a series onto a box inset by `pad`, so the line never clips. */
export function seriesPoints(
  values: number[],
  width: number,
  height: number,
  pad = 4,
): Point[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerWidth = Math.max(1, width - pad * 2);
  const innerHeight = Math.max(1, height - pad * 2);
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: pad + step * index,
    y: pad + innerHeight - ((value - min) / span) * innerHeight,
  }));
}

export function lineDraw(
  values: number[],
  width: number,
  height: number,
  color: string,
  strokeWidth = 2,
  pad = 4,
): string {
  return `stroke:${color} strokeWidth:${n(strokeWidth)} ${smoothPath(
    seriesPoints(values, width, height, pad),
  )}`;
}

/** Same curve, closed along the bottom edge, for the tinted area under it. */
export function areaDraw(
  values: number[],
  width: number,
  height: number,
  color: string,
  pad = 4,
): string {
  const points = seriesPoints(values, width, height, pad);
  if (points.length < 2) return "";
  const last = points[points.length - 1];
  const first = points[0];
  const path = `${smoothPath(points)} L ${n(last.x)} ${n(height)} L ${n(
    first.x,
  )} ${n(height)} Z`;
  return `fill:${color} ${path}`;
}

/**
 * Arc from `startDeg` to `endDeg` — 0° is 3 o'clock and angles grow clockwise,
 * like the ring in the UI. Every quarter gets one cubic, which is accurate to
 * well under a pixel at these radii.
 */
export function arcDraw(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  color: string,
  strokeWidth = 8,
): string {
  const sweep = endDeg - startDeg;
  if (Math.abs(sweep) < 0.01 || radius <= 0) return "";
  const segments = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const step = sweep / segments;
  const radians = (deg: number) => (deg * Math.PI) / 180;
  const at = (deg: number): Point => ({
    x: cx + radius * Math.cos(radians(deg)),
    y: cy + radius * Math.sin(radians(deg)),
  });
  const start = at(startDeg);
  const parts = [`M ${n(start.x)} ${n(start.y)}`];
  for (let index = 0; index < segments; index += 1) {
    const from = startDeg + step * index;
    const to = from + step;
    const k = (4 / 3) * Math.tan(radians(step) / 4);
    const p0 = at(from);
    const p1 = at(to);
    const c1 = {
      x: p0.x - k * radius * Math.sin(radians(from)),
      y: p0.y + k * radius * Math.cos(radians(from)),
    };
    const c2 = {
      x: p1.x + k * radius * Math.sin(radians(to)),
      y: p1.y - k * radius * Math.cos(radians(to)),
    };
    parts.push(
      `C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(p1.x)} ${n(p1.y)}`,
    );
  }
  return `stroke:${color} strokeWidth:${n(strokeWidth)} ${parts.join(" ")}`;
}

/** A five-point star, drawn from its ten corners. */
export function starPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    points.push(`${n(cx + radius * Math.cos(angle))} ${n(cy + radius * Math.sin(angle))}`);
  }
  return `M ${points.join(" L ")} Z`;
}

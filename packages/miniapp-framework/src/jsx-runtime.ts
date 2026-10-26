import { h, Fragment, type VNode } from "./runtime.js";

export { Fragment };

function create(
  type: any,
  props: Record<string, unknown> | null,
  key?: string | number,
): VNode {
  const next = { ...(props ?? {}) };
  if (key !== undefined) next.key = key;
  return h(type, next);
}

export function jsx(type: any, props: Record<string, unknown> | null, key?: string | number): VNode {
  return create(type, props, key);
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export namespace JSX {
  export interface Element extends VNode {}
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicElements {
    [name: string]: Record<string, unknown>;
  }
}

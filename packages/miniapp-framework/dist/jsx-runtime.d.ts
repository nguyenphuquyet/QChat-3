import { Fragment, type VNode } from "./runtime.js";
export { Fragment };
export declare function jsx(type: any, props: Record<string, unknown> | null, key?: string | number): VNode;
export declare const jsxs: typeof jsx;
export declare const jsxDEV: typeof jsx;
export declare namespace JSX {
    interface Element extends VNode {
    }
    interface ElementChildrenAttribute {
        children: {};
    }
    interface IntrinsicElements {
        [name: string]: Record<string, unknown>;
    }
}
//# sourceMappingURL=jsx-runtime.d.ts.map
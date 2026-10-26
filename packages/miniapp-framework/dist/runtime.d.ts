import { type BaseProps, type SerializedTree } from "./protocol.js";
export type Component<P extends BaseProps = BaseProps> = (props: P) => VNodeChild;
export type VNodeChild = VNode | string | number | boolean | null | undefined | VNodeChild[];
export interface VNode {
    type: string | Component<any> | typeof Fragment;
    props: Record<string, unknown>;
    children: VNodeChild[];
    key?: string;
}
export declare const Fragment: "#fragment";
export declare function h(type: VNode["type"], props: Record<string, unknown> | null, ...children: VNodeChild[]): VNode;
/** Create a host node without children. Used by the UI components. */
export declare function node(type: string, props?: Record<string, unknown>): VNode;
export declare function useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void];
export declare function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void];
export declare function useRef<T>(initial: T): {
    current: T;
};
export declare function useMemo<T>(factory: () => T, deps: unknown[]): T;
export declare function useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[]): T;
export declare function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
/** Attach a lifecycle listener for `resume`, `pause` or `destroy`. */
export declare function useLifecycle(listener: (event: string, payload?: unknown) => void): void;
export declare function scheduleRender(): void;
/** Start the mini app and emit the first render frame. */
export declare function start(component: Component<any>, options?: {
    appId?: string;
}): void;
export declare function dispose(): void;
/** Test/dev helper: forces a rerender and returns the latest tree. */
export declare function getRenderTree(): SerializedTree | null;
export declare function dispatchEvent(id: string, event: string, payload?: unknown): void;
/** Validate that a host-supplied tree only contains supported node types. */
export declare const hostNodeTypes: Set<string>;
export declare function assertKnownType(type: string): void;
//# sourceMappingURL=runtime.d.ts.map
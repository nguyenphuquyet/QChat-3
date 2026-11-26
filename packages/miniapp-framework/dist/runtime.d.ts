import { type BaseProps, type SerializedTree } from "./protocol.js";
export type Component<P extends BaseProps = BaseProps> = (props: P) => VNodeChild;
/** A ref never reaches the host; it exists so `ref` type-checks everywhere. */
export type QappRef<T = unknown> = {
    current: T | null;
} | ((value: T | null) => void);
export type VNodeChild = VNode | string | number | boolean | null | undefined | VNodeChild[];
export interface VNode {
    type: string | Component<any> | ContextProvider;
    props: Record<string, unknown>;
    children: VNodeChild[];
    key?: string;
}
export declare const Fragment = "#fragment";
export declare function h(type: VNode["type"], props: Record<string, unknown> | null, ...children: VNodeChild[]): VNode;
/** Create a host node without children. Used by the UI components. */
export declare function node(type: string, props?: Record<string, unknown>): VNode;
export declare function useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void];
export declare function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, (action: A) => void];
export declare function useRef<T>(initial: T): {
    current: T;
};
export declare function useMemo<T>(factory: () => T, deps?: unknown[]): T;
export declare function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: unknown[]): T;
export declare function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
/** Same as `useEffect` but runs before the frame is handed to Flutter. */
export declare function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void;
/** A stable id, unique per component instance and hook position. */
export declare function useId(): string;
/** Attach a lifecycle listener for `resume`, `pause` or `destroy`. */
export declare function useLifecycle(listener: (event: string, payload?: unknown) => void): void;
export interface ContextProvider {
    (props: {
        value: unknown;
        children?: VNodeChild;
    }): VNodeChild;
}
export interface Context<T> {
    readonly defaultValue: T;
    readonly Provider: ContextProvider;
    readonly Consumer: (props: {
        children: (value: T) => VNodeChild;
    }) => VNodeChild;
    /** The value visible to `useContext`; the nearest provider replaces it. */
    value: T;
}
export declare function createContext<T>(defaultValue: T): Context<T>;
export declare function useContext<T>(context: Context<T>): T;
export declare function scheduleRender(): void;
/** Start the mini app and emit the first render frame. */
export declare function start(component: Component<any>, options?: {
    appId?: string;
}): void;
export declare function dispose(): void;
/** Test/dev helper: returns the latest rendered tree. */
export declare function getRenderTree(): SerializedTree | null;
export declare function dispatchEvent(id: string, event: string, payload?: unknown): void;
/** Node types the host understands, generated from the UI contract. */
export declare const hostNodeTypes: ReadonlySet<string>;
export declare function assertKnownType(type: string): void;
//# sourceMappingURL=runtime.d.ts.map
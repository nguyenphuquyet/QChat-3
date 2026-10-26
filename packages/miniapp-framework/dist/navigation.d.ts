/** Navigate to another screen or page inside the same mini app. */
export declare function navigateTo(path: string): Promise<void>;
export declare function navigateBack(): Promise<void>;
export declare function closeMiniApp(): Promise<void>;
/** Requires the `toast` permission. */
export declare function showToast(message: string, options?: {
    icon?: "success" | "error" | "none";
    duration?: number;
}): Promise<void>;
export declare function openExternal(url: string): Promise<void>;
//# sourceMappingURL=navigation.d.ts.map
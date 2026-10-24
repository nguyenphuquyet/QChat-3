import type { BridgeOptions, BridgeResponse } from "./protocol";
import type { AppInfo, ChooseImageOptions, ChosenImage, RequestOptions, SharePayload, ShareResult, SystemInfo, ToastOptions, UserInfo } from "./types";
export declare const MINIAPP_API_ALLOWLIST: readonly ["/users/me", "/friends", "/conversations"];
declare global {
    interface Window {
        QChatNative?: {
            postMessage: (message: string) => void;
        };
        __QChatReceive?: (payload: string) => void;
    }
}
export declare class QChatClient {
    private readonly pending;
    private readonly transport?;
    private readonly timeoutMs;
    private readonly requestTimeoutMs;
    private readonly chooseImageTimeoutMs;
    private disposed;
    constructor(options?: BridgeOptions);
    private installReceiver;
    receive(payload: BridgeResponse | string | unknown): boolean;
    private send;
    getAppInfo(): Promise<AppInfo>;
    getUserInfo(): Promise<UserInfo | null>;
    showToast(message: string, options?: ToastOptions): Promise<void>;
    chooseImage(options?: ChooseImageOptions): Promise<ChosenImage>;
    share(payload: SharePayload): Promise<ShareResult>;
    navigateTo(path: string): Promise<void>;
    closeMiniApp(): Promise<void>;
    request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
    getStorage<T = unknown>(key: string): Promise<T | null>;
    setStorage<T = unknown>(key: string, value: T): Promise<void>;
    removeStorage(key: string): Promise<void>;
    getSystemInfo(): Promise<SystemInfo>;
    dispose(reason?: string): void;
}
export declare const QChat: QChatClient;
export declare function createQChatClient(options?: BridgeOptions): QChatClient;
//# sourceMappingURL=client.d.ts.map
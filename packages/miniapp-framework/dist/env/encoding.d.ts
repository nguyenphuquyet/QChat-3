/**
 * `TextEncoder` and `TextDecoder` do not exist in QuickJS. Only UTF-8 is
 * supported, which is the label every QChat API speaks; other labels raise a
 * `RangeError` instead of silently guessing.
 */
export declare class QappTextEncoder {
    readonly encoding = "utf-8";
    encode(input?: string): Uint8Array;
}
export declare class QappTextDecoder {
    readonly encoding = "utf-8";
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;
    constructor(label?: string, options?: {
        fatal?: boolean;
        ignoreBOM?: boolean;
    });
    decode(input?: ArrayLike<number> | null, options?: {
        stream?: boolean;
    }): string;
}
export declare function installEncoding(): void;
//# sourceMappingURL=encoding.d.ts.map
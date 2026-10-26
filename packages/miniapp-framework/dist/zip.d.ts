export interface ZipEntryInput {
    name: string;
    data: Buffer;
}
export interface ZipEntry {
    name: string;
    bytes: Buffer;
    compressedSize: number;
    size: number;
    method: number;
    crc: number;
}
export declare function crc32(bytes: Buffer): number;
export interface ZipWriteOptions {
    /** Fixed timestamp makes package bytes reproducible in tests. */
    date?: Date;
    compress?: boolean;
}
export declare function writeZip(entries: ZipEntryInput[], options?: ZipWriteOptions): Buffer;
export interface ZipReadLimits {
    maxArchiveBytes: number;
    maxTotalBytes: number;
    maxEntryBytes: number;
    maxEntries: number;
}
export declare const defaultZipLimits: ZipReadLimits;
export declare function isSafeName(raw: string): boolean;
export declare function readZip(bytes: Buffer, limits?: ZipReadLimits): ZipEntry[];
//# sourceMappingURL=zip.d.ts.map
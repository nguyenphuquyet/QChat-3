/**
 * QuickJS has neither `URL` nor `URLSearchParams`. This is a small, strict
 * implementation covering what a mini app uses: parsing and rebuilding an
 * absolute URL, resolving a relative reference against a base, credentials,
 * host, port, path, query and hash, plus a live search-params view.
 */
export type QappURLSearchParamsInit = string | QappURLSearchParams | Array<[unknown, unknown]> | Record<string, unknown> | undefined;
export declare class QappURLSearchParams {
    private pairs;
    /** Called after every mutation so a bound `URL.search` stays in sync. */
    private sync;
    constructor(init?: QappURLSearchParamsInit);
    /** Internal: bind this instance to a `URL.search` string. */
    bindSync(sync: () => void): void;
    /** Internal: replace the pairs without notifying the bound URL. */
    reset(search: string): void;
    append(name: unknown, value: unknown): void;
    delete(name: unknown, value?: unknown): void;
    get(name: unknown): string | null;
    getAll(name: unknown): string[];
    has(name: unknown, value?: unknown): boolean;
    set(name: unknown, value: unknown): void;
    sort(): void;
    entries(): Array<[string, string]>;
    keys(): string[];
    values(): string[];
    forEach(callback: (value: string, key: string) => void): void;
    toString(): string;
    get size(): number;
}
export declare class QappURL {
    private parts;
    private params;
    constructor(input: unknown, base?: unknown);
    get searchParams(): QappURLSearchParams;
    get href(): string;
    set href(value: string);
    get protocol(): string;
    set protocol(value: string);
    get username(): string;
    set username(value: string);
    get password(): string;
    set password(value: string);
    get host(): string;
    set host(value: string);
    get hostname(): string;
    set hostname(value: string);
    get port(): string;
    set port(value: string);
    get pathname(): string;
    set pathname(value: string);
    get search(): string;
    set search(value: string);
    get hash(): string;
    set hash(value: string);
    get origin(): string;
    toString(): string;
    toJSON(): string;
}
export declare function installUrl(): void;
//# sourceMappingURL=url.d.ts.map
/**
 * QuickJS has neither `URL` nor `URLSearchParams`. This is a small, strict
 * implementation covering what a mini app uses: parsing and rebuilding an
 * absolute URL, resolving a relative reference against a base, credentials,
 * host, port, path, query and hash, plus a live search-params view.
 */
function encodePart(value) {
    return encodeURIComponent(value).replace(/%20/g, "+");
}
function decodePart(value) {
    try {
        return decodeURIComponent(value.replace(/\+/g, " "));
    }
    catch {
        return value.replace(/\+/g, " ");
    }
}
function toText(value) {
    if (value === undefined)
        return "undefined";
    if (value === null)
        return "null";
    return typeof value === "string" ? value : String(value);
}
function readPairs(search) {
    const pairs = [];
    const source = search.startsWith("?") ? search.slice(1) : search;
    if (!source.length)
        return pairs;
    for (const chunk of source.split("&")) {
        if (!chunk.length)
            continue;
        const index = chunk.indexOf("=");
        if (index < 0)
            pairs.push([decodePart(chunk), ""]);
        else {
            pairs.push([decodePart(chunk.slice(0, index)), decodePart(chunk.slice(index + 1))]);
        }
    }
    return pairs;
}
function serializePairs(pairs) {
    return pairs
        .map(([key, value]) => `${encodePart(key)}=${encodePart(value)}`)
        .join("&");
}
export class QappURLSearchParams {
    pairs = [];
    /** Called after every mutation so a bound `URL.search` stays in sync. */
    sync = null;
    constructor(init) {
        if (init === undefined)
            return;
        if (typeof init === "string") {
            this.pairs = readPairs(init);
            return;
        }
        if (Array.isArray(init)) {
            for (const entry of init) {
                if (!Array.isArray(entry) || entry.length < 2) {
                    throw new TypeError("URLSearchParams entries need a name and a value");
                }
                this.pairs.push([toText(entry[0]), toText(entry[1])]);
            }
            return;
        }
        if (init instanceof QappURLSearchParams) {
            this.pairs = init.entries();
            return;
        }
        const iterable = init;
        if (iterable && typeof iterable.entries === "function") {
            this.pairs = init
                .entries()
                .map(([key, value]) => [key, value]);
            return;
        }
        for (const [key, value] of Object.entries(init)) {
            this.pairs.push([key, toText(value)]);
        }
    }
    /** Internal: bind this instance to a `URL.search` string. */
    bindSync(sync) {
        this.sync = sync;
    }
    /** Internal: replace the pairs without notifying the bound URL. */
    reset(search) {
        this.pairs = readPairs(search);
    }
    append(name, value) {
        this.pairs.push([toText(name), toText(value)]);
        this.sync?.();
    }
    delete(name, value) {
        const key = toText(name);
        const target = value === undefined ? null : toText(value);
        this.pairs = this.pairs.filter(([existingKey, existingValue]) => target === null
            ? existingKey !== key
            : !(existingKey === key && existingValue === target));
        this.sync?.();
    }
    get(name) {
        const key = toText(name);
        const found = this.pairs.find(([existingKey]) => existingKey === key);
        return found ? found[1] : null;
    }
    getAll(name) {
        const key = toText(name);
        return this.pairs
            .filter(([existingKey]) => existingKey === key)
            .map(([, value]) => value);
    }
    has(name, value) {
        const key = toText(name);
        if (value === undefined) {
            return this.pairs.some(([existingKey]) => existingKey === key);
        }
        const target = toText(value);
        return this.pairs.some(([existingKey, existingValue]) => existingKey === key && existingValue === target);
    }
    set(name, value) {
        const key = toText(name);
        const index = this.pairs.findIndex(([existingKey]) => existingKey === key);
        this.pairs = this.pairs.filter(([existingKey]) => existingKey !== key);
        const entry = [key, toText(value)];
        if (index < 0)
            this.pairs.push(entry);
        else
            this.pairs.splice(Math.min(index, this.pairs.length), 0, entry);
        this.sync?.();
    }
    sort() {
        this.pairs = this.pairs
            .map((pair, index) => ({ pair, index }))
            .sort((left, right) => left.pair[0] < right.pair[0]
            ? -1
            : left.pair[0] > right.pair[0]
                ? 1
                : left.index - right.index)
            .map((entry) => entry.pair);
        this.sync?.();
    }
    entries() {
        return this.pairs.map(([key, value]) => [key, value]);
    }
    keys() {
        return this.pairs.map(([key]) => key);
    }
    values() {
        return this.pairs.map(([, value]) => value);
    }
    forEach(callback) {
        for (const [key, value] of this.pairs)
            callback(value, key);
    }
    toString() {
        return serializePairs(this.pairs);
    }
    get size() {
        return this.pairs.length;
    }
}
const SPECIAL_SCHEMES = new Set(["http:", "https:", "ws:", "wss:", "ftp:"]);
function normalizePath(pathname) {
    const trailing = pathname.endsWith("/");
    const output = [];
    for (const segment of pathname.split("/")) {
        if (segment === "." || segment === "")
            continue;
        if (segment === "..") {
            output.pop();
            continue;
        }
        output.push(segment);
    }
    const built = `/${output.join("/")}`;
    return trailing && built !== "/" ? `${built}/` : built;
}
function parseAuthority(value, parts) {
    let rest = value;
    const at = rest.lastIndexOf("@");
    if (at >= 0) {
        const credentials = rest.slice(0, at);
        rest = rest.slice(at + 1);
        const colon = credentials.indexOf(":");
        parts.username = colon < 0 ? credentials : credentials.slice(0, colon);
        parts.password = colon < 0 ? "" : credentials.slice(colon + 1);
    }
    if (rest.startsWith("[")) {
        const close = rest.indexOf("]");
        parts.hostname = close < 0 ? rest : rest.slice(0, close + 1);
        const tail = close < 0 ? "" : rest.slice(close + 1);
        parts.port = tail.startsWith(":") ? tail.slice(1) : "";
        return;
    }
    const colon = rest.lastIndexOf(":");
    if (colon > 0 && /^\d+$/.test(rest.slice(colon + 1))) {
        parts.hostname = rest.slice(0, colon);
        parts.port = rest.slice(colon + 1);
        return;
    }
    parts.hostname = rest;
    parts.port = "";
}
const URL_PATTERN = /^(?:([A-Za-z][A-Za-z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:(\?[^#]*))?(#.*)?$/;
function parseAbsolute(input) {
    const match = URL_PATTERN.exec(input);
    if (!match || !match[1])
        throw new TypeError(`Invalid URL: ${input}`);
    const parts = {
        protocol: `${match[1].toLowerCase()}:`,
        authority: match[2] !== undefined,
        username: "",
        password: "",
        hostname: "",
        port: "",
        pathname: match[3] ?? "",
        search: match[4] ?? "",
        hash: match[5] ?? "",
    };
    if (parts.authority) {
        parseAuthority(match[2] ?? "", parts);
        parts.pathname = normalizePath(parts.pathname || "/");
    }
    return parts;
}
function isAbsolute(input) {
    return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(input);
}
function buildHost(parts) {
    return parts.port ? `${parts.hostname}:${parts.port}` : parts.hostname;
}
function buildHref(parts) {
    if (!parts.authority) {
        return `${parts.protocol}${parts.pathname}${parts.search}${parts.hash}`;
    }
    const credentials = parts.username
        ? `${parts.username}${parts.password ? `:${parts.password}` : ""}@`
        : "";
    return `${parts.protocol}//${credentials}${buildHost(parts)}${parts.pathname}${parts.search}${parts.hash}`;
}
function resolveReference(input, base) {
    if (isAbsolute(input))
        return input;
    const baseParts = parseAbsolute(base);
    if (input.startsWith("//"))
        return `${baseParts.protocol}${input}`;
    if (input === "")
        return buildHref(baseParts);
    if (input.startsWith("#")) {
        return `${buildHref({ ...baseParts, search: "", hash: "" })}${baseParts.search}${input}`;
    }
    if (input.startsWith("?")) {
        return `${buildHref({ ...baseParts, search: "", hash: "" })}${input}`;
    }
    const hashIndex = input.indexOf("#");
    const withoutHash = hashIndex < 0 ? input : input.slice(0, hashIndex);
    const hash = hashIndex < 0 ? "" : input.slice(hashIndex);
    const queryIndex = withoutHash.indexOf("?");
    const path = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex);
    const search = queryIndex < 0 ? "" : withoutHash.slice(queryIndex);
    // An absolute path replaces the base path entirely; a relative one is
    // resolved against the base directory.
    const basePath = path.startsWith("/")
        ? "/"
        : baseParts.pathname.endsWith("/")
            ? baseParts.pathname
            : baseParts.pathname.slice(0, baseParts.pathname.lastIndexOf("/") + 1);
    const authority = baseParts.authority
        ? `//${buildHost(baseParts)}`
        : "";
    return `${baseParts.protocol}${authority}${normalizePath(`${basePath}${path}`)}${search}${hash}`;
}
export class QappURL {
    parts;
    params;
    constructor(input, base) {
        const text = toText(input);
        const resolved = base === undefined || base === null
            ? text
            : resolveReference(text, toText(base));
        this.parts = parseAbsolute(resolved);
        this.params = new QappURLSearchParams(this.parts.search);
        this.params.bindSync(() => {
            const query = this.params.toString();
            this.parts.search = query.length ? `?${query}` : "";
        });
    }
    get searchParams() {
        return this.params;
    }
    get href() {
        return buildHref(this.parts);
    }
    set href(value) {
        this.parts = parseAbsolute(toText(value));
        this.params.reset(this.parts.search);
    }
    get protocol() {
        return this.parts.protocol;
    }
    set protocol(value) {
        const next = toText(value);
        this.parts.protocol = next.endsWith(":") ? next.toLowerCase() : `${next.toLowerCase()}:`;
    }
    get username() {
        return this.parts.username;
    }
    set username(value) {
        this.parts.username = toText(value);
    }
    get password() {
        return this.parts.password;
    }
    set password(value) {
        this.parts.password = toText(value);
    }
    get host() {
        return buildHost(this.parts);
    }
    set host(value) {
        parseAuthority(toText(value), this.parts);
    }
    get hostname() {
        return this.parts.hostname;
    }
    set hostname(value) {
        this.parts.hostname = toText(value);
    }
    get port() {
        return this.parts.port;
    }
    set port(value) {
        const next = toText(value);
        if (next === "") {
            this.parts.port = "";
            return;
        }
        if (!/^\d+$/.test(next))
            throw new TypeError(`Invalid port: ${next}`);
        this.parts.port = String(Number(next));
    }
    get pathname() {
        return this.parts.pathname;
    }
    set pathname(value) {
        const next = toText(value);
        this.parts.pathname = normalizePath(next.startsWith("/") ? next : `/${next}`);
    }
    get search() {
        return this.parts.search;
    }
    set search(value) {
        const next = toText(value);
        const query = next === "" || next === "?" ? "" : next.startsWith("?") ? next : `?${next}`;
        this.parts.search = query;
        this.params.reset(query);
    }
    get hash() {
        return this.parts.hash;
    }
    set hash(value) {
        const next = toText(value);
        this.parts.hash =
            next === "" || next === "#" ? "" : next.startsWith("#") ? next : `#${next}`;
    }
    get origin() {
        if (!this.parts.authority || !this.parts.hostname)
            return "null";
        return SPECIAL_SCHEMES.has(this.parts.protocol)
            ? `${this.parts.protocol}//${buildHost(this.parts)}`
            : "null";
    }
    toString() {
        return buildHref(this.parts);
    }
    toJSON() {
        return buildHref(this.parts);
    }
}
let installed = false;
export function installUrl() {
    if (installed)
        return;
    installed = true;
    const scope = globalThis;
    scope.URL = QappURL;
    scope.URLSearchParams = QappURLSearchParams;
}
//# sourceMappingURL=url.js.map
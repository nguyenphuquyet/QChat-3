/**
 * QuickJS ships without ECMA-402, so `Intl` does not exist at all. This is a
 * deliberately small polyfill for the two locales QChat supports today,
 * `vi-VN` and `en-US`: number, percent, currency and compact numbers, plus date
 * and time formatting. An unsupported locale tag raises a `RangeError` instead
 * of silently formatting in a language the user cannot read.
 *
 * `installIntl()` also routes `Date.prototype.toLocaleString`,
 * `toLocaleDateString`, `toLocaleTimeString` and
 * `Number.prototype.toLocaleString` through the polyfill, because the QuickJS
 * versions ignore the locale. On an engine that already has a native `Intl`
 * (JavaScriptCore on iOS does), the native implementation is kept unless
 * `force: true` is passed.
 */
export type QappLocale = "vi-VN" | "en-US";
type DateStyleName = "full" | "long" | "medium" | "short";
export declare function supportedLocales(): QappLocale[];
export type QappNotation = "standard" | "compact";
export type QappSignDisplay = "auto" | "always" | "never" | "exceptZero";
export type QappNumberStyle = "decimal" | "percent" | "currency";
export interface QappNumberFormatOptions {
    style?: QappNumberStyle;
    currency?: string;
    currencyDisplay?: "symbol" | "code" | "name";
    minimumIntegerDigits?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
    notation?: QappNotation;
    signDisplay?: QappSignDisplay;
    numberingSystem?: string;
}
export interface QappNumberPart {
    type: "minusSign" | "plusSign" | "integer" | "group" | "decimal" | "fraction" | "compact" | "currency" | "percentSign" | "literal" | "nan" | "infinity";
    value: string;
}
export declare class QappNumberFormat {
    private readonly options;
    private readonly locale;
    constructor(locales?: unknown, options?: QappNumberFormatOptions, fallback?: QappLocale);
    formatToParts(value: unknown): QappNumberPart[];
    format(value: unknown): string;
    resolvedOptions(): Record<string, unknown>;
}
export type QappDateFormatField = "numeric" | "2-digit" | "long" | "short" | "narrow";
export interface QappDateFormatOptions {
    weekday?: QappDateFormatField;
    year?: QappDateFormatField;
    month?: QappDateFormatField;
    day?: QappDateFormatField;
    hour?: QappDateFormatField;
    minute?: QappDateFormatField;
    second?: QappDateFormatField;
    hour12?: boolean;
    dateStyle?: DateStyleName;
    timeStyle?: DateStyleName;
    timeZone?: string;
    numberingSystem?: string;
}
export interface QappDatePart {
    type: "literal" | "weekday" | "year" | "month" | "day" | "dayPeriod" | "hour" | "minute" | "second";
    value: string;
}
export declare class QappDateTimeFormat {
    private readonly options;
    private readonly locale;
    constructor(locales?: unknown, options?: QappDateFormatOptions, fallback?: QappLocale);
    formatToParts(value: unknown): QappDatePart[];
    format(value: unknown): string;
    resolvedOptions(): Record<string, unknown>;
}
export interface InstallIntlOptions {
    /** Locale used when the app passes no locale; defaults to `en-US`. */
    locale?: QappLocale;
    /** Route `toLocaleString` on Date and Number through the polyfill. */
    patchToLocale?: boolean;
    /** Replace a native `Intl` implementation. */
    force?: boolean;
}
export declare function isIntlInstalled(): boolean;
export declare function installIntl(options?: InstallIntlOptions): boolean;
export {};
//# sourceMappingURL=intl.d.ts.map
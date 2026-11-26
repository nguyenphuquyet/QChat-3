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

import { globalValue } from "./scope.js";

export type QappLocale = "vi-VN" | "en-US";

type DateStyleName = "full" | "long" | "medium" | "short";

interface LocaleData {
  id: QappLocale;
  months: string[];
  shortMonths: string[];
  narrowMonths: string[];
  weekdays: string[];
  shortWeekdays: string[];
  narrowWeekdays: string[];
  decimal: string;
  group: string;
  hour12: boolean;
  am: string;
  pm: string;
  dateStyles: Record<DateStyleName, string>;
  timeStyles: Record<DateStyleName, string>;
  glue: Record<DateStyleName, string>;
  compact: [string, string, string];
  currency: Record<string, { symbol: string; suffix: boolean; digits: number }>;
  defaultCurrency: string;
}

const VI: LocaleData = {
  id: "vi-VN",
  months: [
    "tháng 1", "tháng 2", "tháng 3", "tháng 4", "tháng 5", "tháng 6",
    "tháng 7", "tháng 8", "tháng 9", "tháng 10", "tháng 11", "tháng 12",
  ],
  shortMonths: [
    "thg 1", "thg 2", "thg 3", "thg 4", "thg 5", "thg 6",
    "thg 7", "thg 8", "thg 9", "thg 10", "thg 11", "thg 12",
  ],
  narrowMonths: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  weekdays: [
    "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy",
  ],
  shortWeekdays: ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"],
  narrowWeekdays: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  decimal: ",",
  group: ".",
  hour12: false,
  am: "SA",
  pm: "CH",
  dateStyles: {
    full: "EEEE, d MMMM, yyyy",
    long: "d MMMM, yyyy",
    medium: "d MMM, yyyy",
    short: "dd/MM/yy",
  },
  timeStyles: {
    full: "HH:mm:ss",
    long: "HH:mm:ss",
    medium: "HH:mm:ss",
    short: "HH:mm",
  },
  glue: { full: "%s %t", long: "%s %t", medium: "%s %t", short: "%s %t" },
  compact: [" N", " Tr", " T"],
  currency: {
    VND: { symbol: "₫", suffix: true, digits: 0 },
    USD: { symbol: "US$", suffix: true, digits: 2 },
    EUR: { symbol: "€", suffix: true, digits: 2 },
    JPY: { symbol: "¥", suffix: true, digits: 0 },
  },
  defaultCurrency: "VND",
};

const EN: LocaleData = {
  id: "en-US",
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  shortMonths: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  narrowMonths: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  weekdays: [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ],
  shortWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  narrowWeekdays: ["S", "M", "T", "W", "T", "F", "S"],
  decimal: ".",
  group: ",",
  hour12: true,
  am: "AM",
  pm: "PM",
  dateStyles: {
    full: "EEEE, MMMM d, yyyy",
    long: "MMMM d, yyyy",
    medium: "MMM d, yyyy",
    short: "M/d/yy",
  },
  timeStyles: {
    full: "h:mm:ss a",
    long: "h:mm:ss a",
    medium: "h:mm:ss a",
    short: "h:mm a",
  },
  glue: { full: "%s at %t", long: "%s at %t", medium: "%s, %t", short: "%s, %t" },
  compact: ["K", "M", "B"],
  currency: {
    VND: { symbol: "₫", suffix: false, digits: 0 },
    USD: { symbol: "$", suffix: false, digits: 2 },
    EUR: { symbol: "€", suffix: false, digits: 2 },
    JPY: { symbol: "¥", suffix: false, digits: 0 },
  },
  defaultCurrency: "USD",
};

const LOCALES: Record<string, LocaleData> = {
  vi: VI,
  "vi-vn": VI,
  en: EN,
  "en-us": EN,
};

const SUPPORTED = "vi-VN and en-US";

export function supportedLocales(): QappLocale[] {
  return ["vi-VN", "en-US"];
}

function localeFor(tag: unknown): QappLocale | null {
  const key = String(tag).trim().toLowerCase().replace(/_/g, "-");
  return LOCALES[key]?.id ?? null;
}

function resolveLocale(input: unknown, fallback: QappLocale): QappLocale {
  if (input === undefined || input === null) return fallback;
  const list = Array.isArray(input) ? input : [input];
  for (const entry of list) {
    if (entry === undefined || entry === null) continue;
    return localeFor(entry) ?? unsupported(entry);
  }
  return fallback;
}

function unsupported(tag: unknown): never {
  throw new RangeError(
    `The locale "${String(tag)}" is not supported by the QChat Intl polyfill (${SUPPORTED})`,
  );
}

function pad(value: string, length: number): string {
  let output = value;
  while (output.length < length) output = `0${output}`;
  return output;
}

/* -------------------------------------------------------------------------- */
/* Number formatting                                                          */
/* -------------------------------------------------------------------------- */

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
  type:
    | "minusSign"
    | "plusSign"
    | "integer"
    | "group"
    | "decimal"
    | "fraction"
    | "compact"
    | "currency"
    | "percentSign"
    | "literal"
    | "nan"
    | "infinity";
  value: string;
}

function pushInteger(
  parts: QappNumberPart[],
  integer: string,
  separator: string,
  grouping: boolean,
): void {
  if (!grouping || integer.length <= 3) {
    parts.push({ type: "integer", value: integer });
    return;
  }
  const first = integer.length % 3 || 3;
  parts.push({ type: "integer", value: integer.slice(0, first) });
  for (let index = first; index < integer.length; index += 3) {
    parts.push({ type: "group", value: separator });
    parts.push({ type: "integer", value: integer.slice(index, index + 3) });
  }
}

function numberParts(
  input: unknown,
  options: QappNumberFormatOptions,
  locale: LocaleData,
): QappNumberPart[] {
  const style = options.style ?? "decimal";
  const currencyCode = String(options.currency ?? locale.defaultCurrency).toUpperCase();
  const info = locale.currency[currencyCode] ?? {
    symbol: currencyCode,
    suffix: false,
    digits: 2,
  };
  const label =
    options.currencyDisplay === "code" || options.currencyDisplay === "name"
      ? currencyCode
      : info.symbol;
  const currencySuffix = style === "currency" && info.suffix;

  const raw = Number(input);
  if (Number.isNaN(raw)) return [{ type: "nan", value: "NaN" }];
  if (!Number.isFinite(raw)) {
    return raw < 0
      ? [
          { type: "minusSign", value: "-" },
          { type: "infinity", value: "∞" },
        ]
      : [{ type: "infinity", value: "∞" }];
  }

  const signDisplay = options.signDisplay ?? "auto";
  const negative = raw < 0;
  let sign = "";
  if (signDisplay === "always") sign = negative ? "-" : "+";
  else if (signDisplay === "exceptZero") sign = raw === 0 ? "" : negative ? "-" : "+";
  else if (signDisplay === "never") sign = "";
  else if (negative) sign = "-";

  const scaled = style === "percent" ? Math.abs(raw) * 100 : Math.abs(raw);
  const compact = (options.notation ?? "standard") === "compact";
  let value = scaled;
  let compactSuffix = "";
  if (compact) {
    if (scaled >= 1e9) {
      value = scaled / 1e9;
      compactSuffix = locale.compact[2];
    } else if (scaled >= 1e6) {
      value = scaled / 1e6;
      compactSuffix = locale.compact[1];
    } else if (scaled >= 1e3) {
      value = scaled / 1e3;
      compactSuffix = locale.compact[0];
    }
  }

  const defaultFractionDigits =
    style === "currency" ? info.digits : style === "percent" ? 0 : compact ? 1 : 3;
  const maximumFractionDigits = Math.min(
    Math.max(options.maximumFractionDigits ?? defaultFractionDigits, 0),
    20,
  );
  // A currency always shows its minor units: $1,234.50, but 2.500.000 ₫.
  const minimumFractionDigits = Math.min(
    Math.max(
      options.minimumFractionDigits ?? (style === "currency" ? info.digits : 0),
      0,
    ),
    maximumFractionDigits,
  );

  let fixed = value.toFixed(maximumFractionDigits);
  if (fixed.includes(".")) {
    const points = fixed.split(".");
    let fraction = points[1];
    while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
      fraction = fraction.slice(0, -1);
    }
    fixed = fraction.length ? `${points[0]}.${fraction}` : points[0];
  }
  const [rawInteger, fraction = ""] = fixed.split(".");
  const minimumIntegerDigits = Math.min(
    Math.max(options.minimumIntegerDigits ?? 1, 1),
    21,
  );
  const integer = pad(rawInteger, minimumIntegerDigits);
  const grouping = options.useGrouping !== false;

  const parts: QappNumberPart[] = [];
  if (sign) {
    parts.push({ type: sign === "+" ? "plusSign" : "minusSign", value: sign });
  }
  if (style === "currency" && !currencySuffix) {
    parts.push({ type: "currency", value: label });
  }
  pushInteger(parts, integer, locale.group, grouping);
  if (fraction.length) {
    parts.push({ type: "decimal", value: locale.decimal });
    parts.push({ type: "fraction", value: fraction });
  }
  if (compactSuffix) parts.push({ type: "compact", value: compactSuffix });
  if (currencySuffix) {
    parts.push({ type: "literal", value: " " });
    parts.push({ type: "currency", value: label });
  }
  if (style === "percent") parts.push({ type: "percentSign", value: "%" });
  return parts;
}

export class QappNumberFormat {
  private readonly options: QappNumberFormatOptions;
  private readonly locale: LocaleData;

  constructor(
    locales?: unknown,
    options: QappNumberFormatOptions = {},
    fallback: QappLocale = "en-US",
  ) {
    this.locale = LOCALES[resolveLocale(locales, fallback).toLowerCase()];
    this.options = { ...options };
    if (this.options.numberingSystem && this.options.numberingSystem !== "latn") {
      throw new RangeError(
        `The numbering system "${this.options.numberingSystem}" is not supported`,
      );
    }
  }

  formatToParts(value: unknown): QappNumberPart[] {
    return numberParts(value, this.options, this.locale);
  }

  format(value: unknown): string {
    return this.formatToParts(value)
      .map((part) => part.value)
      .join("");
  }

  resolvedOptions(): Record<string, unknown> {
    const style = this.options.style ?? "decimal";
    return {
      locale: this.locale.id,
      numberingSystem: "latn",
      style,
      currency:
        style === "currency"
          ? String(this.options.currency ?? this.locale.defaultCurrency).toUpperCase()
          : undefined,
      notation: this.options.notation ?? "standard",
      signDisplay: this.options.signDisplay ?? "auto",
      minimumFractionDigits: this.options.minimumFractionDigits ?? 0,
      maximumFractionDigits: this.options.maximumFractionDigits ?? 3,
      useGrouping: this.options.useGrouping !== false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Date formatting                                                            */
/* -------------------------------------------------------------------------- */

export type QappDateFormatField =
  | "numeric"
  | "2-digit"
  | "long"
  | "short"
  | "narrow";

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
  type:
    | "literal"
    | "weekday"
    | "year"
    | "month"
    | "day"
    | "dayPeriod"
    | "hour"
    | "minute"
    | "second";
  value: string;
}

function usesUtc(timeZone: unknown): boolean {
  if (timeZone === undefined || timeZone === null) return false;
  const tag = String(timeZone).toUpperCase();
  if (tag === "UTC" || tag === "GMT") return true;
  throw new RangeError(
    `Only the "UTC" time zone is supported by the QChat Intl polyfill (got "${String(timeZone)}")`,
  );
}

interface DateValues {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function readDate(date: Date, utc: boolean): DateValues {
  return {
    year: utc ? date.getUTCFullYear() : date.getFullYear(),
    month: (utc ? date.getUTCMonth() : date.getMonth()) + 1,
    day: utc ? date.getUTCDate() : date.getDate(),
    weekday: utc ? date.getUTCDay() : date.getDay(),
    hours: utc ? date.getUTCHours() : date.getHours(),
    minutes: utc ? date.getUTCMinutes() : date.getMinutes(),
    seconds: utc ? date.getUTCSeconds() : date.getSeconds(),
  };
}

function weekdayToken(field: QappDateFormatField | undefined): string {
  if (field === undefined) return "";
  if (field === "long") return "EEEE";
  if (field === "narrow") return "EEEEE";
  return "EEE";
}

function monthToken(field: QappDateFormatField | undefined, locale: LocaleData): string {
  switch (field) {
    case "2-digit":
      return "MM";
    case "long":
      return "MMMM";
    case "short":
      return "MMM";
    case "narrow":
      return "MMMMM";
    case "numeric":
      // Vietnamese pads the month to two digits: 26/10/2026.
      return locale === VI ? "MM" : "M";
    default:
      return "";
  }
}

/** Builds the date part of the pattern from the requested fields. */
function datePatternFor(
  options: QappDateFormatOptions,
  locale: LocaleData,
): string {
  if (options.dateStyle) return locale.dateStyles[options.dateStyle];
  const weekday = weekdayToken(options.weekday);
  const day = options.day === undefined ? "" : options.day === "2-digit" ? "dd" : "d";
  const month = monthToken(options.month, locale);
  const year =
    options.year === undefined ? "" : options.year === "2-digit" ? "yy" : "yyyy";
  const textual = month === "MMM" || month === "MMMM" || month === "MMMMM";

  let body = "";
  if (day && month && year) {
    if (textual) body = locale === VI ? `${day} ${month}, ${year}` : `${month} ${day}, ${year}`;
    else body = locale === VI ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
  } else if (day && month) {
    body = textual
      ? locale === VI
        ? `${day} ${month}`
        : `${month} ${day}`
      : `${day}/${month}`;
  } else if (month && year) {
    body = textual
      ? locale === VI
        ? `${month} năm ${year}`
        : `${month} ${year}`
      : `${month}/${year}`;
  } else if (day && year) {
    body = `${day}/${year}`;
  } else if (year) {
    body = year;
  } else if (day) {
    body = day;
  } else {
    body = month;
  }
  if (weekday) return body ? `${weekday}, ${body}` : weekday;
  return body;
}

function convertHourCycle(pattern: string, hour12: boolean): string {
  const stripped = pattern.replace(/ ?a$/, "");
  if (hour12) {
    if (/a$/.test(pattern)) return pattern;
    return `${stripped.replace(/HH/, "hh").replace(/H/, "h")} a`;
  }
  if (!/a$/.test(pattern)) return pattern;
  return stripped.replace(/hh/, "HH").replace(/h/, "H");
}

function timePatternFor(
  options: QappDateFormatOptions,
  locale: LocaleData,
  hour12: boolean,
): string {
  if (options.timeStyle) {
    const base = locale.timeStyles[options.timeStyle];
    return options.hour12 === undefined ? base : convertHourCycle(base, hour12);
  }
  const hour = options.hour === undefined ? "" : options.hour === "2-digit" ? "2" : "1";
  const minute = options.minute === undefined ? "" : "mm";
  const second = options.second === undefined ? "" : "ss";
  if (!hour && !minute && !second) return "";
  const clock = hour
    ? hour12
      ? hour === "2"
        ? "hh"
        : "h"
      : hour === "2"
        ? "HH"
        : "H"
    : "";
  const head = clock || (hour12 ? "h" : "HH");
  const body = [head, minute || (clock ? "" : "mm"), second]
    .filter((entry) => entry.length > 0)
    .join(":");
  return hour12 ? `${body} a` : body;
}

function fieldsFor(
  values: DateValues,
  locale: LocaleData,
  hour12: boolean,
): Record<string, () => string> {
  const hour12Value = values.hours % 12 === 0 ? 12 : values.hours % 12;
  const period = values.hours < 12 ? locale.am : locale.pm;
  return {
    d: () => String(values.day),
    dd: () => pad(String(values.day), 2),
    M: () => String(values.month),
    MM: () => pad(String(values.month), 2),
    MMM: () => locale.shortMonths[values.month - 1] ?? "",
    MMMM: () => locale.months[values.month - 1] ?? "",
    MMMMM: () => locale.narrowMonths[values.month - 1] ?? "",
    yy: () => pad(String(Math.abs(values.year) % 100), 2),
    yyyy: () => String(values.year),
    EEE: () => locale.shortWeekdays[values.weekday] ?? "",
    EEEE: () => locale.weekdays[values.weekday] ?? "",
    EEEEE: () => locale.narrowWeekdays[values.weekday] ?? "",
    H: () => String(values.hours),
    HH: () => pad(String(values.hours), 2),
    h: () => String(hour12Value),
    hh: () => pad(String(hour12Value), 2),
    mm: () => pad(String(values.minutes), 2),
    ss: () => pad(String(values.seconds), 2),
    a: () => period,
  };
}

const FIELD_TYPE: Record<string, QappDatePart["type"]> = {
  d: "day",
  dd: "day",
  M: "month",
  MM: "month",
  MMM: "month",
  MMMM: "month",
  MMMMM: "month",
  yy: "year",
  yyyy: "year",
  EEE: "weekday",
  EEEE: "weekday",
  EEEEE: "weekday",
  H: "hour",
  HH: "hour",
  h: "hour",
  hh: "hour",
  mm: "minute",
  ss: "second",
  a: "dayPeriod",
};

function expandPattern(
  pattern: string,
  fields: Record<string, () => string>,
): QappDatePart[] {
  const parts: QappDatePart[] = [];
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "'") {
      const end = pattern.indexOf("'", index + 1);
      parts.push({
        type: "literal",
        value: pattern.slice(index + 1, end < 0 ? pattern.length : end),
      });
      index = end < 0 ? pattern.length : end + 1;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      let run = char;
      while (index + 1 < pattern.length && pattern[index + 1] === char) {
        run += char;
        index++;
      }
      const resolver = fields[run];
      if (resolver) {
        parts.push({ type: FIELD_TYPE[run] ?? "literal", value: resolver() });
      } else {
        // A token we do not know stays visible instead of disappearing.
        parts.push({ type: "literal", value: run });
      }
      index++;
      continue;
    }
    parts.push({ type: "literal", value: char });
    index++;
  }
  return parts;
}

function buildDateTimeParts(
  input: unknown,
  options: QappDateFormatOptions,
  locale: LocaleData,
): QappDatePart[] {
  const date = input instanceof Date ? input : new Date(input as number);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
  const hour12 = options.hour12 ?? locale.hour12;
  const fields = fieldsFor(readDate(date, usesUtc(options.timeZone)), locale, hour12);
  const datePattern =
    options.dateStyle || options.weekday || options.year || options.month || options.day
      ? datePatternFor(options, locale)
      : "";
  const timePattern =
    options.timeStyle || options.hour || options.minute || options.second
      ? timePatternFor(options, locale, hour12)
      : "";
  const dateParts = datePattern ? expandPattern(datePattern, fields) : [];
  const timeParts = timePattern ? expandPattern(timePattern, fields) : [];
  if (dateParts.length && timeParts.length) {
    const style = options.dateStyle ?? options.timeStyle ?? "medium";
    const glue = (locale.glue[style] ?? "%s %t").split("%s");
    const head = glue[0] ?? "";
    const tail = glue[1] ?? "";
    const between = tail.split("%t");
    return [
      ...dateParts,
      ...(between[0] ? [{ type: "literal" as const, value: between[0] }] : []),
      ...timeParts,
      ...(between[1] ? [{ type: "literal" as const, value: between[1] }] : []),
    ];
  }
  if (dateParts.length) return dateParts;
  if (timeParts.length) return timeParts;
  return expandPattern(locale.dateStyles.medium, fields);
}

export class QappDateTimeFormat {
  private readonly options: QappDateFormatOptions;
  private readonly locale: LocaleData;

  constructor(
    locales?: unknown,
    options: QappDateFormatOptions = {},
    fallback: QappLocale = "en-US",
  ) {
    this.locale = LOCALES[resolveLocale(locales, fallback).toLowerCase()];
    this.options = { ...options };
    if (this.options.numberingSystem && this.options.numberingSystem !== "latn") {
      throw new RangeError(
        `The numbering system "${this.options.numberingSystem}" is not supported`,
      );
    }
    // An unsupported time zone is a constructor error, like the platform API.
    usesUtc(this.options.timeZone);
  }

  formatToParts(value: unknown): QappDatePart[] {
    return buildDateTimeParts(value, this.options, this.locale);
  }

  format(value: unknown): string {
    return this.formatToParts(value)
      .map((part) => part.value)
      .join("");
  }

  resolvedOptions(): Record<string, unknown> {
    return {
      locale: this.locale.id,
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: usesUtc(this.options.timeZone) ? "UTC" : "local",
      hour12: this.options.hour12 ?? this.locale.hour12,
      dateStyle: this.options.dateStyle,
      timeStyle: this.options.timeStyle,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Installation                                                               */
/* -------------------------------------------------------------------------- */

export interface InstallIntlOptions {
  /** Locale used when the app passes no locale; defaults to `en-US`. */
  locale?: QappLocale;
  /** Route `toLocaleString` on Date and Number through the polyfill. */
  patchToLocale?: boolean;
  /** Replace a native `Intl` implementation. */
  force?: boolean;
}

function patchToLocaleMethods(defaultLocale: QappLocale): void {
  const dateCtor = globalValue("Date") as
    | { prototype: Record<string, unknown> }
    | undefined;
  const numberCtor = globalValue("Number") as
    | { prototype: Record<string, unknown> }
    | undefined;
  if (dateCtor?.prototype) {
    const proto = dateCtor.prototype;
    proto.toLocaleString = function (
      this: Date,
      locales?: unknown,
      options?: QappDateFormatOptions,
    ) {
      return new QappDateTimeFormat(
        locales,
        options ?? { dateStyle: "medium", timeStyle: "medium" },
        defaultLocale,
      ).format(this);
    };
    proto.toLocaleDateString = function (
      this: Date,
      locales?: unknown,
      options?: QappDateFormatOptions,
    ) {
      return new QappDateTimeFormat(
        locales,
        options ?? { dateStyle: "medium" },
        defaultLocale,
      ).format(this);
    };
    proto.toLocaleTimeString = function (
      this: Date,
      locales?: unknown,
      options?: QappDateFormatOptions,
    ) {
      return new QappDateTimeFormat(
        locales,
        options ?? { timeStyle: "medium" },
        defaultLocale,
      ).format(this);
    };
  }
  if (numberCtor?.prototype) {
    numberCtor.prototype.toLocaleString = function (
      this: number,
      locales?: unknown,
      options?: QappNumberFormatOptions,
    ) {
      return new QappNumberFormat(locales, options ?? {}, defaultLocale).format(this);
    };
  }
}

let installed = false;

export function isIntlInstalled(): boolean {
  return installed;
}

export function installIntl(options: InstallIntlOptions = {}): boolean {
  if (installed) return true;
  const native = globalValue("Intl") as
    | { NumberFormat?: unknown; DateTimeFormat?: unknown }
    | undefined;
  if (!options.force && native?.NumberFormat && native?.DateTimeFormat) {
    // JavaScriptCore already ships a full ECMA-402 implementation; a small
    // subset would be a downgrade, so keep the native one.
    return false;
  }
  const defaultLocale = options.locale ?? "en-US";
  if (!localeFor(defaultLocale)) unsupported(defaultLocale);
  installed = true;
  const scope = globalThis as unknown as Record<string, unknown>;
  const supportedLocalesOf = (locales?: unknown): unknown[] => {
    const list = locales === undefined ? [] : Array.isArray(locales) ? locales : [locales];
    return list.filter((tag) => localeFor(tag) !== null);
  };
  const numberFormat = function (
    locales?: unknown,
    formatOptions?: QappNumberFormatOptions,
  ) {
    return new QappNumberFormat(locales, formatOptions ?? {}, defaultLocale);
  };
  const dateTimeFormat = function (
    locales?: unknown,
    formatOptions?: QappDateFormatOptions,
  ) {
    return new QappDateTimeFormat(locales, formatOptions ?? {}, defaultLocale);
  };
  (numberFormat as unknown as Record<string, unknown>).supportedLocalesOf = supportedLocalesOf;
  (dateTimeFormat as unknown as Record<string, unknown>).supportedLocalesOf = supportedLocalesOf;
  scope.Intl = {
    NumberFormat: numberFormat,
    DateTimeFormat: dateTimeFormat,
    getCanonicalLocales(locales?: unknown) {
      const list = locales === undefined ? [] : Array.isArray(locales) ? locales : [locales];
      return list.map((tag) => resolveLocale(tag, defaultLocale));
    },
  };
  if (options.patchToLocale !== false) patchToLocaleMethods(defaultLocale);
  return true;
}

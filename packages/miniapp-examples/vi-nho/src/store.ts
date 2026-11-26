import { createStorage, useEffect, useState } from "@mna/qchat";
import type { TagTone } from "@mna/qchat/ui";

/**
 * Ví Nhỏ — dữ liệu của một chiếc ví cá nhân giả lập.
 *
 * Toàn bộ state là JSON thuần: 28 khoản thu chi trải từ hôm nay tới 24 ngày
 * trước, sáu hạn mức nhóm và sáu tuỳ chọn. Ngày tháng lấy từ `Date` thật của
 * máy, nên "tháng này" luôn là tháng đang mở app; không có ngày nào bị
 * hard-code. Số tiền tính bằng đồng, không có phần lẻ.
 */

export type Tone = TagTone;
export type Flow = "expense" | "income";
export type Method = "cash" | "card" | "transfer";

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  soft: string;
  tone: Tone;
  flow: Flow;
}

const OTHER_CATEGORY: Category = {
  id: "other",
  label: "Khác",
  icon: "grid",
  color: "#86909c",
  soft: "#f2f3f5",
  tone: "neutral",
  flow: "expense",
};

export const CATEGORIES: readonly Category[] = [
  {
    id: "food",
    label: "Ăn uống",
    icon: "service",
    color: "#e37318",
    soft: "#fdf2e8",
    tone: "warning",
    flow: "expense",
  },
  {
    id: "transport",
    label: "Di chuyển",
    icon: "location",
    color: "#0052d9",
    soft: "#e8f1ff",
    tone: "info",
    flow: "expense",
  },
  {
    id: "shopping",
    label: "Mua sắm",
    icon: "tag",
    color: "#8b5cf6",
    soft: "#f3edff",
    tone: "info",
    flow: "expense",
  },
  {
    id: "bills",
    label: "Hoá đơn",
    icon: "file",
    color: "#d54941",
    soft: "#fdeceb",
    tone: "danger",
    flow: "expense",
  },
  {
    id: "health",
    label: "Sức khoẻ",
    icon: "heart",
    color: "#2ba471",
    soft: "#e8f8f0",
    tone: "success",
    flow: "expense",
  },
  {
    id: "fun",
    label: "Giải trí",
    icon: "music",
    color: "#b28600",
    soft: "#fdf6e3",
    tone: "warning",
    flow: "expense",
  },
  {
    id: "salary",
    label: "Thu nhập",
    icon: "wallet",
    color: "#2ba471",
    soft: "#e8f8f0",
    tone: "success",
    flow: "income",
  },
  OTHER_CATEGORY,
];

export const EXPENSE_CATEGORIES: readonly Category[] = CATEGORIES.filter(
  (category) => category.flow === "expense",
);

export const INCOME_CATEGORIES: readonly Category[] = CATEGORIES.filter(
  (category) => category.flow === "income",
);

export function categoryById(id: string): Category {
  return CATEGORIES.find((category) => category.id === id) ?? OTHER_CATEGORY;
}

export interface MethodOption {
  id: Method;
  label: string;
  icon: string;
}

export const METHODS: readonly MethodOption[] = [
  { id: "cash", label: "Tiền mặt", icon: "wallet" },
  { id: "card", label: "Thẻ", icon: "payments" },
  { id: "transfer", label: "Chuyển khoản", icon: "send" },
];

export function methodById(id: Method): MethodOption {
  return METHODS.find((method) => method.id === id) ?? METHODS[0]!;
}

export function flowLabel(flow: Flow): string {
  return flow === "income" ? "Khoản thu" : "Khoản chi";
}

export interface Txn {
  id: string;
  title: string;
  amount: number;
  flow: Flow;
  categoryId: string;
  method: Method;
  /** `YYYY-MM-DD`. */
  day: string;
  note: string;
  recurring: boolean;
  reconciled: boolean;
  createdAt: number;
}

export interface Budget {
  categoryId: string;
  limit: number;
}

export interface Prefs {
  monthlyBudget: number;
  /** Nhắc trước ngày đến hạn của hoá đơn định kỳ. */
  remind: boolean;
  /** Gửi bản tổng kết chi tiêu mỗi Chủ nhật. */
  weeklyReport: boolean;
  /** Gộp phần lẻ vào quỹ tiết kiệm. */
  roundUp: boolean;
  /** Gợi ý hạn mức mỗi đầu tháng. */
  suggest: boolean;
  /** Chia sẻ số liệu ẩn danh để nhận gợi ý. */
  shareStats: boolean;
  /** Mã PIN 4–6 số, rỗng nghĩa là chưa đặt. */
  pin: string;
}

export const DEFAULT_PREFS: Prefs = {
  monthlyBudget: 16000000,
  remind: true,
  weeklyReport: false,
  roundUp: true,
  suggest: true,
  shareStats: false,
  pin: "",
};

/* ------------------------------------------------------------------ */
/* Ngày tháng                                                          */
/* ------------------------------------------------------------------ */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** `YYYY-MM` của tháng hiện tại, dùng để lọc giao dịch trong tháng. */
export function monthKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthLabel(): string {
  const date = new Date();
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

/** Số ngày còn lại của tháng, tính cả hôm nay. */
export function daysLeftInMonth(): number {
  const date = new Date();
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.max(1, last - date.getDate() + 1);
}

export function dayLabel(day: string): string {
  if (day === todayKey()) return "Hôm nay";
  if (day === dayOffset(-1)) return "Hôm qua";
  const parts = day.split("-");
  return `${parts[2]}/${parts[1]}`;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export function longDay(day: string): string {
  const [year, month, date] = day.split("-").map((part) => Number(part));
  const value = new Date(year ?? 2026, (month ?? 1) - 1, date ?? 1);
  return `${WEEKDAYS[value.getDay()]}, ${dayLabel(day)}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/* ------------------------------------------------------------------ */
/* Dữ liệu mẫu                                                         */
/* ------------------------------------------------------------------ */

type SeedRow = [
  title: string,
  amount: number,
  flow: Flow,
  categoryId: string,
  method: Method,
  daysAgo: number,
  note?: string,
  recurring?: boolean,
];

/**
 * Hai mươi tám khoản đủ để mọi nhóm có số, hai nhóm vượt hạn mức và một
 * nhóm thu nhập. Mọi mốc thời gian là "cách hôm nay N ngày" nên app mở ngày
 * nào cũng có dữ liệu quanh ngày đó.
 */
const SEED_ROWS: readonly SeedRow[] = [
  ["Cà phê sáng", 45000, "expense", "food", "cash", 0, "Quán quen trước cửa"],
  ["Grab đi làm", 62000, "expense", "transport", "transfer", 0],
  ["Bún chả trưa", 55000, "expense", "food", "cash", 0],
  ["Siêu thị cuối ngày", 320000, "expense", "shopping", "card", 0, "Sữa, trứng, hoa quả"],
  ["Cơm tối gia đình", 180000, "expense", "food", "cash", 1],
  ["Nạp điện thoại", 100000, "expense", "bills", "transfer", 1, "", true],
  ["Sách mới", 245000, "expense", "shopping", "card", 1],
  ["Tiền nhà", 3500000, "expense", "bills", "transfer", 2, "Chuyển khoản cho chủ nhà", true],
  ["Xăng xe", 90000, "expense", "transport", "cash", 2],
  ["Phở bò", 50000, "expense", "food", "cash", 3],
  ["Khám răng", 350000, "expense", "health", "card", 3, "Tái khám sau sáu tháng"],
  ["Vé xem phim", 180000, "expense", "fun", "card", 4],
  ["Đi chợ cuối tuần", 480000, "expense", "food", "cash", 5],
  ["Gội đầu", 80000, "expense", "health", "cash", 5],
  ["Tiền điện", 620000, "expense", "bills", "transfer", 6, "Hoá đơn tháng trước", true],
  ["Cà phê với Minh", 95000, "expense", "food", "transfer", 7],
  ["Taxi về khuya", 140000, "expense", "transport", "transfer", 8],
  ["Áo mưa mới", 150000, "expense", "shopping", "cash", 9],
  ["Bữa trưa văn phòng", 60000, "expense", "food", "card", 10],
  ["Internet", 220000, "expense", "bills", "transfer", 11, "", true],
  ["Thu nhập dự án", 8500000, "income", "salary", "transfer", 12, "Đợt thanh toán thứ hai"],
  ["Quà sinh nhật mẹ", 500000, "expense", "shopping", "card", 13],
  ["Cà phê cuối tuần", 120000, "expense", "fun", "cash", 14],
  ["Thu nhập phụ", 1200000, "income", "salary", "card", 16, "Thiết kế banner"],
  ["Tiền nước", 180000, "expense", "bills", "transfer", 18, "", true],
  ["Sửa xe đạp", 200000, "expense", "transport", "cash", 20],
  ["Mua thuốc", 95000, "expense", "health", "cash", 22],
  ["Ăn tối ngoài", 320000, "expense", "food", "card", 24],
];

function seedTxns(): Txn[] {
  const now = Date.now();
  return SEED_ROWS.map((row, index) => ({
    id: `t${index + 1}`,
    title: row[0],
    amount: row[1],
    flow: row[2],
    categoryId: row[3],
    method: row[4],
    day: dayOffset(-row[5]),
    note: row[6] ?? "",
    recurring: row[7] ?? false,
    reconciled: index % 4 === 0,
    createdAt: now - index * 60000,
  }));
}

function seedBudgets(): Budget[] {
  return [
    { categoryId: "food", limit: 1500000 },
    { categoryId: "transport", limit: 1200000 },
    { categoryId: "shopping", limit: 1500000 },
    { categoryId: "bills", limit: 4200000 },
    { categoryId: "health", limit: 800000 },
    { categoryId: "fun", limit: 500000 },
  ];
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let txns: Txn[] = seedTxns();
let budgets: Budget[] = seedBudgets();
let prefs: Prefs = { ...DEFAULT_PREFS };
let nextTxnId = 100;
let hydrated = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const storage = createStorage("vi-nho");

interface Snapshot {
  version: number;
  txns: Txn[];
  budgets: Budget[];
  prefs: Prefs;
  nextTxnId: number;
}

function persist(): void {
  void storage
    .set("state", {
      version: 1,
      txns,
      budgets,
      prefs,
      nextTxnId,
    } satisfies Snapshot)
    .catch(() => {
      // Lưu trữ là tuỳ chọn: thiếu quyền không được làm app hỏng.
    });
}

/** Nạp state đã lưu một lần khi app khởi động. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const saved = await storage.get<Snapshot>("state");
    if (!saved || saved.version !== 1) return;
    if (Array.isArray(saved.txns)) txns = saved.txns;
    if (Array.isArray(saved.budgets)) budgets = saved.budgets;
    prefs = { ...DEFAULT_PREFS, ...(saved.prefs ?? {}) };
    if (typeof saved.nextTxnId === "number") nextTxnId = saved.nextTxnId;
    emit();
  } catch {
    // Lần chạy đầu hoặc quyền bị từ chối: dữ liệu mẫu vẫn dùng được.
  }
}

export function useTxns(): Txn[] {
  const [snapshot, setSnapshot] = useState<Txn[]>(txns);
  useEffect(() => subscribe(() => setSnapshot(txns)), []);
  return snapshot;
}

export function useBudgets(): Budget[] {
  const [snapshot, setSnapshot] = useState<Budget[]>(budgets);
  useEffect(() => subscribe(() => setSnapshot(budgets)), []);
  return snapshot;
}

export function usePrefs(): Prefs {
  const [snapshot, setSnapshot] = useState<Prefs>(prefs);
  useEffect(() => subscribe(() => setSnapshot(prefs)), []);
  return snapshot;
}

/* ------------------------------------------------------------------ */
/* Truy vấn                                                            */
/* ------------------------------------------------------------------ */

export function sortTxns(list: readonly Txn[]): Txn[] {
  return [...list].sort((left, right) => {
    if (left.day !== right.day) return left.day < right.day ? 1 : -1;
    return right.createdAt - left.createdAt;
  });
}

export function currentMonth(list: readonly Txn[]): Txn[] {
  const key = monthKey();
  return list.filter((txn) => txn.day.startsWith(key));
}

export function txnById(list: readonly Txn[], id: string): Txn | null {
  return list.find((txn) => txn.id === id) ?? null;
}

export function searchTxns(
  list: readonly Txn[],
  query: string,
  flow: Flow | "all",
): Txn[] {
  const needle = query.trim().toLowerCase();
  return sortTxns(
    list.filter((txn) => {
      if (flow !== "all" && txn.flow !== flow) return false;
      if (needle.length === 0) return true;
      const category = categoryById(txn.categoryId);
      return (
        txn.title.toLowerCase().includes(needle) ||
        txn.note.toLowerCase().includes(needle) ||
        category.label.toLowerCase().includes(needle)
      );
    }),
  );
}

export function recentTxns(list: readonly Txn[], count: number): Txn[] {
  return sortTxns(list).slice(0, count);
}

export function todayTotal(list: readonly Txn[]): number {
  const key = todayKey();
  return list
    .filter((txn) => txn.day === key && txn.flow === "expense")
    .reduce((sum, txn) => sum + txn.amount, 0);
}

export function todayCount(list: readonly Txn[]): number {
  const key = todayKey();
  return list.filter((txn) => txn.day === key).length;
}

export interface MonthSummary {
  spent: number;
  income: number;
  budget: number;
  remaining: number;
  percent: number;
  tone: Tone;
  label: string;
  daysLeft: number;
  count: number;
}

export function monthSummary(
  list: readonly Txn[],
  budget: number,
): MonthSummary {
  const rows = currentMonth(list);
  let spent = 0;
  let income = 0;
  for (const txn of rows) {
    if (txn.flow === "income") income += txn.amount;
    else spent += txn.amount;
  }
  const percent =
    budget <= 0 ? 0 : Math.min(100, Math.round((spent / budget) * 100));
  let tone: Tone = "success";
  let label = "Trong tầm kiểm soát";
  if (spent >= budget) {
    tone = "danger";
    label = "Vượt ngân sách";
  } else if (percent >= 80) {
    tone = "warning";
    label = "Sắp chạm trần";
  }
  return {
    spent,
    income,
    budget,
    remaining: budget - spent,
    percent,
    tone,
    label,
    daysLeft: daysLeftInMonth(),
    count: rows.length,
  };
}

export function spendByCategory(list: readonly Txn[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const txn of currentMonth(list)) {
    if (txn.flow !== "expense") continue;
    totals[txn.categoryId] = (totals[txn.categoryId] ?? 0) + txn.amount;
  }
  return totals;
}

export interface CategoryTotal {
  category: Category;
  total: number;
  percent: number;
}

/** Nhóm chi nhiều nhất trong tháng, tính theo phần trăm tổng đã chi. */
export function topCategories(
  list: readonly Txn[],
  count: number,
): CategoryTotal[] {
  const totals = spendByCategory(list);
  const spent = Object.keys(totals).reduce(
    (sum, key) => sum + (totals[key] ?? 0),
    0,
  );
  return EXPENSE_CATEGORIES.filter((category) => (totals[category.id] ?? 0) > 0)
    .map((category) => {
      const total = totals[category.id] ?? 0;
      return {
        category,
        total,
        percent: spent === 0 ? 0 : Math.round((total / spent) * 100),
      };
    })
    .sort((left, right) => right.total - left.total)
    .slice(0, count);
}

export interface BudgetRow {
  category: Category;
  limit: number;
  spent: number;
  percent: number;
  tone: Tone;
  state: string;
}

export function budgetRows(
  list: readonly Txn[],
  limits: readonly Budget[],
): BudgetRow[] {
  const totals = spendByCategory(list);
  return limits.map((budget) => {
    const category = categoryById(budget.categoryId);
    const spent = totals[budget.categoryId] ?? 0;
    const percent =
      budget.limit <= 0
        ? 0
        : Math.min(999, Math.round((spent / budget.limit) * 100));
    let tone: Tone = "success";
    let state = "Thoải mái";
    if (percent >= 100) {
      tone = "danger";
      state = "Vượt hạn mức";
    } else if (percent >= 80) {
      tone = "warning";
      state = "Sắp chạm trần";
    } else if (percent >= 50) {
      tone = "info";
      state = "Đang theo dõi";
    }
    return { category, limit: budget.limit, spent, percent, tone, state };
  });
}

export function overBudgetCount(
  list: readonly Txn[],
  limits: readonly Budget[],
): number {
  return budgetRows(list, limits).filter((row) => row.percent >= 100).length;
}

export interface DayTotal {
  key: string;
  label: string;
  total: number;
}

/** Chi tiêu bảy ngày gần nhất, cũ nhất trước, cho biểu đồ cột. */
export function lastSevenDays(list: readonly Txn[]): DayTotal[] {
  const totals: Record<string, number> = {};
  for (const txn of list) {
    if (txn.flow !== "expense") continue;
    totals[txn.day] = (totals[txn.day] ?? 0) + txn.amount;
  }
  const days: DayTotal[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const key = dayKey(date);
    days.push({
      key,
      label: WEEKDAYS[date.getDay()] ?? "",
      total: totals[key] ?? 0,
    });
  }
  return days;
}

/* ------------------------------------------------------------------ */
/* Thay đổi                                                            */
/* ------------------------------------------------------------------ */

export interface NewTxn {
  title: string;
  amount: number;
  flow: Flow;
  categoryId: string;
  method: Method;
  note?: string;
  recurring?: boolean;
  day?: string;
}

export function addTxn(input: NewTxn): Txn {
  const txn: Txn = {
    id: `t${nextTxnId}`,
    title: input.title.trim(),
    amount: Math.max(0, Math.round(input.amount)),
    flow: input.flow,
    categoryId: input.categoryId,
    method: input.method,
    day: input.day ?? todayKey(),
    note: (input.note ?? "").trim(),
    recurring: input.recurring ?? false,
    reconciled: false,
    createdAt: Date.now(),
  };
  nextTxnId += 1;
  txns = [txn, ...txns];
  emit();
  persist();
  return txn;
}

export function updateTxn(
  id: string,
  patch: Partial<Omit<Txn, "id">>,
): void {
  txns = txns.map((txn) => (txn.id === id ? { ...txn, ...patch } : txn));
  emit();
  persist();
}

export function deleteTxns(ids: readonly string[]): number {
  const remove = new Set(ids);
  const before = txns.length;
  txns = txns.filter((txn) => !remove.has(txn.id));
  const removed = before - txns.length;
  if (removed > 0) {
    emit();
    persist();
  }
  return removed;
}

export function deleteTxn(id: string): boolean {
  return deleteTxns([id]) > 0;
}

export function setBudgetLimit(categoryId: string, limit: number): void {
  const value = Math.max(0, Math.round(limit));
  const exists = budgets.some((budget) => budget.categoryId === categoryId);
  budgets = exists
    ? budgets.map((budget) =>
        budget.categoryId === categoryId ? { ...budget, limit: value } : budget,
      )
    : [...budgets, { categoryId, limit: value }];
  emit();
  persist();
}

export function updatePrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  emit();
  persist();
}

/** Đưa ví về đúng dữ liệu mẫu và xoá bản lưu trên thiết bị. */
export function resetAll(): void {
  txns = seedTxns();
  budgets = seedBudgets();
  prefs = { ...DEFAULT_PREFS };
  nextTxnId = 100;
  void storage.remove("state").catch(() => {
    // Xoá thất bại vẫn để app chạy với dữ liệu mẫu trong bộ nhớ.
  });
  emit();
}

/* ------------------------------------------------------------------ */
/* Định dạng                                                           */
/* ------------------------------------------------------------------ */

let moneyFormat: Intl.NumberFormat | null = null;

/** `Intl` đến từ `@mna/qchat/env/auto`, được cài một lần ở `main.tsx`. */
export function money(value: number): string {
  if (!moneyFormat) {
    moneyFormat = new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    });
  }
  return `${moneyFormat.format(Math.round(value))}đ`;
}

/** Số tiền ngắn cho nhãn hẹp: `1,5tr`, `320k`. */
export function shortMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1000000) {
    const millions = Math.round((abs / 1000000) * 10) / 10;
    return `${sign}${String(millions).replace(".", ",")}tr`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

/** Đọc số từ ô nhập: bỏ mọi ký tự không phải chữ số. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length === 0) return 0;
  const value = Number(digits);
  return Number.isFinite(value) ? value : 0;
}

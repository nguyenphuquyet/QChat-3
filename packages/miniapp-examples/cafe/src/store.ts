import { createStorage, useEffect, useState } from "@mna/qchat";

/** Một món trong thực đơn. `price` tính bằng đồng. */
export interface Drink {
  id: string;
  name: string;
  note: string;
  price: number;
  image: string;
  category: "coffee" | "tea" | "bakery";
  tag?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  kcal: number;
}

export const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "coffee", label: "Cà phê" },
  { key: "tea", label: "Trà" },
  { key: "bakery", label: "Bánh" },
];

export const DRINKS: Drink[] = [
  {
    id: "ca-phe-sua",
    name: "Cà phê sữa đá",
    note: "Robusta rang mộc, sữa đặc, đá viên",
    price: 32000,
    image: "assets/ca-phe-sua.png",
    category: "coffee",
    tag: "Bán chạy",
    tone: "success",
    kcal: 180,
  },
  {
    id: "bac-xiu",
    name: "Bạc xỉu",
    note: "Nhiều sữa, một chút cà phê",
    price: 35000,
    image: "assets/bac-xiu.png",
    category: "coffee",
    kcal: 220,
  },
  {
    id: "matcha-latte",
    name: "Matcha latte",
    note: "Matcha Uji, sữa tươi, đá",
    price: 45000,
    image: "assets/matcha-latte.png",
    category: "tea",
    tag: "Mới",
    tone: "info",
    kcal: 160,
  },
  {
    id: "cold-brew-cam",
    name: "Cold brew cam",
    note: "Ủ lạnh 18 giờ, vỏ cam vàng",
    price: 42000,
    image: "assets/cold-brew-cam.png",
    category: "coffee",
    kcal: 90,
  },
  {
    id: "tra-dao-cam-sa",
    name: "Trà đào cam sả",
    note: "Đào giòn, sả tươi, trà oolong",
    price: 39000,
    image: "assets/tra-dao-cam-sa.png",
    category: "tea",
    tag: "Mùa hè",
    tone: "warning",
    kcal: 130,
  },
  {
    id: "croissant-bo",
    name: "Croissant bơ",
    note: "Bơ Pháp, nướng mỗi sáng",
    price: 29000,
    image: "assets/croissant-bo.png",
    category: "bakery",
    kcal: 310,
  },
];

export const SIZES = [
  { key: "S", label: "S · 250ml", extra: 0 },
  { key: "M", label: "M · 350ml", extra: 6000 },
  { key: "L", label: "L · 500ml", extra: 12000 },
] as const;

export const SUGAR_STEPS = [0, 25, 50, 75, 100];

export const EXTRA_PRICE = 10000;

export interface CartLine {
  key: string;
  drinkId: string;
  qty: number;
  size: "S" | "M" | "L";
  sugar: number;
  extra: boolean;
}

export type OrderStatus = "brewing" | "delivering" | "done" | "cancelled";

export interface Order {
  id: string;
  at: number;
  lines: CartLine[];
  total: number;
  status: OrderStatus;
}

export interface Prefs {
  promo: boolean;
  sugar: number;
  receipts: boolean;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  brewing: "Đang pha",
  delivering: "Đang giao",
  done: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export const STATUS_TONE: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  brewing: "warning",
  delivering: "info",
  done: "success",
  cancelled: "danger",
};

export function drinkById(id: string): Drink | undefined {
  return DRINKS.find((entry) => entry.id === id);
}

export function sizeExtra(size: CartLine["size"]): number {
  return SIZES.find((entry) => entry.key === size)?.extra ?? 0;
}

/** Giá của một dòng: giá món + cỡ ly, nhân số lượng, cộng shot thêm. */
export function lineTotal(line: CartLine): number {
  const drink = drinkById(line.drinkId);
  if (!drink) return 0;
  const unit = drink.price + sizeExtra(line.size) + (line.extra ? EXTRA_PRICE : 0);
  return unit * line.qty;
}

export function lineTitle(line: CartLine): string {
  const drink = drinkById(line.drinkId);
  return drink ? drink.name : line.drinkId;
}

export function lineNote(line: CartLine): string {
  return `Cỡ ${line.size} · đường ${line.sugar}%${line.extra ? " · thêm shot" : ""}`;
}

/* ------------------------------------------------------------------ */
/* Store: một module scope + subscription, đủ cho một Mini App.        */
/* ------------------------------------------------------------------ */

let cart: CartLine[] = [];
let orders: Order[] = [];
let vouchers: string[] = [];
let prefs: Prefs = { promo: true, sugar: 50, receipts: false };
let hydrated = false;
let nextOrderId = 1031;

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

const storage = createStorage("cafe");

interface Snapshot {
  cart: CartLine[];
  orders: Order[];
  vouchers: string[];
  prefs: Prefs;
  nextOrderId: number;
}

function persist(): void {
  void storage
    .set("state", {
      cart,
      orders,
      vouchers,
      prefs,
      nextOrderId,
    } satisfies Snapshot)
    .catch(() => {
      // Storage is optional: a denied permission must not break the app.
    });
}

function seedOrders(): Order[] {
  const now = Date.now();
  const seed: Order[] = [
    {
      id: "CF1024",
      at: now - 32 * 60 * 1000,
      status: "delivering",
      lines: [
        {
          key: "ca-phe-sua|M|50|0",
          drinkId: "ca-phe-sua",
          qty: 2,
          size: "M",
          sugar: 50,
          extra: false,
        },
        {
          key: "croissant-bo|S|0|0",
          drinkId: "croissant-bo",
          qty: 1,
          size: "S",
          sugar: 0,
          extra: false,
        },
      ],
      total: 0,
    },
    {
      id: "CF1018",
      at: now - 26 * 60 * 60 * 1000,
      status: "done",
      lines: [
        {
          key: "matcha-latte|L|25|1",
          drinkId: "matcha-latte",
          qty: 1,
          size: "L",
          sugar: 25,
          extra: true,
        },
      ],
      total: 0,
    },
  ];

  return seed.map((order) => ({
    ...order,
    total: order.lines.reduce((sum, line) => sum + lineTotal(line), 0),
  }));
}

/** Nạp state đã lưu một lần khi app khởi động. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const saved = await storage.get<Snapshot>("state");
    if (saved) {
      cart = Array.isArray(saved.cart) ? saved.cart : [];
      orders = Array.isArray(saved.orders) ? saved.orders : [];
      vouchers = Array.isArray(saved.vouchers) ? saved.vouchers : [];
      prefs = { ...prefs, ...(saved.prefs ?? {}) };
      nextOrderId = typeof saved.nextOrderId === "number" ? saved.nextOrderId : nextOrderId;
      emit();
    }
  } catch {
    // First run or a denied permission: the seeded state is still usable.
  }
  if (orders.length === 0) {
    orders = seedOrders();
    emit();
  }
}

export function useCart(): CartLine[] {
  const [snapshot, setSnapshot] = useState<CartLine[]>(cart);
  useEffect(() => subscribe(() => setSnapshot(cart)), []);
  return snapshot;
}

export function useOrders(): Order[] {
  const [snapshot, setSnapshot] = useState<Order[]>(orders);
  useEffect(() => subscribe(() => setSnapshot(orders)), []);
  return snapshot;
}

export function useVouchers(): string[] {
  const [snapshot, setSnapshot] = useState<string[]>(vouchers);
  useEffect(() => subscribe(() => setSnapshot(vouchers)), []);
  return snapshot;
}

export function usePrefs(): Prefs {
  const [snapshot, setSnapshot] = useState<Prefs>(prefs);
  useEffect(() => subscribe(() => setSnapshot(prefs)), []);
  return snapshot;
}

export function cartCount(lines: CartLine[] = cart): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartTotal(lines: CartLine[] = cart): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

/** Thêm một món; cấu hình giống hệt thì cộng dồn vào dòng đã có. */
export function addToCart(input: {
  drinkId: string;
  size: CartLine["size"];
  sugar: number;
  extra: boolean;
  qty?: number;
}): void {
  const key = `${input.drinkId}|${input.size}|${input.sugar}|${input.extra ? 1 : 0}`;
  const existing = cart.find((line) => line.key === key);
  const qty = Math.max(1, input.qty ?? 1);
  cart = existing
    ? cart.map((line) =>
        line.key === key ? { ...line, qty: line.qty + qty } : line,
      )
    : [
        ...cart,
        {
          key,
          drinkId: input.drinkId,
          qty,
          size: input.size,
          sugar: input.sugar,
          extra: input.extra,
        },
      ];
  emit();
  persist();
}

export function changeQty(key: string, delta: number): void {
  cart = cart
    .map((line) =>
      line.key === key ? { ...line, qty: line.qty + delta } : line,
    )
    .filter((line) => line.qty > 0);
  emit();
  persist();
}

export function removeLine(key: string): void {
  cart = cart.filter((line) => line.key !== key);
  emit();
  persist();
}

export function clearCart(): void {
  cart = [];
  emit();
  persist();
}

/** Chốt giỏ thành một đơn và trả về đơn đó. */
export function placeOrder(): Order | null {
  if (cart.length === 0) return null;
  const order: Order = {
    id: `CF${nextOrderId}`,
    at: Date.now(),
    lines: cart.map((line) => ({ ...line })),
    total: cartTotal(),
    status: "brewing",
  };
  nextOrderId += 1;
  orders = [order, ...orders];
  cart = [];
  emit();
  persist();
  return order;
}

export function cancelOrder(id: string): void {
  orders = orders.map((order) =>
    order.id === id ? { ...order, status: "cancelled" } : order,
  );
  emit();
  persist();
}

export function claimVoucher(code: string): void {
  if (vouchers.includes(code)) return;
  vouchers = [...vouchers, code];
  emit();
  persist();
}

export function updatePrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  emit();
  persist();
}

let moneyFormat: Intl.NumberFormat | null = null;

/** `Intl` đến từ `@mna/qchat/env/auto`, được cài một lần ở `main.tsx`. */
export function money(value: number): string {
  if (!moneyFormat) {
    moneyFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
  }
  return `${moneyFormat.format(value)}đ`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function clock(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dayLabel(at: number): string {
  const date = new Date(at);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? `Hôm nay · ${clock(at)}`
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${clock(at)}`;
}

/** Đồng hồ đếm ngược cho khuyến mãi, dạng `02:14:33`. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

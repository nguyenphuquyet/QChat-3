import { db } from "./db";

/// The payment screen in the mobile app is organised in three groups. The
/// built-in catalogue below is the source of truth for keys and ordering; the
/// admin console stores overrides in PostgreSQL so labels and availability can
/// change without shipping a new app build.
export const paymentServiceGroups = [
  "Dịch vụ tài chính",
  "Dịch vụ hàng ngày",
  "Du lịch & Di chuyển",
] as const;

export type PaymentService = {
  key: string;
  label: string;
  group: string;
  note: string;
  enabled: boolean;
  sortOrder: number;
};

type DefaultService = Omit<PaymentService, "sortOrder">;

const defaults: DefaultService[] = [
  {
    key: "cardRepay",
    label: "Trả thẻ",
    group: "Dịch vụ tài chính",
    note: "Thanh toán dư nợ thẻ tín dụng.",
    enabled: true,
  },
  {
    key: "wealth",
    label: "Tài sản",
    group: "Dịch vụ tài chính",
    note: "Theo dõi tiền gửi và khoản đầu tư.",
    enabled: true,
  },
  {
    key: "mobileTopUp",
    label: "Nạp điện thoại",
    group: "Dịch vụ hàng ngày",
    note: "Nạp tiền di động cho số điện thoại.",
    enabled: true,
  },
  {
    key: "utilities",
    label: "Hóa đơn",
    group: "Dịch vụ hàng ngày",
    note: "Điện, nước, internet và các hóa đơn định kỳ.",
    enabled: true,
  },
  {
    key: "coins",
    label: "QChat Xu",
    group: "Dịch vụ hàng ngày",
    note: "Mua và quản lý QChat Xu.",
    enabled: true,
  },
  {
    key: "publicServices",
    label: "Dịch vụ công",
    group: "Dịch vụ hàng ngày",
    note: "Phí, lệ phí và thủ tục trực tuyến.",
    enabled: true,
  },
  {
    key: "charity",
    label: "Quyên góp",
    group: "Dịch vụ hàng ngày",
    note: "Ủng hộ các chiến dịch cộng đồng.",
    enabled: true,
  },
  {
    key: "health",
    label: "Sức khỏe",
    group: "Dịch vụ hàng ngày",
    note: "Đặt lịch khám và thanh toán viện phí.",
    enabled: true,
  },
  {
    key: "travel",
    label: "Du lịch",
    group: "Du lịch & Di chuyển",
    note: "Vé máy bay và tour du lịch.",
    enabled: true,
  },
  {
    key: "rail",
    label: "Tàu & Phà",
    group: "Du lịch & Di chuyển",
    note: "Vé tàu hỏa, tàu cao tốc và phà.",
    enabled: true,
  },
  {
    key: "ride",
    label: "Đặt xe",
    group: "Du lịch & Di chuyển",
    note: "Gọi xe và thanh toán chuyến đi.",
    enabled: true,
  },
  {
    key: "hotels",
    label: "Khách sạn",
    group: "Du lịch & Di chuyển",
    note: "Đặt phòng khách sạn và resort.",
    enabled: true,
  },
];

export const paymentServiceKeys = defaults.map((service) => service.key);

export function defaultPaymentServices(): PaymentService[] {
  return defaults.map((service, index) => ({
    ...service,
    sortOrder: (index + 1) * 10,
  }));
}

export function isPaymentServiceKey(value: string): boolean {
  return paymentServiceKeys.includes(value);
}

/// Returns the full catalogue in a stable order, applying any stored override.
/// A database failure must never break the console, so the defaults are used
/// as a fallback.
export async function readPaymentServices(): Promise<PaymentService[]> {
  try {
    const rows = await db.paymentService.findMany();
    const stored = new Map(rows.map((row) => [row.key, row]));
    return defaultPaymentServices()
      .map((service) => {
        const row = stored.get(service.key);
        return row
          ? {
              key: service.key,
              label: row.label,
              group: row.group,
              note: row.note,
              enabled: row.enabled,
              sortOrder: row.sortOrder,
            }
          : service;
      })
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          paymentServiceKeys.indexOf(a.key) - paymentServiceKeys.indexOf(b.key),
      );
  } catch {
    return defaultPaymentServices();
  }
}

import type { VNodeChild } from "@mna/qchat";
import {
  Checkbox,
  CustomPaint,
  Icon,
  Pressable,
  Row,
  Stack,
  TabBar,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import type { Style, TabItem } from "@mna/qchat/ui";
import { categoryById, dayLabel, money } from "./store.js";
import type { Category, Flow, Tone, Txn } from "./store.js";
import { card, colors } from "./theme.js";

/**
 * Bốn tab của ví. Ví Nhỏ cố ý chỉ có bốn tab để mỗi tab đủ rộng cho ngón tay,
 * và để tab "Tổng quan" luôn là nơi mở app.
 */
const TABS = [
  { key: "overview", label: "Tổng quan", icon: "wallet" },
  { key: "txns", label: "Giao dịch", icon: "file" },
  { key: "budgets", label: "Ngân sách", icon: "grid" },
  { key: "me", label: "Tôi", icon: "me" },
] as const;

/**
 * `TabBar` dùng chung cho cả bốn tab. `CupertinoTabBar` vẽ nền, đường kẻ và
 * vùng home indicator; app chỉ chọn màu nền và màu đường kẻ trên cùng.
 */
export function AppTabBar(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onChange: (index: number) => void;
}) {
  const tabs: TabItem[] = TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    icon: tab.icon,
    badge: props.badges?.[tab.key],
  }));
  return (
    <TabBar
      tabs={tabs}
      activeIndex={props.index}
      onChange={(event) => props.onChange(event.index)}
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        color: colors.brand,
      }}
    />
  );
}

/** Thẻ trắng dùng chung, có thể thêm style riêng cho từng màn hình. */
export function Card(props: {
  key?: string | number;
  children?: VNodeChild;
  style?: Style;
  testID?: string;
}) {
  return (
    <View testID={props.testID} style={{ ...card, ...(props.style ?? {}) }}>
      {props.children}
    </View>
  );
}

/** Tiêu đề nhóm nội dung, kèm một dòng ghi chú và một hành động tuỳ chọn. */
export function SectionHeader(props: {
  title: string;
  note?: string;
  action?: VNodeChild;
}) {
  return (
    <Row
      style={{
        justifyContent: "spaceBetween",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
          {props.title}
        </Text>
        {props.note ? (
          <Text style={{ fontSize: 11.5, color: colors.muted }}>
            {props.note}
          </Text>
        ) : null}
      </View>
      {props.action}
    </Row>
  );
}

/** Ô biểu tượng của một nhóm chi tiêu: nền nhạt, glyph đậm cùng tông. */
export function CategoryMark(props: {
  category: Category;
  size?: number;
}) {
  const size = props.size ?? 38;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        backgroundColor: props.category.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon
        name={props.category.icon}
        size={Math.round(size * 0.5)}
        color={props.category.color}
      />
    </View>
  );
}

/** Thanh tiến độ ngang; nền và màu đều đổi được cho thẻ xanh đậm. */
export function ProgressBar(props: {
  percent: number;
  color?: string;
  track?: string;
}) {
  const percent = Math.max(0, Math.min(100, props.percent));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: props.track ?? colors.soft,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: 8,
          borderRadius: 4,
          backgroundColor: props.color ?? colors.brand,
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Vòng tiến độ                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ngôn ngữ vẽ của `CustomPaint` chỉ có `M/L/Q/C/Z` nên một cung tròn được
 * dựng thành chuỗi đoạn thẳng. 96 bước đủ mượt ở kích thước 30–96 pt.
 */
function ringPath(
  size: number,
  percent: number,
  color: string,
  stroke: number,
): string {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;
  if (ratio <= 0) return "";
  const radiusOfRing = (size - stroke) / 2;
  const center = size / 2;
  const sweep = ratio * Math.PI * 2;
  const steps = Math.max(2, Math.ceil(ratio * 96));
  const parts: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = -Math.PI / 2 + (sweep * index) / steps;
    const x = Math.round((center + radiusOfRing * Math.cos(angle)) * 10) / 10;
    const y = Math.round((center + radiusOfRing * Math.sin(angle)) * 10) / 10;
    parts.push(`${index === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return `stroke:${color} strokeWidth:${stroke} cap:butt ${parts.join(" ")}`;
}

/** Vòng tiến độ: một vòng nền mờ và một cung màu ở trên. */
export function ProgressRing(props: {
  size: number;
  percent: number;
  color: string;
  children?: VNodeChild;
}) {
  const stroke = Math.max(4, Math.round(props.size * 0.1));
  return (
    <Stack
      alignment="center"
      style={{ width: props.size, height: props.size }}
    >
      <CustomPaint
        width={props.size}
        height={props.size}
        draw={ringPath(props.size, 100, colors.line, stroke)}
      />
      <CustomPaint
        width={props.size}
        height={props.size}
        draw={ringPath(props.size, props.percent, props.color, stroke)}
      />
      <View style={{ alignItems: "center", gap: 1 }}>{props.children}</View>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Dòng giao dịch                                                      */
/* ------------------------------------------------------------------ */

/** Số tiền có dấu và màu theo chiều thu/chi. */
export function Money(props: {
  value: number;
  flow?: Flow;
  size?: number;
  style?: Style;
}) {
  const prefix =
    props.flow === "income" ? "+" : props.flow === "expense" ? "−" : "";
  return (
    <Text
      style={{
        fontSize: props.size ?? 14,
        fontWeight: "600",
        color: props.flow === "income" ? colors.success : colors.ink,
        ...(props.style ?? {}),
      }}
    >
      {`${prefix}${money(props.value)}`}
    </Text>
  );
}

/**
 * Một dòng giao dịch dùng ở cả tab Tổng quan, tab Giao dịch và trang chi tiết.
 * Khi đang chọn nhiều khoản, `Checkbox` của TDesign hiện bên trái và cả dòng
 * chạm vào là đánh dấu, không mở trang chi tiết.
 */
export function TxnRow(props: {
  txn: Txn;
  selecting?: boolean;
  selected?: boolean;
  onPress: () => void;
  onToggle?: () => void;
  onLongPress?: () => void;
}) {
  const category = categoryById(props.txn.categoryId);
  return (
    <Pressable
      testID={`txn-row-${props.txn.id}`}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      accessibleLabel={`${props.txn.title}, ${money(props.txn.amount)}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        paddingHorizontal: 14,
        backgroundColor: colors.surface,
      }}
    >
      {props.selecting ? (
        <Checkbox
          checked={props.selected === true}
          onChange={() => props.onToggle?.()}
          testID={`txn-check-${props.txn.id}`}
        />
      ) : null}
      <CategoryMark category={category} size={36} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
        >
          {props.txn.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
          {`${category.label} · ${dayLabel(props.txn.day)}`}
        </Text>
      </View>
      <View style={{ alignItems: "end", gap: 2 }}>
        <Money value={props.txn.amount} flow={props.txn.flow} />
        {props.txn.recurring ? (
          <Tag tone="neutral" size="sm">
            Định kỳ
          </Tag>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Một `Tag` của TDesign bọc trong `Pressable` để chọn nhóm hoặc phương thức.
 * `Tag` không có trạng thái nhấn, nên màu và độ mờ do app quyết định.
 */
export function TagPick(props: {
  key?: string | number;
  label: string;
  active: boolean;
  tone: Tone;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      accessibleLabel={props.label}
      style={{ opacity: props.active ? 1 : 0.45 }}
    >
      <Tag tone={props.active ? props.tone : "neutral"} size="sm">
        {props.label}
      </Tag>
    </Pressable>
  );
}

/** Trạng thái rỗng dùng chung cho danh sách và lưới. */
export function EmptyState(props: {
  icon: string;
  title: string;
  caption: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: 7,
        paddingVertical: 34,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          backgroundColor: colors.brandSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={26} color={colors.brand} />
      </View>
      <Text style={{ fontSize: 14.5, fontWeight: "bold", color: colors.ink }}>
        {props.title}
      </Text>
      <Text
        style={{
          fontSize: 12,
          lineHeight: 18,
          color: colors.muted,
          textAlign: "center",
        }}
      >
        {props.caption}
      </Text>
    </View>
  );
}

/** Một ô số trong hàng thống kê, có thể đặt cạnh `Divider` dọc. */
export function StatTile(props: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "bold",
          color: props.tone ?? colors.ink,
        }}
      >
        {props.value}
      </Text>
      <Text style={{ fontSize: 10.5, color: colors.muted }}>{props.label}</Text>
    </View>
  );
}

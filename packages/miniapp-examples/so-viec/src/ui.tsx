import type { VNodeChild } from "@mna/qchat";
import {
  Checkbox,
  CustomPaint,
  Icon,
  Pressable,
  Row,
  Stack,
  TabBar,
  Text,
  View,
} from "@mna/qchat/ui";
import type { Style, TabItem } from "@mna/qchat/ui";
import type { Task } from "./store.js";
import { formatMinutes } from "./store.js";
import {
  card,
  colors,
  priorityColor,
  priorityLabel,
  radius,
} from "./theme.js";

/**
 * Bốn tab của app. Sổ Việc cố ý chỉ có bốn tab để mỗi tab đủ rộng cho ngón
 * tay, và để tab "Hôm nay" luôn là nơi mở app.
 */
const TABS = [
  { key: "today", label: "Hôm nay", icon: "check" },
  { key: "plan", label: "Kế hoạch", icon: "grid" },
  { key: "habits", label: "Thói quen", icon: "heart" },
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
  children?: VNodeChild;
  style?: Style;
  testID?: string;
}) {
  return (
    <View
      testID={props.testID}
      style={{ ...card, ...(props.style ?? {}) }}
    >
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

/** Nhãn nhỏ một dòng: nhóm việc, ưu tiên, số đếm. */
export function Pill(props: {
  label: string;
  bg: string;
  fg: string;
  testID?: string;
}) {
  return (
    <View
      testID={props.testID}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: props.bg,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: "600", color: props.fg }}>
        {props.label}
      </Text>
    </View>
  );
}

/** Nút lọc dạng viên thuốc. */
export function Chip(props: {
  key?: string | number;
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const active = props.active === true;
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      accessibleLabel={props.label}
      style={{
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: active ? "600" : "normal",
          color: active ? colors.white : colors.ink,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Vòng tiến độ                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ngôn ngữ vẽ của `CustomPaint` chỉ có `M/L/Q/C/Z` nên một cung tròn được
 * dựng thành chuỗi đoạn thẳng. 96 bước đủ mượt ở kích thước 30–96 pt và câu
 * lệnh vẫn ngắn hơn nhiều so với gửi cả một painter.
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

/**
 * Vòng tiến độ: một vòng nền mờ và một cung màu ở trên. Nội dung nằm giữa
 * bằng `Stack alignment="center"`, nên gọi ở đâu cũng chỉ cần truyền số.
 */
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

/** Thanh tiến độ ngang, dùng cho mục tiêu tuần. */
export function ProgressBar(props: { percent: number; color?: string }) {
  const percent = Math.max(0, Math.min(100, props.percent));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.soft,
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
/* Dòng việc                                                           */
/* ------------------------------------------------------------------ */

export function TaskRow(props: {
  key?: string | number;
  task: Task;
  onToggle: () => void;
  onOpen: () => void;
  onLongPress?: () => void;
}) {
  const task = props.task;
  const meta = task.time
    ? `${task.project} · ${task.time} · ${formatMinutes(task.minutes)}`
    : `${task.project} · ${formatMinutes(task.minutes)}`;
  return (
    <Row
      style={{
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <Checkbox
        checked={task.done}
        onChange={props.onToggle}
        testID={`task-${task.id}`}
        accessibleLabel={`Đánh dấu ${task.title}`}
      />
      <Pressable
        testID={`open-${task.id}`}
        onPress={props.onOpen}
        onLongPress={props.onLongPress}
        style={{ flex: 1, gap: 4 }}
      >
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: task.done ? colors.muted : colors.ink,
            textDecoration: task.done ? "lineThrough" : "none",
          }}
        >
          {task.title}
        </Text>
        <Row style={{ alignItems: "center", gap: 7 }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: priorityColor(task.priority),
            }}
          />
          <Text style={{ fontSize: 11.5, color: colors.muted }}>{meta}</Text>
        </Row>
      </Pressable>
      <Icon
        name={task.done ? "check" : "chevronRight"}
        size={16}
        color={task.done ? colors.brand : colors.muted}
      />
    </Row>
  );
}

/** Một dòng thông tin có biểu tượng, dùng ở màn hình chi tiết. */
export function InfoRow(props: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Row style={{ alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={16} color={props.color ?? colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.label}</Text>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}>
          {props.value}
        </Text>
      </View>
    </Row>
  );
}

/** Khối rỗng: một biểu tượng mờ, một câu giải thích. */
export function EmptyState(props: {
  icon: string;
  title: string;
  caption: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: 8,
        paddingVertical: 34,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={24} color={colors.muted} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
        {props.title}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: colors.muted,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {props.caption}
      </Text>
    </View>
  );
}

/** Ô số liệu nhỏ trên thẻ hồ sơ. */
export function StatTile(props: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 19, fontWeight: "bold", color: colors.ink }}>
        {props.value}
      </Text>
      <Text style={{ fontSize: 10.5, color: colors.muted }}>{props.label}</Text>
    </View>
  );
}

/** Nhãn ưu tiên đọc được, dùng ở chi tiết việc. */
export function priorityPill(task: Task) {
  const tone =
    task.priority === "high"
      ? { bg: colors.dangerSoft, fg: colors.danger }
      : task.priority === "low"
        ? { bg: colors.soft, fg: colors.muted }
        : { bg: colors.brandSoft, fg: colors.brand };
  return (
    <Pill label={priorityLabel(task.priority)} bg={tone.bg} fg={tone.fg} />
  );
}

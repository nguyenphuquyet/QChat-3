import type { VNodeChild } from "@mna/qchat";
import {
  Button,
  Pressable,
  Row,
  ScrollView,
  Stack,
  Text,
  View,
} from "@mna/qchat/ui";
import type { ButtonVariant, Style } from "@mna/qchat/ui";
import { formatTime, type LogEntry } from "./store.js";
import {
  card,
  chipStyle,
  chipTextStyle,
  colors,
  radius,
  screenPad,
  toneColors,
} from "./theme.js";

/**
 * The body of one tab. `Modal`, `BottomSheet` and `Dialog` paint a full screen
 * barrier with `Positioned.fill`, so they need a `Stack` that has a bounded size
 * to paint over; the `height: "100%"` on the scroller is what makes the stack
 * fill the tab body without clipping the content.
 */
export function ScreenShell(props: {
  children?: VNodeChild;
  overlays?: VNodeChild;
}) {
  return (
    <Stack alignment="topLeft" style={{ flex: 1 }}>
      <ScrollView style={{ height: "100%" }} showsScrollIndicator={false}>
        <View style={screenPad}>{props.children}</View>
      </ScrollView>
      {props.overlays}
    </Stack>
  );
}

/** `key` is an element attribute, so every helper accepts one explicitly. */
export interface WidgetProps {
  key?: string | number;
  children?: VNodeChild;
}

export function Card(props: WidgetProps & { style?: Style }) {
  return (
    <View style={{ ...card, ...(props.style ?? {}) }}>{props.children}</View>
  );
}

export function Section(props: {
  key?: string | number;
  title: string;
  caption?: string;
  right?: VNodeChild;
  children?: VNodeChild;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <Row
          style={{
            justifyContent: "spaceBetween",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
            {props.title}
          </Text>
          {props.right}
        </Row>
        {props.caption ? (
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {props.caption}
          </Text>
        ) : null}
      </View>
      {props.children}
    </View>
  );
}

export function KeyValue(props: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: "spaceBetween", gap: 12 }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{props.label}</Text>
      <Text
        numberOfLines={2}
        style={{ fontSize: 13, color: colors.ink, flex: 1, textAlign: "right" }}
      >
        {props.value}
      </Text>
    </Row>
  );
}

export function StatTile(props: {
  key?: string | number;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        gap: 2,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "bold", color: props.tone }}>
        {props.value}
      </Text>
      <Text style={{ fontSize: 11, color: colors.muted }}>{props.label}</Text>
    </View>
  );
}

export function ActionButton(props: {
  key?: string | number;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      variant={props.variant ?? "secondary"}
      icon={props.icon}
      disabled={props.disabled}
      loading={props.loading}
      onPress={props.onPress}
    >
      {props.label}
    </Button>
  );
}

export function Chip(props: {
  key?: string | number;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress} style={chipStyle(props.active)}>
      <Text style={chipTextStyle(props.active)}>{props.label}</Text>
    </Pressable>
  );
}

export function Note(props: WidgetProps) {
  return (
    <Text style={{ fontSize: 12, color: colors.muted }}>{props.children}</Text>
  );
}

/** The Debug tab reads the newest entries first. */
export function LogList(props: {
  key?: string | number;
  entries: LogEntry[];
  limit?: number;
}) {
  const limit = props.limit ?? 60;
  const items = props.entries.slice(-limit).reverse();

  if (items.length === 0) {
    return (
      <Note>Chưa có log. Bấm vài nút ở các tab khác rồi quay lại đây.</Note>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.map((entry) => (
        <Row key={String(entry.id)} style={{ gap: 8, alignItems: "start" }}>
          <Text style={{ fontSize: 10, color: colors.muted, width: 54 }}>
            {formatTime(entry.at)}
          </Text>
          <View
            style={{
              width: 6,
              height: 6,
              marginTop: 5,
              borderRadius: 3,
              backgroundColor: toneColors[entry.tone],
            }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: toneColors[entry.tone],
              }}
            >
              {entry.scope}
            </Text>
            <Text style={{ fontSize: 12, color: colors.ink }}>
              {entry.message}
            </Text>
          </View>
        </Row>
      ))}
    </View>
  );
}

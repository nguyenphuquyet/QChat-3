import type { VNodeChild } from "@mna/qchat";
import {
  Pressable,
  Row,
  ScrollView,
  Stack,
  Text,
  View,
} from "@mna/qchat/ui";
import type { Style } from "@mna/qchat/ui";
import { card, colors, radius, screenPad } from "./theme.js";

/**
 * Thân một tab. `Modal`, `BottomSheet` và `Dialog` vẽ barrier `Positioned.fill`,
 * nên chúng cần một `Stack` có kích thước xác định; `height: "100%"` trên
 * scroller làm stack phủ kín thân tab mà không cắt nội dung.
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

/** `key` là thuộc tính element, nên helper khai báo nó tường minh. */
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
    <View style={{ gap: 10 }}>
      <Row
        style={{
          justifyContent: "spaceBetween",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.ink }}>
            {props.title}
          </Text>
          {props.caption ? (
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {props.caption}
            </Text>
          ) : null}
        </View>
        {props.right}
      </Row>
      {props.children}
    </View>
  );
}

export function Chip(props: {
  key?: string | number;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const active = props.active;
  return (
    <Pressable
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
          fontSize: 12,
          fontWeight: active ? "600" : "normal",
          color: active ? "#ffffff" : colors.muted,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Nút tròn nhỏ dùng cho bộ tăng/giảm số lượng. */
function RoundButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibleLabel={props.label}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: props.disabled ? colors.soft : colors.cream,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.brand }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function QtyStepper(props: {
  key?: string | number;
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <Row style={{ alignItems: "center", gap: 10 }}>
      <RoundButton label="−" onPress={props.onMinus} />
      <Text
        style={{
          minWidth: 18,
          textAlign: "center",
          fontSize: 14,
          fontWeight: "bold",
          color: colors.ink,
        }}
      >
        {String(props.qty)}
      </Text>
      <RoundButton label="+" onPress={props.onPlus} />
    </Row>
  );
}

export function InfoRow(props: {
  key?: string | number;
  label: string;
  value: string;
}) {
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

export function EmptyState(props: {
  key?: string | number;
  title: string;
  caption: string;
  action?: VNodeChild;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: 8,
        paddingVertical: 44,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22 }}>☕</Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
        {props.title}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
        {props.caption}
      </Text>
      {props.action}
    </View>
  );
}

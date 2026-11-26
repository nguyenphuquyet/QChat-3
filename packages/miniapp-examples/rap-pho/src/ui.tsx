import type { VNodeChild } from "@mna/qchat";
import {
  Icon,
  Pressable,
  Row,
  ScrollView,
  Stack,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import type { Style, TagTone } from "@mna/qchat/ui";
import type { Movie } from "./store.js";
import {
  card,
  chipStyle,
  chipTextStyle,
  colors,
  posterFade,
  posterStyle,
  radius,
  screenPad,
  toneAt,
} from "./theme.js";

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

/** Nhãn nhỏ in hoa, dùng cho các khối trong trang chi tiết phim. */
export function Label(props: { children?: VNodeChild }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 1,
        color: colors.muted,
        textTransform: "uppercase",
      }}
    >
      {props.children}
    </Text>
  );
}

export function Chip(props: {
  key?: string | number;
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const active = props.active;
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.label}
      testID={props.testID}
      style={chipStyle(active)}
    >
      <Text style={chipTextStyle(active)}>{props.label}</Text>
    </Pressable>
  );
}

/** Nhãn độ tuổi: P/K xanh, T13/T16 vàng, T18 đỏ. */
export function ageTone(age: Movie["age"]): TagTone {
  if (age === "P" || age === "K") return "success";
  if (age === "T18") return "danger";
  return "warning";
}

/**
 * Poster không dùng ảnh: gradient theo `tone`, chữ cái đầu làm hình nền mờ và
 * một lớp tối ở đáy để tiêu đề luôn đọc được.
 */
export function Poster(props: {
  key?: string | number;
  movie: Movie;
  width?: number;
  height?: number;
  onPress?: () => void;
  testID?: string;
}) {
  const movie = props.movie;
  const width = props.width ?? 132;
  const height = props.height ?? 188;
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={movie.title}
      testID={props.testID}
      style={{ width, gap: 6 }}
    >
      <Stack
        style={{
          width,
          height,
          borderRadius: radius.md,
          overflow: "hidden",
          ...posterStyle(toneAt(movie.tone)),
        }}
      >
        <Text
          style={{
            position: "absolute",
            right: -10,
            bottom: 34,
            fontSize: 104,
            fontWeight: "bold",
            color: "#24ffffff",
          }}
        >
          {movie.title.charAt(0)}
        </Text>
        <View style={posterFade} />
        <View style={{ position: "absolute", left: 8, top: 8 }}>
          <Tag tone={ageTone(movie.age)} size="sm">
            {movie.age}
          </Tag>
        </View>
        {movie.status === "soon" ? (
          <View style={{ position: "absolute", right: 8, top: 8 }}>
            <Tag tone="info" size="sm">
              Sắp chiếu
            </Tag>
          </View>
        ) : null}
        <View
          style={{ position: "absolute", left: 9, right: 9, bottom: 9, gap: 3 }}
        >
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, fontWeight: "600", color: colors.white }}
          >
            {movie.title}
          </Text>
          <Text style={{ fontSize: 10, color: "#d7dbe6" }}>
            {`${movie.genres[0]} · ${movie.minutes} phút`}
          </Text>
        </View>
      </Stack>
    </Pressable>
  );
}

/** Một dòng phim trong danh sách: poster nhỏ, thông tin và nhãn trạng thái. */
export function MovieRow(props: {
  key?: string | number;
  movie: Movie;
  onPress: () => void;
  right?: VNodeChild;
}) {
  const movie = props.movie;
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={movie.title}
      testID={`movie-${movie.id}`}
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Stack
        style={{
          width: 64,
          height: 90,
          borderRadius: 10,
          overflow: "hidden",
          ...posterStyle(toneAt(movie.tone)),
        }}
      >
        <Text
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            fontSize: 46,
            fontWeight: "bold",
            color: "#2effffff",
          }}
        >
          {movie.title.charAt(0)}
        </Text>
      </Stack>
      <View style={{ flex: 1, gap: 5 }}>
        <Row style={{ justifyContent: "spaceBetween", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "bold",
              color: colors.ink,
            }}
          >
            {movie.title}
          </Text>
          <Tag tone={ageTone(movie.age)} size="sm">
            {movie.age}
          </Tag>
        </Row>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
          {`${movie.original} · ${movie.year}`}
        </Text>
        <Row style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.gold }}>
            {`★ ${movie.rating.toFixed(1)}`}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {`${movie.minutes} phút`}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: colors.muted, flex: 1 }}
          >
            {movie.genres.join(" · ")}
          </Text>
        </Row>
        <Row style={{ gap: 8, alignItems: "center" }}>
          {movie.status === "now" ? (
            <Text style={{ fontSize: 11, color: colors.green }}>Đang chiếu</Text>
          ) : (
            <Text style={{ fontSize: 11, color: colors.blue }}>
              {`Khởi chiếu ${movie.opening}`}
            </Text>
          )}
          {movie.formats.includes("IMAX") ? (
            <Tag tone="warning" size="sm">
              IMAX
            </Tag>
          ) : null}
        </Row>
      </View>
      {props.right}
    </Pressable>
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
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Icon name="play" size={24} color={colors.muted} />
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

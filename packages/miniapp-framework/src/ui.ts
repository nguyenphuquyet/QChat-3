import { h, type VNode, type VNodeChild } from "./runtime.js";
import type { BaseProps, Style } from "./protocol.js";

export interface ViewProps extends BaseProps {
  children?: VNodeChild;
}
export interface TextProps extends BaseProps {
  children?: VNodeChild;
  numberOfLines?: number;
  selectable?: boolean;
}
export interface ButtonProps extends BaseProps {
  children?: VNodeChild;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "text" | "danger";
  loading?: boolean;
  icon?: string;
}
export interface ImageProps extends BaseProps {
  src?: string;
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "fitWidth" | "fitHeight";
  borderRadius?: number;
  onPress?: () => void;
}
export interface IconProps extends BaseProps {
  name: string;
  size?: number;
  color?: string;
}
export interface TextFieldProps extends BaseProps {
  value?: string;
  placeholder?: string;
  onInput?: (value: string) => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: "text" | "number" | "email" | "phone" | "url";
  editable?: boolean;
  autoFocus?: boolean;
}
export interface CheckboxProps extends BaseProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}
export interface SwitchProps extends BaseProps {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
}
export interface SliderProps extends BaseProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
}
export interface ScrollViewProps extends BaseProps {
  children?: VNodeChild;
  horizontal?: boolean;
  showsScrollIndicator?: boolean;
  onScroll?: (offset: { x: number; y: number }) => void;
}
export interface ListViewProps<T = unknown> extends BaseProps {
  data?: T[];
  renderItem?: (item: T, index: number) => VNodeChild;
  keyExtractor?: (item: T, index: number) => string;
  horizontal?: boolean;
  empty?: VNodeChild;
}
export interface GridViewProps<T = unknown> extends BaseProps {
  data?: T[];
  renderItem?: (item: T, index: number) => VNodeChild;
  numColumns?: number;
  empty?: VNodeChild;
}
export interface StackProps extends BaseProps {
  children?: VNodeChild;
  alignment?: "topLeft" | "topCenter" | "topRight" | "centerLeft" | "center" | "centerRight" | "bottomLeft" | "bottomCenter" | "bottomRight";
}
export interface PositionedProps extends BaseProps {
  children?: VNodeChild;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
export interface SpacerProps extends BaseProps {
  size?: number;
}
export interface DividerProps extends BaseProps {
  color?: string;
  thickness?: number;
}
export interface ActivityIndicatorProps extends BaseProps {
  size?: number;
  color?: string;
}
export interface SafeAreaProps extends BaseProps {
  children?: VNodeChild;
  edges?: Array<"top" | "right" | "bottom" | "left">;
}
export interface PressableProps extends BaseProps {
  children?: VNodeChild;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}
export interface AnimatedViewProps extends BaseProps {
  children?: VNodeChild;
  animate?: "fadeIn" | "slideUp" | "scaleIn";
  duration?: number;
}
export interface CustomPaintProps extends BaseProps {
  draw?: string;
  width?: number;
  height?: number;
}

const view = (type: string, props: Record<string, unknown>) => h(type, props);

export function View(props: ViewProps): VNode {
  return view("View", props as Record<string, unknown>);
}

export function Row(props: ViewProps): VNode {
  const style = { flexDirection: "row", ...(props.style ?? {}) } as Style;
  return view("View", { ...props, style } as Record<string, unknown>);
}

export function Column(props: ViewProps): VNode {
  const style = { flexDirection: "column", ...(props.style ?? {}) } as Style;
  return view("View", { ...props, style } as Record<string, unknown>);
}

export function Text(props: TextProps): VNode {
  return view("Text", props as Record<string, unknown>);
}

export function Button(props: ButtonProps): VNode {
  return view("Button", props as Record<string, unknown>);
}

export function Pressable(props: PressableProps): VNode {
  return view("Pressable", props as Record<string, unknown>);
}

export function Image(props: ImageProps): VNode {
  return view("Image", props as Record<string, unknown>);
}

export function Icon(props: IconProps): VNode {
  return view("Icon", { ...props });
}

export function TextField(props: TextFieldProps): VNode {
  return view("TextField", props as Record<string, unknown>);
}

export function Checkbox(props: CheckboxProps): VNode {
  return view("Checkbox", props as Record<string, unknown>);
}

export function Switch(props: SwitchProps): VNode {
  return view("Switch", props as Record<string, unknown>);
}

export function Slider(props: SliderProps): VNode {
  return view("Slider", props as Record<string, unknown>);
}

export function ScrollView(props: ScrollViewProps): VNode {
  return view("ScrollView", props as Record<string, unknown>);
}

export function ListView<T>(props: ListViewProps<T>): VNode {
  const { data = [], renderItem, empty, ...rest } = props;
  const children =
    data.length === 0
      ? empty ?? null
      : data.map((item, index) => renderItem?.(item, index) ?? null);
  return view("ScrollView", {
    ...rest,
    vertical: !props.horizontal,
    children,
  } as Record<string, unknown>);
}

export function GridView<T>(props: GridViewProps<T>): VNode {
  const { data = [], renderItem, empty, numColumns = 2, ...rest } = props;
  const children =
    data.length === 0
      ? empty ?? null
      : data.map((item, index) => renderItem?.(item, index) ?? null);
  return view("ScrollView", {
    ...rest,
    vertical: true,
    grid: true,
    numColumns,
    children,
  } as Record<string, unknown>);
}

export function Stack(props: StackProps): VNode {
  return view("Stack", props as Record<string, unknown>);
}

export function Positioned(props: PositionedProps): VNode {
  const style = {
    position: "absolute",
    top: props.top,
    right: props.right,
    bottom: props.bottom,
    left: props.left,
    ...(props.style ?? {}),
  } as Style;
  return view("Positioned", { ...props, style } as Record<string, unknown>);
}

export function Spacer(props: SpacerProps): VNode {
  return view("Spacer", { ...props, size: props.size ?? 0 } as Record<string, unknown>);
}

export function Divider(props: DividerProps = {}): VNode {
  return view("Divider", props as Record<string, unknown>);
}

export function ActivityIndicator(props: ActivityIndicatorProps = {}): VNode {
  return view("ActivityIndicator", props as Record<string, unknown>);
}

export function SafeArea(props: SafeAreaProps): VNode {
  return view("SafeArea", props as Record<string, unknown>);
}

export function AnimatedView(props: AnimatedViewProps): VNode {
  return view("AnimatedView", props as Record<string, unknown>);
}

/**
 * Custom drawing uses a deliberately small, declarative path language rather
 * than arbitrary Dart code: `M x y L x y Q cx cy x y C ... Z` plus optional
 * `fill:` and `stroke:` prefixes. The Flutter renderer owns the painter.
 */
export function CustomPaint(props: CustomPaintProps): VNode {
  return view("CustomPaint", props as Record<string, unknown>);
}

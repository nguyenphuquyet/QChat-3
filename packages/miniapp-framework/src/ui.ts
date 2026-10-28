import { h, type VNode, type VNodeChild } from "./runtime.js";
import { navigateTo } from "./navigation.js";
import type {
  BaseProps,
  QappBoxShadow,
  QappGradient,
  QappNumberEvent,
  QappScrollEvent,
  QappTabEvent,
  QappTextEvent,
  QappToggleEvent,
  Style,
} from "./protocol.js";

export type StackAlignment =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "center"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

export type ImageFit = "cover" | "contain" | "fill" | "fitWidth" | "fitHeight";
export type KeyboardType = "text" | "number" | "email" | "phone" | "url";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "text"
  | "danger";
export type ControlSize = "sm" | "md" | "lg";
export type TagTone = "neutral" | "success" | "warning" | "danger" | "info";
export type AvatarShape = "circle" | "rounded";
export type SafeAreaEdge = "top" | "right" | "bottom" | "left";
export type ModalAnimation = "none" | "fade" | "slide";
export type AnimateKind = "fadeIn" | "slideUp" | "scaleIn";

export interface ScrollOffset {
  x: number;
  y: number;
}

export interface TabItem {
  key: string;
  label: string;
  icon?: string;
  badge?: string;
}

export interface TabChangePayload {
  index: number;
  key: string;
  value: string;
}

export interface ViewProps extends BaseProps {
  children?: VNodeChild;
}
export interface TextProps extends BaseProps {
  children?: VNodeChild;
  numberOfLines?: number;
  selectable?: boolean;
}
/**
 * Inline text with mixed styles. Children are `Text`, `Link` or plain strings;
 * they are flattened into one native paragraph. No HTML is accepted.
 */
export interface RichTextProps extends BaseProps {
  children?: VNodeChild;
  numberOfLines?: number;
  selectable?: boolean;
}
/**
 * Tappable text. `href` navigates inside the Mini App through the host router,
 * so the path is validated on the native side. `external` links are reported to
 * the app through `onPress` with the URL in the payload; the host does not open
 * other applications yet.
 */
export interface LinkProps extends BaseProps {
  children?: VNodeChild;
  href?: string;
  external?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}
/**
 * A count, a status dot, or both, drawn over `children` (usually an icon or an
 * avatar). A count of zero hides the badge, like a chat app would.
 */
export interface BadgeProps extends BaseProps {
  children?: VNodeChild;
  count?: number;
  max?: number;
  dot?: boolean;
  visible?: boolean;
  tone?: TagTone;
}
export interface TagProps extends BaseProps {
  children?: VNodeChild;
  tone?: TagTone;
  size?: ControlSize;
}
export interface AvatarProps extends BaseProps {
  src?: string;
  /** Used for the initials shown while the image loads or when `src` is empty. */
  name?: string;
  size?: number;
  shape?: AvatarShape;
}
export interface ButtonProps extends BaseProps {
  children?: VNodeChild;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  icon?: string;
}
export interface PressableProps extends BaseProps {
  children?: VNodeChild;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}
export interface ImageProps extends BaseProps {
  src?: string;
  width?: number;
  height?: number;
  fit?: ImageFit;
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
  /** Low-level hook that receives the raw text. */
  onInput?: (value: string) => void;
  onChange?: (event: QappTextEvent) => void;
  onSubmit?: (event: QappTextEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardType;
  editable?: boolean;
  autoFocus?: boolean;
}
export interface CheckboxProps extends BaseProps {
  checked?: boolean;
  onChange?: (event: QappToggleEvent) => void;
  /** Alias of `onChange`; both fire the same `change` event. */
  onCheckedChange?: (event: QappToggleEvent) => void;
  label?: string;
  disabled?: boolean;
}
export interface SwitchProps extends BaseProps {
  value?: boolean;
  /** Fires the `change` event. */
  onChange?: (event: QappToggleEvent) => void;
  /** Fires the `valueChange` event. */
  onValueChange?: (event: QappToggleEvent) => void;
  disabled?: boolean;
}
export interface SliderProps extends BaseProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (event: QappNumberEvent) => void;
  onValueChange?: (event: QappNumberEvent) => void;
  disabled?: boolean;
}
export interface ScrollViewProps extends BaseProps {
  children?: VNodeChild;
  horizontal?: boolean;
  vertical?: boolean;
  showsScrollIndicator?: boolean;
  onScroll?: (event: QappScrollEvent) => void;
  grid?: boolean;
  numColumns?: number;
}
export interface ListViewProps<T = unknown> extends BaseProps {
  data?: readonly T[];
  horizontal?: boolean;
  empty?: VNodeChild;
  /** Items rendered in the first frame; the rest is built lazily by Flutter. */
  initialCount?: number;
  renderItem?: (item: T, index: number) => VNodeChild;
  keyExtractor?: (item: T, index: number) => string;
}
export interface GridViewProps<T = unknown> extends BaseProps {
  data?: readonly T[];
  numColumns?: number;
  empty?: VNodeChild;
  initialCount?: number;
  renderItem?: (item: T, index: number) => VNodeChild;
}
export interface StackProps extends BaseProps {
  children?: VNodeChild;
  alignment?: StackAlignment;
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
  /** A vertical rule for a `Row`. */
  vertical?: boolean;
  /** Leading inset: left for a horizontal rule, top for a vertical one. */
  inset?: number;
}
export interface ActivityIndicatorProps extends BaseProps {
  size?: number;
  color?: string;
}
export interface SafeAreaProps extends BaseProps {
  children?: VNodeChild;
  edges?: readonly SafeAreaEdge[];
}
export interface AnimatedViewProps extends BaseProps {
  children?: VNodeChild;
  animate?: AnimateKind;
  duration?: number;
}
export interface CustomPaintProps extends BaseProps {
  draw?: string;
  width?: number;
  height?: number;
}
export interface ModalProps extends BaseProps {
  children?: VNodeChild;
  visible?: boolean;
  onClose?: () => void;
  transparent?: boolean;
  animationType?: ModalAnimation;
}
export interface BottomSheetProps extends BaseProps {
  children?: VNodeChild;
  visible?: boolean;
  onClose?: () => void;
  height?: number;
}
export interface DialogProps extends BaseProps {
  children?: VNodeChild;
  visible?: boolean;
  title?: string;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}
export interface NavBarProps extends BaseProps {
  children?: VNodeChild;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  safeArea?: boolean;
  reserveRight?: number;
  /**
   * Draws no surface, so the page artwork runs under the header. The title and
   * the host capsule keep their place.
   */
  transparent?: boolean;
  /** Blurs what is behind the header instead of painting a solid surface. */
  blur?: boolean;
  /**
   * Hairline under the header. On by default for a solid or blurred surface, so
   * a white header does not blend into the white card below it. Ignored when
   * `transparent` is set.
   */
  border?: boolean;
}
export interface TabBarProps extends BaseProps {
  tabs?: readonly TabItem[];
  activeKey?: string;
  activeIndex?: number;
  onChange?: (event: QappTabEvent) => void;
  safeArea?: boolean;
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

export function RichText(props: RichTextProps): VNode {
  return view("RichText", props as Record<string, unknown>);
}

export function Link(props: LinkProps): VNode {
  const { href, external, onPress, ...rest } = props;
  const isExternal = external === true;
  return view("Link", {
    ...rest,
    href,
    external: isExternal,
    onPress: () => {
      onPress?.();
      // In-app routes go through the host router so the path is validated on
      // the native side. An external URL is only reported to the app: opening
      // another application is a privileged host API that is not wired yet.
      if (href && !isExternal) {
        void navigateTo(href).catch(() => {
          // The host rejects routes that leave the Mini App. The tap still
          // reached `onPress`, so a failed navigation is not fatal.
        });
      }
    },
  } as Record<string, unknown>);
}

export function Badge(props: BadgeProps): VNode {
  return view("Badge", props as Record<string, unknown>);
}

export function Tag(props: TagProps): VNode {
  return view("Tag", props as Record<string, unknown>);
}

export function Avatar(props: AvatarProps): VNode {
  return view("Avatar", props as Record<string, unknown>);
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

/** Items materialized in the first frame before Flutter builds lazily. */
const DEFAULT_INITIAL_COUNT = 60;

/**
 * `ListView` and `GridView` keep their own node types so the Flutter host only
 * lays out the rows it can see. The frame carries the first `initialCount`
 * items (60 by default) and the total count; Flutter builds those rows lazily
 * as they scroll in. Items past `initialCount` are not serialized, so a longer
 * list has to raise `initialCount` or page its own data.
 */
export function ListView<T>(props: ListViewProps<T>): VNode {
  const { data = [], renderItem, empty, initialCount, ...rest } = props;
  const limit = Math.max(0, initialCount ?? DEFAULT_INITIAL_COUNT);
  const children =
    data.length === 0
      ? (empty ?? null)
      : data
          .slice(0, limit)
          .map((item, index) => renderItem?.(item, index) ?? null);
  return view("ListView", {
    ...rest,
    horizontal: props.horizontal === true,
    totalCount: data.length,
    children,
  } as Record<string, unknown>);
}

export function GridView<T>(props: GridViewProps<T>): VNode {
  const { data = [], renderItem, empty, numColumns = 2, initialCount, ...rest } =
    props;
  const limit = Math.max(0, initialCount ?? DEFAULT_INITIAL_COUNT);
  const children =
    data.length === 0
      ? (empty ?? null)
      : data
          .slice(0, limit)
          .map((item, index) => renderItem?.(item, index) ?? null);
  return view("GridView", {
    ...rest,
    numColumns,
    totalCount: data.length,
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
  return view("Spacer", {
    ...props,
    size: props.size ?? 0,
  } as Record<string, unknown>);
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

export function Modal(props: ModalProps): VNode {
  return view("Modal", props as Record<string, unknown>);
}

export function BottomSheet(props: BottomSheetProps): VNode {
  return view("BottomSheet", props as Record<string, unknown>);
}

export function Dialog(props: DialogProps): VNode {
  return view("Dialog", props as Record<string, unknown>);
}

export function NavBar(props: NavBarProps): VNode {
  return view("NavBar", props as Record<string, unknown>);
}

export function TabBar(props: TabBarProps): VNode {
  return view("TabBar", props as Record<string, unknown>);
}

/**
 * Custom drawing uses a deliberately small, declarative path language rather
 * than arbitrary Dart code: `M x y L x y Q cx cy x y C ... Z` plus optional
 * `fill:`, `stroke:`, `strokeWidth:` and `cap:` prefixes. The Flutter renderer
 * owns the painter.
 *
 * `cap:` is `round` (the default), `butt` or `square`. Arcs should ask for
 * `butt`: a round cap extends half the stroke width past the end angle, so a
 * gauge bleeds over its own track where the arc starts.
 */
export function CustomPaint(props: CustomPaintProps): VNode {
  return view("CustomPaint", props as Record<string, unknown>);
}

export type { QappBoxShadow, QappGradient, Style };

import { type VNode, type VNodeChild } from "./runtime.js";
import type { BaseProps, QappBoxShadow, QappGradient, QappNumberEvent, QappScrollEvent, QappTabEvent, QappTextEvent, QappToggleEvent, Style } from "./protocol.js";
export type StackAlignment = "topLeft" | "topCenter" | "topRight" | "centerLeft" | "center" | "centerRight" | "bottomLeft" | "bottomCenter" | "bottomRight";
export type ImageFit = "cover" | "contain" | "fill" | "fitWidth" | "fitHeight";
export type KeyboardType = "text" | "number" | "email" | "phone" | "url";
export type ButtonVariant = "primary" | "secondary" | "outline" | "text" | "danger";
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
}
export interface TabBarProps extends BaseProps {
    tabs?: readonly TabItem[];
    activeKey?: string;
    activeIndex?: number;
    onChange?: (event: QappTabEvent) => void;
    safeArea?: boolean;
}
export declare function View(props: ViewProps): VNode;
export declare function Row(props: ViewProps): VNode;
export declare function Column(props: ViewProps): VNode;
export declare function Text(props: TextProps): VNode;
export declare function RichText(props: RichTextProps): VNode;
export declare function Link(props: LinkProps): VNode;
export declare function Badge(props: BadgeProps): VNode;
export declare function Tag(props: TagProps): VNode;
export declare function Avatar(props: AvatarProps): VNode;
export declare function Button(props: ButtonProps): VNode;
export declare function Pressable(props: PressableProps): VNode;
export declare function Image(props: ImageProps): VNode;
export declare function Icon(props: IconProps): VNode;
export declare function TextField(props: TextFieldProps): VNode;
export declare function Checkbox(props: CheckboxProps): VNode;
export declare function Switch(props: SwitchProps): VNode;
export declare function Slider(props: SliderProps): VNode;
export declare function ScrollView(props: ScrollViewProps): VNode;
/**
 * `ListView` and `GridView` keep their own node types so the Flutter host can
 * build the items lazily: only `initialCount` items are serialized into the
 * frame, and the remaining rows are created as they scroll into view.
 */
export declare function ListView<T>(props: ListViewProps<T>): VNode;
export declare function GridView<T>(props: GridViewProps<T>): VNode;
export declare function Stack(props: StackProps): VNode;
export declare function Positioned(props: PositionedProps): VNode;
export declare function Spacer(props: SpacerProps): VNode;
export declare function Divider(props?: DividerProps): VNode;
export declare function ActivityIndicator(props?: ActivityIndicatorProps): VNode;
export declare function SafeArea(props: SafeAreaProps): VNode;
export declare function AnimatedView(props: AnimatedViewProps): VNode;
export declare function Modal(props: ModalProps): VNode;
export declare function BottomSheet(props: BottomSheetProps): VNode;
export declare function Dialog(props: DialogProps): VNode;
export declare function NavBar(props: NavBarProps): VNode;
export declare function TabBar(props: TabBarProps): VNode;
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
export declare function CustomPaint(props: CustomPaintProps): VNode;
export type { QappBoxShadow, QappGradient, Style };
//# sourceMappingURL=ui.d.ts.map
import { type VNode, type VNodeChild } from "./runtime.js";
import type { BaseProps, QappGradient, QappBoxShadow, Style } from "./protocol.js";
export type StackAlignment = "topLeft" | "topCenter" | "topRight" | "centerLeft" | "center" | "centerRight" | "bottomLeft" | "bottomCenter" | "bottomRight";
export type ImageFit = "cover" | "contain" | "fill" | "fitWidth" | "fitHeight";
export type KeyboardType = "text" | "number" | "email" | "phone" | "url";
export type ButtonVariant = "primary" | "secondary" | "text" | "danger";
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
export interface ButtonProps extends BaseProps {
    children?: VNodeChild;
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    variant?: ButtonVariant;
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
    onInput?: (value: string) => void;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
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
    onChange?: (value: boolean) => void;
    onCheckedChange?: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}
export interface SwitchProps extends BaseProps {
    value?: boolean;
    onChange?: (value: boolean) => void;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
}
export interface SliderProps extends BaseProps {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
    onValueChange?: (value: number) => void;
    disabled?: boolean;
}
export interface ScrollViewProps extends BaseProps {
    children?: VNodeChild;
    horizontal?: boolean;
    vertical?: boolean;
    showsScrollIndicator?: boolean;
    onScroll?: (offset: ScrollOffset) => void;
    grid?: boolean;
    numColumns?: number;
}
export interface ListViewProps<T = unknown> extends BaseProps {
    data?: readonly T[];
    horizontal?: boolean;
    empty?: VNodeChild;
    renderItem?: (item: T, index: number) => VNodeChild;
    keyExtractor?: (item: T, index: number) => string;
}
export interface GridViewProps<T = unknown> extends BaseProps {
    data?: readonly T[];
    numColumns?: number;
    empty?: VNodeChild;
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
    onChange?: (payload: TabChangePayload) => void;
    safeArea?: boolean;
}
export declare function View(props: ViewProps): VNode;
export declare function Row(props: ViewProps): VNode;
export declare function Column(props: ViewProps): VNode;
export declare function Text(props: TextProps): VNode;
export declare function Button(props: ButtonProps): VNode;
export declare function Pressable(props: PressableProps): VNode;
export declare function Image(props: ImageProps): VNode;
export declare function Icon(props: IconProps): VNode;
export declare function TextField(props: TextFieldProps): VNode;
export declare function Checkbox(props: CheckboxProps): VNode;
export declare function Switch(props: SwitchProps): VNode;
export declare function Slider(props: SliderProps): VNode;
export declare function ScrollView(props: ScrollViewProps): VNode;
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
 * `fill:` and `stroke:` prefixes. The Flutter renderer owns the painter.
 */
export declare function CustomPaint(props: CustomPaintProps): VNode;
export type { QappBoxShadow, QappGradient, Style };
//# sourceMappingURL=ui.d.ts.map
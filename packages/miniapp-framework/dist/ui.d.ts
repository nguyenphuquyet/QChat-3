import { type VNode, type VNodeChild } from "./runtime.js";
import type { BaseProps } from "./protocol.js";
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
    onScroll?: (offset: {
        x: number;
        y: number;
    }) => void;
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
/**
 * Custom drawing uses a deliberately small, declarative path language rather
 * than arbitrary Dart code: `M x y L x y Q cx cy x y C ... Z` plus optional
 * `fill:` and `stroke:` prefixes. The Flutter renderer owns the painter.
 */
export declare function CustomPaint(props: CustomPaintProps): VNode;
//# sourceMappingURL=ui.d.ts.map
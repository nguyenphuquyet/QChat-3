import { h } from "./runtime.js";
import { navigateTo } from "./navigation.js";
const view = (type, props) => h(type, props);
export function View(props) {
    return view("View", props);
}
export function Row(props) {
    const style = { flexDirection: "row", ...(props.style ?? {}) };
    return view("View", { ...props, style });
}
export function Column(props) {
    const style = { flexDirection: "column", ...(props.style ?? {}) };
    return view("View", { ...props, style });
}
export function Text(props) {
    return view("Text", props);
}
export function RichText(props) {
    return view("RichText", props);
}
export function Link(props) {
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
    });
}
export function Badge(props) {
    return view("Badge", props);
}
export function Tag(props) {
    return view("Tag", props);
}
export function Avatar(props) {
    return view("Avatar", props);
}
export function Button(props) {
    return view("Button", props);
}
export function Pressable(props) {
    return view("Pressable", props);
}
export function Image(props) {
    return view("Image", props);
}
export function Icon(props) {
    return view("Icon", { ...props });
}
export function TextField(props) {
    return view("TextField", props);
}
export function Checkbox(props) {
    return view("Checkbox", props);
}
export function Switch(props) {
    return view("Switch", props);
}
export function Slider(props) {
    return view("Slider", props);
}
export function ScrollView(props) {
    return view("ScrollView", props);
}
/** Items materialized in the first frame before Flutter builds lazily. */
const DEFAULT_INITIAL_COUNT = 60;
/**
 * `ListView` and `GridView` keep their own node types so the Flutter host can
 * build the items lazily: only `initialCount` items are serialized into the
 * frame, and the remaining rows are created as they scroll into view.
 */
export function ListView(props) {
    const { data = [], renderItem, empty, initialCount, ...rest } = props;
    const limit = Math.max(0, initialCount ?? DEFAULT_INITIAL_COUNT);
    const children = data.length === 0
        ? (empty ?? null)
        : data
            .slice(0, limit)
            .map((item, index) => renderItem?.(item, index) ?? null);
    return view("ListView", {
        ...rest,
        horizontal: props.horizontal === true,
        totalCount: data.length,
        children,
    });
}
export function GridView(props) {
    const { data = [], renderItem, empty, numColumns = 2, initialCount, ...rest } = props;
    const limit = Math.max(0, initialCount ?? DEFAULT_INITIAL_COUNT);
    const children = data.length === 0
        ? (empty ?? null)
        : data
            .slice(0, limit)
            .map((item, index) => renderItem?.(item, index) ?? null);
    return view("GridView", {
        ...rest,
        numColumns,
        totalCount: data.length,
        children,
    });
}
export function Stack(props) {
    return view("Stack", props);
}
export function Positioned(props) {
    const style = {
        position: "absolute",
        top: props.top,
        right: props.right,
        bottom: props.bottom,
        left: props.left,
        ...(props.style ?? {}),
    };
    return view("Positioned", { ...props, style });
}
export function Spacer(props) {
    return view("Spacer", {
        ...props,
        size: props.size ?? 0,
    });
}
export function Divider(props = {}) {
    return view("Divider", props);
}
export function ActivityIndicator(props = {}) {
    return view("ActivityIndicator", props);
}
export function SafeArea(props) {
    return view("SafeArea", props);
}
export function AnimatedView(props) {
    return view("AnimatedView", props);
}
export function Modal(props) {
    return view("Modal", props);
}
export function BottomSheet(props) {
    return view("BottomSheet", props);
}
export function Dialog(props) {
    return view("Dialog", props);
}
export function NavBar(props) {
    return view("NavBar", props);
}
export function TabBar(props) {
    return view("TabBar", props);
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
export function CustomPaint(props) {
    return view("CustomPaint", props);
}
//# sourceMappingURL=ui.js.map
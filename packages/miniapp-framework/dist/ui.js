import { h, useState } from "./runtime.js";
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
/**
 * Items materialized in the first frame, and the number revealed by each
 * `endReached`.
 */
const DEFAULT_INITIAL_COUNT = 60;
/** The window size: `initialCount` when given, 60 by default. */
function windowStep(initialCount) {
    if (initialCount == null || !Number.isFinite(initialCount)) {
        return DEFAULT_INITIAL_COUNT;
    }
    return Math.max(1, Math.floor(initialCount));
}
/**
 * A windowed list.
 *
 * The frame carries a window of items, not the whole array: Flutter builds
 * those rows lazily, and when the user scrolls near the end the host reports
 * `endReached`, the window grows by one step and the frame is resent. A long
 * list therefore stays small on the wire while every item stays reachable, and
 * the app can page its own data from `onEndReached` at the same time.
 *
 * The state lives in a component of its own so two lists never share a window
 * and a list keeps its window across unrelated re-renders.
 */
export function ListView(props) {
    return h(ListWindow, props);
}
function ListWindow(props) {
    const { data = [], renderItem, empty, initialCount, onEndReached, ...rest } = props;
    const step = windowStep(initialCount);
    const [visibleCount, setVisibleCount] = useState(step);
    const limit = Math.max(step, visibleCount);
    const children = data.length === 0
        ? (empty ?? null)
        : data
            .slice(0, limit)
            .map((item, index) => renderItem?.(item, index) ?? null);
    return view("ListView", {
        ...rest,
        horizontal: props.horizontal === true,
        totalCount: data.length,
        onEndReached: () => {
            setVisibleCount((previous) => previous + step);
            onEndReached?.();
        },
        children,
    });
}
export function GridView(props) {
    return h(GridWindow, props);
}
function GridWindow(props) {
    const { data = [], renderItem, empty, numColumns = 2, initialCount, onEndReached, ...rest } = props;
    const step = windowStep(initialCount);
    const [visibleCount, setVisibleCount] = useState(step);
    const limit = Math.max(step, visibleCount);
    const children = data.length === 0
        ? (empty ?? null)
        : data
            .slice(0, limit)
            .map((item, index) => renderItem?.(item, index) ?? null);
    return view("GridView", {
        ...rest,
        numColumns,
        totalCount: data.length,
        onEndReached: () => {
            setVisibleCount((previous) => previous + step);
            onEndReached?.();
        },
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
export function Page(props) {
    const { header, footer, overlays, children, style, ...rest } = props;
    return view("View", {
        ...rest,
        style: { flex: 1, ...(style ?? {}) },
        children: [
            view("Stack", {
                alignment: "topLeft",
                style: { flex: 1 },
                children: [
                    // The page column is pinned so it fills the frame even though the
                    // overlays are laid out beside it. Overlays are siblings of the whole
                    // column — header and footer included — not of the body: a dialog
                    // barrier that stopped at the body left the header and the TabBar
                    // bright and tappable behind the scrim.
                    view("Positioned", {
                        style: {
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                        },
                        children: [
                            view("View", {
                                style: { flex: 1 },
                                children: [
                                    header,
                                    view("Stack", {
                                        alignment: "topLeft",
                                        style: { flex: 1 },
                                        children: [
                                            // The body is pinned to the stack instead of being laid
                                            // out from its own content, so it fills the page even
                                            // when it is a plain `View`.
                                            view("Positioned", {
                                                style: {
                                                    position: "absolute",
                                                    top: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    left: 0,
                                                },
                                                children,
                                            }),
                                        ],
                                    }),
                                    footer,
                                ],
                            }),
                        ],
                    }),
                    overlays,
                ],
            }),
        ],
    });
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
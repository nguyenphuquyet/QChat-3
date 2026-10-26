// AUTO-GENERATED FILE - DO NOT EDIT BY HAND.
// Source of truth: packages/contracts/miniapp-ui.contract.json
// Regenerate: corepack pnpm contract:generate
/* eslint-disable */

export const CONTRACT_VERSION = 1;
export const PROTOCOL_VERSION = 1 as const;
export const TEXT_NODE_TYPE = "#text";
export const FRAGMENT_TYPE = "#fragment";
export const SDK_VERSION = "1.0.0" as const;
export const RUNTIME_VERSION = "1.0.0" as const;

export const HOST_NODE_TYPES: ReadonlySet<string> = new Set<string>(["View", "Row", "Column", "Text", "Button", "Pressable", "Image", "Icon", "TextField", "Checkbox", "Switch", "Slider", "ScrollView", "ListView", "GridView", "Stack", "Positioned", "Spacer", "Divider", "ActivityIndicator", "SafeArea", "AnimatedView", "CustomPaint", "Modal", "BottomSheet", "Dialog", "NavBar", "TabBar", "#text"]);

export const COMPONENT_EVENTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "View": [],
  "Row": [],
  "Column": [],
  "Text": [],
  "Button": ["press", "longPress"],
  "Pressable": ["press", "longPress"],
  "Image": ["press"],
  "Icon": [],
  "TextField": ["input", "change", "submit", "focus", "blur"],
  "Checkbox": ["change"],
  "Switch": ["change", "valueChange"],
  "Slider": ["change", "valueChange"],
  "ScrollView": ["scroll"],
  "ListView": [],
  "GridView": [],
  "Stack": [],
  "Positioned": [],
  "Spacer": [],
  "Divider": [],
  "ActivityIndicator": [],
  "SafeArea": [],
  "AnimatedView": [],
  "CustomPaint": [],
  "Modal": ["press"],
  "BottomSheet": ["press"],
  "Dialog": ["press"],
  "NavBar": ["press"],
  "TabBar": ["change"],
});

export const EVENT_NAMES = ["press", "longPress", "change", "input", "submit", "valueChange", "scroll", "refresh", "focus", "blur", "select"] as const;
export type GeneratedEventName = (typeof EVENT_NAMES)[number];

export const PROP_EVENT_MAP: Readonly<Record<string, string>> = Object.freeze({
  "onPress": "press",
  "onClose": "press",
  "onConfirm": "press",
  "onBack": "press",
  "onLongPress": "longPress",
  "onChange": "change",
  "onCheckedChange": "change",
  "onInput": "input",
  "onSubmit": "submit",
  "onValueChange": "valueChange",
  "onValueChangeEnd": "valueChange",
  "onScroll": "scroll",
  "onRefresh": "refresh",
  "onFocus": "focus",
  "onBlur": "blur",
  "onSelect": "select",
});

export const STYLE_KEYS = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "padding", "paddingHorizontal", "paddingVertical", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "margin", "marginHorizontal", "marginVertical", "marginTop", "marginRight", "marginBottom", "marginLeft", "gap", "rowGap", "columnGap", "flex", "flexGrow", "flexShrink", "flexBasis", "flexDirection", "flexWrap", "alignItems", "justifyContent", "alignSelf", "alignContent", "position", "top", "right", "bottom", "left", "zIndex", "overflow", "aspectRatio", "backgroundColor", "color", "opacity", "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius", "borderWidth", "borderColor", "borderTopWidth", "borderTopColor", "borderRightWidth", "borderRightColor", "borderBottomWidth", "borderBottomColor", "borderLeftWidth", "borderLeftColor", "fontSize", "fontWeight", "fontStyle", "fontFamily", "lineHeight", "letterSpacing", "textAlign", "textDecoration", "textTransform", "numberOfLines", "shadow", "boxShadow", "elevation", "gradient", "rotate", "scale", "translateX", "translateY"] as const;
export type GeneratedStyleKey = (typeof STYLE_KEYS)[number];

export const STYLE_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "flexDirection": ["row", "column", "row-reverse", "column-reverse"],
  "flexWrap": ["nowrap", "wrap"],
  "alignItems": ["start", "end", "center", "stretch", "baseline"],
  "justifyContent": ["start", "end", "center", "spaceBetween", "spaceAround", "spaceEvenly"],
  "alignSelf": ["auto", "start", "end", "center", "stretch", "baseline"],
  "position": ["relative", "absolute"],
  "overflow": ["visible", "hidden", "clip"],
  "fontWeight": ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
  "fontStyle": ["normal", "italic"],
  "textAlign": ["left", "right", "center", "justify"],
  "textDecoration": ["none", "underline", "lineThrough"],
  "textTransform": ["none", "uppercase", "lowercase", "capitalize"],
  "stackAlignment": ["topLeft", "topCenter", "topRight", "centerLeft", "center", "centerRight", "bottomLeft", "bottomCenter", "bottomRight"],
  "imageFit": ["cover", "contain", "fill", "fitWidth", "fitHeight"],
  "animate": ["fadeIn", "slideUp", "scaleIn"],
  "keyboardType": ["text", "number", "email", "phone", "url"],
  "buttonVariant": ["primary", "secondary", "text", "danger"],
  "safeAreaEdge": ["top", "right", "bottom", "left"],
  "modalAnimation": ["none", "fade", "slide"],
  "toastIcon": ["success", "error", "none"],
  "gradientType": ["linear", "radial"],
});

export const STYLE_ENUM_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  "flexDirection": Object.freeze({}),
  "flexWrap": Object.freeze({"no-wrap": "nowrap"}),
  "alignItems": Object.freeze({"flex-start": "start", "flex-end": "end"}),
  "justifyContent": Object.freeze({"flex-start": "start", "flex-end": "end", "space-between": "spaceBetween", "space-around": "spaceAround", "space-evenly": "spaceEvenly"}),
  "alignSelf": Object.freeze({"flex-start": "start", "flex-end": "end"}),
  "position": Object.freeze({}),
  "overflow": Object.freeze({}),
  "fontWeight": Object.freeze({}),
  "fontStyle": Object.freeze({}),
  "textAlign": Object.freeze({"start": "left", "end": "right"}),
  "textDecoration": Object.freeze({"line-through": "lineThrough"}),
  "textTransform": Object.freeze({}),
  "stackAlignment": Object.freeze({}),
  "imageFit": Object.freeze({"cover-fill": "cover"}),
  "animate": Object.freeze({}),
  "keyboardType": Object.freeze({}),
  "buttonVariant": Object.freeze({}),
  "safeAreaEdge": Object.freeze({}),
  "modalAnimation": Object.freeze({}),
  "toastIcon": Object.freeze({}),
  "gradientType": Object.freeze({}),
});

export const STYLE_ENUM_KEYS: Readonly<Record<string, string>> = Object.freeze({
  "flexDirection": "flexDirection",
  "flexWrap": "flexWrap",
  "alignItems": "alignItems",
  "justifyContent": "justifyContent",
  "alignSelf": "alignSelf",
  "alignContent": "justifyContent",
  "position": "position",
  "overflow": "overflow",
  "fontWeight": "fontWeight",
  "fontStyle": "fontStyle",
  "textAlign": "textAlign",
  "textDecoration": "textDecoration",
  "textTransform": "textTransform",
});

export const PERMISSION_IDS = ["toast", "user.profile", "media.choose", "share", "storage", "qchat.api", "network"] as const;
export type GeneratedPermission = (typeof PERMISSION_IDS)[number];

export const HOST_METHOD_PERMISSIONS: Readonly<Record<string, string | null>> = Object.freeze({
  "getAppInfo": null,
  "getSystemInfo": null,
  "getUserInfo": "user.profile",
  "showToast": "toast",
  "chooseImage": "media.choose",
  "share": "share",
  "navigateTo": null,
  "navigateBack": null,
  "closeMiniApp": null,
  "getStorage": "storage",
  "setStorage": "storage",
  "removeStorage": "storage",
  "request": "qchat.api",
  "fetch": "network",
  "clipboard.write": "clipboard",
  "clipboard.read": "clipboard",
  "haptic": "haptic",
  "setTimeout": null,
  "clearTimeout": null,
  "setInterval": null,
  "clearInterval": null,
  "requestAnimationFrame": null,
});

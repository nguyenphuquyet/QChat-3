import type { VNodeChild } from "@mna/qchat";
import {
  AnimatedView,
  CustomPaint,
  Positioned,
  Pressable,
  Row,
  ScrollView,
  Stack,
  Text,
  View,
} from "@mna/qchat/ui";
import type { Style } from "@mna/qchat/ui";
import { arcDraw, areaDraw, lineDraw } from "./draw.js";
import { Glyph, type GlyphName } from "./icons.js";
import {
  accentGradient,
  palette,
  radius,
  text,
  tint,
  type Accent,
} from "./theme.js";

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One tab body: a scroller plus an overlay layer. The `Stack` gives overlays a
 * bounded box, and `height: "100%"` on the scroller is what makes that box the
 * full tab height instead of the content height.
 */
export function Screen(props: {
  children?: VNodeChild;
  overlays?: VNodeChild;
}) {
  return (
    <Stack alignment="topLeft" style={{ flex: 1 }}>
      <ScrollView style={{ height: "100%" }} showsScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 2,
            paddingBottom: 26,
            gap: 16,
          }}
        >
          {props.children}
        </View>
      </ScrollView>
      {props.overlays}
    </Stack>
  );
}

export function Card(props: { children?: VNodeChild; style?: Style }) {
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: palette.lineSoft,
        padding: 16,
        gap: 12,
        ...(props.style ?? {}),
      }}
    >
      {props.children}
    </View>
  );
}

export function SectionTitle(props: {
  title: string;
  caption?: string;
  right?: VNodeChild;
}) {
  return (
    <Row
      style={{
        alignItems: "end",
        justifyContent: "spaceBetween",
        gap: 10,
      }}
    >
      <View style={{ gap: 2, flex: 1 }}>
        <Text
          style={{ fontSize: 14.5, fontWeight: "bold", color: palette.text }}
        >
          {props.title}
        </Text>
        {props.caption ? (
          <Text style={{ fontSize: 11.5, color: palette.muted }}>
            {props.caption}
          </Text>
        ) : null}
      </View>
      {props.right}
    </Row>
  );
}

/** Fade/slide in, unless the app is set to reduce motion. */
export function Motion(props: {
  calm: boolean;
  children?: VNodeChild;
  duration?: number;
}) {
  if (props.calm) return <View>{props.children}</View>;
  return (
    <AnimatedView animate="slideUp" duration={props.duration ?? 220}>
      {props.children}
    </AnimatedView>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                               */
/* -------------------------------------------------------------------------- */

export function StatTile(props: {
  label: string;
  value: string;
  note: string;
  glyph: GlyphName;
  accent: Accent;
  tone?: string;
}) {
  const tone = props.tone ?? props.accent.color;
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        gap: 6,
        borderRadius: radius.lg,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.lineSoft,
      }}
    >
      <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
        <Text style={text.label}>{props.label}</Text>
        <Glyph name={props.glyph} size={14} color={tone} />
      </Row>
      <Text
        style={{
          fontSize: 21,
          fontWeight: "bold",
          color: palette.text,
          letterSpacing: -0.4,
        }}
      >
        {props.value}
      </Text>
      <Text style={{ fontSize: 10.5, color: tone }}>{props.note}</Text>
    </View>
  );
}

export function ProgressBar(props: {
  value: number;
  accent: Accent;
  height?: number;
  track?: string;
}) {
  const height = props.height ?? 8;
  const percent = Math.round(Math.max(0, Math.min(1, props.value)) * 100);
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: props.track ?? palette.surfaceSoft,
        overflow: "hidden",
        alignItems: "start",
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: props.accent.color,
        }}
      />
    </View>
  );
}

/** Ring gauge: a full track, the progress arc and a dot on its head. */
export function Ring(props: {
  value: number;
  accent: Accent;
  label: string;
  caption?: string;
  size?: number;
  thickness?: number;
  track?: string;
}) {
  const size = props.size ?? 96;
  const thickness = props.thickness ?? 9;
  const radiusValue = (size - thickness) / 2;
  const center = size / 2;
  const clamped = Math.max(0, Math.min(1, props.value));
  const sweep = clamped * 360;
  const endAngle = -90 + sweep;
  const dot = thickness + 2;
  const angle = (endAngle * Math.PI) / 180;
  const dotX = center + radiusValue * Math.cos(angle);
  const dotY = center + radiusValue * Math.sin(angle);
  return (
    <Stack alignment="center" style={{ width: size, height: size }}>
      <CustomPaint
        width={size}
        height={size}
        draw={arcDraw(
          center,
          center,
          radiusValue,
          0,
          360,
          props.track ?? palette.surfaceSoft,
          thickness,
        )}
      />
      {sweep > 1 ? (
        <CustomPaint
          width={size}
          height={size}
          draw={arcDraw(
            center,
            center,
            radiusValue,
            -90,
            endAngle,
            props.accent.color,
            thickness,
          )}
        />
      ) : null}
      {sweep > 1 && clamped < 1 ? (
        <Positioned
          left={dotX - dot / 2}
          top={dotY - dot / 2}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: props.accent.color,
          }}
        />
      ) : null}
      <View style={{ alignItems: "center", gap: 1 }}>
        <Text
          style={{
            fontSize: size * 0.25,
            fontWeight: "bold",
            color: palette.text,
            letterSpacing: -0.6,
          }}
        >
          {props.label}
        </Text>
        {props.caption ? (
          <Text style={{ fontSize: 9.5, color: palette.muted }}>
            {props.caption}
          </Text>
        ) : null}
      </View>
    </Stack>
  );
}

export function Sparkline(props: {
  values: number[];
  width: number;
  color: string;
  fill: string;
  height?: number;
  strokeWidth?: number;
}) {
  const height = props.height ?? 64;
  const width = Math.max(40, Math.round(props.width));
  return (
    <Stack style={{ width, height }}>
      <CustomPaint
        width={width}
        height={height}
        draw={areaDraw(props.values, width, height, props.fill, 6)}
      />
      <CustomPaint
        width={width}
        height={height}
        draw={lineDraw(
          props.values,
          width,
          height,
          props.color,
          props.strokeWidth ?? 2.4,
          6,
        )}
      />
    </Stack>
  );
}

export function BarChart(props: {
  values: number[];
  labels: string[];
  accent: Accent;
  height?: number;
  highlight?: number;
}) {
  const height = props.height ?? 118;
  const max = Math.max(...props.values, 1);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "end",
        gap: 7,
        height: height + 26,
      }}
    >
      {props.values.map((value, index) => {
        const active = index === props.highlight;
        const barHeight = Math.max(6, Math.round((value / max) * height));
        return (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "end",
              gap: 7,
            }}
          >
            <View
              style={{
                width: "100%",
                height: barHeight,
                borderRadius: 7,
                backgroundColor: active
                  ? props.accent.color
                  : tint(props.accent.color, 0.22),
              }}
            />
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: active ? "bold" : "normal",
                color: active ? props.accent.color : palette.faint,
              }}
            >
              {props.labels[index] ?? ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function Avatar(props: {
  initials: string;
  accent: Accent;
  size?: number;
}) {
  const size = props.size ?? 44;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        gradient: accentGradient(props.accent, 145),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.34,
          fontWeight: "bold",
          color: palette.bg,
        }}
      >
        {props.initials}
      </Text>
    </View>
  );
}

/** A glyph inside a tinted rounded square: the kit's icon "chip". */
export function GlyphTile(props: {
  glyph: GlyphName;
  accent: Accent;
  size?: number;
  tinted?: boolean;
}) {
  const size = props.size ?? 34;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor:
          props.tinted === false ? palette.surfaceSoft : tint(props.accent.color, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Glyph
        name={props.glyph}
        size={size * 0.5}
        color={props.tinted === false ? palette.muted : props.accent.color}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

export function Toggle(props: {
  value: boolean;
  accent: Accent;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable onPress={() => props.onChange(!props.value)}>
      <View
        style={{
          width: 46,
          height: 27,
          borderRadius: 14,
          padding: 3,
          justifyContent: "center",
          alignItems: props.value ? "end" : "start",
          backgroundColor: props.value
            ? props.accent.color
            : palette.surfaceSoft,
          borderWidth: 1,
          borderColor: props.value ? props.accent.color : palette.line,
        }}
      >
        <View
          style={{
            width: 19,
            height: 19,
            borderRadius: 10,
            backgroundColor: props.value ? palette.bg : palette.faint,
          }}
        />
      </View>
    </Pressable>
  );
}

export function Check(props: {
  checked: boolean;
  accent: Accent;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable onPress={() => props.onChange(!props.checked)}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: props.checked ? props.accent.color : "transparent",
          borderWidth: 1.5,
          borderColor: props.checked ? props.accent.color : palette.line,
        }}
      >
        {props.checked ? (
          <Glyph name="check" size={13} color={palette.bg} weight={2.8} />
        ) : null}
      </View>
    </Pressable>
  );
}

export function Radio(props: {
  selected: boolean;
  accent: Accent;
  onSelect: () => void;
}) {
  return (
    <Pressable onPress={props.onSelect}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1.5,
          borderColor: props.selected ? props.accent.color : palette.line,
        }}
      >
        {props.selected ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: props.accent.color,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function Chip(props: {
  label: string;
  active: boolean;
  accent: Accent;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: radius.pill,
          backgroundColor: props.active
            ? tint(props.accent.color, 0.16)
            : palette.surface,
          borderWidth: 1,
          borderColor: props.active
            ? tint(props.accent.color, 0.55)
            : palette.lineSoft,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: props.active ? "bold" : "normal",
            color: props.active ? props.accent.color : palette.muted,
          }}
        >
          {props.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Stars(props: {
  value: number;
  accent: Accent;
  onChange?: (next: number) => void;
  size?: number;
}) {
  return (
    <Row style={{ gap: 3 }}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Pressable
          onPress={() => {
            if (props.onChange) props.onChange(index);
          }}
        >
          <Glyph
            name="star"
            size={props.size ?? 20}
            color={index <= props.value ? props.accent.color : palette.line}
          />
        </Pressable>
      ))}
    </Row>
  );
}

export function Stepper(props: {
  value: number;
  min: number;
  max: number;
  accent: Accent;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) =>
    Math.max(props.min, Math.min(props.max, next));
  return (
    <Row style={{ alignItems: "center", gap: 10 }}>
      <Pressable onPress={() => props.onChange(clamp(props.value - 1))}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: palette.surfaceSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Glyph name="minus" size={15} color={palette.text} weight={2.2} />
        </View>
      </Pressable>
      <Text
        style={{
          minWidth: 34,
          textAlign: "center",
          fontSize: 16,
          fontWeight: "bold",
          color: palette.text,
        }}
      >
        {props.value}
      </Text>
      <Pressable onPress={() => props.onChange(clamp(props.value + 1))}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: tint(props.accent.color, 0.16),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Glyph
            name="plus"
            size={15}
            color={props.accent.color}
            weight={2.2}
          />
        </View>
      </Pressable>
    </Row>
  );
}

export function PrimaryButton(props: {
  label: string;
  accent: Accent;
  onPress: () => void;
  glyph?: GlyphName;
  disabled?: boolean;
}) {
  const accent = props.disabled
    ? { ...props.accent, color: palette.surfaceSoft, deep: palette.line }
    : props.accent;
  return (
    <Pressable onPress={props.onPress} disabled={props.disabled}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 13,
          borderRadius: radius.md,
          gradient: accentGradient(accent, 160),
          boxShadow: props.disabled
            ? []
            : [{ color: tint(props.accent.color, 0.3), offsetY: 6, blurRadius: 18 }],
        }}
      >
        {props.glyph ? (
          <Glyph name={props.glyph} size={15} color={palette.bg} weight={2.2} />
        ) : null}
        <Text
          style={{
            fontSize: 13.5,
            fontWeight: "bold",
            color: props.disabled ? palette.faint : palette.bg,
          }}
        >
          {props.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function GhostButton(props: {
  label: string;
  accent: Accent;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 13,
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: tint(props.accent.color, 0.4),
        }}
      >
        <Text
          style={{ fontSize: 13.5, fontWeight: "bold", color: props.accent.color }}
        >
          {props.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Segmented(props: {
  options: { key: string; label: string }[];
  value: string;
  accent: Accent;
  onChange: (key: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: radius.pill,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.lineSoft,
      }}
    >
      {props.options.map((option) => {
        const active = option.key === props.value;
        return (
          <Pressable
            onPress={() => props.onChange(option.key)}
            style={{ flex: 1 }}
          >
            <View
              style={{
                paddingVertical: 8,
                borderRadius: radius.pill,
                alignItems: "center",
                backgroundColor: active
                  ? tint(props.accent.color, 0.16)
                  : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? "bold" : "normal",
                  color: active ? props.accent.color : palette.muted,
                }}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RowItem(props: {
  glyph: GlyphName;
  title: string;
  subtitle?: string;
  accent: Accent;
  right?: VNodeChild;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
      }}
    >
      <GlyphTile glyph={props.glyph} accent={props.accent} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontSize: 13.5, fontWeight: "bold", color: palette.text }}
        >
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={{ fontSize: 11.5, color: palette.muted }}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      {props.right ??
        (props.onPress ? (
          <Glyph name="chevron" size={14} color={palette.faint} />
        ) : null)}
    </View>
  );
  return props.onPress ? (
    <Pressable onPress={props.onPress}>{body}</Pressable>
  ) : (
    body
  );
}

/* -------------------------------------------------------------------------- */
/* Overlays                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A bottom sheet built from scratch: a full-screen scrim, a `Pressable` that
 * eats the remaining height for "tap outside to close", and the panel itself.
 * No `Dialog`, no `BottomSheet`, no `Modal`.
 *
 * `flex: 1` works on the `Pressable` node because its parent is a flex column;
 * the empty child is fine — the gesture detector is forced to the full height.
 */
export function Sheet(props: {
  title: string;
  caption?: string;
  accent: Accent;
  calm: boolean;
  onClose: () => void;
  children?: VNodeChild;
}) {
  return (
    <Positioned top={0} left={0} right={0} bottom={0}>
      <View style={{ backgroundColor: "#a6050a10" }}>
        <Pressable onPress={props.onClose} style={{ flex: 1 }}>
          <View style={{ height: 1 }} />
        </Pressable>
        <Motion calm={props.calm} duration={240}>
          <View
            style={{
              width: "100%",
              backgroundColor: palette.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderTopWidth: 1,
              borderTopColor: palette.line,
              padding: 20,
              paddingBottom: 26,
              gap: 14,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: palette.line,
                }}
              />
            </View>
            <Row
              style={{ alignItems: "center", justifyContent: "spaceBetween" }}
            >
              <View style={{ gap: 3, flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: palette.text,
                  }}
                >
                  {props.title}
                </Text>
                {props.caption ? (
                  <Text style={{ fontSize: 11.5, color: palette.muted }}>
                    {props.caption}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={props.onClose}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: palette.surfaceSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Glyph name="close" size={14} color={palette.muted} weight={2.2} />
                </View>
              </Pressable>
            </Row>
            {props.children}
            <PrimaryButton
              label="Close"
              accent={props.accent}
              onPress={props.onClose}
            />
          </View>
        </Motion>
      </View>
    </Positioned>
  );
}

/** In-app toast: owned, so it matches the palette and never leaves the app. */
export function Toast(props: {
  message: string;
  accent: Accent;
  calm: boolean;
}) {
  return (
    <Positioned left={18} right={18} bottom={104}>
      <Motion calm={props.calm} duration={200}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radius.md,
            backgroundColor: palette.surfaceRaised,
            borderWidth: 1,
            borderColor: palette.line,
            boxShadow: [
              { color: "#66000000", offsetY: 8, blurRadius: 20 },
            ],
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: tint(props.accent.color, 0.18),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph
              name="check"
              size={12}
              color={props.accent.color}
              weight={2.8}
            />
          </View>
          <Text style={{ flex: 1, fontSize: 12.5, color: palette.text }}>
            {props.message}
          </Text>
        </View>
      </Motion>
    </Positioned>
  );
}

/** A small label used above the values, uppercase and tracked out. */
export function Overline(props: { children?: VNodeChild; color?: string }) {
  return (
    <Text
      style={{
        fontSize: 9.5,
        fontWeight: "bold",
        letterSpacing: 1.4,
        color: props.color ?? palette.faint,
      }}
    >
      {props.children}
    </Text>
  );
}

/** Bar used by the kit screen to show a raw value next to a slider-less track. */
export function Meter(props: {
  label: string;
  value: number;
  display: string;
  accent: Accent;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: "spaceBetween" }}>
        <Text style={{ fontSize: 12, color: palette.muted }}>{props.label}</Text>
        <Text
          style={{ fontSize: 12, fontWeight: "bold", color: palette.text }}
        >
          {props.display}
        </Text>
      </Row>
      <ProgressBar value={props.value} accent={props.accent} />
    </View>
  );
}

/** Short helper so screens can print a rounded percentage. */
export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

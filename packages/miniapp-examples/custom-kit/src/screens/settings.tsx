import { Pressable, Row, Text, View } from "@mna/qchat/ui";
import {
  Avatar,
  Card,
  GlyphTile,
  Overline,
  RowItem,
  Screen,
  SectionTitle,
  Toggle,
} from "../components.js";
import { Glyph } from "../icons.js";
import {
  accents,
  palette,
  radius,
  text,
  tint,
  type Accent,
} from "../theme.js";

export function SettingsScreen(props: {
  accent: Accent;
  accentKey: string;
  onAccent: (key: string) => void;
  notify: boolean;
  onNotify: (next: boolean) => void;
  calm: boolean;
  onCalm: (next: boolean) => void;
  compact: boolean;
  onCompact: (next: boolean) => void;
  version: string;
  onOpenSheet: () => void;
  onHostToast: () => void;
  onReset: () => void;
}) {
  const accent = props.accent;

  return (
    <Screen>
      <Card style={{ gap: 14 }}>
        <Row style={{ gap: 14, alignItems: "center" }}>
          <Avatar initials="QG" accent={accent} size={54} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: palette.text,
              }}
            >
              Quyết Guic
            </Text>
            <Text style={{ fontSize: 11.5, color: palette.muted }}>
              @quyetguic · Pro plan
            </Text>
          </View>
          <Pressable onPress={props.onOpenSheet}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 11,
                backgroundColor: palette.surfaceSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Glyph name="chevron" size={14} color={palette.muted} />
            </View>
          </Pressable>
        </Row>
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <Row style={{ gap: 10 }}>
          {[
            { label: "Sessions", value: "18" },
            { label: "Hours", value: "24.3" },
            { label: "Streak", value: "12d" },
          ].map((stat) => (
            <View
              style={{
                flex: 1,
                gap: 2,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: palette.surfaceRaised,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "bold",
                  color: palette.text,
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ fontSize: 9.5, color: palette.faint }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </Row>
      </Card>

      <SectionTitle
        title="Appearance"
        caption="The accent repaints the whole app and is saved to storage"
      />
      <Card>
        <Row style={{ gap: 8 }}>
          {accents.map((entry) => {
            const active = entry.key === props.accentKey;
            return (
              <Pressable
                onPress={() => props.onAccent(entry.key)}
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: active
                      ? tint(entry.color, 0.16)
                      : palette.surfaceRaised,
                    borderWidth: 1,
                    borderColor: active
                      ? tint(entry.color, 0.5)
                      : palette.lineSoft,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: entry.color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active ? (
                      <Glyph
                        name="check"
                        size={14}
                        color={palette.bg}
                        weight={2.8}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: active ? "bold" : "normal",
                      color: active ? entry.color : palette.muted,
                    }}
                  >
                    {entry.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <SectionTitle title="Preferences" caption="Every switch repaints immediately" />
      <Card style={{ gap: 4 }}>
        <RowItem
          glyph="bell"
          title="Notifications"
          subtitle="Shows the dot on the header bell"
          accent={accent}
          right={
            <Toggle
              value={props.notify}
              accent={accent}
              onChange={props.onNotify}
            />
          }
        />
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <RowItem
          glyph="moon"
          title="Reduce motion"
          subtitle="Drops the sheet and toast animation"
          accent={accent}
          right={
            <Toggle
              value={props.calm}
              accent={accent}
              onChange={props.onCalm}
            />
          }
        />
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <RowItem
          glyph="sliders"
          title="Compact rows"
          subtitle="Tighter activity list on the home tab"
          accent={accent}
          right={
            <Toggle
              value={props.compact}
              accent={accent}
              onChange={props.onCompact}
            />
          }
        />
      </Card>

      <SectionTitle title="About" caption="Custom overlay, host API and a reset" />
      <Card style={{ gap: 4 }}>
        <RowItem
          glyph="sparkle"
          title="What is this kit?"
          subtitle="Opens the hand-drawn sheet"
          accent={accent}
          onPress={props.onOpenSheet}
        />
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <RowItem
          glyph="chat"
          title="Send a host toast"
          subtitle="Calls showToast from the host, not the app"
          accent={accent}
          onPress={props.onHostToast}
        />
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <RowItem
          glyph="shield"
          title="Reset demo state"
          subtitle="Accent, toggles and target back to defaults"
          accent={accent}
          onPress={props.onReset}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 12, alignItems: "center" }}>
          <GlyphTile glyph="lock" accent={accent} size={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={text.title}>Only two permissions</Text>
            <Text style={text.subtitle}>
              toast and storage — nothing else is requested.
            </Text>
          </View>
        </Row>
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
          <Overline>VERSION</Overline>
          <Text style={{ fontSize: 11.5, color: palette.muted }}>
            {props.version}
          </Text>
        </Row>
      </Card>

      <Text
        style={{ fontSize: 10.5, color: palette.faint, textAlign: "center" }}
      >
        Custom Kit · 100% hand-drawn UI
      </Text>
    </Screen>
  );
}

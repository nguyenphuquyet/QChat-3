import { useState } from "@mna/qchat";
import { Pressable, Row, Text, View } from "@mna/qchat/ui";
import {
  Card,
  Overline,
  PrimaryButton,
  Ring,
  Screen,
  SectionTitle,
  Sparkline,
  StatTile,
  Stepper,
} from "../components.js";
import { Glyph, type GlyphName } from "../icons.js";
import {
  heroGradient,
  palette,
  radius,
  text,
  tint,
  type Accent,
} from "../theme.js";

const WEEK = [4.2, 6.1, 5.4, 8.8, 7.2, 10.6, 9.4];

const ACTIVITY: {
  glyph: GlyphName;
  title: string;
  meta: string;
  duration: string;
}[] = [
  {
    glyph: "chat",
    title: "Deep work · Design review",
    meta: "Today · 09:20",
    duration: "1h 40m",
  },
  {
    glyph: "calendar",
    title: "Planning · Sprint 12",
    meta: "Yesterday · 16:05",
    duration: "45m",
  },
  {
    glyph: "play",
    title: "Focus block · Writing",
    meta: "Yesterday · 08:10",
    duration: "2h 05m",
  },
];

export function HomeScreen(props: {
  accent: Accent;
  width: number;
  goal: number;
  onGoalChange: (next: number) => void;
  announce: (message: string) => void;
  compact: boolean;
}) {
  const [streak, setStreak] = useState(12);
  const accent = props.accent;
  const chartWidth = Math.max(160, Math.round(props.width - 78));

  return (
    <Screen>
      <View
        style={{
          borderRadius: radius.xl,
          padding: 18,
          gap: 14,
          gradient: heroGradient(accent, 145),
          borderWidth: 1,
          borderColor: tint(accent.color, 0.22),
          boxShadow: [
            { color: tint(accent.color, 0.18), offsetY: 12, blurRadius: 28 },
          ],
        }}
      >
        <Row
          style={{
            justifyContent: "spaceBetween",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Overline color={tint("#ffffff", 0.66)}>THIS WEEK</Overline>
          <Row
            style={{
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: radius.pill,
              backgroundColor: tint("#ffffff", 0.14),
            }}
          >
            <Glyph name="arrowUp" size={11} color={palette.white} weight={2.4} />
            <Text
              style={{ fontSize: 10.5, fontWeight: "bold", color: palette.white }}
            >
              12.4%
            </Text>
          </Row>
        </Row>

        <View style={{ gap: 2 }}>
          <Text
            style={{
              fontSize: 38,
              fontWeight: "bold",
              color: palette.white,
              letterSpacing: -1.6,
            }}
          >
            24h 18m
          </Text>
          <Text style={{ fontSize: 12.5, color: tint("#ffffff", 0.72) }}>
            Focus time · 18 sessions · 6 days
          </Text>
        </View>

        <Sparkline
          values={WEEK}
          width={chartWidth}
          height={62}
          color={tint("#ffffff", 0.92)}
          fill={tint(accent.color, 0.3)}
          strokeWidth={2.6}
        />

        <Row style={{ gap: 16, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Overline color={tint("#ffffff", 0.55)}>BEST DAY</Overline>
            <Text
              style={{ fontSize: 14, fontWeight: "bold", color: palette.white }}
            >
              Saturday
            </Text>
          </View>
          <View
            style={{ width: 1, height: 26, backgroundColor: tint("#ffffff", 0.18) }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Overline color={tint("#ffffff", 0.55)}>AVG / DAY</Overline>
            <Text
              style={{ fontSize: 14, fontWeight: "bold", color: palette.white }}
            >
              3h 28m
            </Text>
          </View>
        </Row>
      </View>

      <Row style={{ gap: 12 }}>
        <StatTile
          label="FOCUS"
          value="4h 12m"
          note="+8% vs last week"
          glyph="clock"
          accent={accent}
        />
        <StatTile
          label="STREAK"
          value={`${streak} days`}
          note="Personal best 21"
          glyph="bolt"
          accent={accent}
          tone={palette.amber}
        />
      </Row>

      <Card>
        <Row style={{ gap: 16, alignItems: "center" }}>
          <Ring
            value={props.goal / 5}
            size={104}
            thickness={10}
            accent={accent}
            label={`${props.goal}`}
            caption="of 5"
          />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={text.title}>{"Today's goal"}</Text>
            <Text style={text.subtitle}>
              {props.goal >= 5
                ? "Goal reached — the ring is full."
                : `${5 - props.goal} session${
                    5 - props.goal === 1 ? "" : "s"
                  } to go`}
            </Text>
            <Stepper
              value={props.goal}
              min={0}
              max={5}
              accent={accent}
              onChange={props.onGoalChange}
            />
          </View>
        </Row>
      </Card>

      <SectionTitle
        title="Recent activity"
        caption="Last three sessions"
        right={
          <Pressable onPress={() => props.announce("Filters are a demo only")}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.lineSoft,
              }}
            >
              <Glyph name="sliders" size={12} color={palette.muted} />
              <Text style={{ fontSize: 11, color: palette.muted }}>Filter</Text>
            </View>
          </Pressable>
        }
      />

      <View style={{ gap: 10 }}>
        {ACTIVITY.map((item) => (
          <Row
            style={{
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 12,
              paddingVertical: props.compact ? 8 : 12,
              borderRadius: radius.md,
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.lineSoft,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: tint(accent.color, 0.14),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Glyph name={item.glyph} size={18} color={accent.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 13, fontWeight: "bold", color: palette.text }}
              >
                {item.title}
              </Text>
              <Text style={{ fontSize: 11, color: palette.muted }}>
                {item.meta}
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, fontWeight: "bold", color: accent.color }}
            >
              {item.duration}
            </Text>
          </Row>
        ))}
      </View>

      <PrimaryButton
        label="Check in for today"
        glyph="check"
        accent={accent}
        onPress={() => {
          setStreak((value) => value + 1);
          props.announce("Checked in — the streak grows");
        }}
      />

      <Text
        style={{
          fontSize: 10.5,
          color: palette.faint,
          textAlign: "center",
        }}
      >
        Every pixel above is a View, Text, Pressable or CustomPaint.
      </Text>
    </Screen>
  );
}

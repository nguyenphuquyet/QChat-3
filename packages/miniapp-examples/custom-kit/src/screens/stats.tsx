import { useState } from "@mna/qchat";
import { Row, Text, View } from "@mna/qchat/ui";
import {
  BarChart,
  Card,
  Meter,
  Overline,
  Ring,
  Screen,
  SectionTitle,
  Segmented,
  StatTile,
  Stars,
  Stepper,
} from "../components.js";
import { Glyph } from "../icons.js";
import { palette, radius, text, tint, type Accent } from "../theme.js";

interface Range {
  key: string;
  label: string;
  total: string;
  delta: string;
  values: number[];
  labels: string[];
  highlight: number;
}

const RANGES: Range[] = [
  {
    key: "week",
    label: "Week",
    total: "24h 18m",
    delta: "+12.4%",
    values: [4.2, 6.1, 5.4, 8.8, 7.2, 10.6, 9.4],
    labels: ["M", "T", "W", "T", "F", "S", "S"],
    highlight: 5,
  },
  {
    key: "month",
    label: "Month",
    total: "96h 40m",
    delta: "+6.1%",
    values: [18, 22, 16, 25, 21, 19],
    labels: ["W1", "W2", "W3", "W4", "W5", "W6"],
    highlight: 3,
  },
  {
    key: "year",
    label: "Year",
    total: "1 148h",
    delta: "+18.9%",
    values: [62, 71, 84, 78, 92, 88, 104, 96, 90, 112, 118, 121],
    labels: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    highlight: 11,
  },
];

const SESSIONS: { label: string; value: number; display: string }[] = [
  { label: "Design review", value: 0.92, display: "4h 40m" },
  { label: "Deep work", value: 0.74, display: "3h 45m" },
  { label: "Writing", value: 0.51, display: "2h 35m" },
  { label: "Meetings", value: 0.28, display: "1h 25m" },
];

export function StatsScreen(props: {
  accent: Accent;
  target: number;
  onTargetChange: (next: number) => void;
}) {
  const [range, setRange] = useState("week");
  const [rating, setRating] = useState(4);
  const accent = props.accent;
  const current = RANGES.find((entry) => entry.key === range) ?? RANGES[0];

  return (
    <Screen>
      <Segmented
        options={RANGES.map((entry) => ({ key: entry.key, label: entry.label }))}
        value={range}
        accent={accent}
        onChange={setRange}
      />

      <Card>
        <Row
          style={{
            justifyContent: "spaceBetween",
            alignItems: "start",
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Overline>FOCUS TIME</Overline>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "bold",
                color: palette.text,
                letterSpacing: -0.8,
              }}
            >
              {current.total}
            </Text>
          </View>
          <Row
            style={{
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: radius.pill,
              backgroundColor: tint(accent.color, 0.14),
            }}
          >
            <Glyph name="arrowUp" size={11} color={accent.color} weight={2.4} />
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: "bold",
                color: accent.color,
              }}
            >
              {current.delta}
            </Text>
          </Row>
        </Row>

        <BarChart
          values={current.values}
          labels={current.labels}
          accent={accent}
          highlight={current.highlight}
        />

        <Row style={{ justifyContent: "spaceBetween", gap: 8 }}>
          <Text style={{ fontSize: 11, color: palette.faint }}>
            Tap a range above to re-scale the chart
          </Text>
          <Text
            style={{ fontSize: 11, fontWeight: "bold", color: palette.muted }}
          >
            {current.label}
          </Text>
        </Row>
      </Card>

      <Row style={{ gap: 12 }}>
        <StatTile
          label="BEST DAY"
          value="10h 36m"
          note="Saturday"
          glyph="trend"
          accent={accent}
        />
        <StatTile
          label="AVERAGE"
          value="3h 28m"
          note="+18m vs before"
          glyph="clock"
          accent={accent}
          tone={palette.blue}
        />
      </Row>

      <Card>
        <Row style={{ gap: 16, alignItems: "center" }}>
          <Ring
            value={0.82}
            size={92}
            thickness={9}
            accent={accent}
            label="82%"
            caption="efficiency"
          />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={text.title}>How was this week?</Text>
            <Text style={text.subtitle}>
              Rate the rhythm — the stars are drawn, not an icon font.
            </Text>
            <Stars value={rating} accent={accent} onChange={setRating} />
          </View>
        </Row>
      </Card>

      <SectionTitle title="Top sessions" caption="By time spent" />
      <Card style={{ gap: 14 }}>
        {SESSIONS.map((session) => (
          <Meter
            label={session.label}
            value={session.value}
            display={session.display}
            accent={accent}
          />
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={text.title}>Daily target</Text>
            <Text style={text.subtitle}>
              {props.target} session{props.target === 1 ? "" : "s"} per day
            </Text>
          </View>
          <Stepper
            value={props.target}
            min={1}
            max={9}
            accent={accent}
            onChange={props.onTargetChange}
          />
        </Row>
      </Card>
    </Screen>
  );
}

import { useState } from "@mna/qchat";
import { Pressable, Row, Text, View } from "@mna/qchat/ui";
import {
  Avatar,
  Card,
  Check,
  Chip,
  GhostButton,
  GlyphTile,
  Meter,
  Overline,
  PrimaryButton,
  Radio,
  Ring,
  Screen,
  SectionTitle,
  Stars,
  Stepper,
  Toggle,
} from "../components.js";
import { Glyph, glyphNames } from "../icons.js";
import {
  accents,
  palette,
  radius,
  text,
  tint,
  type Accent,
} from "../theme.js";

const CHIPS = ["Design", "Code", "Writing", "Music", "Reading"];

const PEOPLE = [
  { initials: "AN", name: "An" },
  { initials: "BL", name: "Bảo" },
  { initials: "CH", name: "Chi" },
  { initials: "DU", name: "Dũng" },
];

export function KitScreen(props: {
  accent: Accent;
  accentKey: string;
  onAccent: (key: string) => void;
  announce: (message: string) => void;
}) {
  const [notify, setNotify] = useState(true);
  const [haptics, setHaptics] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [terms, setTerms] = useState(true);
  const [digest, setDigest] = useState(false);
  const [plan, setPlan] = useState("pro");
  const [chips, setChips] = useState<string[]>(["Design", "Code"]);
  const [rating, setRating] = useState(4);
  const [level, setLevel] = useState(3);
  const accent = props.accent;

  const toggleChip = (label: string) => {
    setChips((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  };

  return (
    <Screen>
      <SectionTitle
        title="Controls"
        caption="Pressables that draw their own track, knob and check"
      />

      <Card>
        <Overline>BUTTONS</Overline>
        <PrimaryButton
          label="Primary action"
          glyph="sparkle"
          accent={accent}
          onPress={() => props.announce("Primary button pressed")}
        />
        <GhostButton
          label="Ghost action"
          accent={accent}
          onPress={() => props.announce("Ghost button pressed")}
        />
        <PrimaryButton
          label="Disabled"
          accent={accent}
          disabled
          onPress={() => props.announce("Never runs")}
        />
      </Card>

      <Card>
        <Overline>SWITCHES</Overline>
        {[
          {
            label: "Notifications",
            caption: "Bell dot in the header",
            value: notify,
            onChange: setNotify,
          },
          {
            label: "Haptics",
            caption: "A local flag, no host call",
            value: haptics,
            onChange: setHaptics,
          },
          {
            label: "Auto-save drafts",
            caption: "Every 30 seconds",
            value: autoSave,
            onChange: setAutoSave,
          },
        ].map((row) => (
          <Row
            style={{
              alignItems: "center",
              justifyContent: "spaceBetween",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, color: palette.text }}>
                {row.label}
              </Text>
              <Text style={{ fontSize: 11, color: palette.faint }}>
                {row.caption}
              </Text>
            </View>
            <Toggle
              value={row.value}
              accent={accent}
              onChange={row.onChange}
            />
          </Row>
        ))}
      </Card>

      <Card>
        <Overline>CHECKBOXES &amp; RADIOS</Overline>
        <Row style={{ alignItems: "center", gap: 10 }}>
          <Check checked={terms} accent={accent} onChange={setTerms} />
          <Text style={{ fontSize: 13, color: palette.text }}>
            Accept the terms
          </Text>
        </Row>
        <Row style={{ alignItems: "center", gap: 10 }}>
          <Check checked={digest} accent={accent} onChange={setDigest} />
          <Text style={{ fontSize: 13, color: palette.text }}>
            Send a weekly digest
          </Text>
        </Row>
        <View style={{ height: 1, backgroundColor: palette.lineSoft }} />
        {[
          { key: "free", label: "Free", caption: "3 projects" },
          { key: "pro", label: "Pro", caption: "Unlimited projects" },
          { key: "team", label: "Team", caption: "Shared workspace" },
        ].map((option) => (
          <Row
            style={{ alignItems: "center", gap: 10 }}
            key={option.key}
          >
            <Radio
              selected={plan === option.key}
              accent={accent}
              onSelect={() => setPlan(option.key)}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 13, color: palette.text }}>
                {option.label}
              </Text>
              <Text style={{ fontSize: 11, color: palette.faint }}>
                {option.caption}
              </Text>
            </View>
            {plan === option.key ? (
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: accent.color,
                  letterSpacing: 0.6,
                }}
              >
                SELECTED
              </Text>
            ) : null}
          </Row>
        ))}
      </Card>

      <Card>
        <Overline>CHIPS</Overline>
        <Row style={{ flexWrap: "wrap", gap: 8 }}>
          {CHIPS.map((label) => (
            <Chip
              label={label}
              active={chips.includes(label)}
              accent={accent}
              onPress={() => toggleChip(label)}
            />
          ))}
        </Row>
        <Text style={{ fontSize: 11, color: palette.faint }}>
          {chips.length === 0
            ? "Nothing selected"
            : `${chips.length} selected · ${chips.join(", ")}`}
        </Text>
      </Card>

      <Card>
        <Overline>PROGRESS</Overline>
        <Meter
          label="Storage"
          value={0.64}
          display="640 MB / 1 GB"
          accent={accent}
        />
        <Meter label="Battery" value={0.38} display="38%" accent={accent} />
        <Meter label="Quota" value={0.9} display="90%" accent={accent} />
        <Row style={{ gap: 14, alignItems: "center" }}>
          <Ring
            value={level / 6}
            size={72}
            thickness={8}
            accent={accent}
            label={`${level}`}
            caption="level"
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={text.title}>Stepper + ring</Text>
            <Text style={text.subtitle}>
              The ring follows the value without a slider.
            </Text>
            <Stepper
              value={level}
              min={0}
              max={6}
              accent={accent}
              onChange={setLevel}
            />
          </View>
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
          <View style={{ gap: 2 }}>
            <Text style={text.title}>Rating</Text>
            <Text style={text.subtitle}>{rating} of 5 stars</Text>
          </View>
          <Stars value={rating} accent={accent} onChange={setRating} size={22} />
        </Row>
      </Card>

      <Card>
        <Overline>AVATARS</Overline>
        <Row style={{ gap: 12, alignItems: "center" }}>
          {PEOPLE.map((person) => (
            <View style={{ alignItems: "center", gap: 6 }}>
              <Avatar initials={person.initials} accent={accent} />
              <Text style={{ fontSize: 10.5, color: palette.muted }}>
                {person.name}
              </Text>
            </View>
          ))}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: palette.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "bold", color: palette.muted }}
            >
              +3
            </Text>
          </View>
        </Row>
      </Card>

      <Card>
        <Overline>ACCENTS</Overline>
        <Row style={{ gap: 10 }}>
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
                    gap: 7,
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
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: entry.color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {active ? (
                      <Glyph
                        name="check"
                        size={13}
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

      <SectionTitle
        title="Glyph set"
        caption={`${glyphNames.length} icons, every one a CustomPaint path`}
      />
      <Card>
        <Row style={{ flexWrap: "wrap", gap: 10 }}>
          {glyphNames.map((name) => (
            <GlyphTile glyph={name} accent={accent} size={40} />
          ))}
        </Row>
      </Card>

      <Card>
        <Row style={{ gap: 12, alignItems: "center" }}>
          <GlyphTile glyph="sparkle" accent={accent} size={38} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={text.title}>No host widgets here</Text>
            <Text style={text.subtitle}>
              Everything on this screen is View, Text, Pressable, Stack,
              Positioned, ScrollView or CustomPaint.
            </Text>
          </View>
          <Glyph name="chevron" size={14} color={palette.faint} />
        </Row>
      </Card>
    </Screen>
  );
}

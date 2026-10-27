import "@mna/qchat/env/auto";

import {
  getAppInfo,
  getSystemInfo,
  start,
  useEffect,
  useState,
  type AppInfo,
  type SystemInfo,
} from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { getStorage, setStorage } from "@mna/qchat/storage";
import {
  Positioned,
  Pressable,
  SafeArea,
  Stack,
  Text,
  View,
} from "@mna/qchat/ui";
import { Sheet, Toast } from "./components.js";
import { Glyph, glyphNames, type GlyphName } from "./icons.js";
import { HomeScreen } from "./screens/home.js";
import { KitScreen } from "./screens/kit.js";
import { SettingsScreen } from "./screens/settings.js";
import { StatsScreen } from "./screens/stats.js";
import {
  accentByKey,
  accents,
  accentGradient,
  palette,
  tint,
} from "./theme.js";

const ACCENT_KEY = "custom-kit.accent";

type TabKey = "home" | "stats" | "kit" | "settings";

const TABS: { key: TabKey; label: string; glyph: GlyphName }[] = [
  { key: "home", label: "Home", glyph: "home" },
  { key: "stats", label: "Stats", glyph: "trend" },
  { key: "kit", label: "Kit", glyph: "grid" },
  { key: "settings", label: "You", glyph: "sliders" },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** One timer at a time: a second toast replaces the first one. */
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const [accentKey, setAccentKey] = useState("mint");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [calm, setCalm] = useState(false);
  const [compact, setCompact] = useState(false);
  const [goal, setGoal] = useState(3);
  const [target, setTarget] = useState(4);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [app, setApp] = useState<AppInfo | null>(null);

  const accent = accentByKey(accentKey);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const stored = await getStorage<string>(ACCENT_KEY);
        if (alive && typeof stored === "string" && accents.some((entry) => entry.key === stored)) {
          setAccentKey(stored);
        }
      } catch {
        // Storage is optional: a denied permission keeps the default accent.
      }
      try {
        const info = await getSystemInfo();
        if (alive) setSystem(info);
      } catch {
        // The shell falls back to a 360pt content width.
      }
      try {
        const info = await getAppInfo();
        if (alive) setApp(info);
      } catch {
        // The footer simply shows the build version instead.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const announce = (message: string) => {
    setToast(message);
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      setToast(null);
    }, 1900);
  };

  const pickAccent = (key: string) => {
    setAccentKey(key);
    announce(`${accentByKey(key).label} accent applied`);
    void setStorage(ACCENT_KEY, key).catch(() => undefined);
  };

  const hostToast = () => {
    void showToast("Hello from the QChat host", { icon: "success" }).catch(() =>
      announce("The host toast needs the toast permission"),
    );
  };

  const reset = () => {
    setAccentKey("mint");
    setNotify(true);
    setCalm(false);
    setCompact(false);
    setGoal(3);
    setTarget(4);
    announce("Demo state reset");
    void setStorage(ACCENT_KEY, "mint").catch(() => undefined);
  };

  const titles: Record<TabKey, string> = {
    home: greeting(),
    stats: "Your week in numbers",
    kit: "Component gallery",
    settings: "Settings",
  };

  const version = app
    ? `${app.name} ${app.version} · runtime ${app.runtimeVersion}`
    : "Custom Kit 1.0.0";

  return (
    <Stack style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <SafeArea edges={["top"]} style={{ backgroundColor: palette.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 18,
              paddingTop: 10,
              paddingBottom: 14,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                gradient: accentGradient(accent, 140),
                alignItems: "center",
                justifyContent: "center",
                boxShadow: [
                  { color: tint(accent.color, 0.3), offsetY: 5, blurRadius: 16 },
                ],
              }}
            >
              <Glyph name="sparkle" size={20} color={palette.bg} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: "bold",
                  letterSpacing: 1.6,
                  color: palette.faint,
                }}
              >
                CUSTOM KIT
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: palette.text,
                }}
              >
                {titles[tab]}
              </Text>
            </View>
            <Pressable onPress={() => setSheet(true)}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.line,
                }}
              >
                <Stack alignment="center" style={{ width: 36, height: 36 }}>
                  <Glyph name="bell" size={18} color={palette.muted} />
                  {notify ? (
                    <Positioned
                      right={7}
                      top={7}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: accent.color,
                      }}
                    />
                  ) : null}
                </Stack>
              </View>
            </Pressable>
          </View>
        </SafeArea>

        <View style={{ flex: 1 }}>
          {tab === "home" ? (
            <HomeScreen
              accent={accent}
              width={system ? system.screenWidth : 360}
              goal={goal}
              onGoalChange={setGoal}
              announce={announce}
              compact={compact}
            />
          ) : null}
          {tab === "stats" ? (
            <StatsScreen
              accent={accent}
              target={target}
              onTargetChange={setTarget}
            />
          ) : null}
          {tab === "kit" ? (
            <KitScreen
              accent={accent}
              accentKey={accentKey}
              onAccent={pickAccent}
              announce={announce}
            />
          ) : null}
          {tab === "settings" ? (
            <SettingsScreen
              accent={accent}
              accentKey={accentKey}
              onAccent={pickAccent}
              notify={notify}
              onNotify={setNotify}
              calm={calm}
              onCalm={setCalm}
              compact={compact}
              onCompact={setCompact}
              version={version}
              onOpenSheet={() => setSheet(true)}
              onHostToast={hostToast}
              onReset={reset}
            />
          ) : null}
        </View>

        <SafeArea
          edges={["bottom"]}
          style={{ backgroundColor: palette.surface }}
        >
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 6,
              paddingTop: 8,
              paddingBottom: 6,
              backgroundColor: palette.surface,
              borderTopWidth: 1,
              borderTopColor: palette.lineSoft,
            }}
          >
            {TABS.map((item) => {
              const active = item.key === tab;
              return (
                <Pressable
                  onPress={() => setTab(item.key)}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{ alignItems: "center", gap: 5, paddingVertical: 5 }}
                  >
                    <Glyph
                      name={item.glyph}
                      size={21}
                      color={active ? accent.color : palette.faint}
                      weight={active ? 2.1 : 1.7}
                    />
                    <Text
                      style={{
                        fontSize: 9.5,
                        fontWeight: active ? "bold" : "normal",
                        color: active ? accent.color : palette.faint,
                      }}
                    >
                      {item.label}
                    </Text>
                    <View
                      style={{
                        width: 16,
                        height: 2.5,
                        borderRadius: 2,
                        backgroundColor: active
                          ? accent.color
                          : "transparent",
                      }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SafeArea>
      </View>

      {toast ? <Toast message={toast} accent={accent} calm={calm} /> : null}

      {sheet ? (
        <Sheet
          title="Custom Kit"
          caption="Aurora edition · every pixel is a primitive"
          accent={accent}
          calm={calm}
          onClose={() => setSheet(false)}
        >
          <View style={{ gap: 12 }}>
            {[
              {
                glyph: "grid" as GlyphName,
                title: "Primitives only",
                body: "View, Text, Pressable, Stack, Positioned, ScrollView, SafeArea and CustomPaint.",
              },
              {
                glyph: "sparkle" as GlyphName,
                title: "Hand-drawn glyphs",
                body: `${glyphNames.length} icons stored as path strings and scaled at runtime.`,
              },
              {
                glyph: "lock" as GlyphName,
                title: "Two permissions",
                body: "toast and storage — the accent is the only thing persisted.",
              },
            ].map((item) => (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 11,
                    backgroundColor: tint(accent.color, 0.14),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Glyph name={item.glyph} size={16} color={accent.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      color: palette.text,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: palette.muted }}>
                    {item.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Sheet>
      ) : null}
    </Stack>
  );
}

start(App);

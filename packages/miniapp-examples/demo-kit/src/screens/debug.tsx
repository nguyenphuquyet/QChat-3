import {
  getSystemInfo,
  useEffect,
  useState,
  type SystemInfo,
} from "@mna/qchat";
import { Button, Icon, Row, Text, View } from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  Chip,
  KeyValue,
  LogList,
  Note,
  ScreenShell,
  Section,
  StatTile,
} from "../components.js";
import { clearLogs, pushLog, useLogs, type LogTone } from "../store.js";
import { colors } from "../theme.js";

type Filter = LogTone | "all";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "info", label: "info" },
  { key: "success", label: "success" },
  { key: "warn", label: "warn" },
  { key: "error", label: "error" },
];

/** Tab 5: the shared log, timer behaviour and the lifecycle the host reports. */
export function DebugScreen() {
  const logs = useLogs();
  const [filter, setFilter] = useState<Filter>("all");
  const [ticks, setTicks] = useState(0);
  const [ticking, setTicking] = useState(false);
  const [system, setSystem] = useState<SystemInfo | null>(null);

  useEffect(() => {
    void getSystemInfo()
      .then(setSystem)
      .catch(() => undefined);
    pushLog("debug", "log nằm trong bộ nhớ QuickJS, mất khi app đóng");
  }, []);

  // One interval that stops itself after five ticks: this is the timer path the
  // host drives through `__qchatTickTimers`, including the cleanup below.
  useEffect(() => {
    if (!ticking) return;
    let count = 0;
    pushLog("timer", "setInterval(1000) bắt đầu");
    const id = setInterval(() => {
      count += 1;
      setTicks(count);
      if (count >= 5) {
        clearInterval(id);
        setTicking(false);
        pushLog("timer", "setInterval tự dừng sau 5 tick", "success");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const counts: Record<Filter, number> = {
    all: logs.length,
    info: logs.filter((entry) => entry.tone === "info").length,
    success: logs.filter((entry) => entry.tone === "success").length,
    warn: logs.filter((entry) => entry.tone === "warn").length,
    error: logs.filter((entry) => entry.tone === "error").length,
  };
  const filtered =
    filter === "all" ? logs : logs.filter((entry) => entry.tone === filter);

  return (
    <ScreenShell>
      <Row style={{ gap: 10 }}>
        <StatTile
          value={String(counts.all)}
          label="tổng log"
          tone={colors.blue}
        />
        <StatTile
          value={String(counts.warn)}
          label="warn"
          tone={colors.amber}
        />
        <StatTile
          value={String(counts.error)}
          label="error"
          tone={colors.red}
        />
      </Row>

      <Section
        title="Ghi log thử"
        caption="Bốn mức màu; mỗi lần bấm là một lần app tự cập nhật giao diện."
      >
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 8 }}>
            {(["info", "success", "warn", "error"] as LogTone[]).map((tone) => (
              <View key={tone} style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  onPress={() => pushLog("log thử", `mức ${tone}`, tone)}
                >
                  {tone}
                </Button>
              </View>
            ))}
          </Row>
          <ActionButton
            label="Bắn 5 log trong cùng một event"
            onPress={() => {
              for (let index = 1; index <= 5; index++) {
                pushLog("batch", `log ${index}/5 trong một event`);
              }
            }}
          />
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="danger"
                icon="delete"
                label="Xoá toàn bộ log"
                onPress={() => clearLogs()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                icon="play"
                label={ticking ? "Đang chạy…" : "Interval 5 tick"}
                disabled={ticking}
                onPress={() => {
                  setTicks(0);
                  setTicking(true);
                }}
              />
            </View>
          </Row>
          <ActionButton
            icon="mail"
            label="console.log ra kênh log của host"
            onPress={() => {
              console.log("Demo Kit: console.log từ QuickJS", {
                ticks,
                log: logs.length,
              });
              pushLog(
                "console",
                "đã gọi console.log · xem log của host/IDE",
                "success",
              );
            }}
          />
          <ActionButton
            icon="refresh"
            label="setTimeout 300ms"
            onPress={() => {
              pushLog("timer", "setTimeout(300) bắt đầu");
              setTimeout(
                () => pushLog("timer", "setTimeout(300) xong", "success"),
                300,
              );
            }}
          />
          <Note>
            Interval đang chạy: {ticks}/5 tick. Rời tab này giữa chừng thì
            cleanup của effect sẽ clearInterval.
          </Note>
        </Card>
      </Section>

      <Section
        title="Log"
        caption="Chỉ giữ 200 dòng gần nhất; danh sách hiển thị 60 dòng mới nhất."
        right={
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {filtered.length} dòng
          </Text>
        }
      >
        <Row style={{ gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((entry) => (
            <Chip
              key={entry.key}
              label={`${entry.label} (${counts[entry.key]})`}
              active={filter === entry.key}
              onPress={() => setFilter(entry.key)}
            />
          ))}
        </Row>
        <Card>
          <LogList entries={filtered} limit={60} />
        </Card>
      </Section>

      <Section
        title="Vòng đời & môi trường"
        caption="resume, pause, navigate và back do host phát; App ghi lại vào log."
      >
        <Card style={{ gap: 8 }}>
          <KeyValue label="Nền tảng" value={system?.platform ?? "…"} />
          <KeyValue
            label="Phiên bản runtime"
            value={system?.runtimeVersion ?? "…"}
          />
          <KeyValue
            label="Intl.NumberFormat"
            value={new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
              maximumFractionDigits: 0,
            }).format(1234567)}
          />
          <KeyValue
            label="Intl.DateTimeFormat"
            value={new Intl.DateTimeFormat("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(new Date())}
          />
          <KeyValue
            label="Safe area"
            value={`top ${system?.safeAreaTop ?? 0} · bottom ${system?.safeAreaBottom ?? 0}`}
          />
          <Row style={{ gap: 8, alignItems: "center" }}>
            <Icon name="radar" size={18} color={colors.violet} />
            <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }}>
              Đưa app xuống nền rồi mở lại để thấy sự kiện pause/resume trong
              log.
            </Text>
          </Row>
          <ActionButton
            variant="danger"
            label="Gây lỗi trong handler (runtime tự bắt)"
            onPress={() => {
              pushLog("error demo", "handler sắp ném lỗi", "warn");
              throw new Error("Demo Kit: lỗi cố ý trong onPress");
            }}
          />
          <Note>
            Lỗi này do runtime bắt và gửi qua kênh log của host, app vẫn tiếp
            tục chạy.
          </Note>
        </Card>
      </Section>
    </ScreenShell>
  );
}

import {
  getAppInfo,
  getSystemInfo,
  useEffect,
  useState,
  type AppInfo,
  type SystemInfo,
} from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { getStorage, removeStorage, setStorage } from "@mna/qchat/storage";
import {
  ActivityIndicator,
  AnimatedView,
  BottomSheet,
  Button,
  CustomPaint,
  Dialog,
  Modal,
  Row,
  Switch,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  KeyValue,
  Note,
  ScreenShell,
  Section,
  StatTile,
} from "../components.js";
import { describeError, formatTime, pushLog, useLogs } from "../store.js";
import { colors, heroCard, radius } from "../theme.js";

const VISITS_KEY = "demo-kit.visits";
const COUNTER_KEY = "demo-kit.counter";

/** Tab 1: what the app is, how the host describes it, overlays and timers. */
export function OverviewScreen() {
  const [app, setApp] = useState<AppInfo | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [visits, setVisits] = useState(0);
  const [counter, setCounter] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [animationKey, setAnimationKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [notify, setNotify] = useState(true);
  const logs = useLogs();

  useEffect(() => {
    let active = true;
    void getAppInfo()
      .then((value) => {
        if (active) setApp(value);
      })
      .catch((error) => pushLog("getAppInfo", describeError(error), "error"));
    void getSystemInfo()
      .then((value) => {
        if (active) setSystem(value);
      })
      .catch((error) =>
        pushLog("getSystemInfo", describeError(error), "error"),
      );
    void getStorage<number>(VISITS_KEY).then((value) => {
      if (!active) return;
      const next = (typeof value === "number" ? value : 0) + 1;
      setVisits(next);
      void setStorage(VISITS_KEY, next);
    });
    void getStorage<number>(COUNTER_KEY).then((value) => {
      if (active && typeof value === "number") setCounter(value);
    });
    pushLog("overview", "mount · đọc storage + thông tin app");
    return () => {
      active = false;
    };
  }, []);

  // A real host tick every second: the timer lives in JavaScript, the clock in
  // the host, and the cleanup has to cancel it when the tab unmounts.
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const updateCounter = (next: number) => {
    setCounter(next);
    void setStorage(COUNTER_KEY, next);
    pushLog("storage", `setStorage ${COUNTER_KEY} = ${next}`);
  };

  const runBackgroundTask = () => {
    setLoading(true);
    pushLog("timer", "setTimeout(900) bắt đầu");
    setTimeout(() => {
      setLoading(false);
      pushLog("timer", "setTimeout(900) xong", "success");
      void showToast("Tác vụ nền đã xong", { icon: "success" });
    }, 900);
  };

  return (
    <ScreenShell
      overlays={
        <>
          <Dialog
            visible={dialog}
            title="Xác nhận demo"
            confirmText="Đồng ý"
            cancelText="Huỷ"
            onClose={() => {
              setDialog(false);
              pushLog("dialog", "close");
            }}
            onConfirm={() => {
              setDialog(false);
              pushLog("dialog", "confirm", "success");
              void showToast("Đã xác nhận", { icon: "success" });
            }}
          />
          <BottomSheet
            visible={sheet}
            height={250}
            onClose={() => setSheet(false)}
          >
            <View style={{ gap: 10, padding: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                BottomSheet
              </Text>
              <Note>
                BottomSheet trượt từ đáy lên, chạm vùng tối hoặc nút bên dưới để
                đóng.
              </Note>
              <Button variant="secondary" onPress={() => setSheet(false)}>
                Đóng BottomSheet
              </Button>
            </View>
          </BottomSheet>
          <Modal visible={modal} onClose={() => setModal(false)}>
            <View style={{ gap: 10, padding: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>Modal</Text>
              <Note>Modal dùng cùng lớp phủ; nội dung nằm giữa màn hình.</Note>
              <Button onPress={() => setModal(false)}>Đóng Modal</Button>
            </View>
          </Modal>
        </>
      }
    >
      <View style={heroCard}>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: "#ffffff" }}>
          {app?.name ?? "Demo Kit"}
        </Text>
        <Text style={{ fontSize: 12, color: "#eafff2" }}>
          qapp v{app?.version ?? "1.0.0"} · runtime{" "}
          {app?.runtimeVersion ?? system?.runtimeVersion ?? "?"}
        </Text>
        <Row style={{ gap: 8, alignItems: "center", marginTop: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: "#ffffff" }}>
            {formatTime(clock)}
          </Text>
          <ActivityIndicator color="#ffffff" size={18} />
        </Row>
        <Text style={{ fontSize: 11, color: "#dff7e7" }}>
          Đồng hồ này do setInterval trong QuickJS cập nhật mỗi giây.
        </Text>
      </View>

      <Row style={{ gap: 10 }}>
        <StatTile
          value={String(logs.length)}
          label="dòng log"
          tone={colors.blue}
        />
        <StatTile
          value={String(visits)}
          label="lần mở app"
          tone={colors.brand}
        />
        <StatTile
          value={String(counter)}
          label="bộ đếm storage"
          tone={colors.violet}
        />
      </Row>

      <Section
        title="Thiết bị & phiên bản"
        caption="getSystemInfo() và getAppInfo() không cần quyền."
      >
        <Card>
          <KeyValue label="Nền tảng" value={system?.platform ?? "…"} />
          <KeyValue label="Hệ điều hành" value={system?.osVersion ?? "…"} />
          <KeyValue label="Ngôn ngữ" value={system?.locale ?? "…"} />
          <KeyValue label="Chủ đề" value={system?.theme ?? "…"} />
          <KeyValue
            label="Màn hình"
            value={
              system
                ? `${Math.round(system.screenWidth)}×${Math.round(system.screenHeight)} @${system.pixelRatio ?? 1}x`
                : "…"
            }
          />
          <KeyValue
            label="Safe area"
            value={`top ${system?.safeAreaTop ?? 0} · bottom ${system?.safeAreaBottom ?? 0}`}
          />
          <KeyValue label="App id" value={app?.appId ?? "…"} />
          <KeyValue
            label="Quyền đã khai báo"
            value={(app?.permissions ?? []).join(", ") || "…"}
          />
        </Card>
      </Section>

      <Section
        title="Lớp phủ & phản hồi"
        caption="Dialog, BottomSheet, Modal và showToast."
      >
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="shieldCheck"
            label="Mở Dialog xác nhận"
            onPress={() => setDialog(true)}
          />
          <ActionButton
            icon="file"
            label="Mở BottomSheet"
            onPress={() => setSheet(true)}
          />
          <ActionButton
            icon="grid"
            label="Mở Modal"
            onPress={() => setModal(true)}
          />
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="primary"
                label="Toast thành công"
                onPress={() =>
                  void showToast("Lưu thành công", { icon: "success" })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="danger"
                label="Toast lỗi"
                onPress={() =>
                  void showToast("Có lỗi xảy ra", { icon: "error" })
                }
              />
            </View>
          </Row>
        </Card>
      </Section>

      <Section
        title="Hiệu ứng, vẽ và tiến trình"
        caption="AnimatedView, CustomPaint và Button loading."
      >
        <Card style={{ gap: 12 }}>
          <AnimatedView
            key={String(animationKey)}
            animate="slideUp"
            duration={320}
            style={{
              padding: 12,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
          >
            <Text style={{ fontSize: 13 }}>
              AnimatedView · slideUp lần {animationKey + 1}
            </Text>
          </AnimatedView>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Chạy lại hiệu ứng"
                onPress={() => {
                  setAnimationKey(animationKey + 1);
                  pushLog("animation", `replay #${animationKey + 1}`);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="primary"
                loading={loading}
                label="Tác vụ 900ms"
                onPress={runBackgroundTask}
              />
            </View>
          </Row>
          <CustomPaint
            draw="stroke:#168fe5 strokeWidth:2 M 0 56 L 28 40 L 56 48 L 84 24 L 112 32 L 140 8"
            style={{
              height: 64,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
          />
          <Note>
            CustomPaint nhận chuỗi lệnh M/L/Q/C/Z, không nhận mã Dart.
          </Note>
        </Card>
      </Section>

      <Section
        title="Bộ đếm có lưu trữ"
        caption="setStorage / getStorage / removeStorage của riêng app."
      >
        <Card style={{ gap: 12 }}>
          <Row style={{ gap: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 32, fontWeight: "bold", flex: 1 }}>
              {counter}
            </Text>
            <Button
              variant="secondary"
              icon="delete"
              onPress={() => {
                setCounter(0);
                void removeStorage(COUNTER_KEY);
                pushLog("storage", `removeStorage ${COUNTER_KEY}`, "warn");
              }}
            >
              Xoá
            </Button>
          </Row>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="− 1"
                onPress={() => updateCounter(counter - 1)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="primary"
                label="+ 1"
                onPress={() => updateCounter(counter + 1)}
              />
            </View>
          </Row>
          <Row
            style={{
              justifyContent: "spaceBetween",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13 }}>Nhận thông báo</Text>
              <Note>Switch thuần trạng thái, không gọi host.</Note>
            </View>
            <Switch
              value={notify}
              onChange={(event) => {
                setNotify(event.value);
                pushLog("switch", `thông báo = ${event.value}`);
              }}
            />
          </Row>
        </Card>
      </Section>
    </ScreenShell>
  );
}

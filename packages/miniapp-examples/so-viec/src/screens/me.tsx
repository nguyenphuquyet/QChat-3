import {
  getAppInfo,
  getUserInfo,
  share,
  showToast,
  useEffect,
  useState,
} from "@mna/qchat";
import type { AppInfo, UserInfo } from "@mna/qchat";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  Divider,
  Icon,
  NavBar,
  Page,
  Pressable,
  Row,
  ScrollView,
  Slider,
  Switch,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  clearDoneTasks,
  formatNumber,
  habitSummary,
  resetAll,
  todayStats,
  updatePrefs,
  useHabits,
  usePrefs,
  useTasks,
  weekStats,
} from "../store.js";
import { colors, radius } from "../theme.js";
import {
  AppTabBar,
  Card,
  Pill,
  SectionHeader,
  StatTile,
} from "../ui.js";

/**
 * Tab Tôi: hồ sơ lấy từ host, số liệu tuần, cài đặt và các hành động nguy
 * hiểm. Nút đồng bộ cố ý chờ một nhịp để thấy `loading` + `ActivityIndicator`.
 */
export function MeScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenAbout: () => void;
}) {
  const tasks = useTasks();
  const habits = useHabits();
  const prefs = usePrefs();
  const week = weekStats(tasks, prefs);
  const today = todayStats(tasks);
  const habit = habitSummary(habits);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let alive = true;
    void getUserInfo()
      .then((info) => {
        if (alive) setUser(info);
      })
      .catch(() => {
        // Không có quyền hồ sơ: thẻ vẫn hiện tên mặc định.
      });
    void getAppInfo()
      .then((info) => {
        if (alive) setApp(info);
      })
      .catch(() => {
        // Thông tin phiên bản chỉ là trang trí.
      });
    return () => {
      alive = false;
    };
  }, []);

  const sync = () => {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      void showToast(
        `Đã đồng bộ ${formatNumber(tasks.length)} việc và ${formatNumber(habits.length)} thói quen`,
        { icon: "success" },
      );
    }, 900);
  };

  const shareProgress = () => {
    void share({
      title: "Sổ Việc",
      text: `Mình đã xong ${formatNumber(week.done)} việc và giữ ${habit.bestStreak} ngày chuỗi thói quen trên Sổ Việc.`,
    })
      .then((shared) => {
        void showToast(shared ? "Đã mở bảng chia sẻ" : "Chưa chia sẻ được", {
          icon: shared ? "success" : "error",
        });
      })
      .catch(() => {
        void showToast("Chưa chia sẻ được", { icon: "error" });
      });
  };

  const doneCount = tasks.filter((task) => task.done).length;

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Tôi"
          subtitle="Hồ sơ, mục tiêu và dữ liệu"
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
      footer={
        <AppTabBar
          index={props.index}
          badges={props.badges}
          onChange={props.onTab}
        />
      }
      overlays={
        <Dialog
          visible={confirmClear}
          title="Xoá toàn bộ dữ liệu?"
          confirmText="Xoá hết"
          cancelText="Giữ lại"
          onClose={() => setConfirmClear(false)}
          onConfirm={() => {
            resetAll();
            setConfirmClear(false);
            props.onTab(0);
            void showToast("Đã đưa sổ về dữ liệu mẫu", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            Việc đã thêm, ghi chú và dấu thói quen sẽ bị xoá khỏi thiết bị này.
            Sổ trở về đúng dữ liệu mẫu ban đầu.
          </Text>
        </Dialog>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 30,
            gap: 14,
          }}
        >
          <Card style={{ gap: 14 }}>
            <Row style={{ alignItems: "center", gap: 13 }}>
              <Avatar
                name={user?.nickname ?? "Bạn"}
                size={56}
                shape="circle"
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}
                >
                  {user?.nickname ?? "Bạn"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {user ? `@${user.qchatId}` : "Đang lấy hồ sơ QChat…"}
                </Text>
                <Row style={{ gap: 6, marginTop: 2 }}>
                  <Pill
                    label={`${formatNumber(week.done)} việc/tuần`}
                    bg={colors.brandSoft}
                    fg={colors.brand}
                  />
                  <Pill
                    label={prefs.remind ? "Đang nhắc nhở" : "Đã tắt nhắc"}
                    bg={prefs.remind ? colors.accentSoft : colors.soft}
                    fg={prefs.remind ? colors.accent : colors.muted}
                  />
                </Row>
              </View>
            </Row>
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center" }}>
              <StatTile
                value={formatNumber(week.done)}
                label="việc tuần này"
              />
              <Divider vertical color={colors.line} />
              <StatTile value={`${habit.bestStreak}`} label="ngày chuỗi" />
              <Divider vertical color={colors.line} />
              <StatTile
                value={`${habit.doneToday}/${habit.total}`}
                label="thói quen hôm nay"
              />
            </Row>
          </Card>

          <SectionHeader
            title="Đồng bộ & chia sẻ"
            note="Dữ liệu nằm trong namespace riêng của Mini App"
          />
          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="refresh" size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
                >
                  Đồng bộ với QChat
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  {syncing
                    ? "Đang gửi thay đổi…"
                    : `Lần cuối: hôm nay · ${formatNumber(today.done)} việc mới`}
                </Text>
              </View>
              <Button
                size="sm"
                variant={syncing ? "secondary" : "primary"}
                loading={syncing}
                onPress={sync}
                testID="sync"
              >
                {syncing ? "Đang đồng bộ" : "Đồng bộ"}
              </Button>
            </Row>
            {syncing ? (
              <Row style={{ alignItems: "center", gap: 8 }}>
                <ActivityIndicator size={16} color={colors.brand} />
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Đang đối chiếu việc và thói quen với máy chủ…
                </Text>
              </Row>
            ) : null}
            <Button
              variant="secondary"
              icon="share"
              testID="share-app"
              onPress={shareProgress}
            >
              Chia sẻ tiến độ
            </Button>
          </Card>

          <SectionHeader
            title="Mục tiêu"
            note={`Còn ${formatNumber(Math.max(0, week.goal - week.done))} việc để đạt mục tiêu tuần`}
          />
          <Card style={{ gap: 12 }}>
            <Row
              style={{ justifyContent: "spaceBetween", alignItems: "center" }}
            >
              <Text
                style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
              >
                Số việc mỗi tuần
              </Text>
              <Text
                style={{ fontSize: 13, fontWeight: "bold", color: colors.brand }}
              >
                {formatNumber(prefs.weeklyGoal)}
              </Text>
            </Row>
            <Slider
              value={prefs.weeklyGoal}
              min={5}
              max={40}
              step={5}
              onChange={(event) =>
                updatePrefs({ weeklyGoal: Math.round(event.value) })
              }
              testID="me-goal"
            />
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
                >
                  Nhắc nhở mỗi sáng
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  7:30, kèm việc gấp nhất trong ngày.
                </Text>
              </View>
              <Switch
                value={prefs.remind}
                onChange={(event) => updatePrefs({ remind: event.value })}
                testID="me-remind"
              />
            </Row>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
                >
                  Hiện việc đã xong
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Tắt để danh sách gọn hơn trong ngày bận.
                </Text>
              </View>
              <Switch
                value={prefs.showDone}
                onChange={(event) => updatePrefs({ showDone: event.value })}
                testID="me-show-done"
              />
            </Row>
          </Card>

          <SectionHeader
            title="Dữ liệu"
            note={`${formatNumber(doneCount)} việc đã xong đang lưu trên máy`}
          />
          <Card style={{ gap: 10 }}>
            <Button
              variant="secondary"
              icon="check"
              testID="clear-done"
              onPress={() => {
                const removed = clearDoneTasks();
                void showToast(
                  removed === 0
                    ? "Không còn việc nào đã xong"
                    : `Đã dọn ${removed} việc đã xong`,
                  { icon: "success" },
                );
              }}
            >
              Dọn việc đã xong
            </Button>
            <Button
              variant="danger"
              icon="delete"
              testID="clear-data"
              onPress={() => setConfirmClear(true)}
            >
              Xoá toàn bộ dữ liệu
            </Button>
          </Card>

          <Pressable
            testID="open-about"
            accessibleLabel="Giới thiệu Sổ Việc"
            onPress={props.onOpenAbout}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: colors.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="info" size={17} color={colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
              >
                Giới thiệu Sổ Việc
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {app
                  ? `Phiên bản ${app.version} · QChat Mini App`
                  : "QChat Mini App"}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.muted} />
          </Pressable>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Mọi màn hình được vẽ bằng QChat Design System, không dùng Material.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

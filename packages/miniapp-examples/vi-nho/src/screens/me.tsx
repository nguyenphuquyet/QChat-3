import {
  getUserInfo,
  share,
  showToast,
  useEffect,
  useState,
} from "@mna/qchat";
import type { UserInfo } from "@mna/qchat";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Checkbox,
  Dialog,
  Divider,
  Icon,
  NavBar,
  Page,
  Pressable,
  Row,
  ScrollView,
  Switch,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  money,
  monthSummary,
  resetAll,
  shortMoney,
  updatePrefs,
  usePrefs,
  useTxns,
} from "../store.js";
import { colors, radius, screenPad } from "../theme.js";
import {
  AppTabBar,
  Card,
  SectionHeader,
  StatTile,
} from "../ui.js";

/** Một dòng dẫn sang màn hình khác, dùng cho khối "Khám phá". */
function NavRow(props: {
  icon: string;
  title: string;
  note: string;
  badge?: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      accessibleLabel={props.title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: colors.brandSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={17} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}>
          {props.title}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.note}</Text>
      </View>
      {props.badge ? (
        <Tag tone="info" size="sm">
          {props.badge}
        </Tag>
      ) : null}
      <Icon name="chevronRight" size={16} color={colors.muted} />
    </Pressable>
  );
}

/**
 * Tab Tôi: hồ sơ lấy từ host, số liệu tháng, cài đặt quyền riêng tư, mã PIN
 * bảo vệ ví và các route phụ (bộ điều khiển TDesign, giới thiệu).
 *
 * Mã PIN dùng `TextField` bảo mật của TDesign; nút đồng bộ cố ý chờ một nhịp
 * để thấy `loading` cùng `ActivityIndicator`.
 */
export function MeScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenGallery: () => void;
  onOpenAbout: () => void;
}) {
  const txns = useTxns();
  const prefs = usePrefs();
  const summary = monthSummary(txns, prefs.monthlyBudget);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pin, setPin] = useState(prefs.pin);
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    let alive = true;
    void getUserInfo()
      .then((info) => {
        if (alive) setUser(info);
      })
      .catch(() => {
        // Không có quyền hồ sơ: thẻ vẫn hiện tên mặc định.
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
        `Đã đồng bộ ${summary.count} khoản trong ${money(summary.spent)}`,
        { icon: "success" },
      );
    }, 900);
  };

  const shareSummary = () => {
    void share({
      title: "Ví Nhỏ",
      text: `Tháng này mình đã chi ${money(summary.spent)} cho ${summary.count} khoản, còn ${money(Math.max(0, summary.remaining))} trong ngân sách.`,
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

  const savePin = () => {
    if (savingPin) return;
    if (pin.trim().length < 4) {
      void showToast("Mã PIN cần ít nhất 4 số", { icon: "error" });
      return;
    }
    setSavingPin(true);
    setTimeout(() => {
      updatePrefs({ pin });
      setSavingPin(false);
      void showToast("Đã cập nhật mã PIN cho ví", { icon: "success" });
    }, 500);
  };

  const savings = summary.income - summary.spent;

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Tôi"
          subtitle="Hồ sơ, cài đặt và dữ liệu"
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
          visible={confirmReset}
          title="Đưa ví về dữ liệu mẫu?"
          confirmText="Đặt lại"
          cancelText="Giữ lại"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetAll();
            setConfirmReset(false);
            setPin("");
            props.onTab(0);
            void showToast("Đã đưa ví về dữ liệu mẫu", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            Khoản đã thêm, hạn mức và mã PIN sẽ bị xoá khỏi thiết bị này. Ví trở
            về đúng 28 khoản mẫu ban đầu.
          </Text>
        </Dialog>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <Card style={{ gap: 14 }}>
            <Row style={{ alignItems: "center", gap: 13 }}>
              <Avatar
                name={user?.nickname ?? "Bạn"}
                src={user?.avatarUrl ?? undefined}
                size={56}
                shape="circle"
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "bold",
                    color: colors.ink,
                  }}
                >
                  {user?.nickname ?? "Bạn"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {user ? `@${user.qchatId}` : "Đang lấy hồ sơ QChat…"}
                </Text>
                <Row style={{ gap: 6, marginTop: 2 }}>
                  <Tag tone="info" size="sm">
                    Ví cá nhân
                  </Tag>
                  <Tag
                    tone={prefs.remind ? "success" : "neutral"}
                    size="sm"
                  >
                    {prefs.remind ? "Đang nhắc" : "Đã tắt nhắc"}
                  </Tag>
                </Row>
              </View>
            </Row>
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center" }}>
              <StatTile value={String(summary.count)} label="khoản tháng này" />
              <Divider vertical color={colors.line} />
              <StatTile
                value={shortMoney(summary.spent)}
                label="đã chi"
                tone={colors.danger}
              />
              <Divider vertical color={colors.line} />
              <StatTile
                value={shortMoney(savings)}
                label="chênh thu chi"
                tone={savings >= 0 ? colors.success : colors.danger}
              />
            </Row>
            <Button
              variant="secondary"
              icon="share"
              onPress={shareSummary}
              testID="share-wallet"
            >
              Chia sẻ tổng kết tháng
            </Button>
          </Card>

          <SectionHeader
            title="Cài đặt"
            note="Nhắc nhở và quyền riêng tư"
          />
          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  Nhắc hoá đơn định kỳ
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Trước hai ngày, vào lúc 9:00.
                </Text>
              </View>
              <Switch
                value={prefs.remind}
                onChange={(event) => updatePrefs({ remind: event.value })}
                testID="me-remind"
              />
            </Row>
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  Tổng kết mỗi Chủ nhật
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Một tin nhắn ngắn về tuần vừa chi.
                </Text>
              </View>
              <Switch
                value={prefs.weeklyReport}
                onChange={(event) =>
                  updatePrefs({ weeklyReport: event.value })
                }
                testID="me-report"
              />
            </Row>
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  Làm tròn vào quỹ tiết kiệm
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Giữ lại phần lẻ của mỗi khoản chi.
                </Text>
              </View>
              <Switch
                value={prefs.roundUp}
                onChange={(event) => updatePrefs({ roundUp: event.value })}
                testID="me-round"
              />
            </Row>
            <Divider color={colors.line} />
            <Checkbox
              checked={prefs.shareStats}
              label="Chia sẻ số liệu ẩn danh để nhận gợi ý"
              onChange={(event) =>
                updatePrefs({ shareStats: event.value })
              }
              testID="me-share-stats"
            />
          </Card>

          <SectionHeader
            title="Bảo vệ ví"
            note="Mã PIN chỉ lưu trong namespace của Mini App"
          />
          <Card style={{ gap: 11 }}>
            <Row style={{ alignItems: "center", gap: 8 }}>
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
              >
                Mã PIN 4–6 số
              </Text>
              <View style={{ flex: 1 }} />
              <Tag
                tone={prefs.pin.length > 0 ? "success" : "neutral"}
                size="sm"
              >
                {prefs.pin.length > 0 ? "Đã đặt mã" : "Chưa đặt mã"}
              </Tag>
            </Row>
            <TextField
              value={pin}
              placeholder="••••"
              keyboardType="number"
              secureTextEntry
              maxLength={6}
              onInput={(value) => setPin(value.replace(/[^0-9]/g, ""))}
              testID="me-pin"
              style={{
                backgroundColor: colors.soft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.ink,
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon="lock"
              onPress={savePin}
              loading={savingPin}
              disabled={savingPin || pin.trim().length < 4}
              testID="save-pin"
            >
              {savingPin ? "Đang lưu…" : "Lưu mã PIN"}
            </Button>
          </Card>

          <SectionHeader
            title="Đồng bộ"
            note="Dữ liệu nằm trên thiết bị, đồng bộ chỉ là mô phỏng"
          />
          <Card style={{ gap: 11 }}>
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
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  Đồng bộ với QChat
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  {syncing
                    ? "Đang gửi thay đổi…"
                    : `Lần cuối: hôm nay · ${summary.count} khoản`}
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
                  Đang tính lại số dư và hạn mức từng nhóm…
                </Text>
              </Row>
            ) : null}
          </Card>

          <SectionHeader title="Khám phá" note="Hai route nội bộ của app" />
          <Card style={{ gap: 0 }}>
            <NavRow
              icon="grid"
              title="Bộ điều khiển TDesign"
              note="Button, Tag, Badge, Checkbox, Switch, Slider, TextField…"
              badge="Demo"
              testID="open-gallery"
              onPress={props.onOpenGallery}
            />
            <Divider color={colors.line} />
            <NavRow
              icon="info"
              title="Về Ví Nhỏ"
              note="Cách app dùng hợp đồng Mini App"
              testID="open-about"
              onPress={props.onOpenAbout}
            />
          </Card>

          <Card
            style={{
              gap: 10,
              backgroundColor: colors.dangerSoft,
              borderColor: "#f7d2cf",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.danger,
              }}
            >
              Vùng nguy hiểm
            </Text>
            <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.muted }}>
              Đặt lại sẽ xoá mọi thay đổi trên thiết bị này và nạp lại dữ liệu
              mẫu. Bản lưu trong storage cũng bị xoá.
            </Text>
            <Button
              variant="danger"
              icon="undo"
              onPress={() => setConfirmReset(true)}
              testID="reset-data"
            >
              Đặt lại dữ liệu mẫu
            </Button>
          </Card>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Ví Nhỏ 1.0.0 · một Mini App mẫu, không kết nối ngân hàng hay ví điện
            tử thật.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

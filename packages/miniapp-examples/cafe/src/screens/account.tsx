import { useEffect, useState } from "@mna/qchat";
import {
  closeMiniApp,
  getAppInfo,
  getSystemInfo,
  getUserInfo,
  openExternal,
  share,
  showToast,
} from "@mna/qchat";
import type { AppInfo, SystemInfo, UserInfo } from "@mna/qchat";
import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  Divider,
  Icon,
  Link,
  NavBar,
  Pressable,
  Row,
  Slider,
  Switch,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import { describeError, money, updatePrefs, usePrefs, useVouchers } from "../store.js";
import { colors, radius } from "../theme.js";
import { Card, InfoRow, ScreenShell, Section } from "../ui.js";

/**
 * Tab tài khoản: hồ sơ từ host, tuỳ chọn lưu qua storage và các API chỉ chủ
 * thiết bị mới trả lời được. Mọi lời gọi đều có nhánh lỗi, vì quyền có thể bị
 * từ chối.
 */
export function AccountScreen(props: { onOpenLegal: () => void }) {
  const prefs = usePrefs();
  const vouchers = useVouchers();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const info = await getUserInfo();
        if (alive) setUser(info);
      } catch (error) {
        if (alive) setProblem(describeError(error));
      }
      try {
        const meta = await getAppInfo();
        if (alive) setApp(meta);
      } catch {
        // The app still works without its own metadata.
      }
      try {
        const device = await getSystemInfo();
        if (alive) setSystem(device);
      } catch {
        // Same here: the info card just shows fewer rows.
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const displayName = user?.nickname ?? "Khách của quán";
  const handle = user?.qchatId ? `@${user.qchatId}` : "@khach";

  const doShare = async () => {
    setSharing(true);
    try {
      const done = await share({
        title: "Cà Phê Nhà",
        text: "Rang mộc mỗi sáng, giao trong 20 phút.",
        url: "https://qchat.vn/miniapp/cafe",
      });
      void showToast(done ? "Đã chia sẻ" : "Bạn đã đóng bảng chia sẻ", {
        icon: done ? "success" : "none",
      });
    } catch (error) {
      void showToast(describeError(error), { icon: "error" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar title="Tài khoản" subtitle="Hồ sơ và tuỳ chọn của bạn" />

      <ScreenShell>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar
            src={user?.avatarUrl ?? undefined}
            name={displayName}
            size={56}
            shape="circle"
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}>
              {displayName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{handle}</Text>
            <Row style={{ gap: 6, marginTop: 2 }}>
              <Tag tone="success" size="sm">
                {`${vouchers.length} mã đã lưu`}
              </Tag>
              <Tag tone="neutral" size="sm">
                Thành viên từ 2024
              </Tag>
            </Row>
          </View>
        </Card>

        {problem ? (
          <Card style={{ backgroundColor: "#fdf1ef", gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.red }}>
              Không đọc được hồ sơ
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>{problem}</Text>
          </Card>
        ) : null}

        <Section title="Tuỳ chọn" caption="Lưu vào storage của Mini App">
          <Card style={{ gap: 14 }}>
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, color: colors.ink }}>
                  Nhận khuyến mãi
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Thông báo khi có mã mới hoặc flash sale
                </Text>
              </View>
              <Switch
                value={prefs.promo}
                onChange={(event) => updatePrefs({ promo: event.value })}
              />
            </Row>

            <Divider />

            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 14, color: colors.ink }}>
                  Mức đường mặc định
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "bold", color: colors.brand }}>
                  {`${prefs.sugar}%`}
                </Text>
              </Row>
              <Slider
                value={prefs.sugar}
                min={0}
                max={100}
                step={25}
                onChange={(event) => updatePrefs({ sugar: event.value })}
              />
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Dùng sẵn khi bạn bấm “+” ở thực đơn.
              </Text>
            </View>

            <Divider />

            <Checkbox
              checked={prefs.receipts}
              label="Gửi hoá đơn qua QChat sau khi đơn hoàn tất"
              onChange={(event) => updatePrefs({ receipts: event.value })}
            />
          </Card>
        </Section>

        <Section title="Quán và ứng dụng">
          <Card style={{ padding: 0 }}>
            <Cell
              icon="share"
              title="Chia sẻ quán cho bạn bè"
              note="Mở bảng chia sẻ của QChat"
              loading={sharing}
              onPress={() => void doShare()}
            />
            <Divider inset={56} />
            <Cell
              icon="qrCode"
              title="Mã QR của quán"
              note="Dùng để mời bạn bè quét"
              onPress={() => void showToast("Quán chưa mở mã QR", { icon: "none" })}
            />
            <Divider inset={56} />
            <Cell
              icon="info"
              title="Điều khoản và chính sách"
              note="Trang nội bộ, mở bằng host router"
              onPress={props.onOpenLegal}
            />
            <Divider inset={56} />
            <Cell
              icon="landmark"
              title="Trang chủ QChat"
              note="Liên kết ngoài: host báo lại, không tự mở app khác"
              onPress={() => {
                void openExternal("https://qchat.vn").catch((error) => {
                  void showToast(describeError(error), { icon: "error" });
                });
              }}
            />
          </Card>
        </Section>

        <Section
          title="Thông tin runtime"
          caption="Số liệu host trả về, không phải app tự đoán"
        >
          <Card style={{ gap: 8 }}>
            <InfoRow label="App" value={app ? `${app.name} · ${app.version}` : "…"} />
            <InfoRow
              label="Runtime"
              value={app ? app.runtimeVersion : system?.runtimeVersion ?? "…"}
            />
            <InfoRow label="Nền tảng" value={system?.platform ?? "…"} />
            <InfoRow
              label="Màn hình"
              value={
                system
                  ? `${Math.round(system.screenWidth)} × ${Math.round(system.screenHeight)}`
                  : "…"
              }
            />
            <InfoRow
              label="Safe area"
              value={
                system
                  ? `top ${system.safeAreaTop ?? 0} · bottom ${system.safeAreaBottom ?? 0}`
                  : "…"
              }
            />
            <InfoRow
              label="Chủ đề"
              value={system?.theme === "dark" ? "Tối" : "Sáng"}
            />
          </Card>
        </Section>

        <Section title="Khác">
          <Card style={{ gap: 12 }}>
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Hạn mức quán tặng tháng này
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "bold", color: colors.ink }}>
                {money(214000)}
              </Text>
            </Row>
            <Link href="/legal">Đọc điều khoản trước khi đóng ứng dụng</Link>
            <Button
              variant="outline"
              icon="close"
              onPress={() => setConfirmClose(true)}
            >
              Đóng Mini App
            </Button>
          </Card>
        </Section>
      </ScreenShell>

      <Dialog
        visible={confirmClose}
        title="Đóng Cà Phê Nhà?"
        confirmText="Đóng"
        cancelText="Ở lại"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          void closeMiniApp();
        }}
      >
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Giỏ hàng và tuỳ chọn đã được lưu, mở lại sẽ còn nguyên.
        </Text>
      </Dialog>
    </View>
  );
}

function Cell(props: {
  icon: string;
  title: string;
  note: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cream,
        }}
      >
        <Icon name={props.icon} size={17} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, color: colors.ink }}>{props.title}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.note}</Text>
      </View>
      {props.loading ? (
        <Text style={{ fontSize: 11, color: colors.muted }}>…</Text>
      ) : (
        <Icon name="chevronRight" size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

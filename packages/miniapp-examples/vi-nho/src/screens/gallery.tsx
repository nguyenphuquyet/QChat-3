import { useState } from "@mna/qchat";
import {
  ActivityIndicator,
  Badge,
  Button,
  Checkbox,
  Divider,
  Icon,
  NavBar,
  Page,
  Row,
  ScrollView,
  Slider,
  Switch,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import type { VNodeChild } from "@mna/qchat";
import { money } from "../store.js";
import type { Tone } from "../store.js";
import { colors, radius, screenPad } from "../theme.js";
import { Card } from "../ui.js";

const TONES: readonly { tone: Tone; label: string }[] = [
  { tone: "neutral", label: "Trung tính" },
  { tone: "info", label: "Thông tin" },
  { tone: "success", label: "Thành công" },
  { tone: "warning", label: "Cảnh báo" },
  { tone: "danger", label: "Nguy hiểm" },
];

const ICONS = [
  "check",
  "close",
  "plus",
  "minus",
  "heart",
  "share",
  "delete",
  "refresh",
  "info",
  "clock",
  "grid",
  "me",
  "mail",
  "call",
  "videoCall",
  "camera",
  "image",
  "location",
  "file",
  "music",
  "lock",
  "pencil",
  "star",
  "search",
  "service",
  "wallet",
  "eye",
  "tag",
  "undo",
  "send",
] as const;

function Block(props: {
  title: string;
  note: string;
  children?: VNodeChild;
}) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
          {props.title}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.note}</Text>
      </View>
      {props.children}
    </Card>
  );
}

function Label(props: { children?: VNodeChild }) {
  return (
    <Text
      style={{
        fontSize: 10.5,
        fontWeight: "600",
        color: colors.muted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {props.children}
    </Text>
  );
}

/**
 * Route `/bo-dieu-khien`: bộ điều khiển TDesign của hợp đồng Mini App, mỗi
 * control một khối kèm trạng thái thật.
 *
 * Màn hình này cố ý không phải một "style guide" chết: `Checkbox`, `Switch`,
 * `Slider` và các ô nhập đều giữ state, nên có thể chạm thử ngay trong app.
 */
export function GalleryScreen(props: { onBack: () => void }) {
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [amount, setAmount] = useState(650000);
  const [text, setText] = useState("Ví Nhỏ");
  const [note, setNote] = useState(
    "Ghi chú nhiều dòng: xuống dòng, dán và sửa đều được.",
  );
  const [secret, setSecret] = useState("123456");
  const [busy, setBusy] = useState(false);

  const runBusy = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => setBusy(false), 800);
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Bộ điều khiển"
          subtitle="TDesign trong khung Mini App"
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <View
            style={{
              padding: 12,
              gap: 4,
              borderRadius: radius.md,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: "#cfe0ff",
            }}
          >
            <Text
              style={{ fontSize: 12.5, fontWeight: "600", color: colors.brand }}
            >
              Một file, mười một control
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 17, color: colors.muted }}>
              Mọi nút, nhãn, ô nhập và thanh trượt dưới đây do TDesign vẽ; khung
              trang và chuyển động vẫn của QChat.
            </Text>
          </View>

          <Block
            title="Button"
            note="Ba kích thước, năm kiểu, kèm icon, loading và disabled"
          >
            <Label>Kích thước</Label>
            <Row style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Button size="sm">Nhỏ</Button>
              <Button size="md">Vừa</Button>
              <Button size="lg">Lớn</Button>
            </Row>

            <Label>Kiểu</Label>
            <Row style={{ gap: 8, flexWrap: "wrap" }}>
              <Button>Chính</Button>
              <Button variant="secondary">Phụ</Button>
              <Button variant="outline">Viền</Button>
              <Button variant="text">Chữ</Button>
              <Button variant="danger">Nguy hiểm</Button>
            </Row>

            <Label>Trạng thái</Label>
            <Row style={{ gap: 8, flexWrap: "wrap" }}>
              <Button icon="plus" size="sm">
                Có icon
              </Button>
              <Button disabled size="sm">
                Khoá
              </Button>
              <Button
                loading={busy}
                onPress={runBusy}
                size="sm"
                testID="gallery-busy"
              >
                {busy ? "Đang chạy" : "Chạy thử"}
              </Button>
              <Button variant="outline" icon="share" size="sm">
                Chia sẻ
              </Button>
            </Row>
          </Block>

          <Block title="Tag" note="Năm sắc thái và hai kích thước">
            <Label>Sắc thái</Label>
            <Row style={{ gap: 7, flexWrap: "wrap" }}>
              {TONES.map((entry) => (
                <Tag key={entry.tone} tone={entry.tone}>
                  {entry.label}
                </Tag>
              ))}
            </Row>
            <Label>Kích thước</Label>
            <Row style={{ gap: 7, alignItems: "center" }}>
              <Tag size="sm" tone="info">
                Nhỏ
              </Tag>
              <Tag size="md" tone="info">
                Vừa
              </Tag>
              <Tag size="lg" tone="info">
                Lớn
              </Tag>
            </Row>
          </Block>

          <Block
            title="Badge"
            note="Số đếm, giới hạn max, chấm tròn và trạng thái ẩn"
          >
            <Row style={{ gap: 20, alignItems: "center" }}>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Badge count={8} testID="gallery-badge">
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="mail" size={21} color={colors.brand} />
                  </View>
                </Badge>
                <Text style={{ fontSize: 9.5, color: colors.muted }}>
                  count 8
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Badge count={120} max={99}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="chats" size={21} color={colors.brand} />
                  </View>
                </Badge>
                <Text style={{ fontSize: 9.5, color: colors.muted }}>
                  max 99
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Badge dot>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="clock" size={21} color={colors.brand} />
                  </View>
                </Badge>
                <Text style={{ fontSize: 9.5, color: colors.muted }}>dot</Text>
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Badge count={3} visible={false}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="star" size={21} color={colors.brand} />
                  </View>
                </Badge>
                <Text style={{ fontSize: 9.5, color: colors.muted }}>
                  ẩn
                </Text>
              </View>
            </Row>
          </Block>

          <Block title="Checkbox & Switch" note="Bật, tắt và khoá">
            <Checkbox
              checked={checked}
              label={checked ? "Đang chọn" : "Chưa chọn"}
              onChange={(event) => setChecked(event.value)}
              testID="gallery-checkbox"
            />
            <Checkbox checked label="Đã chọn sẵn" />
            <Checkbox checked={false} disabled label="Không chọn được" />
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center", gap: 11 }}>
              <Text style={{ flex: 1, fontSize: 13, color: colors.ink }}>
                Công tắc
              </Text>
              <Switch
                value={switchOn}
                onChange={(event) => setSwitchOn(event.value)}
                testID="gallery-switch"
              />
            </Row>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <Text style={{ flex: 1, fontSize: 13, color: colors.ink }}>
                Công tắc khoá
              </Text>
              <Switch value disabled />
            </Row>
          </Block>

          <Block title="Slider" note="Bước 50.000đ, cập nhật ngay khi kéo">
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Hạn mức thử
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "bold",
                  color: colors.brand,
                }}
              >
                {money(amount)}
              </Text>
            </Row>
            <Slider
              value={amount}
              min={50000}
              max={5000000}
              step={50000}
              onChange={(event) => setAmount(event.value)}
              testID="gallery-slider"
            />
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 9.5, color: colors.muted }}>50k</Text>
              <Text style={{ fontSize: 9.5, color: colors.muted }}>5tr</Text>
            </Row>
          </Block>

          <Block
            title="TextField"
            note="Một dòng, nhiều dòng, bảo mật và chỉ đọc"
          >
            <Label>Một dòng</Label>
            <TextField
              value={text}
              placeholder="Tên khoản chi"
              onInput={setText}
              maxLength={40}
              testID="gallery-text"
              style={{
                backgroundColor: colors.soft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.ink,
              }}
            />

            <Label>Nhiều dòng</Label>
            <TextField
              value={note}
              placeholder="Ghi chú"
              onInput={setNote}
              multiline
              maxLength={240}
              testID="gallery-note"
              style={{
                backgroundColor: colors.soft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.ink,
              }}
            />

            <Label>Bảo mật</Label>
            <TextField
              value={secret}
              placeholder="Mã PIN"
              keyboardType="number"
              secureTextEntry
              onInput={(value) => setSecret(value.replace(/[^0-9]/g, ""))}
              maxLength={6}
              testID="gallery-secret"
              style={{
                backgroundColor: colors.soft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.ink,
              }}
            />

            <Label>Chỉ đọc</Label>
            <TextField
              value="Không thể sửa ô này"
              editable={false}
              style={{
                backgroundColor: colors.neutralSoft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.muted,
              }}
            />
          </Block>

          <Block
            title="ActivityIndicator"
            note="Ba kích thước, ba màu; vòng xoay do TDesign vẽ"
          >
            <Row style={{ gap: 22, alignItems: "center" }}>
              <ActivityIndicator size={16} color={colors.brand} />
              <ActivityIndicator size={22} color={colors.warning} />
              <ActivityIndicator size={30} color={colors.success} />
              <Text style={{ fontSize: 10.5, color: colors.muted }}>
                đang tải
              </Text>
            </Row>
          </Block>

          <Block
            title="Divider"
            note="Một nét mảnh, một nét dày có lề trái"
          >
            <Text style={{ fontSize: 11.5, color: colors.muted }}>
              Trước đường kẻ
            </Text>
            <Divider color={colors.line} />
            <Text style={{ fontSize: 11.5, color: colors.muted }}>
              Sau đường kẻ mảnh
            </Text>
            <Divider color={colors.brand} thickness={3} inset={28} />
            <Text style={{ fontSize: 11.5, color: colors.muted }}>
              Sau đường kẻ dày
            </Text>
          </Block>

          <Block
            title="Icon"
            note="Bộ glyph của hợp đồng; tên lạ rơi về bộ QChat"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {ICONS.map((name) => (
                <View
                  key={name}
                  style={{ width: 50, alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: colors.soft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={name} size={18} color={colors.brand} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 8, color: colors.muted }}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </Block>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Mọi control ở trên đi qua `qapp_tdesign.dart`; không file nào khác
            trong app chạm tới TDesign hay Material.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

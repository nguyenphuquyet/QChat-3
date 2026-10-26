import { useEffect, useMemo, useRef, useState } from "@mna/qchat";
import {
  ActivityIndicator,
  AnimatedView,
  Button,
  Checkbox,
  CustomPaint,
  Divider,
  GridView,
  Icon,
  Image,
  ListView,
  Pressable,
  Positioned,
  Row,
  SafeArea,
  ScrollView,
  Slider,
  Spacer,
  Stack,
  Switch,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import type { AnimateKind } from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  Note,
  ScreenShell,
  Section,
} from "../components.js";
import { pushLog } from "../store.js";
import { colors, radius } from "../theme.js";

/** Icon names the QChat design system actually draws. */
const ICONS = [
  "chats",
  "contacts",
  "me",
  "discover",
  "grid",
  "more",
  "share",
  "image",
  "camera",
  "star",
  "heart",
  "qr",
  "wallet",
  "gift",
  "gear",
  "info",
  "lock",
  "play",
  "radar",
  "mail",
];

const LIST_ITEMS = Array.from({ length: 40 }, (_value, index) => ({
  id: index + 1,
  title: `Dòng #${index + 1}`,
  caption: index % 3 === 0 ? "mục nổi bật" : "mục thường",
}));

const GRID_ITEMS = Array.from({ length: 8 }, (_value, index) => ({
  id: index + 1,
  label: `Ô ${index + 1}`,
}));

const TAGS = [
  "Tất cả",
  "Tin nhắn",
  "Nhóm",
  "Tệp",
  "Ảnh",
  "Video",
  "Liên kết",
  "Ghim",
];

const SMALL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAC2SURBVDhPpcs7C0EBGAbg92/YTDaTzWQy2Uw2k03JiTg5ObkdueeW45Ijg1KUKEVJSlKUopRB+SWvH/E9+4Nk5EMt+qKu3JmLXWjEjywndqypazZTC3a0Gc30hEO9TyvT5jRb5SxvcF7QuSyqhCSvSgohyZtKmJDkbTVESPK+HiQk+dAIEJJ8avoJST63fIQkXzteQpJvXQ8hyY+em5Dkp+kiJPk9cBKS/Bk5CEn+ju2EJP8sG//SR65XOueLkgAAAABJRU5ErkJggg==";

const LONG_TEXT =
  "Đoạn văn dài này chỉ hiện hai dòng rồi bị cắt bằng numberOfLines, phần còn lại " +
  "vẫn nằm trong dữ liệu nhưng Flutter không phải dựng thêm dòng nào.";

/** Tab 2: one screen that puts every component and style key on display. */
export function UiKitScreen() {
  const [checked, setChecked] = useState(true);
  const [toggle, setToggle] = useState(false);
  const [slider, setSlider] = useState(40);
  const [scrollX, setScrollX] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [animate, setAnimate] = useState<AnimateKind>("slideUp");
  const [busy, setBusy] = useState(false);
  const [presses, setPresses] = useState(0);
  const pressRef = useRef(0);
  const squares = useMemo(() => [colors.blue, colors.brand, colors.amber], []);

  useEffect(() => {
    pushLog("ui-kit", "mở thư viện thành phần");
  }, []);

  const runBusy = () => {
    setBusy(true);
    pushLog("button", "loading 800ms");
    setTimeout(() => {
      setBusy(false);
      pushLog("button", "loading xong", "success");
    }, 800);
  };

  return (
    <ScreenShell>
      <Section
        title="Chữ & kiểu chữ"
        caption="fontSize, weight, style, decoration, transform, numberOfLines"
      >
        <Card>
          <Text style={{ fontSize: 24, fontWeight: "bold" }}>
            Tiêu đề 24 bold
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>
            Phụ đề 18 / 600
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>
            Nội dung 14 màu muted, dùng cho phần mô tả.
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontStyle: "italic",
              textDecoration: "underline",
            }}
          >
            Nghiêng và gạch chân
          </Text>
          <Text
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            uppercase 2px
          </Text>
          <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 20 }}>
            {LONG_TEXT}
          </Text>
          <Text selectable style={{ fontSize: 14, color: colors.blue }}>
            Văn bản này bôi đen và copy được (selectable).
          </Text>
        </Card>
      </Section>

      <Section
        title="Nút & nhấn"
        caption="Bốn biến thể, disabled, loading, icon, Pressable nhấn giữ"
      >
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 8, flexWrap: "wrap" }}>
            <Button onPress={() => void pushLog("button", "primary")}>
              Primary
            </Button>
            <Button
              variant="secondary"
              onPress={() => void pushLog("button", "secondary")}
            >
              Secondary
            </Button>
            <Button
              variant="text"
              onPress={() => void pushLog("button", "text")}
            >
              Text
            </Button>
            <Button
              variant="danger"
              onPress={() => void pushLog("button", "danger", "warn")}
            >
              Danger
            </Button>
          </Row>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label="Disabled"
                disabled
                onPress={() => undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="primary"
                label="Loading 800ms"
                loading={busy}
                onPress={runBusy}
              />
            </View>
          </Row>
          <Button
            icon="download"
            onPress={() => void pushLog("button", "có icon")}
          >
            Nút có icon
          </Button>
          <Pressable
            style={{
              padding: 12,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
            onPress={() => {
              pressRef.current += 1;
              setPresses(pressRef.current);
              pushLog("pressable", `press #${pressRef.current} (useRef)`);
            }}
            onLongPress={() => {
              pressRef.current = 0;
              setPresses(0);
              pushLog("pressable", "longPress · reset useRef", "warn");
            }}
          >
            <Text style={{ fontSize: 13, textAlign: "center" }}>
              Pressable · nhấn {presses} lần · nhấn giữ để reset
            </Text>
          </Pressable>
        </Card>
      </Section>

      <Section
        title="Điều khiển nhập"
        caption="Checkbox, Switch, Slider, ActivityIndicator"
      >
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
            <Text style={{ fontSize: 14 }}>Checkbox có nhãn</Text>
            <Checkbox
              checked={checked}
              label="Bật"
              onChange={(event) => {
                setChecked(event.value);
                pushLog("checkbox", `checked = ${event.value}`);
              }}
            />
          </Row>
          <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
            <Text style={{ fontSize: 14 }}>Switch</Text>
            <Switch
              value={toggle}
              onChange={(event) => {
                setToggle(event.value);
                pushLog("switch", `value = ${event.value}`);
              }}
            />
          </Row>
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 14 }}>Slider 0…100 bước 5</Text>
              <Text style={{ fontSize: 14, color: colors.blue }}>
                {Math.round(slider)}
              </Text>
            </Row>
            <Slider
              value={slider}
              min={0}
              max={100}
              step={5}
              onChange={(event) => setSlider(event.value)}
            />
          </View>
          <Row style={{ gap: 14, alignItems: "center" }}>
            <ActivityIndicator />
            <ActivityIndicator size={30} color={colors.violet} />
            <ActivityIndicator size={18} color={colors.amber} />
            <Text style={{ fontSize: 13, color: colors.muted }}>
              ActivityIndicator 3 cỡ
            </Text>
          </Row>
        </Card>
      </Section>

      <Section
        title="Bố cục"
        caption="Row/Column, flex, gap, wrap, Stack + Positioned, Spacer, Divider, aspectRatio"
      >
        <Card style={{ gap: 14 }}>
          <Row style={{ justifyContent: "spaceBetween" }}>
            {squares.map((color) => (
              <View
                key={color}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.sm,
                  backgroundColor: color,
                }}
              />
            ))}
          </Row>
          <Row style={{ gap: 10 }}>
            <View
              style={{
                flex: 1,
                height: 24,
                borderRadius: 6,
                backgroundColor: colors.blue,
              }}
            />
            <View
              style={{
                flex: 2,
                height: 24,
                borderRadius: 6,
                backgroundColor: colors.brand,
              }}
            />
          </Row>
          <Row style={{ gap: 6, flexWrap: "wrap" }}>
            {TAGS.map((tag) => (
              <View
                key={tag}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor: colors.soft,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.ink }}>{tag}</Text>
              </View>
            ))}
          </Row>
          <Stack
            alignment="center"
            style={{
              height: 100,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Stack · alignment center
            </Text>
            <Positioned top={8} left={8}>
              <Text style={{ fontSize: 11, color: colors.blue }}>top/left</Text>
            </Positioned>
            <Positioned bottom={8} right={8}>
              <Text style={{ fontSize: 11, color: colors.red }}>
                bottom/right
              </Text>
            </Positioned>
          </Stack>
          <Row style={{ alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 13 }}>Trái</Text>
            <Spacer />
            <Text style={{ fontSize: 13 }}>Phải (Spacer ở giữa)</Text>
          </Row>
          <Divider />
          <Divider color={colors.brand} thickness={2} />
          <View
            style={{
              aspectRatio: 3,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
          />
          <Note>Ô trên dùng aspectRatio 3 (rộng gấp ba lần cao).</Note>
        </Card>
      </Section>

      <Section
        title="Hiệu ứng, màu và vẽ"
        caption="AnimatedView, gradient, opacity, rotate, scale, viền từng cạnh, overflow, CustomPaint"
      >
        <Card style={{ gap: 14 }}>
          <AnimatedView
            key={String(animKey)}
            animate={animate}
            duration={360}
            style={{
              padding: 12,
              borderRadius: radius.sm,
              backgroundColor: colors.soft,
            }}
          >
            <Text style={{ fontSize: 13 }}>
              AnimatedView · {animate} · lần {animKey + 1}
            </Text>
          </AnimatedView>
          <Row style={{ gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onPress={() => {
                setAnimKey(animKey + 1);
                pushLog("animation", `${animate} replay`);
              }}
            >
              Chạy lại
            </Button>
            <Button
              variant="secondary"
              onPress={() =>
                setAnimate(
                  animate === "slideUp"
                    ? "scaleIn"
                    : animate === "scaleIn"
                      ? "fadeIn"
                      : "slideUp",
                )
              }
            >
              Đổi kiểu: {animate}
            </Button>
          </Row>
          <Row style={{ gap: 10, flexWrap: "wrap" }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: colors.brand,
                opacity: 0.45,
              }}
            />
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: colors.blue,
                rotate: 0.4,
              }}
            />
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                backgroundColor: colors.violet,
                scale: 0.78,
              }}
            />
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                gradient: {
                  type: "radial",
                  stops: [
                    { offset: 0, color: "#ffffff" },
                    { offset: 1, color: colors.brand },
                  ],
                },
              }}
            />
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.sm,
                borderWidth: 2,
                borderColor: colors.amber,
                borderTopWidth: 5,
                borderTopColor: colors.red,
              }}
            />
          </Row>
          <View
            style={{
              height: 56,
              borderRadius: radius.sm,
              overflow: "hidden",
              backgroundColor: colors.soft,
            }}
          >
            <View
              style={{
                width: 240,
                height: 56,
                gradient: {
                  type: "linear",
                  angle: 90,
                  stops: [
                    { offset: 0, color: "#0f7ad6" },
                    { offset: 1, color: colors.brand },
                  ],
                },
              }}
            />
          </View>
          <CustomPaint
            draw="fill:#eef0f3 stroke:#7970da strokeWidth:2 M 0 60 Q 35 0 70 30 C 95 52 120 10 150 24 Z"
            style={{ height: 70, borderRadius: radius.sm }}
          />
          <Note>
            Khối màu trên bị cắt bởi overflow hidden; hình dưới do CustomPaint
            vẽ.
          </Note>
        </Card>
      </Section>

      <Section
        title="Ảnh & icon"
        caption="assets/ có hash khi đóng gói, data URL, fit, fallback và Icon của design system"
      >
        <Card style={{ gap: 14 }}>
          <Row style={{ gap: 12, flexWrap: "wrap" }}>
            <Image
              src="assets/logo.png"
              width={72}
              height={72}
              fit="cover"
              borderRadius={16}
              onPress={() => void pushLog("image", "press assets/logo.png")}
            />
            <Image
              src={SMALL_PNG}
              width={72}
              height={72}
              fit="cover"
              borderRadius={16}
            />
            <Image
              src="assets/khong-ton-tai.png"
              width={72}
              height={72}
              fit="contain"
              borderRadius={16}
            />
          </Row>
          <Row style={{ gap: 12, flexWrap: "wrap" }}>
            {ICONS.map((name) => (
              <View
                key={name}
                style={{ width: 62, gap: 4, alignItems: "center" }}
              >
                <Icon name={name} size={22} color={colors.ink} />
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10, color: colors.muted }}
                >
                  {name}
                </Text>
              </View>
            ))}
          </Row>
        </Card>
      </Section>

      <Section
        title="Danh sách & cuộn"
        caption="ListView cửa sổ 12 mục, ScrollView ngang có onScroll, GridView 2 cột"
      >
        <Card style={{ gap: 12 }}>
          <View style={{ height: 190 }}>
            <ListView
              data={LIST_ITEMS}
              initialCount={12}
              style={{ flex: 1 }}
              keyExtractor={(item) => String(item.id)}
              renderItem={(item) => (
                <Row
                  style={{
                    justifyContent: "spaceBetween",
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {item.caption}
                  </Text>
                </Row>
              )}
            />
          </View>
          <ScrollView
            horizontal
            showsScrollIndicator={false}
            style={{ height: 44 }}
            onScroll={(event) => setScrollX(event.x)}
          >
            <Row style={{ gap: 8 }}>
              {TAGS.concat(TAGS).map((tag, index) => (
                <View
                  key={`${tag}-${index}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.pill,
                    backgroundColor:
                      index % 2 === 0 ? colors.soft : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{tag}</Text>
                </View>
              ))}
            </Row>
          </ScrollView>
          <Note>Cuộn ngang kết thúc ở x = {Math.round(scrollX)}</Note>
          <View style={{ height: 240 }}>
            <GridView
              data={GRID_ITEMS}
              numColumns={2}
              initialCount={8}
              style={{ flex: 1, gap: 10 }}
              renderItem={(item) => (
                <View
                  style={{
                    height: 74,
                    borderRadius: radius.sm,
                    backgroundColor: colors.soft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{item.label}</Text>
                </View>
              )}
            />
          </View>
          <TextField
            placeholder="TextField trần để kiểm tra tiêu điểm"
            onFocus={() => void pushLog("textfield", "focus")}
            onBlur={() => void pushLog("textfield", "blur")}
          />
        </Card>
      </Section>

      <SafeArea edges={["left", "right"]}>
        <Note>
          SafeArea ở đây chỉ áp cho hai cạnh trái/phải; NavBar và TabBar tự xử
          lý cạnh trên/dưới.
        </Note>
      </SafeArea>
    </ScreenShell>
  );
}

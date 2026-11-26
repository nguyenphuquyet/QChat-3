import { useState } from "@mna/qchat";
import { showToast } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Checkbox,
  Dialog,
  Divider,
  Image,
  NavBar,
  Positioned,
  Pressable,
  Row,
  ScrollView,
  Slider,
  Stack,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  CATEGORIES,
  DRINKS,
  cartCount,
  cartTotal,
  changeQty,
  lineNote,
  lineTitle,
  lineTotal,
  money,
  placeOrder,
  removeLine,
  useCart,
  usePrefs,
  addToCart,
} from "../store.js";
import type { CartLine, Drink } from "../store.js";
import { card, colors, heroFade, radius } from "../theme.js";
import { Card, Chip, EmptyState, QtyStepper, Section } from "../ui.js";

/**
 * Tab thực đơn: header trong suốt nằm trên ảnh bìa, rồi chuyển sang kính mờ và
 * cuối cùng là nền đặc khi cuộn. Ô tìm kiếm và bộ lọc là `bottom` của header nên
 * chúng thuộc về header chứ không phải nội dung.
 */
export function MenuScreen(props: { onOpenDrink: (id: string) => void }) {
  const cart = useCart();
  const prefs = usePrefs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [scrollY, setScrollY] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tip, setTip] = useState(0);
  const [points, setPoints] = useState(false);

  const surface =
    scrollY > 260 ? "solid" : scrollY > 110 ? "blur" : "transparent";
  const onImage = surface === "transparent";
  const count = cartCount(cart);
  const total = cartTotal(cart);
  const discount = points && total >= 60000 ? 12000 : 0;

  const needle = query.trim().toLowerCase();
  const list = DRINKS.filter((drink) => {
    const inCategory = category === "all" || drink.category === category;
    const matches =
      needle.length === 0 ||
      drink.name.toLowerCase().includes(needle) ||
      drink.note.toLowerCase().includes(needle);
    return inCategory && matches;
  });

  const quickAdd = (drink: Drink) => {
    addToCart({
      drinkId: drink.id,
      size: "M",
      sugar: prefs.sugar,
      extra: false,
    });
    void showToast(`Đã thêm ${drink.name}`, { icon: "success" });
  };

  const submit = () => {
    const order = placeOrder();
    setConfirm(false);
    setSheet(false);
    setTip(0);
    setPoints(false);
    if (order) {
      void showToast(`Đơn ${order.id} đang được pha`, { icon: "success" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack alignment="topLeft" style={{ flex: 1 }}>
        <ScrollView
          style={{ height: "100%" }}
          showsScrollIndicator={false}
          onScroll={(event) => setScrollY(event.y)}
        >
          {/* Ảnh bìa chạy dưới header trong suốt. */}
          <Stack style={{ height: 340 }}>
            <Image
              src="assets/hero.png"
              fit="cover"
              style={{ width: "100%", height: 340 }}
            />
            <View style={heroFade} />
            <Positioned left={18} right={18} bottom={20}>
              <View style={{ gap: 6 }}>
                <Text
                  style={{ fontSize: 26, fontWeight: "bold", color: "#ffffff" }}
                >
                  Cà phê nhà
                </Text>
                <Text style={{ fontSize: 13, color: "#f0dccb" }}>
                  Rang mộc mỗi sáng · giao trong 20 phút
                </Text>
                <Row style={{ gap: 8, marginTop: 6 }}>
                  <Tag tone="success" size="sm">
                    Đang mở · 07:00–21:00
                  </Tag>
                  <Tag tone="warning" size="sm">
                    4.9 ★ · 312 đánh giá
                  </Tag>
                </Row>
              </View>
            </Positioned>
          </Stack>

          <View style={{ padding: 16, gap: 18 }}>
            <Section
              title="Món nổi bật"
              caption="Chạm để xem chi tiết và chọn cỡ ly"
            >
              <ScrollView
                horizontal
                showsScrollIndicator={false}
                style={{ height: 208 }}
              >
                <Row style={{ gap: 12, paddingRight: 16 }}>
                  {DRINKS.slice(0, 3).map((drink) => (
                    <FeaturedCard
                      key={drink.id}
                      drink={drink}
                      onPress={() => props.onOpenDrink(drink.id)}
                    />
                  ))}
                </Row>
              </ScrollView>
            </Section>

            <Section
              title="Thực đơn"
              caption={`${list.length} món · giá đã gồm VAT`}
              right={
                <Text style={{ fontSize: 12, color: colors.brand }}>
                  {category === "all" ? "Tất cả" : CATEGORIES.find((c) => c.key === category)?.label}
                </Text>
              }
            >
              {list.length === 0 ? (
                <Card>
                  <EmptyState
                    title="Không tìm thấy món"
                    caption="Thử từ khoá khác, ví dụ “trà” hoặc “bạc xỉu”."
                  />
                </Card>
              ) : (
                <View style={{ gap: 10 }}>
                  {list.map((drink) => (
                    <DrinkRow
                      key={drink.id}
                      drink={drink}
                      onPress={() => props.onOpenDrink(drink.id)}
                      onAdd={() => quickAdd(drink)}
                    />
                  ))}
                </View>
              )}
            </Section>

            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Cà Phê Nhà · 12 Nguyễn Huệ, Quận 1
              </Text>
            </View>
          </View>
        </ScrollView>

        {count > 0 ? (
          <Positioned left={16} right={16} bottom={16}>
            <Pressable
              onPress={() => setSheet(true)}
              accessibleLabel={`Giỏ hàng, ${count} món`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: radius.pill,
                backgroundColor: colors.ink,
                boxShadow: {
                  color: "#33000000",
                  offsetX: 0,
                  offsetY: 6,
                  blurRadius: 18,
                },
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.brand,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "bold", color: "#ffffff" }}
                >
                  {String(count)}
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#ffffff", flex: 1 }}
              >
                Giỏ hàng
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: "#ffffff" }}>
                {money(total)}
              </Text>
            </Pressable>
          </Positioned>
        ) : null}

        <BottomSheet
          visible={sheet}
          height={560}
          onClose={() => setSheet(false)}
        >
          <View style={{ padding: 18, gap: 14 }}>
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}>
                Giỏ hàng
              </Text>
              <Pressable onPress={() => setSheet(false)} accessibleLabel="Đóng">
                <Text style={{ fontSize: 13, color: colors.muted }}>Đóng</Text>
              </Pressable>
            </Row>

            <View style={{ gap: 12 }}>
              {cart.map((line) => (
                <CartRow key={line.key} line={line} />
              ))}
            </View>

            <Divider />

            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 13, color: colors.ink }}>
                  Tip cho quán
                </Text>
                <Text style={{ fontSize: 13, color: colors.brand }}>
                  {tip === 0 ? "Không" : money(tip)}
                </Text>
              </Row>
              <Slider
                value={tip}
                min={0}
                max={20000}
                step={5000}
                onChange={(event) => setTip(event.value)}
              />
            </View>

            <Checkbox
              checked={points}
              label="Dùng 120 điểm · giảm 12.000đ (đơn từ 60.000đ)"
              onChange={(event) => setPoints(event.value)}
            />

            <Divider />

            <View style={{ gap: 4 }}>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Tạm tính</Text>
                <Text style={{ fontSize: 13, color: colors.ink }}>
                  {money(total)}
                </Text>
              </Row>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Tip</Text>
                <Text style={{ fontSize: 13, color: colors.ink }}>
                  {money(tip)}
                </Text>
              </Row>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>Điểm</Text>
                <Text style={{ fontSize: 13, color: colors.green }}>
                  −{money(discount)}
                </Text>
              </Row>
              <Row style={{ justifyContent: "spaceBetween", marginTop: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
                  Tổng
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.brand }}>
                  {money(total + tip - discount)}
                </Text>
              </Row>
            </View>

            <Button onPress={() => setConfirm(true)} disabled={cart.length === 0}>
              {`Đặt hàng · ${money(total + tip - discount)}`}
            </Button>
          </View>
        </BottomSheet>

        <Dialog
          visible={confirm}
          title="Gửi đơn cho quán?"
          confirmText="Gửi đơn"
          cancelText="Xem lại"
          onClose={() => setConfirm(false)}
          onConfirm={submit}
        >
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {`${count} món · ${money(total + tip - discount)} · quán xác nhận trong 2 phút.`}
          </Text>
        </Dialog>

        <NavBar
          title="Cà Phê Nhà"
          transparent={onImage}
          blur={surface === "blur"}
          style={{ color: onImage ? "#ffffff" : colors.ink }}
        >
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
            <TextField
              value={query}
              placeholder="Tìm món, ví dụ: bạc xỉu"
              onInput={setQuery}
              style={{
                backgroundColor: onImage ? "#f2ffffff" : colors.surface,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: onImage ? "#33ffffff" : colors.line,
              }}
            />
            <Row style={{ gap: 8, flexWrap: "wrap" }}>
              {CATEGORIES.map((entry) => (
                <Chip
                  key={entry.key}
                  label={entry.label}
                  active={category === entry.key}
                  onPress={() => setCategory(entry.key)}
                />
              ))}
            </Row>
          </View>
        </NavBar>
      </Stack>
    </View>
  );
}

function FeaturedCard(props: {
  key?: string | number;
  drink: Drink;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.drink.name}
      style={{ ...card, width: 170, padding: 10 }}
    >
      <Image
        src={props.drink.image}
        fit="cover"
        style={{ width: "100%", height: 108, borderRadius: radius.sm }}
      />
      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
        >
          {props.drink.name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
          {props.drink.note}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "bold", color: colors.brand }}>
          {money(props.drink.price)}
        </Text>
      </View>
    </Pressable>
  );
}

function DrinkRow(props: {
  key?: string | number;
  drink: Drink;
  onPress: () => void;
  onAdd: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.drink.name}
      style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <Image
        src={props.drink.image}
        fit="cover"
        style={{ width: 64, height: 64, borderRadius: radius.sm }}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Row style={{ gap: 6, alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
          >
            {props.drink.name}
          </Text>
          {props.drink.tag ? (
            <Tag tone={props.drink.tone ?? "neutral"} size="sm">
              {props.drink.tag}
            </Tag>
          ) : null}
        </Row>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
          {props.drink.note}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "bold", color: colors.brand }}>
          {money(props.drink.price)}
        </Text>
      </View>
      <Pressable
        onPress={props.onAdd}
        accessibleLabel={`Thêm ${props.drink.name} vào giỏ`}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cream,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.brand }}>
          +
        </Text>
      </Pressable>
    </Pressable>
  );
}

function CartRow(props: { key?: string | number; line: CartLine }) {
  const drink = DRINKS.find((entry) => entry.id === props.line.drinkId);
  return (
    <Row style={{ gap: 10, alignItems: "center" }}>
      {drink ? (
        <Image
          src={drink.image}
          fit="cover"
          style={{ width: 44, height: 44, borderRadius: 8 }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
        >
          {lineTitle(props.line)}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>
          {lineNote(props.line)}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "bold", color: colors.brand }}>
          {money(lineTotal(props.line))}
        </Text>
      </View>
      <View style={{ alignItems: "end", gap: 6 }}>
        <QtyStepper
          qty={props.line.qty}
          onMinus={() => changeQty(props.line.key, -1)}
          onPlus={() => changeQty(props.line.key, 1)}
        />
        <Pressable
          onPress={() => removeLine(props.line.key)}
          accessibleLabel={`Bỏ ${lineTitle(props.line)}`}
        >
          <Text style={{ fontSize: 11, color: colors.muted }}>Bỏ</Text>
        </Pressable>
      </View>
    </Row>
  );
}

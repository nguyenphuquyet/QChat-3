import { useState } from "@mna/qchat";
import { navigateBack, showToast } from "@mna/qchat";
import {
  Button,
  Checkbox,
  Divider,
  Image,
  NavBar,
  Pressable,
  RichText,
  Row,
  Slider,
  Stack,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  EXTRA_PRICE,
  SIZES,
  SUGAR_STEPS,
  addToCart,
  drinkById,
  money,
  sizeExtra,
  usePrefs,
} from "../store.js";
import type { CartLine } from "../store.js";
import { colors, radius } from "../theme.js";
import { Card, EmptyState, QtyStepper, ScreenShell, Section } from "../ui.js";

/** Route `/drink/<id>`: một màn hình chi tiết mở bằng host router. */
export function DrinkScreen(props: { drinkId: string; onBack: () => void }) {
  const drink = drinkById(props.drinkId);
  const prefs = usePrefs();
  const [size, setSize] = useState<CartLine["size"]>("M");
  const [sugar, setSugar] = useState(prefs.sugar);
  const [extra, setExtra] = useState(false);
  const [qty, setQty] = useState(1);

  const back = () => {
    void navigateBack().catch(() => {
      // A preview host may not own a route stack; the app still closes the page.
    });
    props.onBack();
  };

  if (!drink) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavBar title="Không tìm thấy món" showBack onBack={back} />
        <Card style={{ margin: 16 }}>
          <EmptyState
            title="Món này không còn"
            caption="Quay lại thực đơn để chọn món khác."
            action={
              <Button variant="secondary" onPress={back}>
                Về thực đơn
              </Button>
            }
          />
        </Card>
      </View>
    );
  }

  const unit = drink.price + sizeExtra(size) + (extra ? EXTRA_PRICE : 0);
  const total = unit * qty;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title={drink.name}
        subtitle={`${drink.kcal} kcal · ${money(drink.price)}`}
        showBack
        onBack={back}
      />

      <ScreenShell>
        <Stack style={{ height: 240, borderRadius: radius.lg, overflow: "hidden" }}>
          <Image
            src={drink.image}
            fit="cover"
            style={{ width: "100%", height: 240 }}
          />
          <View style={{ position: "absolute", left: 14, top: 14 }}>
            {drink.tag ? (
              <Tag tone={drink.tone ?? "neutral"}>{drink.tag}</Tag>
            ) : null}
          </View>
        </Stack>

        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.ink }}>
              {drink.name}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.brand }}>
              {money(drink.price)}
            </Text>
          </Row>
          <RichText style={{ fontSize: 13, lineHeight: 20, color: colors.muted }}>
            <Text style={{ fontWeight: "bold", color: colors.ink }}>
              {drink.note}.
            </Text>{" "}
            Pha theo yêu cầu, khuấy đều trước khi uống. Món có{" "}
            {String(drink.kcal)} kcal, phù hợp cho một buổi sáng nhẹ.
          </RichText>
          <Row style={{ gap: 8, flexWrap: "wrap" }}>
            <Tag tone="neutral" size="sm">
              Rang mộc
            </Tag>
            <Tag tone="success" size="sm">
              Không chất bảo quản
            </Tag>
            <Tag tone="info" size="sm">
              Giao 20 phút
            </Tag>
          </Row>
        </Card>

        <Section title="Cỡ ly" caption="Giá cộng thêm theo dung tích">
          <Row style={{ gap: 10 }}>
            {SIZES.map((entry) => {
              const active = size === entry.key;
              return (
                <Pressable
                  key={entry.key}
                  onPress={() => setSize(entry.key)}
                  accessibleLabel={entry.label}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 2,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.cream : colors.surface,
                    borderWidth: 1.5,
                    borderColor: active ? colors.brand : colors.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "bold",
                      color: active ? colors.brand : colors.ink,
                    }}
                  >
                    {entry.key}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.muted }}>
                    {entry.extra === 0 ? "Giá gốc" : `+${money(entry.extra)}`}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </Section>

        <Section
          title="Mức đường"
          caption="0% là không đường, 100% là ngọt đậm"
          right={
            <Text style={{ fontSize: 12, color: colors.brand }}>{`${sugar}%`}</Text>
          }
        >
          <Card style={{ gap: 8 }}>
            <Slider
              value={sugar}
              min={0}
              max={100}
              step={25}
              onChange={(event) => setSugar(event.value)}
            />
            <Row style={{ justifyContent: "spaceBetween" }}>
              {SUGAR_STEPS.map((step) => (
                <Text
                  key={`sugar-${step}`}
                  style={{
                    fontSize: 10,
                    color: sugar === step ? colors.brand : colors.muted,
                  }}
                >
                  {`${step}%`}
                </Text>
              ))}
            </Row>
          </Card>
        </Section>

        <Section title="Thêm vào">
          <Card style={{ gap: 12 }}>
            <Checkbox
              checked={extra}
              label={`Thêm shot espresso · +${money(EXTRA_PRICE)}`}
              onChange={(event) => setExtra(event.value)}
            />
            <Divider />
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <Text style={{ fontSize: 14, color: colors.ink }}>Số lượng</Text>
              <QtyStepper
                qty={qty}
                onMinus={() => setQty(Math.max(1, qty - 1))}
                onPlus={() => setQty(qty + 1)}
              />
            </Row>
          </Card>
        </Section>

        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: "spaceBetween" }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {`${money(unit)} × ${qty}`}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.ink }}>
              {money(total)}
            </Text>
          </Row>
          <Button
            icon="check"
            onPress={() => {
              addToCart({
                drinkId: drink.id,
                size,
                sugar,
                extra,
                qty,
              });
              void showToast(`Đã thêm ${qty} × ${drink.name}`, {
                icon: "success",
              });
              back();
            }}
          >
            Thêm vào giỏ
          </Button>
        </Card>

        <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
          Giá đã gồm VAT · huỷ miễn phí trước khi quán pha xong
        </Text>
      </ScreenShell>
    </View>
  );
}

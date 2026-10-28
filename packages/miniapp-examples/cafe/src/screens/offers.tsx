import { useEffect, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat";
import {
  Badge,
  Button,
  CustomPaint,
  Divider,
  Icon,
  NavBar,
  Pressable,
  Row,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import { claimVoucher, countdown, money, useVouchers } from "../store.js";
import { card, colors, radius } from "../theme.js";
import { Card, Section, ScreenShell } from "../ui.js";

interface Voucher {
  code: string;
  title: string;
  detail: string;
  amount: number;
  tone: "success" | "warning" | "info";
}

const VOUCHERS: Voucher[] = [
  {
    code: "NHA20",
    title: "Giảm 20% toàn menu",
    detail: "Đơn từ 60.000đ · tối đa 30.000đ",
    amount: 20000,
    tone: "success",
  },
  {
    code: "FREESHIP",
    title: "Miễn phí giao hàng",
    detail: "Bán kính 3 km · mọi khung giờ",
    amount: 15000,
    tone: "info",
  },
  {
    code: "BANHMOI",
    title: "Tặng 1 croissant bơ",
    detail: "Khi mua từ 2 ly · trong tuần này",
    amount: 29000,
    tone: "warning",
  },
];

const ENDS_AT = Date.now() + 3 * 60 * 60 * 1000;

/**
 * Tab ưu đãi: đồng hồ đếm ngược, mã giảm giá lưu vào storage và thẻ tem.
 * Header đặc, không có phần dưới, để so sánh với hai tab kia.
 */
export function OffersScreen(props: { onGoMenu: () => void }) {
  const claimed = useVouchers();
  const [left, setLeft] = useState(ENDS_AT - Date.now());

  useEffect(() => {
    const timer = setInterval(() => setLeft(ENDS_AT - Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Ưu đãi"
        subtitle="Quà của quán, làm mới mỗi tuần"
        style={{ backgroundColor: colors.surface }}
      />

      <ScreenShell>
        <View style={{ gap: 18 }}>
          <View
            style={{
              borderRadius: radius.lg,
              padding: 18,
              gap: 10,
              gradient: {
                type: "linear",
                angle: 135,
                stops: [
                  { offset: 0, color: colors.brandDark },
                  { offset: 1, color: colors.brand },
                ],
              },
            }}
          >
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <Row style={{ gap: 6, alignItems: "center" }}>
                <Icon name="clock" size={16} color="#ffe6cf" />
                <Text style={{ fontSize: 12, color: "#ffe6cf" }}>
                  Flash sale kết thúc sau
                </Text>
              </Row>
              <Badge count={2} tone="danger">
                <Icon name="gift" size={20} color="#ffffff" />
              </Badge>
            </Row>
            <Text style={{ fontSize: 30, fontWeight: "bold", color: "#ffffff" }}>
              {countdown(left)}
            </Text>
            <Text style={{ fontSize: 12, color: "#f7d8bd" }}>
              Giảm 20% cho mọi món cà phê, áp dụng tới 21:00.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              icon="ticketPercent"
              onPress={props.onGoMenu}
            >
              Xem món đang giảm
            </Button>
          </View>

          <Section title="Mã của bạn" caption="Lưu mã rồi dùng ở bước thanh toán">
            <View style={{ gap: 10 }}>
              {VOUCHERS.map((voucher) => (
                <VoucherCard
                  key={voucher.code}
                  voucher={voucher}
                  claimed={claimed.includes(voucher.code)}
                  onClaim={() => {
                    claimVoucher(voucher.code);
                    void showToast(`Đã lưu mã ${voucher.code}`, {
                      icon: "success",
                    });
                  }}
                />
              ))}
            </View>
          </Section>

          <Section
            title="Thẻ tem"
            caption="Mua 8 ly, tặng 1 ly bất kỳ"
            right={
              <Text style={{ fontSize: 12, color: colors.brand }}>
                5/8 tem
              </Text>
            }
          >
            <Card style={{ gap: 12 }}>
              <Row style={{ gap: 8, flexWrap: "wrap" }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                  <View
                    key={`stamp-${index}`}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        index < 5 ? colors.brand : colors.soft,
                      borderWidth: 1,
                      borderColor: index < 5 ? colors.brand : colors.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: index < 5 ? "#ffffff" : colors.muted,
                      }}
                    >
                      {index < 5 ? "✓" : "·"}
                    </Text>
                  </View>
                ))}
              </Row>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.soft,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 6,
                    width: "62%",
                    borderRadius: 3,
                    backgroundColor: colors.brand,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Còn 3 ly nữa để nhận ly miễn phí. Tem được cộng khi đơn hoàn tất.
              </Text>
            </Card>
          </Section>

          <Section
            title="Bạn uống gì nhiều nhất?"
            caption="Số ly 7 ngày gần đây · vẽ bằng CustomPaint"
          >
            <Card>
              <CustomPaint
                draw="stroke:#c2703d strokeWidth:3 cap:round M 8 68 L 58 44 L 108 56 L 158 28 L 208 38 L 258 14"
                style={{ height: 84 }}
              />
              <Row style={{ justifyContent: "spaceBetween" }}>
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                  <Text key={day} style={{ fontSize: 10, color: colors.muted }}>
                    {day}
                  </Text>
                ))}
              </Row>
              <Divider />
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Trung bình 1,7 ly/ngày
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "bold", color: colors.brand }}>
                  {money(214000)}
                </Text>
              </Row>
            </Card>
          </Section>
        </View>
      </ScreenShell>
    </View>
  );
}

function VoucherCard(props: {
  key?: string | number;
  voucher: Voucher;
  claimed: boolean;
  onClaim: () => void;
}) {
  return (
    <View
      style={{
        ...card,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: 6,
          alignSelf: "stretch",
          backgroundColor:
            props.voucher.tone === "success"
              ? colors.green
              : props.voucher.tone === "info"
                ? colors.ink
                : colors.amber,
        }}
      />
      <View style={{ flex: 1, gap: 4, paddingVertical: 14 }}>
        <Row style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
            {props.voucher.title}
          </Text>
          <Tag tone={props.voucher.tone} size="sm">
            {props.voucher.code}
          </Tag>
        </Row>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {props.voucher.detail}
        </Text>
        <Text style={{ fontSize: 12, color: colors.brand }}>
          {`Tiết kiệm tới ${money(props.voucher.amount)}`}
        </Text>
      </View>
      <View style={{ paddingRight: 14 }}>
        {props.claimed ? (
          <Row style={{ gap: 4, alignItems: "center" }}>
            <Icon name="check" size={16} color={colors.green} />
            <Text style={{ fontSize: 12, color: colors.green }}>Đã lưu</Text>
          </Row>
        ) : (
          <Pressable
            onPress={props.onClaim}
            accessibleLabel={`Lưu mã ${props.voucher.code}`}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
              backgroundColor: colors.cream,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand }}>
              Lưu mã
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

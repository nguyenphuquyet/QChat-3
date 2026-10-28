import { share, showToast } from "@mna/qchat";
import {
  Button,
  Icon,
  NavBar,
  Page,
  Row,
  ScrollView,
  Text,
  View,
} from "@mna/qchat/ui";
import { colors, radius } from "../theme.js";
import { Card, SectionHeader } from "../ui.js";

const FEATURES: ReadonlyArray<readonly [string, string, string]> = [
  [
    "check",
    "Một chỗ cho mọi việc",
    "Bốn tab: Hôm nay, Kế hoạch, Thói quen và Tôi. Việc gấp nằm ngay trên cùng.",
  ],
  [
    "grid",
    "Kế hoạch nhìn được cả tuần",
    "Chọn từng ngày, đặt mục tiêu tuần và xem thanh tiến độ cập nhật ngay.",
  ],
  [
    "heart",
    "Thói quen có chuỗi ngày",
    "Mỗi thói quen một vòng tiến độ riêng; chạm một lần là ghi nhận hôm nay.",
  ],
  [
    "official",
    "Ghi chú đi cùng việc",
    "Mở chi tiết để thêm ghi chú, chia sẻ hoặc xoá — tất cả đều lưu trên máy.",
  ],
  [
    "share",
    "Chia sẻ tiến độ",
    "Gửi một dòng ngắn về số việc và chuỗi ngày cho bạn bè qua QChat.",
  ],
];

/**
 * Route `/about`: một trang giới thiệu tĩnh, không đụng tới store. Dùng để
 * thấy `NavBar.showBack` + `ScrollView` mà không cần dữ liệu.
 */
export function AboutScreen(props: { onBack: () => void }) {
  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Giới thiệu"
          subtitle="Sổ Việc · 1.0.0"
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 30,
            gap: 16,
          }}
        >
          <Card style={{ alignItems: "center", gap: 10, paddingVertical: 22 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={30} color={colors.white} />
            </View>
            <Text
              style={{ fontSize: 22, fontWeight: "bold", color: colors.ink }}
            >
              Sổ Việc
            </Text>
            <Text
              style={{
                fontSize: 12.5,
                color: colors.muted,
                textAlign: "center",
                lineHeight: 19,
                paddingHorizontal: 12,
              }}
            >
              Một cuốn sổ nhỏ cho việc hằng ngày và những thói quen muốn giữ.
              Không tài khoản, không quảng cáo — mọi thứ nằm trên máy của bạn.
            </Text>
            <Text style={{ fontSize: 10.5, color: colors.muted }}>
              QChat Mini App · phiên bản 1.0.0
            </Text>
          </Card>

          <SectionHeader
            title="Bạn có thể làm gì?"
            note="Mọi tính năng đều chạy trong Mini App"
          />
          <View style={{ gap: 10 }}>
            {FEATURES.map(([icon, title, caption]) => (
              <Row
                key={title}
                style={{
                  alignItems: "start",
                  gap: 12,
                  padding: 13,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
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
                  <Icon name={icon} size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.ink,
                    }}
                  >
                    {title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: colors.muted,
                      lineHeight: 17,
                    }}
                  >
                    {caption}
                  </Text>
                </View>
              </Row>
            ))}
          </View>

          <SectionHeader title="Dữ liệu của bạn" />
          <Card style={{ gap: 10 }}>
            <Row style={{ alignItems: "start", gap: 10 }}>
              <Icon name="lock" size={17} color={colors.brand} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.muted,
                }}
              >
                Việc, ghi chú và dấu thói quen được lưu trong namespace riêng
                của Sổ Việc. Gỡ Mini App là dữ liệu đi theo. Bạn có thể xoá tất
                cả bất cứ lúc nào ở tab Tôi.
              </Text>
            </Row>
            <Button
              variant="secondary"
              icon="share"
              testID="share-about"
              onPress={() => {
                void share({
                  title: "Sổ Việc",
                  text: "Một cuốn sổ nhỏ cho việc hằng ngày và thói quen — thử Sổ Việc trên QChat nhé.",
                })
                  .then((shared) => {
                    void showToast(
                      shared ? "Đã mở bảng chia sẻ" : "Chưa chia sẻ được",
                      { icon: shared ? "success" : "error" },
                    );
                  })
                  .catch(() => {
                    void showToast("Chưa chia sẻ được", { icon: "error" });
                  });
              }}
            >
              Mời bạn bè dùng thử
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
            Vẽ bằng QChat Design System · điều khiển và chuyển động theo chuẩn
            iOS
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

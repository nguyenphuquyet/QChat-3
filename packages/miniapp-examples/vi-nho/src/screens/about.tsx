import {
  getAppInfo,
  share,
  showToast,
  useEffect,
  useState,
} from "@mna/qchat";
import type { AppInfo } from "@mna/qchat";
import {
  Button,
  Divider,
  Icon,
  NavBar,
  Page,
  Row,
  ScrollView,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import { colors, radius, screenPad } from "../theme.js";
import { Card, SectionHeader } from "../ui.js";

interface Feature {
  icon: string;
  title: string;
  caption: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: "wallet",
    title: "Ngân sách tháng",
    caption: "Một thanh trượt cho tổng ngân sách, sáu hạn mức theo nhóm.",
  },
  {
    icon: "file",
    title: "Sổ giao dịch",
    caption: "Tìm kiếm, lọc thu chi, tải từng trang và xoá hàng loạt.",
  },
  {
    icon: "check",
    title: "Đối chiếu",
    caption: "Đánh dấu khoản đã khớp hoá đơn, ghi chú nhiều dòng.",
  },
  {
    icon: "grid",
    title: "Bộ điều khiển",
    caption: "Một route riêng bày đủ mười một control TDesign.",
  },
];

const HOST_CALLS: readonly { method: string; note: string }[] = [
  { method: "getUserInfo", note: "Tên và ảnh đại diện ở tab Tôi" },
  { method: "setStorage", note: "Snapshot của ví, namespace `vi-nho`" },
  { method: "showToast", note: "Xác nhận thêm, lưu và xoá" },
  { method: "share", note: "Chia sẻ tổng kết tháng" },
  { method: "navigateTo / navigateBack", note: "Hai route nội bộ" },
];

/**
 * Route `/about`: giới thiệu Ví Nhỏ, những gì app làm và các host API đã dùng.
 * Màn hình nhỏ này cũng là nơi kiểm tra `getAppInfo` và `share`.
 */
export function AboutScreen(props: {
  onBack: () => void;
  onOpenGallery: () => void;
}) {
  const [app, setApp] = useState<AppInfo | null>(null);

  useEffect(() => {
    let alive = true;
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

  const shareApp = () => {
    void share({
      title: "Ví Nhỏ",
      text: "Ví Nhỏ — Mini App quản lý chi tiêu mẫu của QChat, dùng TDesign cho mọi control.",
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

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Về Ví Nhỏ"
          subtitle={app ? `Phiên bản ${app.version}` : "Mini App mẫu"}
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  backgroundColor: colors.brand,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="wallet" size={27} color={colors.white} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: "bold",
                    color: colors.ink,
                  }}
                >
                  Ví Nhỏ
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Ghi chi tiêu, giữ hạn mức, hiểu tháng của mình.
                </Text>
              </View>
              <Tag tone="info" size="sm">
                {app ? `v${app.version}` : "v1.0.0"}
              </Tag>
            </Row>
            <Divider color={colors.line} />
            <Text style={{ fontSize: 12.5, lineHeight: 19, color: colors.ink }}>
              Ví Nhỏ là một Mini App hoàn chỉnh viết bằng TSX trên hợp đồng
              QChat: bốn tab, hai route nội bộ, bottom sheet, dialog, lưu trữ
              cục bộ và một route bày đủ bộ điều khiển TDesign.
            </Text>
            <Row style={{ gap: 7, flexWrap: "wrap" }}>
              <Tag tone="neutral" size="sm">
                TSX
              </Tag>
              <Tag tone="neutral" size="sm">
                TDesign
              </Tag>
              <Tag tone="success" size="sm">
                Storage
              </Tag>
              <Tag tone="info" size="sm">
                Intl
              </Tag>
            </Row>
          </Card>

          <SectionHeader
            title="Có gì trong ví"
            note="Bốn phần chính của app"
          />
          {FEATURES.map((feature) => (
            <Card key={feature.title} style={{ gap: 8 }}>
              <Row style={{ alignItems: "center", gap: 11 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: colors.brandSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={feature.icon} size={19} color={colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: colors.ink,
                    }}
                  >
                    {feature.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.muted }}>
                    {feature.caption}
                  </Text>
                </View>
              </Row>
            </Card>
          ))}

          <SectionHeader
            title="Host API"
            note="Những gì app gọi ra ngoài khung Mini App"
          />
          <Card style={{ gap: 0 }}>
            {HOST_CALLS.map((call, index) => (
              <View key={call.method}>
                <View style={{ gap: 4, paddingVertical: 10 }}>
                  <Row style={{ alignItems: "center", gap: 8 }}>
                    <Tag tone="info" size="sm">
                      {call.method}
                    </Tag>
                  </Row>
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    {call.note}
                  </Text>
                </View>
                {index < HOST_CALLS.length - 1 ? (
                  <Divider color={colors.line} />
                ) : null}
              </View>
            ))}
          </Card>

          <Card
            style={{
              gap: 9,
              padding: 13,
              borderRadius: radius.md,
              backgroundColor: colors.brandSoft,
              borderColor: "#cfe0ff",
            }}
          >
            <Text
              style={{ fontSize: 12.5, fontWeight: "600", color: colors.brand }}
            >
              Thử bộ điều khiển
            </Text>
            <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.muted }}>
              Mọi control TDesign trong app đều đi qua một file duy nhất của
              runtime. Route này cho thấy chúng ở đủ trạng thái.
            </Text>
            <Button
              variant="outline"
              icon="grid"
              onPress={props.onOpenGallery}
              testID="about-gallery"
            >
              Mở bộ điều khiển
            </Button>
          </Card>

          <Button
            variant="secondary"
            icon="share"
            onPress={shareApp}
            testID="share-about"
          >
            Chia sẻ Ví Nhỏ
          </Button>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Dữ liệu chỉ nằm trên thiết bị này. Không có ngân hàng, thẻ hay ví
            điện tử nào được kết nối.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

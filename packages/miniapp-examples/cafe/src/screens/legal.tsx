import { navigateBack } from "@mna/qchat";
import {
  Divider,
  Link,
  NavBar,
  RichText,
  Row,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import { colors } from "../theme.js";
import { Card, ScreenShell } from "../ui.js";

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "1. Đặt hàng",
    body:
      "Giá hiển thị đã gồm VAT. Đơn được quán xác nhận trong 2 phút; trước khi quán pha xong bạn có thể huỷ mà không mất phí. Sau khi pha, đơn không huỷ được.",
  },
  {
    title: "2. Giao hàng",
    body:
      "Bán kính 3 km, thời gian trung bình 20 phút. Trời mưa có thể lâu hơn; app sẽ báo khi tài xế nhận đơn.",
  },
  {
    title: "3. Dữ liệu",
    body:
      "Mini App chỉ lưu giỏ hàng, tuỳ chọn và mã giảm giá vào storage riêng của ứng dụng trên máy bạn. Không có token QChat nào được gửi cho quán.",
  },
];

/**
 * Route `/legal`: trang nội bộ thứ hai. Nó kiểm tra `showBack`, `RichText` nhiều
 * đoạn và `Link` nội bộ (đi qua host router, không mở app khác).
 */
export function LegalScreen(props: { onBack: () => void }) {
  const back = () => {
    void navigateBack().catch(() => {
      // Preview hosts without a route stack still close the page.
    });
    props.onBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar title="Điều khoản" subtitle="Cập nhật 12/10/2026" showBack onBack={back} />

      <ScreenShell>
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 8, alignItems: "center" }}>
            <Tag tone="info" size="sm">
              Bản 1.0
            </Tag>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Áp dụng cho Mini App Cà Phê Nhà
            </Text>
          </Row>
          <RichText style={{ fontSize: 13, lineHeight: 21, color: colors.ink }}>
            Trang này là một <Text style={{ fontWeight: "bold" }}>route nội bộ</Text>{" "}
            của Mini App. Host mở nó bằng router của QChat, không phải bằng một
            WebView, nên nút back của hệ thống vẫn đóng đúng trang.
          </RichText>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title} style={{ gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
              {section.title}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 21, color: colors.muted }}>
              {section.body}
            </Text>
          </Card>
        ))}

        <Card style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
            Đi tiếp
          </Text>
          <Link href="/drink/ca-phe-sua">Xem món bán chạy nhất</Link>
          <Divider />
          <Link href="https://qchat.vn" external>
            qchat.vn (liên kết ngoài, host chỉ báo lại)
          </Link>
        </Card>

        <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>
          Cà Phê Nhà · 12 Nguyễn Huệ, Quận 1, TP.HCM
        </Text>
      </ScreenShell>
    </View>
  );
}

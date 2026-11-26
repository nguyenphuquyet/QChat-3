import { NavBar, ScrollView, Text, View } from "@mna/qchat/ui";
import { colors } from "../theme.js";
import { Card, Label, Section } from "../ui.js";

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "1. Đặt vé và thanh toán",
    body: "Giá vé hiển thị trên Mini App đã gồm VAT và phụ thu định dạng (2D, 3D, IMAX). Ghế VIP ở hàng E và F có phụ thu 30.000đ mỗi ghế. Đơn vé chỉ được giữ khi bạn hoàn tất thanh toán; hệ thống không giữ ghế trước cho bất kỳ phương thức nào.",
  },
  {
    title: "2. Huỷ vé và hoàn tiền",
    body: "Bạn có thể huỷ vé trong trang Vé điện tử trước suất chiếu 2 giờ. Tiền được hoàn về phương thức đã dùng trong 24 giờ làm việc. Vé đã soát, vé của suất chiếu đặc biệt và combo bắp nước đã nhận không được hoàn.",
  },
  {
    title: "3. Độ tuổi và giấy tờ",
    body: "Rạp kiểm tra độ tuổi theo nhãn P, K, T13, T16 và T18. Khán giả dưới tuổi quy định có thể bị từ chối vào phòng chiếu mà không được hoàn tiền. Vui lòng mang giấy tờ tuỳ thân khi xem phim T16 hoặc T18.",
  },
  {
    title: "4. Dữ liệu cá nhân",
    body: "Rạp Phố chỉ đọc tên hiển thị và mã QChat để in tên trên vé điện tử. Lịch sử vé, phim yêu thích và cài đặt thông báo được lưu trên thiết bị của bạn. Bạn có thể xoá dữ liệu này bằng cách xoá Mini App khỏi QChat.",
  },
  {
    title: "5. Liên hệ",
    body: "Hotline 1900 6789, từ 08:00 đến 22:00 mỗi ngày. Địa chỉ rạp: 12 Nguyễn Huệ, Quận 1, TP.HCM. Khiếu nại về chất lượng suất chiếu được tiếp nhận trong 7 ngày kể từ ngày xem.",
  },
];

/** Trang điều khoản, mở từ tab Tôi. Route `/legal`. */
export function LegalScreen(props: { onBack: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Điều khoản"
        showBack
        onBack={props.onBack}
        style={{ backgroundColor: colors.bg, color: colors.ink }}
      />
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={{ padding: 16, gap: 18, paddingBottom: 40 }}>
          <View style={{ gap: 6 }}>
            <Label>Rạp Phố · cập nhật 01/10/2025</Label>
            <Text
              style={{ fontSize: 22, fontWeight: "bold", color: colors.ink }}
            >
              Điều khoản & quyền riêng tư
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
              Bằng việc đặt vé trên Rạp Phố, bạn đồng ý với các điều khoản dưới
              đây. Chính sách có thể thay đổi; phiên bản mới sẽ hiện trong Mini
              App trước khi áp dụng.
            </Text>
          </View>

          <Section title="Tóm tắt nhanh">
            <Card style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>
                · Huỷ vé trước 2 giờ, hoàn trong 24 giờ.
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>
                · Mang giấy tờ khi xem phim T16 hoặc T18.
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>
                · Combo đã nhận không hoàn tiền.
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.ink }}>
                · Dữ liệu vé chỉ lưu trên thiết bị.
              </Text>
            </Card>
          </Section>

          {SECTIONS.map((entry) => (
            <View key={entry.title} style={{ gap: 6 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
              >
                {entry.title}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 19, color: "#b9bfcd" }}>
                {entry.body}
              </Text>
            </View>
          ))}

          <Card style={{ gap: 4 }}>
            <Label>Ghi chú</Label>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
              Đây là Mini App mẫu trong bộ ví dụ của QChat. Rạp Phố, giá vé và
              các suất chiếu đều là dữ liệu giả lập dùng để trình diễn giao diện.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

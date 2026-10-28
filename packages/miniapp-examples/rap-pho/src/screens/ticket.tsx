import { share, showToast, useState } from "@mna/qchat";import {
  CustomPaint,
  Dialog,
  Icon,
  NavBar,
  Positioned,
  Pressable,
  Row,
  ScrollView,
  Stack,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  cancelTicket,
  codeHash,
  money,
  movieById,
  shortDay,
  useTickets,
} from "../store.js";
import type { TicketStatus } from "../store.js";
import { colors, radius } from "../theme.js";
import { Card, EmptyState, InfoRow, Label } from "../ui.js";

/* ------------------------------------------------------------------ */
/* Mã QR: 21×21 ô, ba ô định vị ở góc, phần còn lại băm từ mã vé.      */
/* ------------------------------------------------------------------ */

const QR_SIZE = 21;
const QR_CELL = 7;
const QR_MARGIN = 16;
const QR_SIDE = QR_MARGIN * 2 + QR_SIZE * QR_CELL;

function qrRect(row: number, column: number, span: number): string {
  const x = QR_MARGIN + column * QR_CELL;
  const y = QR_MARGIN + row * QR_CELL;
  const side = span * QR_CELL;
  return `M ${x} ${y} L ${x + side} ${y} L ${x + side} ${y + side} L ${x} ${y + side} Z`;
}

function inFinder(row: number, column: number): boolean {
  return (
    (row < 7 && column < 7) ||
    (row < 7 && column >= QR_SIZE - 7) ||
    (row >= QR_SIZE - 7 && column < 7)
  );
}

/**
 * Ba lớp vẽ chồng lên nhau: mô-đun tối, lỗ trắng bên trong ô định vị, rồi lõi
 * tối. `CustomPaint` chỉ có một màu tô nên tách lớp là cách duy nhất để vẽ
 * vòng định vị đúng.
 */
function qrDraws(code: string): { modules: string; holes: string; cores: string } {
  const modules: string[] = [];
  const holes: string[] = [];
  const cores: string[] = [];
  for (let row = 0; row < QR_SIZE; row += 1) {
    for (let column = 0; column < QR_SIZE; column += 1) {
      if (inFinder(row, column)) continue;
      if (codeHash(`${code}:${row}:${column}`) % 3 === 0) continue;
      modules.push(qrRect(row, column, 1));
    }
  }
  const corners: Array<[number, number]> = [
    [0, 0],
    [0, QR_SIZE - 7],
    [QR_SIZE - 7, 0],
  ];
  for (const [row, column] of corners) {
    modules.push(qrRect(row, column, 7));
    holes.push(qrRect(row + 1, column + 1, 5));
    cores.push(qrRect(row + 2, column + 2, 3));
  }
  return {
    modules: `fill:${colors.bg} ${modules.join(" ")}`,
    holes: `fill:#ffffff ${holes.join(" ")}`,
    cores: `fill:${colors.bg} ${cores.join(" ")}`,
  };
}

function statusText(status: TicketStatus): string {
  if (status === "upcoming") return "Sắp chiếu";
  if (status === "used") return "Đã soát vé";
  return "Đã huỷ";
}

function statusTone(status: TicketStatus): "success" | "neutral" | "danger" {
  if (status === "upcoming") return "success";
  if (status === "used") return "neutral";
  return "danger";
}

/** Nút phụ dưới tấm vé. */
function ActionButton(props: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.label}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingVertical: 12,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Icon name={props.icon} size={16} color={colors.ink} />
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/**
 * Trang vé điện tử: mã QR vẽ bằng `CustomPaint`, thông tin suất chiếu, chia sẻ
 * và huỷ vé. Đây là route `/ticket/:code`.
 */
export function TicketScreen(props: { code: string; onBack: () => void }) {
  const tickets = useTickets();
  const [confirm, setConfirm] = useState(false);
  const ticket = tickets.find((entry) => entry.code === props.code);
  const movie = ticket ? movieById(ticket.movieId) : null;

  if (!ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavBar title="Vé điện tử" showBack onBack={props.onBack} />
        <EmptyState
          title="Không tìm thấy vé"
          caption="Vé này có thể đã bị xoá khỏi thiết bị. Mở tab Vé để xem lại."
        />
      </View>
    );
  }

  const draws = qrDraws(ticket.code);
  const canCancel = ticket.status === "upcoming";

  const doShare = async () => {
    try {
      const done = await share({
        title: `${movie?.title ?? "Rạp Phố"} · ${ticket.code}`,
        text: `Vé ${ticket.code} · ${shortDay(ticket.dateKey)} ${ticket.time} · Ghế ${ticket.seats.join(", ")}`,
        url: "https://qchat.vn/miniapp/rap-pho",
      });
      void showToast(done ? "Đã chia sẻ vé" : "Bạn đã đóng bảng chia sẻ", {
        icon: done ? "success" : "none",
      });
    } catch {
      void showToast("Không chia sẻ được vé", { icon: "error" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack alignment="topLeft" style={{ flex: 1 }}>
        <ScrollView
          style={{ height: "100%" }}
          showsScrollIndicator={false}
        >
          <View
            testID="ticket-page"
            style={{ padding: 16, gap: 16, paddingBottom: 40 }}
          >
            {ticket.status !== "upcoming" ? (
              <Card
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderColor:
                    ticket.status === "cancelled" ? "#5a2430" : colors.line,
                  backgroundColor:
                    ticket.status === "cancelled" ? "#241318" : colors.surface,
                }}
              >
                <Icon
                  name={ticket.status === "cancelled" ? "info" : "check"}
                  size={18}
                  color={
                    ticket.status === "cancelled" ? colors.brand : colors.green
                  }
                />
                <Text
                  style={{ flex: 1, fontSize: 12, color: colors.ink }}
                >
                  {ticket.status === "cancelled"
                    ? "Vé đã huỷ. Ghế đã được trả lại cho rạp."
                    : "Vé đã được soát. Chúc bạn xem phim vui vẻ!"}
                </Text>
              </Card>
            ) : null}

            <View
              style={{
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  padding: 16,
                  gap: 4,
                  gradient: {
                    type: "linear",
                    angle: 135,
                    stops: [
                      { offset: 0, color: colors.brand },
                      { offset: 1, color: colors.brandDark },
                    ],
                  },
                }}
              >
                <Row style={{ justifyContent: "spaceBetween", gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "600",
                      letterSpacing: 1.4,
                      color: "#ffd7dd",
                    }}
                  >
                    VÉ ĐIỆN TỬ · RẠP PHỐ
                  </Text>
                  <Tag tone={statusTone(ticket.status)} size="sm">
                    {statusText(ticket.status)}
                  </Tag>
                </Row>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 21, fontWeight: "bold", color: colors.white }}
                >
                  {movie?.title ?? "Phim"}
                </Text>
                <Text style={{ fontSize: 12, color: "#ffe3e7" }}>
                  {`${ticket.format} · ${ticket.hall} · ${shortDay(ticket.dateKey)} ${ticket.time}`}
                </Text>
              </View>

              <View style={{ alignItems: "center", gap: 10, paddingTop: 20 }}>
                <View
                  style={{
                    padding: 8,
                    borderRadius: 14,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Stack style={{ width: QR_SIDE, height: QR_SIDE }}>
                    <CustomPaint
                      width={QR_SIDE}
                      height={QR_SIDE}
                      draw={draws.modules}
                    />
                    <CustomPaint
                      width={QR_SIDE}
                      height={QR_SIDE}
                      draw={draws.holes}
                    />
                    <CustomPaint
                      width={QR_SIDE}
                      height={QR_SIDE}
                      draw={draws.cores}
                    />
                  </Stack>
                </View>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "bold",
                    letterSpacing: 4,
                    color: colors.ink,
                  }}
                >
                  {ticket.code}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Đưa mã này cho nhân viên soát vé
                </Text>
              </View>

              <Stack style={{ height: 22, marginTop: 16 }}>
                <Row
                  style={{
                    height: 22,
                    alignItems: "center",
                    justifyContent: "spaceBetween",
                    paddingHorizontal: 14,
                  }}
                >
                  {Array.from({ length: 26 }).map((_, index) => (
                    <View
                      key={String(index)}
                      style={{
                        width: 5,
                        height: 1,
                        backgroundColor: colors.line,
                      }}
                    />
                  ))}
                </Row>
                <Positioned left={-9} top={2}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.bg,
                    }}
                  />
                </Positioned>
                <Positioned right={-9} top={2}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.bg,
                    }}
                  />
                </Positioned>
              </Stack>

              <View style={{ padding: 16, paddingTop: 0, gap: 9 }}>
                <Label>Thông tin suất chiếu</Label>
                <InfoRow
                  label="Ngày"
                  value={`${shortDay(ticket.dateKey)} · ${ticket.time}`}
                />
                <InfoRow
                  label="Phòng"
                  value={`${ticket.hall} · ${ticket.format}`}
                />
                <InfoRow label="Ghế" value={ticket.seats.join(", ")} />
                <InfoRow
                  label="Combo"
                  value={ticket.combo ? "Bắp + nước" : "Không"}
                />
                <InfoRow label="Thanh toán" value={ticket.payment} />
                <InfoRow label="Tổng" value={money(ticket.total)} />
              </View>
            </View>

            <Row style={{ gap: 10 }}>
              <ActionButton
                icon="share"
                label="Chia sẻ vé"
                onPress={() => void doShare()}
              />
              <ActionButton
                icon="clock"
                label="Nhắc lịch"
                onPress={() =>
                  void showToast("Sẽ nhắc bạn trước suất chiếu 2 giờ", {
                    icon: "success",
                  })
                }
              />
            </Row>

            {canCancel ? (
              <Pressable
                onPress={() => setConfirm(true)}
                accessibleLabel="Huỷ vé"
                style={{
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: "#3a2430",
                  backgroundColor: "#1c1116",
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: colors.brand }}
                >
                  Huỷ vé này
                </Text>
              </Pressable>
            ) : null}

            <Text
              style={{
                fontSize: 11,
                lineHeight: 17,
                color: colors.muted,
                textAlign: "center",
              }}
            >
              Vé đã mua có thể huỷ trước suất chiếu 2 giờ và hoàn về ví trong 24
              giờ. Ghế VIP không áp dụng hoàn tiền mặt.
            </Text>
          </View>
        </ScrollView>

        <Dialog
          visible={confirm}
          title="Huỷ vé này?"
          confirmText="Huỷ vé"
          cancelText="Giữ vé"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            cancelTicket(ticket.code);
            setConfirm(false);
            void showToast("Đã huỷ vé và hoàn về ví", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {`${movie?.title ?? "Phim"} · ${shortDay(ticket.dateKey)} ${ticket.time} · Ghế ${ticket.seats.join(", ")}. Ghế sẽ được trả lại cho rạp ngay lập tức.`}
          </Text>
        </Dialog>

        <NavBar
          title="Vé điện tử"
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      </Stack>
    </View>
  );
}

import { useState } from "@mna/qchat";
import {
  Button,
  NavBar,
  Pressable,
  Row,
  Stack,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  money,
  movieById,
  shortDay,
  ticketStats,
  useTickets,
} from "../store.js";
import type { Ticket, TicketStatus } from "../store.js";
import { colors, posterStyle, radius, toneAt } from "../theme.js";
import { Card, Chip, EmptyState, ScreenShell } from "../ui.js";

const FILTERS: Array<[TicketStatus, string]> = [
  ["upcoming", "Sắp tới"],
  ["used", "Đã dùng"],
  ["cancelled", "Đã huỷ"],
];

function statusLabel(status: TicketStatus): string {
  if (status === "upcoming") return "Sắp chiếu";
  if (status === "used") return "Đã soát vé";
  return "Đã huỷ";
}

function statusTone(status: TicketStatus): "success" | "neutral" | "danger" {
  if (status === "upcoming") return "success";
  if (status === "used") return "neutral";
  return "danger";
}

/** Một tấm vé trong ví: poster nhỏ, suất chiếu, ghế và mã vé. */
function TicketCard(props: {
  key?: string | number;
  ticket: Ticket;
  onOpen: () => void;
}) {
  const ticket = props.ticket;
  const movie = movieById(ticket.movieId);
  return (
    <Pressable
      onPress={props.onOpen}
      accessibleLabel={`Vé ${ticket.code}`}
      testID={`ticket-${ticket.code}`}
      style={{
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: ticket.status === "upcoming" ? "#3a2430" : colors.line,
        overflow: "hidden",
      }}
    >
      <Row style={{ alignItems: "stretch" }}>
        <Stack
          style={{
            width: 76,
            height: 104,
            ...posterStyle(toneAt(movie?.tone ?? 0)),
          }}
        >
          <Text
            style={{
              position: "absolute",
              right: -4,
              bottom: 4,
              fontSize: 54,
              fontWeight: "bold",
              color: "#2effffff",
            }}
          >
            {movie?.title.charAt(0) ?? "?"}
          </Text>
          <Text
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              fontSize: 10,
              fontWeight: "600",
              color: colors.white,
            }}
          >
            {ticket.format}
          </Text>
        </Stack>
        <View style={{ flex: 1, padding: 12, gap: 5 }}>
          <Row style={{ justifyContent: "spaceBetween", gap: 8 }}>
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "bold",
                color: colors.ink,
              }}
            >
              {movie?.title ?? "Phim"}
            </Text>
            <Tag tone={statusTone(ticket.status)} size="sm">
              {statusLabel(ticket.status)}
            </Tag>
          </Row>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {`${shortDay(ticket.dateKey)} · ${ticket.time} · ${ticket.hall}`}
          </Text>
          <Text style={{ fontSize: 12, color: colors.gold }}>
            {`Ghế ${ticket.seats.join(", ")}`}
          </Text>
          <Row
            style={{
              justifyContent: "spaceBetween",
              alignItems: "center",
              marginTop: 3,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: colors.muted,
              }}
            >
              {`#${ticket.code}`}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.brand }}>
              Xem vé →
            </Text>
          </Row>
        </View>
      </Row>
    </Pressable>
  );
}

/**
 * Tab Vé: ví vé điện tử với ba bộ lọc. Vé sắp tới mở trang QR, vé đã dùng và
 * đã huỷ vẫn giữ lại để đối chiếu.
 */
export function TicketsScreen(props: {
  onOpenTicket: (code: string) => void;
  onGoMovies: () => void;
}) {
  const tickets = useTickets();
  const [filter, setFilter] = useState<TicketStatus>("upcoming");
  const stats = ticketStats(tickets);
  const list = tickets.filter((ticket) => ticket.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Vé của tôi"
        subtitle={`${stats.upcoming} vé sắp tới · ${stats.watched} phim đã xem`}
        style={{ backgroundColor: colors.bg, color: colors.ink }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
          <Row style={{ gap: 8 }}>
            {FILTERS.map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                active={filter === key}
                onPress={() => setFilter(key)}
              />
            ))}
          </Row>
        </View>
      </NavBar>

      <ScreenShell>
        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}>
              {String(stats.upcoming)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Vé sắp tới</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}>
              {String(stats.watched)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Đã xem</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.gold }}>
              {money(stats.spent)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Tổng chi</Text>
          </View>
        </Card>

        {list.length === 0 ? (
          <Card>
            <EmptyState
              title={
                filter === "upcoming"
                  ? "Chưa có vé sắp tới"
                  : filter === "used"
                    ? "Chưa xem phim nào"
                    : "Không có vé đã huỷ"
              }
              caption="Chọn một phim đang chiếu để đặt vé. Vé điện tử sẽ nằm ở đây."
              action={
                <Button onPress={props.onGoMovies} variant="secondary">
                  Khám phá phim
                </Button>
              }
            />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((ticket) => (
              <TicketCard
                key={ticket.code}
                ticket={ticket}
                onOpen={() => props.onOpenTicket(ticket.code)}
              />
            ))}
          </View>
        )}

        <Text
          style={{
            fontSize: 11,
            color: colors.muted,
            textAlign: "center",
            paddingVertical: 4,
          }}
        >
          Vé đã mua có thể huỷ trước suất chiếu 2 giờ.
        </Text>
      </ScreenShell>
    </View>
  );
}

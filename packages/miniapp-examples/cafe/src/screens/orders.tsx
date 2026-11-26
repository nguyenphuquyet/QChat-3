import { useState } from "@mna/qchat";
import { showToast } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Dialog,
  Divider,
  Image,
  NavBar,
  Pressable,
  Row,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  DRINKS,
  STATUS_LABEL,
  STATUS_TONE,
  addToCart,
  cancelOrder,
  dayLabel,
  lineNote,
  lineTitle,
  lineTotal,
  money,
  useOrders,
} from "../store.js";
import type { Order } from "../store.js";
import { card, colors, radius } from "../theme.js";
import { Card, Chip, EmptyState, ScreenShell, Section } from "../ui.js";

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "brewing", label: "Đang pha" },
  { key: "delivering", label: "Đang giao" },
  { key: "done", label: "Hoàn tất" },
];

/**
 * Tab đơn hàng: header đặc có hai phần dưới (ô tìm kiếm và bộ lọc trạng thái).
 * Đây là kiểu header mở rộng xuống dưới, khác với header trong suốt ở tab thực
 * đơn.
 */
export function OrdersScreen(props: { onGoMenu: () => void }) {
  const orders = useOrders();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const list = orders.filter((order) => {
    const inFilter = filter === "all" || order.status === filter;
    const haystack = `${order.id} ${order.lines
      .map((line) => lineTitle(line))
      .join(" ")}`.toLowerCase();
    return inFilter && (needle.length === 0 || haystack.includes(needle));
  });

  const detail = open ? orders.find((order) => order.id === open) : undefined;
  const target = cancelling
    ? orders.find((order) => order.id === cancelling)
    : undefined;

  const reorder = (order: Order) => {
    for (const line of order.lines) {
      addToCart({
        drinkId: line.drinkId,
        size: line.size,
        sugar: line.sugar,
        extra: line.extra,
        qty: line.qty,
      });
    }
    setOpen(null);
    void showToast("Đã thêm lại vào giỏ", { icon: "success" });
    props.onGoMenu();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Đơn hàng"
        subtitle={`${orders.filter((order) => order.status !== "done" && order.status !== "cancelled").length} đơn đang xử lý`}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
          <TextField
            value={query}
            placeholder="Tìm theo mã đơn hoặc tên món"
            onInput={setQuery}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          />
          <Row style={{ gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((entry) => (
              <Chip
                key={entry.key}
                label={entry.label}
                active={filter === entry.key}
                onPress={() => setFilter(entry.key)}
              />
            ))}
          </Row>
        </View>
      </NavBar>

      <ScreenBody
        orders={list}
        onOpen={setOpen}
        onCancel={setCancelling}
        onGoMenu={props.onGoMenu}
      />

      <BottomSheet
        visible={detail !== undefined}
        height={480}
        onClose={() => setOpen(null)}
      >
        {detail ? (
          <View style={{ padding: 18, gap: 14 }}>
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}>
                  {`Đơn ${detail.id}`}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {dayLabel(detail.at)}
                </Text>
              </View>
              <Tag tone={STATUS_TONE[detail.status]}>
                {STATUS_LABEL[detail.status]}
              </Tag>
            </Row>

            <Divider />

            <View style={{ gap: 12 }}>
              {detail.lines.map((line) => {
                const drink = DRINKS.find((entry) => entry.id === line.drinkId);
                return (
                  <Row key={line.key} style={{ gap: 10, alignItems: "center" }}>
                    {drink ? (
                      <Image
                        src={drink.image}
                        fit="cover"
                        style={{ width: 44, height: 44, borderRadius: 8 }}
                      />
                    ) : null}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
                      >
                        {`${line.qty} × ${lineTitle(line)}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {lineNote(line)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: colors.ink }}>
                      {money(lineTotal(line))}
                    </Text>
                  </Row>
                );
              })}
            </View>

            <Divider />

            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
                Tổng
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.brand }}>
                {money(detail.total)}
              </Text>
            </Row>

            <Row style={{ gap: 10 }}>
              <Button
                variant="secondary"
                onPress={() => reorder(detail)}
                style={{ flex: 1 }}
              >
                Đặt lại
              </Button>
              {detail.status === "brewing" ? (
                <Button
                  variant="outline"
                  onPress={() => {
                    setOpen(null);
                    setCancelling(detail.id);
                  }}
                  style={{ flex: 1 }}
                >
                  Huỷ đơn
                </Button>
              ) : null}
            </Row>
          </View>
        ) : null}
      </BottomSheet>

      <Dialog
        visible={target !== undefined}
        title="Huỷ đơn này?"
        confirmText="Huỷ đơn"
        cancelText="Giữ lại"
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (target) {
            cancelOrder(target.id);
            void showToast(`Đã huỷ đơn ${target.id}`);
          }
          setCancelling(null);
        }}
      >
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Quán chưa pha xong nên bạn không mất phí. Đơn sẽ chuyển sang “Đã huỷ”.
        </Text>
      </Dialog>
    </View>
  );
}

function ScreenBody(props: {
  orders: Order[];
  onOpen: (id: string) => void;
  onCancel: (id: string) => void;
  onGoMenu: () => void;
}) {
  if (props.orders.length === 0) {
    return (
      <ScreenShell>
        <Card>
          <EmptyState
            title="Chưa có đơn nào"
            caption="Đơn bạn đặt ở tab thực đơn sẽ xuất hiện ở đây, kèm trạng thái pha và giao."
            action={
              <Button variant="secondary" onPress={props.onGoMenu}>
                Mở thực đơn
              </Button>
            }
          />
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <Section title="Gần đây" caption="Chạm vào đơn để xem chi tiết">
        <View style={{ gap: 12 }}>
          {props.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={() => props.onOpen(order.id)}
              onCancel={() => props.onCancel(order.id)}
            />
          ))}
        </View>
      </Section>
    </ScreenShell>
  );
}

function OrderCard(props: {
  key?: string | number;
  order: Order;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const count = props.order.lines.reduce((sum, line) => sum + line.qty, 0);
  const summary = props.order.lines
    .map((line) => `${line.qty} × ${lineTitle(line)}`)
    .join(", ");

  return (
    <Pressable
      onPress={props.onOpen}
      accessibleLabel={`Đơn ${props.order.id}`}
      style={{ ...card, gap: 10 }}
    >
      <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}>
            {props.order.id}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {dayLabel(props.order.at)}
          </Text>
        </View>
        <Tag tone={STATUS_TONE[props.order.status]}>
          {STATUS_LABEL[props.order.status]}
        </Tag>
      </Row>

      <Text numberOfLines={2} style={{ fontSize: 13, color: colors.ink }}>
        {summary}
      </Text>

      <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {`${count} món`}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.brand }}>
          {money(props.order.total)}
        </Text>
      </Row>

      {props.order.status === "brewing" ? (
        <Row style={{ justifyContent: "end" }}>
          <Pressable
            onPress={props.onCancel}
            accessibleLabel={`Huỷ đơn ${props.order.id}`}
          >
            <Text style={{ fontSize: 12, color: colors.red }}>Huỷ đơn</Text>
          </Pressable>
        </Row>
      ) : null}
    </Pressable>
  );
}

import { showToast, useState } from "@mna/qchat";
import {
  Button,
  Checkbox,
  Dialog,
  ListView,
  NavBar,
  Page,
  Row,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  deleteTxns,
  money,
  searchTxns,
  useTxns,
} from "../store.js";
import type { Flow, Txn } from "../store.js";
import { colors, radius } from "../theme.js";
import { AppTabBar, Card, EmptyState, TxnRow } from "../ui.js";

/** Số khoản hé ra thêm mỗi lần danh sách chạm đáy. */
const PAGE = 6;

type Row =
  | { kind: "txn"; txn: Txn }
  | { kind: "more"; remaining: number };

type FlowFilter = Flow | "all";

const FILTERS: readonly { id: FlowFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "expense", label: "Khoản chi" },
  { id: "income", label: "Khoản thu" },
];

/**
 * Tab Giao dịch: ô tìm kiếm nằm trên header, ba nút lọc chiều thu chi, danh
 * sách tải sáu khoản một lần và chế độ chọn nhiều để xoá hàng loạt.
 *
 * Chế độ chọn dùng `Checkbox` của TDesign trên từng dòng; nút xoá mở `Dialog`
 * xác nhận trước khi bỏ các khoản khỏi store.
 */
export function TxnsScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenTxn: (id: string) => void;
}) {
  const txns = useTxns();

  const [query, setQuery] = useState("");
  const [flow, setFlow] = useState<FlowFilter>("all");
  const [page, setPage] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const filtered = searchTxns(txns, query, flow);
  const visible = filtered.slice(0, page * PAGE);
  const spent = filtered
    .filter((txn) => txn.flow === "expense")
    .reduce((sum, txn) => sum + txn.amount, 0);

  const rows: Row[] =
    filtered.length === 0
      ? []
      : [
          ...visible.map((txn) => ({ kind: "txn", txn }) as Row),
          {
            kind: "more",
            remaining: Math.max(0, filtered.length - visible.length),
          },
        ];

  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const changeFlow = (next: FlowFilter) => {
    setFlow(next);
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  };

  const allSelected =
    filtered.length > 0 && selected.length === filtered.length;

  const toggleAll = () => {
    setSelected(allSelected ? [] : filtered.map((txn) => txn.id));
  };

  const toggleMode = () => {
    setSelecting((current) => !current);
    setSelected([]);
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Giao dịch"
          subtitle={`${filtered.length} khoản · ${money(spent)} đã chi`}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 10,
              gap: 9,
            }}
          >
            <Row style={{ gap: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={query}
                  placeholder="Tìm theo tên, ghi chú hoặc nhóm"
                  onInput={changeQuery}
                  testID="txn-search"
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.line,
                    color: colors.ink,
                  }}
                />
              </View>
              <Button
                size="sm"
                variant={selecting ? "secondary" : "outline"}
                icon={selecting ? "close" : "check"}
                onPress={toggleMode}
                testID="select-mode"
              >
                {selecting ? "Xong" : "Chọn"}
              </Button>
            </Row>

            <Row style={{ gap: 8, alignItems: "center" }}>
              {FILTERS.map((entry) => (
                <Button
                  key={entry.id}
                  size="sm"
                  variant={flow === entry.id ? "primary" : "secondary"}
                  onPress={() => changeFlow(entry.id)}
                  testID={`filter-${entry.id}`}
                >
                  {entry.label}
                </Button>
              ))}
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 10.5, color: colors.muted }}>
                {`${visible.length}/${filtered.length}`}
              </Text>
            </Row>
          </View>
        </NavBar>
      }
      footer={
        <AppTabBar
          index={props.index}
          badges={props.badges}
          onChange={props.onTab}
        />
      }
      overlays={
        <Dialog
          visible={confirmBulk}
          title={`Xoá ${selected.length} khoản?`}
          confirmText="Xoá hết"
          cancelText="Giữ lại"
          onClose={() => setConfirmBulk(false)}
          onConfirm={() => {
            const removed = deleteTxns(selected);
            setConfirmBulk(false);
            setSelected([]);
            setSelecting(false);
            void showToast(
              `Đã xoá ${removed} khoản khỏi ví`,
              { icon: "success" },
            );
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            Các khoản đang chọn sẽ biến mất khỏi danh sách, tổng chi tháng và
            hạn mức nhóm. Hành động này không thể hoàn tác.
          </Text>
        </Dialog>
      }
    >
      <View style={{ flex: 1 }}>
        {selecting ? (
          <Row
            style={{
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Checkbox
              checked={allSelected}
              label={`${selected.length} đã chọn`}
              onChange={toggleAll}
              testID="select-all"
            />
            <View style={{ flex: 1 }} />
            <Button
              size="sm"
              variant="danger"
              icon="delete"
              disabled={selected.length === 0}
              onPress={() => setConfirmBulk(true)}
              testID="bulk-delete"
            >
              Xoá
            </Button>
          </Row>
        ) : null}

        <ListView<Row>
          testID="txn-list"
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 24,
          }}
          data={rows}
          initialCount={PAGE + 1}
          onEndReached={() => setPage((current) => current + 1)}
          empty={
            <EmptyState
              icon="search"
              title="Không tìm thấy khoản nào"
              caption={
                query.trim().length > 0
                  ? "Thử một từ ngắn hơn, hoặc bỏ bộ lọc chiều thu chi."
                  : "Chạm nút Thêm khoản chi ở tab Tổng quan để bắt đầu."
              }
            />
          }
          renderItem={(row) => {
            if (row.kind === "more") {
              return (
                <View
                  style={{
                    alignItems: "center",
                    gap: 3,
                    paddingTop: 10,
                    paddingBottom: 22,
                  }}
                >
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    {row.remaining > 0
                      ? `Còn ${row.remaining} khoản · cuộn để tải thêm`
                      : "Đã hiển thị tất cả khoản trong bộ lọc này"}
                  </Text>
                  {row.remaining > 0 ? (
                    <Button
                      size="sm"
                      variant="text"
                      icon="refresh"
                      onPress={() => setPage((current) => current + 1)}
                      testID="load-more"
                    >
                      Tải thêm
                    </Button>
                  ) : null}
                </View>
              );
            }

            const txn = row.txn;
            return (
              <View
                style={{
                  marginBottom: 8,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  overflow: "hidden",
                }}
              >
                <TxnRow
                  txn={txn}
                  selecting={selecting}
                  selected={selected.includes(txn.id)}
                  onToggle={() => toggleSelect(txn.id)}
                  onPress={() => {
                    if (selecting) toggleSelect(txn.id);
                    else props.onOpenTxn(txn.id);
                  }}
                />
              </View>
            );
          }}
        />
      </View>

      {selecting ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Card style={{ gap: 8 }}>
            <Text style={{ fontSize: 11.5, color: colors.muted }}>
              Chạm một dòng hoặc ô chọn để thêm vào danh sách xoá. Nút xoá chỉ
              bật khi có ít nhất một khoản.
            </Text>
            <Button
              size="sm"
              variant="outline"
              icon="check"
              onPress={() => {
                setSelecting(false);
                setSelected([]);
              }}
              testID="cancel-select"
            >
              Thoát chế độ chọn
            </Button>
          </Card>
        </View>
      ) : null}
    </Page>
  );
}

import { share, showToast, useState } from "@mna/qchat";
import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Icon,
  NavBar,
  Page,
  Row,
  ScrollView,
  Slider,
  Switch,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  METHODS,
  categoryById,
  deleteTxn,
  flowLabel,
  longDay,
  methodById,
  money,
  parseAmount,
  txnById,
  updateTxn,
  useTxns,
} from "../store.js";
import type { Method } from "../store.js";
import { colors, radius, screenPad } from "../theme.js";
import {
  Card,
  CategoryMark,
  EmptyState,
  SectionHeader,
  TagPick,
} from "../ui.js";

/**
 * Route `/giao-dich/:id`: xem và sửa một khoản, đổi chiều thu chi, nhóm,
 * phương thức và ghi chú; đánh dấu đã đối chiếu hoặc xoá bằng `Dialog`.
 *
 * Đây là màn hình duy nhất dùng `TextField` nhiều dòng cho ghi chú và một
 * `Slider` chỉnh nhanh số tiền bên cạnh ô số.
 */
export function TxnScreen(props: { txnId: string; onBack: () => void }) {
  const txns = useTxns();
  const txn = txnById(txns, props.txnId);

  const [title, setTitle] = useState(txn?.title ?? "");
  const [amountText, setAmountText] = useState(
    txn ? String(txn.amount) : "",
  );
  const [note, setNote] = useState(txn?.note ?? "");
  const [categoryId, setCategoryId] = useState(txn?.categoryId ?? "food");
  const [method, setMethod] = useState<Method>(txn?.method ?? "cash");
  const [isIncome, setIsIncome] = useState(txn?.flow === "income");
  const [recurring, setRecurring] = useState(txn?.recurring ?? false);
  const [reconciled, setReconciled] = useState(txn?.reconciled ?? false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!txn) {
    return (
      <Page
        style={{ backgroundColor: colors.bg }}
        header={
          <NavBar
            title="Không tìm thấy"
            showBack
            onBack={props.onBack}
            style={{ backgroundColor: colors.bg, color: colors.ink }}
          />
        }
      >
        <View style={{ padding: 20, gap: 16 }}>
          <EmptyState
            icon="info"
            title="Khoản này không còn"
            caption="Có thể nó đã bị xoá ở tab Giao dịch. Quay lại danh sách để chọn khoản khác."
          />
          <Button variant="secondary" onPress={props.onBack}>
            Quay lại danh sách
          </Button>
        </View>
      </Page>
    );
  }

  const category = categoryById(categoryId);
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const amount = parseAmount(amountText);
  const sliderValue = Math.min(
    5000000,
    Math.max(10000, amount || 10000),
  );

  const switchFlow = (income: boolean) => {
    setIsIncome(income);
    setCategoryId(income ? "salary" : "food");
  };

  const save = () => {
    if (saving) return;
    const value = title.trim();
    if (value.length === 0) {
      void showToast("Khoản này cần một cái tên", { icon: "error" });
      return;
    }
    if (amount <= 0) {
      void showToast("Số tiền phải lớn hơn 0", { icon: "error" });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      updateTxn(txn.id, {
        title: value,
        amount,
        flow: isIncome ? "income" : "expense",
        categoryId,
        method,
        note: note.trim(),
        recurring,
        reconciled,
      });
      setSaving(false);
      void showToast("Đã lưu thay đổi", { icon: "success" });
    }, 500);
  };

  const shareTxn = () => {
    void share({
      title: "Ví Nhỏ",
      text: `${flowLabel(txn.flow)}: ${txn.title} · ${money(amount)} · ${category.label}`,
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
          title="Chi tiết khoản"
          subtitle={longDay(txn.day)}
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
      overlays={
        <Dialog
          visible={confirmDelete}
          title="Xoá khoản này?"
          confirmText="Xoá"
          cancelText="Giữ lại"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteTxn(txn.id);
            setConfirmDelete(false);
            props.onBack();
            void showToast("Đã xoá khoản khỏi ví", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            “{txn.title}” sẽ bị xoá khỏi ví, khỏi tổng chi tháng và hạn mức
            nhóm. Không thể hoàn tác.
          </Text>
        </Dialog>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 12 }}>
              <CategoryMark category={category} size={48} />
              <View style={{ flex: 1, gap: 3 }}>
                <Row style={{ gap: 6 }}>
                  <Tag
                    tone={isIncome ? "success" : "danger"}
                    size="sm"
                  >
                    {flowLabel(isIncome ? "income" : "expense")}
                  </Tag>
                  {recurring ? (
                    <Tag tone="neutral" size="sm">
                      Định kỳ
                    </Tag>
                  ) : null}
                </Row>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color: colors.ink,
                  }}
                >
                  {txn.title}
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  {`${category.label} · ${methodById(method).label}`}
                </Text>
              </View>
            </Row>
            <Divider color={colors.line} />
            <View style={{ gap: 3 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Số tiền
              </Text>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "bold",
                  color: isIncome ? colors.success : colors.ink,
                }}
              >
                {`${isIncome ? "+" : "−"}${money(txn.amount)}`}
              </Text>
            </View>
            <Row style={{ alignItems: "center", gap: 8 }}>
              <Tag tone={reconciled ? "success" : "neutral"} size="sm">
                {reconciled ? "Đã đối chiếu" : "Chưa đối chiếu"}
              </Tag>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {longDay(txn.day)}
              </Text>
            </Row>
          </Card>

          <SectionHeader
            title="Chỉnh sửa"
            note="Mọi thay đổi được lưu vào bộ nhớ thiết bị"
          />
          <Card style={{ gap: 12 }}>
            <View style={{ gap: 5 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
              >
                Tên khoản
              </Text>
              <TextField
                value={title}
                placeholder="Ví dụ: Cà phê sáng"
                onInput={setTitle}
                maxLength={60}
                testID="detail-title"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />
            </View>

            <View style={{ gap: 5 }}>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.muted,
                  }}
                >
                  Số tiền
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.brand,
                  }}
                >
                  {amount > 0 ? money(amount) : "Chưa nhập"}
                </Text>
              </Row>
              <TextField
                value={amountText}
                placeholder="0"
                keyboardType="number"
                onInput={(value) =>
                  setAmountText(value.replace(/[^0-9]/g, ""))
                }
                maxLength={9}
                testID="detail-amount"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />
              <Slider
                value={sliderValue}
                min={10000}
                max={5000000}
                step={10000}
                onChange={(event) =>
                  setAmountText(String(Math.round(event.value)))
                }
                testID="detail-amount-slider"
              />
            </View>

            <Row style={{ alignItems: "center", gap: 11 }}>
              <Icon
                name={isIncome ? "wallet" : "send"}
                size={18}
                color={isIncome ? colors.success : colors.danger}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.ink,
                  }}
                >
                  Là khoản thu
                </Text>
                <Text style={{ fontSize: 10.5, color: colors.muted }}>
                  Đổi chiều sẽ đặt lại nhóm phù hợp.
                </Text>
              </View>
              <Switch
                value={isIncome}
                onChange={(event) => switchFlow(event.value)}
                testID="detail-income"
              />
            </Row>

            <View style={{ gap: 6 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
              >
                Nhóm
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {categories.map((entry) => (
                  <TagPick
                    key={entry.id}
                    label={entry.label}
                    tone={entry.tone}
                    active={categoryId === entry.id}
                    onPress={() => setCategoryId(entry.id)}
                    testID={`detail-cat-${entry.id}`}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
              >
                Phương thức
              </Text>
              <Row style={{ gap: 8 }}>
                {METHODS.map((entry) => (
                  <TagPick
                    key={entry.id}
                    label={entry.label}
                    tone="info"
                    active={method === entry.id}
                    onPress={() => setMethod(entry.id)}
                    testID={`detail-method-${entry.id}`}
                  />
                ))}
              </Row>
            </View>

            <View style={{ gap: 5 }}>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
              >
                Ghi chú
              </Text>
              <TextField
                value={note}
                placeholder="Chi tiết, người liên hệ hoặc hoá đơn."
                onInput={setNote}
                multiline
                maxLength={240}
                testID="detail-note"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />
            </View>

            <Divider color={colors.line} />

            <Checkbox
              checked={reconciled}
              label="Đã đối chiếu với hoá đơn"
              onChange={(event) => setReconciled(event.value)}
              testID="detail-reconciled"
            />
            <Checkbox
              checked={recurring}
              label="Khoản định kỳ hằng tháng"
              onChange={(event) => setRecurring(event.value)}
              testID="detail-recurring"
            />
          </Card>

          <Button
            icon="check"
            onPress={save}
            loading={saving}
            disabled={saving || title.trim().length === 0 || amount <= 0}
            testID="save-txn"
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
          <Button
            variant="secondary"
            icon="share"
            onPress={shareTxn}
            testID="share-txn"
          >
            Chia sẻ khoản này
          </Button>
          <Button
            variant="danger"
            icon="delete"
            onPress={() => setConfirmDelete(true)}
            testID="delete-txn"
          >
            Xoá khoản
          </Button>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Khoản này thuộc {flowLabel(isIncome ? "income" : "expense").toLowerCase()} của{" "}
            {category.label.toLowerCase()}.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

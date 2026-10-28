import { showToast, useState } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Checkbox,
  Dialog,
  Divider,
  Icon,
  NavBar,
  Page,
  Pressable,
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
  addTxn,
  categoryById,
  deleteTxn,
  greeting,
  lastSevenDays,
  money,
  monthLabel,
  monthSummary,
  parseAmount,
  recentTxns,
  shortMoney,
  todayCount,
  todayKey,
  todayTotal,
  topCategories,
  txnById,
  usePrefs,
  useTxns,
} from "../store.js";
import type { Method, Txn } from "../store.js";
import { colors, radius, screenPad } from "../theme.js";
import {
  AppTabBar,
  Card,
  CategoryMark,
  EmptyState,
  ProgressBar,
  SectionHeader,
  StatTile,
  TagPick,
  TxnRow,
} from "../ui.js";

/**
 * Tab Tổng quan: tấm thẻ ngân sách tháng, ba con số nhanh, tỉ trọng từng
 * nhóm, biểu đồ bảy ngày và bốn khoản gần nhất.
 *
 * Nút "Thêm khoản chi" mở `BottomSheet` có `TextField`, `Slider`, `Switch`,
 * `Checkbox` và các `Tag` chọn nhóm; nhấn giữ một dòng để xoá bằng `Dialog`.
 */
export function OverviewScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenTxn: (id: string) => void;
}) {
  const txns = useTxns();
  const prefs = usePrefs();
  const summary = monthSummary(txns, prefs.monthlyBudget);
  const recent = recentTxns(txns, 4);
  const groups = topCategories(txns, 4);
  const days = lastSevenDays(txns);
  const weekTotal = days.reduce((sum, day) => sum + day.total, 0);
  const weekMax = Math.max(1, ...days.map((day) => day.total));

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isIncome, setIsIncome] = useState(false);
  const [title, setTitle] = useState("");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("food");
  const [method, setMethod] = useState<Method>("cash");
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const amount = parseAmount(amountText);
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const pendingTxn = pendingDelete ? txnById(txns, pendingDelete) : null;

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
  };

  const switchFlow = (income: boolean) => {
    setIsIncome(income);
    setCategoryId(income ? "salary" : "food");
  };

  const submit = () => {
    if (saving) return;
    const value = title.trim();
    if (value.length === 0) {
      void showToast("Đặt tên cho khoản này đã nhé", { icon: "error" });
      return;
    }
    if (amount <= 0) {
      void showToast("Nhập số tiền lớn hơn 0", { icon: "error" });
      return;
    }
    setSaving(true);
    // Một nhịp chờ ngắn để thấy nút loading và vòng xoay của TDesign; dữ liệu
    // vẫn nằm trong bộ nhớ cục bộ nên đây chỉ là phản hồi thị giác.
    setTimeout(() => {
      addTxn({
        title: value,
        amount,
        flow: isIncome ? "income" : "expense",
        categoryId,
        method,
        note,
        recurring,
      });
      setSaving(false);
      setSheetOpen(false);
      setTitle("");
      setAmountText("");
      setNote("");
      setRecurring(false);
      setMethod("cash");
      switchFlow(false);
      void showToast(`Đã thêm “${value}”`, { icon: "success" });
    }, 600);
  };

  const sliderValue = Math.min(2000000, Math.max(10000, amount || 50000));

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Ví Nhỏ"
          subtitle={`${monthLabel()} · còn ${summary.daysLeft} ngày`}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        >
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View
              style={{
                borderRadius: radius.lg,
                padding: 16,
                gap: 11,
                backgroundColor: colors.brand,
                gradient: {
                  type: "linear",
                  angle: 135,
                  stops: [
                    { offset: 0, color: colors.brandDeep },
                    { offset: 1, color: "#2f7cf6" },
                  ],
                },
              }}
            >
              <Row
                style={{
                  justifyContent: "spaceBetween",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 12, color: "#ffffffcc" }}>
                  Ngân sách tháng
                </Text>
                <Tag tone={summary.tone} size="sm">
                  {summary.label}
                </Tag>
              </Row>

              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 11.5, color: "#ffffffb3" }}>
                  {summary.remaining >= 0
                    ? "Còn lại trong tháng"
                    : "Đã vượt ngân sách"}
                </Text>
                <Text
                  style={{
                    fontSize: 31,
                    fontWeight: "bold",
                    color: colors.white,
                  }}
                >
                  {money(Math.abs(summary.remaining))}
                </Text>
              </View>

              <ProgressBar
                percent={summary.percent}
                color={colors.white}
                track="#ffffff3d"
              />
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 10.5, color: "#ffffffcc" }}>
                  {`Đã chi ${money(summary.spent)}`}
                </Text>
                <Text style={{ fontSize: 10.5, color: "#ffffffcc" }}>
                  {`${summary.percent}% · ${money(summary.budget)}`}
                </Text>
              </Row>

              <Divider color="#ffffff33" />

              <Row style={{ alignItems: "center" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 10, color: "#ffffffb3" }}>
                    Thu nhập
                  </Text>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: colors.white,
                    }}
                  >
                    {shortMoney(summary.income)}
                  </Text>
                </View>
                <Divider vertical color="#ffffff33" />
                <View style={{ flex: 1, gap: 2, paddingLeft: 12 }}>
                  <Text style={{ fontSize: 10, color: "#ffffffb3" }}>
                    Số khoản
                  </Text>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: colors.white,
                    }}
                  >
                    {String(summary.count)}
                  </Text>
                </View>
                <Divider vertical color="#ffffff33" />
                <View style={{ flex: 1, gap: 2, paddingLeft: 12 }}>
                  <Text style={{ fontSize: 10, color: "#ffffffb3" }}>
                    Hôm nay
                  </Text>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: colors.white,
                    }}
                  >
                    {shortMoney(todayTotal(txns))}
                  </Text>
                </View>
              </Row>
            </View>
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
        <>
          <BottomSheet
            visible={sheetOpen}
            onClose={closeSheet}
            height={560}
            testID="add-sheet"
          >
            <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
              <View style={{ gap: 13, paddingBottom: 10 }}>
              <Row
                style={{
                  justifyContent: "spaceBetween",
                  alignItems: "center",
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: colors.ink,
                    }}
                  >
                    Khoản mới
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    Ghi lại một khoản thu hoặc chi trong vài giây.
                  </Text>
                </View>
                <Pressable
                  accessibleLabel="Đóng"
                  onPress={closeSheet}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.soft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="close" size={16} color={colors.muted} />
                </Pressable>
              </Row>

              <Row
                style={{
                  alignItems: "center",
                  gap: 11,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.sm,
                  backgroundColor: colors.soft,
                }}
              >
                <Icon
                  name={isIncome ? "wallet" : "send"}
                  size={17}
                  color={isIncome ? colors.success : colors.danger}
                />
                <View style={{ flex: 1 }}>
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
                    Tắt để ghi một khoản chi.
                  </Text>
                </View>
                <Switch
                  value={isIncome}
                  onChange={(event) => switchFlow(event.value)}
                  testID="txn-income"
                />
              </Row>

              <TextField
                value={title}
                placeholder="Bạn vừa chi cho việc gì?"
                onInput={setTitle}
                autoFocus
                maxLength={60}
                testID="txn-title"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />

              <View style={{ gap: 4 }}>
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
                  onInput={(value) => setAmountText(value.replace(/[^0-9]/g, ""))}
                  maxLength={9}
                  testID="txn-amount"
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
                  max={2000000}
                  step={10000}
                  onChange={(event) =>
                    setAmountText(String(Math.round(event.value)))
                  }
                  testID="txn-amount-slider"
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.muted,
                  }}
                >
                  Nhóm
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {categories.map((category) => (
                    <TagPick
                      key={category.id}
                      label={category.label}
                      tone={category.tone}
                      active={categoryId === category.id}
                      onPress={() => setCategoryId(category.id)}
                      testID={`pick-cat-${category.id}`}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.muted,
                  }}
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
                      testID={`pick-method-${entry.id}`}
                    />
                  ))}
                </Row>
              </View>

              <TextField
                value={note}
                placeholder="Ghi chú (không bắt buộc)"
                onInput={setNote}
                maxLength={120}
                testID="txn-note"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />

              <Checkbox
                checked={recurring}
                label="Khoản định kỳ hằng tháng"
                onChange={(event) => setRecurring(event.value)}
                testID="txn-recurring"
              />

              <Button
                icon="plus"
                onPress={submit}
                loading={saving}
                disabled={
                  saving || title.trim().length === 0 || amount <= 0
                }
                testID="create-txn"
              >
                {saving ? "Đang lưu…" : "Thêm vào ví"}
              </Button>
              </View>
            </ScrollView>
          </BottomSheet>

          <Dialog
            visible={pendingDelete != null}
            title="Xoá khoản này?"
            confirmText="Xoá"
            cancelText="Giữ lại"
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              if (pendingDelete) deleteTxn(pendingDelete);
              setPendingDelete(null);
              void showToast("Đã xoá khoản chi", { icon: "success" });
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
              “{pendingTxn?.title ?? "Khoản này"}” sẽ bị xoá khỏi ví và khỏi
              ngân sách tháng. Không thể hoàn tác.
            </Text>
          </Dialog>
        </>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <Row style={{ gap: 10 }}>
            <Button
              icon="plus"
              onPress={() => setSheetOpen(true)}
              testID="open-add"
              style={{ flex: 1 }}
            >
              Thêm khoản chi
            </Button>
            <Button
              variant="secondary"
              icon="grid"
              onPress={() => props.onTab(2)}
              testID="overview-budget"
              style={{ flex: 1 }}
            >
              Ngân sách
            </Button>
          </Row>

          <Card style={{ gap: 12 }}>
            <Row
              style={{
                justifyContent: "spaceBetween",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}
                >
                  Hôm nay
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {todayCount(txns) === 0
                    ? "Chưa ghi khoản nào hôm nay"
                    : `${todayCount(txns)} khoản đã ghi`}
                </Text>
              </View>
              <Icon name="clock" size={20} color={colors.brand} />
            </Row>
            <Row style={{ alignItems: "center" }}>
              <StatTile
                value={money(todayTotal(txns))}
                label="đã chi hôm nay"
              />
              <Divider vertical color={colors.line} />
              <StatTile
                value={shortMoney(
                  Math.max(0, summary.remaining) / summary.daysLeft,
                )}
                label="mức mỗi ngày"
              />
              <Divider vertical color={colors.line} />
              <StatTile
                value={`${summary.percent}%`}
                label="ngân sách tháng"
                tone={colors.brand}
              />
            </Row>
          </Card>

          <SectionHeader
            title="Chi theo nhóm"
            note={`${groups.length} nhóm có phát sinh trong tháng`}
            action={
              <Button
                size="sm"
                variant="text"
                icon="chevronRight"
                onPress={() => props.onTab(1)}
                testID="groups-all"
              >
                Tất cả
              </Button>
            }
          />

          {groups.length === 0 ? (
            <Card>
              <EmptyState
                icon="tag"
                title="Chưa có khoản chi"
                caption="Thêm khoản đầu tiên để thấy tỉ trọng từng nhóm."
              />
            </Card>
          ) : (
            <Card style={{ gap: 13 }}>
              {groups.map((group) => (
                <View key={group.category.id} style={{ gap: 6 }}>
                  <Row
                    style={{
                      justifyContent: "spaceBetween",
                      alignItems: "center",
                    }}
                  >
                    <Row style={{ alignItems: "center", gap: 8 }}>
                      <CategoryMark category={group.category} size={28} />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: colors.ink,
                        }}
                      >
                        {group.category.label}
                      </Text>
                    </Row>
                    <Row style={{ alignItems: "center", gap: 7 }}>
                      <Tag tone={group.category.tone} size="sm">
                        {`${group.percent}%`}
                      </Tag>
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: colors.ink,
                        }}
                      >
                        {money(group.total)}
                      </Text>
                    </Row>
                  </Row>
                  <ProgressBar
                    percent={group.percent}
                    color={group.category.color}
                  />
                </View>
              ))}
            </Card>
          )}

          <Card style={{ gap: 11 }}>
            <Row
              style={{
                justifyContent: "spaceBetween",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}
                >
                  Bảy ngày qua
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {`Tổng ${money(weekTotal)} · cột đậm là hôm nay`}
                </Text>
              </View>
              <Tag tone="info" size="sm">
                {shortMoney(weekTotal)}
              </Tag>
            </Row>
            <Row style={{ alignItems: "end", height: 104, gap: 6 }}>
              {days.map((day) => (
                <View
                  key={day.key}
                  style={{ flex: 1, alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      width: 14,
                      height: Math.max(
                        5,
                        Math.round((day.total / weekMax) * 72),
                      ),
                      borderRadius: 7,
                      backgroundColor:
                        day.key === todayKey()
                          ? colors.brand
                          : colors.brandSoft,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 9.5,
                      fontWeight:
                        day.key === todayKey() ? "bold" : "normal",
                      color:
                        day.key === todayKey() ? colors.brand : colors.muted,
                    }}
                  >
                    {day.label}
                  </Text>
                </View>
              ))}
            </Row>
          </Card>

          <SectionHeader
            title="Gần đây"
            note="Nhấn giữ một dòng để xoá"
            action={
              <Button
                size="sm"
                variant="text"
                icon="chevronRight"
                onPress={() => props.onTab(1)}
                testID="recent-all"
              >
                Xem tất cả
              </Button>
            }
          />

          {recent.length === 0 ? (
            <Card>
              <EmptyState
                icon="file"
                title="Ví đang trống"
                caption="Chạm nút Thêm khoản chi để bắt đầu ghi chép."
              />
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {recent.map((txn: Txn, index: number) => (
                <View key={txn.id}>
                  <TxnRow
                    txn={txn}
                    onPress={() => props.onOpenTxn(txn.id)}
                    onLongPress={() => setPendingDelete(txn.id)}
                  />
                  {index < recent.length - 1 ? (
                    <Divider color={colors.line} inset={64} />
                  ) : null}
                </View>
              ))}
            </Card>
          )}

          <View
            style={{
              padding: 13,
              gap: 9,
              borderRadius: radius.md,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: "#cfe0ff",
            }}
          >
            <Row style={{ alignItems: "center", gap: 8 }}>
              <Tag tone="info" size="sm">
                Mẹo
              </Tag>
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.brandDeep,
                }}
              >
                {greeting()}. Còn {summary.daysLeft} ngày và{" "}
                {money(Math.max(0, summary.remaining))} trong ngân sách — chia
                đều khoảng {money(Math.max(0, summary.remaining) / summary.daysLeft)}
                /ngày là vừa.
              </Text>
            </Row>
            <Button
              size="sm"
              variant="outline"
              onPress={() => props.onTab(2)}
              testID="tip-budget"
            >
              Xem hạn mức từng nhóm
            </Button>
          </View>

          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            Tổng quan chỉ tính các khoản trong tháng hiện tại. Mọi số liệu được
            lưu trên thiết bị này.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

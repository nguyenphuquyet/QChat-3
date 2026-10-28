import { showToast, useState } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Checkbox,
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
  budgetRows,
  categoryById,
  money,
  monthLabel,
  monthSummary,
  parseAmount,
  setBudgetLimit,
  updatePrefs,
  useBudgets,
  usePrefs,
  useTxns,
} from "../store.js";
import type { BudgetRow } from "../store.js";
import { colors, radius, screenPad } from "../theme.js";
import {
  AppTabBar,
  Card,
  CategoryMark,
  ProgressBar,
  SectionHeader,
  StatTile,
} from "../ui.js";

const QUICK_LIMITS = [500000, 1000000, 2000000] as const;

/**
 * Tab Ngân sách: một `Slider` cho tổng ngân sách tháng, sáu thẻ hạn mức theo
 * nhóm (mỗi thẻ có `Tag` trạng thái) và các công tắc nhắc nhở.
 *
 * Nút "Sửa" mở `BottomSheet` có ô số, slider và ba nút chọn nhanh; lưu bằng
 * một nút loading ngắn để thấy phản hồi của TDesign.
 */
export function BudgetsScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
}) {
  const txns = useTxns();
  const budgets = useBudgets();
  const prefs = usePrefs();
  const summary = monthSummary(txns, prefs.monthlyBudget);
  const rows = budgetRows(txns, budgets);

  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [limitText, setLimitText] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);

  const editingRow =
    rows.find((row) => row.category.id === editing) ?? null;
  const draftLimit = parseAmount(limitText);
  const sliderValue = Math.min(
    10000000,
    Math.max(200000, draftLimit || 500000),
  );

  const openEdit = (row: BudgetRow) => {
    setEditing(row.category.id);
    setLimitText(String(row.limit));
  };

  const closeSheet = () => {
    if (sheetSaving) return;
    setEditing(null);
  };

  const saveLimit = () => {
    if (!editing || sheetSaving) return;
    const value = parseAmount(limitText);
    if (value <= 0) {
      void showToast("Hạn mức phải lớn hơn 0", { icon: "error" });
      return;
    }
    setSheetSaving(true);
    setTimeout(() => {
      setBudgetLimit(editing, value);
      setSheetSaving(false);
      setEditing(null);
      void showToast(
        `Đã đặt hạn mức ${categoryById(editing).label.toLowerCase()}`,
        { icon: "success" },
      );
    }, 500);
  };

  const savePlan = () => {
    if (saving) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      void showToast(`Đã lưu ngân sách ${monthLabel()}`, { icon: "success" });
    }, 600);
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Ngân sách"
          subtitle={`${monthLabel()} · ${summary.daysLeft} ngày còn lại`}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
      footer={
        <AppTabBar
          index={props.index}
          badges={props.badges}
          onChange={props.onTab}
        />
      }
      overlays={
        <BottomSheet
          visible={editing != null}
          onClose={closeSheet}
          height={430}
          testID="limit-sheet"
        >
          {editingRow ? (
            <View style={{ gap: 13 }}>
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
                    Hạn mức nhóm
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    {`${editingRow.category.label} · đã chi ${money(editingRow.spent)}`}
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

              <Row style={{ alignItems: "center", gap: 11 }}>
                <CategoryMark category={editingRow.category} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Hạn mức mới
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "bold",
                      color: colors.brand,
                    }}
                  >
                    {draftLimit > 0 ? money(draftLimit) : "Chưa nhập"}
                  </Text>
                </View>
                <Tag tone={editingRow.tone} size="sm">
                  {editingRow.state}
                </Tag>
              </Row>

              <TextField
                value={limitText}
                placeholder="0"
                keyboardType="number"
                onInput={(value) =>
                  setLimitText(value.replace(/[^0-9]/g, ""))
                }
                maxLength={9}
                autoFocus
                testID="limit-input"
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
                min={200000}
                max={10000000}
                step={100000}
                onChange={(event) =>
                  setLimitText(String(Math.round(event.value)))
                }
                testID="limit-slider"
              />

              <Row style={{ gap: 8 }}>
                {QUICK_LIMITS.map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant="outline"
                    onPress={() => setLimitText(String(value))}
                    testID={`quick-${value}`}
                  >
                    {value >= 1000000
                      ? `${value / 1000000} triệu`
                      : `${value / 1000}k`}
                  </Button>
                ))}
              </Row>

              <Button
                icon="check"
                onPress={saveLimit}
                loading={sheetSaving}
                disabled={sheetSaving || draftLimit <= 0}
                testID="save-limit"
              >
                {sheetSaving ? "Đang lưu…" : "Lưu hạn mức"}
              </Button>
            </View>
          ) : null}
        </BottomSheet>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={screenPad}>
          <Card style={{ gap: 12 }}>
            <Row
              style={{
                justifyContent: "spaceBetween",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "bold", color: colors.ink }}
              >
                Tổng ngân sách tháng
              </Text>
              <Tag tone={summary.tone} size="sm">
                {summary.label}
              </Tag>
            </Row>

            <Row style={{ alignItems: "end", gap: 6 }}>
              <Text
                style={{
                  fontSize: 27,
                  fontWeight: "bold",
                  color: colors.brand,
                }}
              >
                {money(prefs.monthlyBudget)}
              </Text>
              <Text
                style={{
                  fontSize: 11.5,
                  color: colors.muted,
                  paddingBottom: 4,
                }}
              >
                / tháng
              </Text>
            </Row>

            <Slider
              value={prefs.monthlyBudget}
              min={5000000}
              max={40000000}
              step={500000}
              onChange={(event) =>
                updatePrefs({ monthlyBudget: Math.round(event.value) })
              }
              testID="budget-slider"
            />
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 10, color: colors.muted }}>5 triệu</Text>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                40 triệu
              </Text>
            </Row>

            <ProgressBar percent={summary.percent} />
            <Row style={{ alignItems: "center" }}>
              <StatTile value={money(summary.spent)} label="đã chi" />
              <Divider vertical color={colors.line} />
              <StatTile
                value={money(Math.max(0, summary.remaining))}
                label="còn lại"
                tone={colors.success}
              />
              <Divider vertical color={colors.line} />
              <StatTile
                value={`${summary.percent}%`}
                label="đã dùng"
                tone={colors.brand}
              />
            </Row>

            <Button
              variant="secondary"
              icon="refresh"
              onPress={savePlan}
              loading={saving}
              testID="save-budget"
            >
              {saving ? "Đang lưu…" : "Lưu ngân sách tháng"}
            </Button>
          </Card>

          <SectionHeader
            title="Theo nhóm"
            note="Chạm Sửa để đổi hạn mức của từng nhóm"
          />

          {rows.map((row) => (
            <Card key={row.category.id} style={{ gap: 9 }}>
              <Row
                style={{
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CategoryMark category={row.category} size={34} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "600",
                      color: colors.ink,
                    }}
                  >
                    {row.category.label}
                  </Text>
                  <Text style={{ fontSize: 10.5, color: colors.muted }}>
                    {row.state}
                  </Text>
                </View>
                <Tag tone={row.tone} size="sm">
                  {`${row.percent}%`}
                </Tag>
                <Button
                  size="sm"
                  variant="text"
                  onPress={() => openEdit(row)}
                  testID={`edit-budget-${row.category.id}`}
                >
                  Sửa
                </Button>
              </Row>
              <ProgressBar
                percent={row.percent}
                color={row.category.color}
              />
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 11.5, color: colors.ink }}>
                  {`Đã chi ${money(row.spent)}`}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {`Hạn mức ${money(row.limit)}`}
                </Text>
              </Row>
            </Card>
          ))}

          <SectionHeader
            title="Nhắc nhở & quy tắc"
            note="Áp dụng cho mọi khoản trong tháng"
          />
          <Card style={{ gap: 12 }}>
            <Checkbox
              checked={prefs.suggest}
              label="Gợi ý hạn mức mỗi đầu tháng"
              onChange={(event) =>
                updatePrefs({ suggest: event.value })
              }
              testID="budget-suggest"
            />
            <Divider color={colors.line} />
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: colors.warningSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="clock" size={17} color={colors.warning} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
                >
                  Nhắc hoá đơn định kỳ
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Báo trước hai ngày, vào lúc 9:00.
                </Text>
              </View>
              <Switch
                value={prefs.remind}
                onChange={(event) => updatePrefs({ remind: event.value })}
                testID="budget-remind"
              />
            </Row>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: colors.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="file" size={17} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
                >
                  Tổng kết Chủ nhật
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Một tin nhắn ngắn về tuần vừa chi.
                </Text>
              </View>
              <Switch
                value={prefs.weeklyReport}
                onChange={(event) =>
                  updatePrefs({ weeklyReport: event.value })
                }
                testID="budget-report"
              />
            </Row>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: colors.successSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="wallet" size={17} color={colors.success} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 13.5, fontWeight: "600", color: colors.ink }}
                >
                  Làm tròn vào quỹ tiết kiệm
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Phần lẻ của mỗi khoản chi được giữ lại.
                </Text>
              </View>
              <Switch
                value={prefs.roundUp}
                onChange={(event) => updatePrefs({ roundUp: event.value })}
                testID="budget-round"
              />
            </Row>
          </Card>

          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            Hạn mức chỉ là mốc tham khảo: chạm trần không chặn khoản chi mới,
            nhưng thẻ sẽ chuyển sang màu cảnh báo.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

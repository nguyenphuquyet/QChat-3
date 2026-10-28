import { showToast, useState } from "@mna/qchat";
import {
  Button,
  Icon,
  NavBar,
  Page,
  Pressable,
  Row,
  ScrollView,
  Slider,
  Switch,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  dayDiff,
  dayNumber,
  dayOffset,
  formatDay,
  formatNumber,
  monthLabel,
  tasksForDay,
  toggleTask,
  updatePrefs,
  usePrefs,
  useTasks,
  weekdayShort,
  weekStats,
} from "../store.js";
import { colors, radius } from "../theme.js";
import {
  AppTabBar,
  Card,
  EmptyState,
  ProgressBar,
  SectionHeader,
  TaskRow,
} from "../ui.js";

/** Bảy ngày quanh hôm nay: một ngày đã qua, hôm nay và năm ngày tới. */
const DAYS = [-1, 0, 1, 2, 3, 4, 5];

/**
 * Tab Kế hoạch: một hàng chip ngày trên header, mục tiêu tuần có thanh tiến độ
 * và slider, công tắc nhắc nhở, rồi danh sách việc của ngày đang chọn.
 */
export function PlanScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenTask: (id: string) => void;
}) {
  const tasks = useTasks();
  const prefs = usePrefs();
  const week = weekStats(tasks, prefs);
  const [selected, setSelected] = useState(dayOffset(0));

  const days = DAYS.map((offset) => dayOffset(offset));
  const list = tasksForDay(tasks, selected);
  const open = list.filter((task) => !task.done);
  const diff = dayDiff(selected);

  const finishDay = () => {
    if (open.length === 0) {
      void showToast("Ngày này đã xong hết rồi", { icon: "none" });
      return;
    }
    for (const task of open) toggleTask(task.id);
    void showToast(`Đã đánh dấu xong ${open.length} việc`, {
      icon: "success",
    });
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Kế hoạch"
          subtitle={monthLabel()}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        >
          <ScrollView
            horizontal
            showsScrollIndicator={false}
            style={{ height: 70 }}
          >
            <Row style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
              {days.map((key) => {
                const active = key === selected;
                const today = key === dayOffset(0);
                const done = tasksForDay(tasks, key).filter(
                  (task) => task.done,
                ).length;
                const total = tasks.filter((task) => task.day === key).length;
                return (
                  <Pressable
                    key={key}
                    testID={`day-${key}`}
                    accessibleLabel={`Chọn ${formatDay(key)}`}
                    onPress={() => setSelected(key)}
                    style={{
                      width: 48,
                      paddingVertical: 8,
                      gap: 2,
                      alignItems: "center",
                      borderRadius: radius.md,
                      backgroundColor: active ? colors.brand : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: active ? colors.brandSoft : colors.muted,
                      }}
                    >
                      {today ? "HÔM NAY" : weekdayShort(key)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: active ? colors.white : colors.ink,
                      }}
                    >
                      {dayNumber(key)}
                    </Text>
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor:
                          total > 0 && done === total
                            ? active
                              ? colors.white
                              : colors.brand
                            : "transparent",
                      }}
                    />
                  </Pressable>
                );
              })}
            </Row>
          </ScrollView>
        </NavBar>
      }
      footer={
        <AppTabBar
          index={props.index}
          badges={props.badges}
          onChange={props.onTab}
        />
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 14 }}>
          <Card style={{ gap: 12 }}>
            <SectionHeader
              title="Mục tiêu tuần"
              note={`${formatNumber(week.done)}/${formatNumber(week.goal)} việc đã xong`}
            />
            <ProgressBar percent={week.goalPercent} />
            <Row
              style={{
                justifyContent: "spaceBetween",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 11.5, color: colors.muted }}>
                {week.goalPercent >= 100
                  ? "Đã đạt mục tiêu — giỏi quá!"
                  : `Còn ${formatNumber(Math.max(0, week.goal - week.done))} việc để chạm mục tiêu`}
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: "600", color: colors.brand }}
              >
                {`${week.goalPercent}%`}
              </Text>
            </Row>
            <View style={{ gap: 2 }}>
              <Slider
                value={prefs.weeklyGoal}
                min={5}
                max={40}
                step={5}
                onChange={(event) =>
                  updatePrefs({ weeklyGoal: Math.round(event.value) })
                }
                testID="weekly-goal"
              />
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 10, color: colors.muted }}>5 việc</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>
                  40 việc
                </Text>
              </Row>
            </View>
          </Card>

          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.brandSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="clock" size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
                >
                  Nhắc nhở mỗi sáng
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Một thông báo lúc 7:30 với việc gấp nhất.
                </Text>
              </View>
              <Switch
                value={prefs.remind}
                onChange={(event) =>
                  updatePrefs({ remind: event.value })
                }
                testID="plan-remind"
              />
            </Row>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.soft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="eye" size={18} color={colors.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
                >
                  Hiện cả việc đã xong
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Tắt để danh sách chỉ còn việc cần làm.
                </Text>
              </View>
              <Switch
                value={prefs.showDone}
                onChange={(event) =>
                  updatePrefs({ showDone: event.value })
                }
                testID="plan-show-done"
              />
            </Row>
          </Card>

          <SectionHeader
            title={formatDay(selected)}
            note={
              list.length === 0
                ? "Chưa có việc nào cho ngày này"
                : `${open.length} cần làm · ${list.length - open.length} đã xong`
            }
          />

          {list.length === 0 ? (
            <Card>
              <EmptyState
                icon="star"
                title="Ngày này đang trống"
                caption={
                  diff < 0
                    ? "Một ngày đã qua không có việc nào. Sạch sẽ!"
                    : "Thêm việc ở tab Hôm nay rồi kéo lịch sang ngày này."
                }
              />
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              {list.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleTask(task.id)}
                  onOpen={() => props.onOpenTask(task.id)}
                />
              ))}
            </View>
          )}

          <Button
            variant="secondary"
            icon="refresh"
            testID="finish-day-button"
            onPress={finishDay}
            disabled={open.length === 0}
          >
            {open.length === 0
              ? "Ngày này đã xong"
              : `Đánh dấu xong ${open.length} việc`}
          </Button>
        </View>
      </ScrollView>
    </Page>
  );
}

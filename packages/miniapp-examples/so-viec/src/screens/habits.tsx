import { showToast, useState } from "@mna/qchat";
import {
  Button,
  Dialog,
  GridView,
  Icon,
  NavBar,
  Page,
  Pressable,
  Row,
  ScrollView,
  Switch,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  formatNumber,
  habitStats,
  habitSummary,
  resetHabitWeek,
  toggleHabit,
  updatePrefs,
  useHabits,
  usePrefs,
} from "../store.js";
import type { Habit } from "../store.js";
import { colors, habitSoft, radius } from "../theme.js";
import {
  AppTabBar,
  Card,
  EmptyState,
  ProgressBar,
  ProgressRing,
  SectionHeader,
} from "../ui.js";

/**
 * Tab Thói quen: lưới hai cột, mỗi ô là một vòng tiến độ tuần và một chạm để
 * đánh dấu hôm nay. Công tắc nhắc nhở và nút đặt lại tuần nằm dưới lưới.
 */
export function HabitsScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
}) {
  const habits = useHabits();
  const prefs = usePrefs();
  const summary = habitSummary(habits);
  const [confirmReset, setConfirmReset] = useState(false);

  const average =
    habits.length === 0
      ? 0
      : Math.round(
          habits.reduce((sum, habit) => sum + habitStats(habit).percent, 0) /
            habits.length,
        );
  const weeklyDone = habits.reduce(
    (sum, habit) => sum + habitStats(habit).doneThisWeek,
    0,
  );
  const weeklyTarget = habits.reduce((sum, habit) => sum + habit.target, 0);

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Thói quen"
          subtitle={`${formatNumber(habits.length)} thói quen · ${formatNumber(weeklyDone)}/${formatNumber(weeklyTarget)} lần tuần này`}
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
        <Dialog
          visible={confirmReset}
          title="Đặt lại tuần này?"
          confirmText="Đặt lại"
          cancelText="Huỷ"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetHabitWeek();
            setConfirmReset(false);
            void showToast("Đã đặt lại chuỗi thói quen", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            Mọi dấu đã hoàn thành trong tuần sẽ bị xoá và các chuỗi ngày bắt đầu
            lại từ 0. Việc và mục tiêu tuần không bị ảnh hưởng.
          </Text>
        </Dialog>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 30,
            gap: 14,
          }}
        >
          <Card style={{ gap: 14 }}>
            <Row style={{ alignItems: "center", gap: 14 }}>
              <ProgressRing size={74} percent={average} color={colors.brand}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "bold",
                    color: colors.ink,
                  }}
                >
                  {`${average}%`}
                </Text>
                <Text style={{ fontSize: 9, color: colors.muted }}>cả tuần</Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "bold", color: colors.ink }}
                >
                  {summary.doneToday === summary.total
                    ? "Hôm nay trọn vẹn"
                    : `Còn ${summary.total - summary.doneToday} thói quen hôm nay`}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {`${summary.doneToday}/${summary.total} đã đánh dấu · chuỗi dài nhất ${summary.bestStreak} ngày`}
                </Text>
                <ProgressBar percent={average} />
              </View>
            </Row>
          </Card>

          <SectionHeader
            title="Bốn thói quen"
            note="Chạm vào ô để đánh dấu hôm nay"
          />

          {habits.length === 0 ? (
            <Card>
              <EmptyState
                icon="heart"
                title="Chưa có thói quen"
                caption="Thói quen giúp ngày trôi có nhịp. Hãy quay lại sau khi thêm."
              />
            </Card>
          ) : (
            <GridView<Habit>
              data={habits}
              numColumns={2}
              style={{ gap: 10, aspectRatio: 0.9 }}
              empty={<EmptyState icon="heart" title="Chưa có thói quen" caption="Thêm thói quen đầu tiên của bạn." />}
              renderItem={(habit) => {
                const stats = habitStats(habit);
                return (
                  <Pressable
                    key={habit.id}
                    testID={`habit-${habit.id}`}
                    accessibleLabel={`Đánh dấu ${habit.name}`}
                    onPress={() => {
                      const nowDone = toggleHabit(habit.id);
                      void showToast(
                        nowDone
                          ? `Đã ghi “${habit.name}”`
                          : `Đã bỏ đánh dấu “${habit.name}”`,
                        { icon: nowDone ? "success" : "none" },
                      );
                    }}
                    style={{
                      padding: 12,
                      gap: 7,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      borderWidth: stats.doneToday ? 1.5 : 1,
                      borderColor: stats.doneToday ? habit.color : colors.line,
                    }}
                  >
                    <Row
                      style={{
                        justifyContent: "spaceBetween",
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 13,
                          backgroundColor: habitSoft(habit),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={habit.icon}
                          size={20}
                          color={habit.color}
                        />
                      </View>
                      {stats.doneToday ? (
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: habit.color,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="check" size={14} color={colors.white} />
                        </View>
                      ) : (
                        <ProgressRing
                          size={28}
                          percent={stats.percent}
                          color={habit.color}
                        />
                      )}
                    </Row>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 13.5,
                        fontWeight: "600",
                        color: colors.ink,
                        lineHeight: 18,
                      }}
                    >
                      {habit.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {`${stats.doneThisWeek}/${habit.target} lần tuần này`}
                    </Text>
                    <ProgressBar
                      percent={stats.percent}
                      color={habit.color}
                    />
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "600",
                        color: stats.doneToday ? habit.color : colors.muted,
                      }}
                    >
                      {stats.streak > 0
                        ? `Chuỗi ${stats.streak} ngày`
                        : "Bắt đầu hôm nay"}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}

          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: "center", gap: 11 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="clock" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
                >
                  Nhắc nhở thói quen
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.muted }}>
                  Nhắc vào 20:30 nếu hôm nay còn thói quen chưa xong.
                </Text>
              </View>
              <Switch
                value={prefs.remind}
                onChange={(event) => updatePrefs({ remind: event.value })}
                testID="habit-remind"
              />
            </Row>
            <Button
              variant="secondary"
              icon="undo"
              testID="reset-habits"
              onPress={() => setConfirmReset(true)}
            >
              Đặt lại tuần này
            </Button>
          </Card>

          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 17,
            }}
          >
            Chuỗi ngày được tính tới hôm nay; nếu hôm nay chưa làm thì tính tới
            hôm qua.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

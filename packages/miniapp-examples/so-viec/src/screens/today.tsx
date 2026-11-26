import { showToast, useState } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Dialog,
  Icon,
  ListView,
  NavBar,
  Page,
  Positioned,
  Pressable,
  Row,
  ScrollView,
  Slider,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  PRIORITIES,
  PROJECTS,
  addTask,
  dayDiff,
  deleteTask,
  formatDay,
  formatMinutes,
  formatNumber,
  greeting,
  habitStats,
  longDay,
  tasksForDay,
  todayKey,
  todayStats,
  toggleHabit,
  toggleTask,
  useHabits,
  usePrefs,
  useTasks,
} from "../store.js";
import type { Priority, Project, Task } from "../store.js";
import { colors, habitSoft, priorityLabel, radius } from "../theme.js";
import {
  AppTabBar,
  Card,
  Chip,
  EmptyState,
  Pill,
  ProgressBar,
  ProgressRing,
  SectionHeader,
  TaskRow,
} from "../ui.js";

/** Số việc "Sắp tới" hé ra thêm mỗi lần danh sách chạm đáy. */
const PAGE = 4;

type TodayRow =
  | { kind: "task"; task: Task }
  | { kind: "habits" }
  | { kind: "section"; title: string; note: string }
  | { kind: "empty" }
  | { kind: "more"; remaining: number };

/** Việc chưa xong từ ngày mai trở đi, xếp theo ngày rồi theo giờ. */
function upcomingTasks(list: readonly Task[]): Task[] {
  return [...list]
    .filter((task) => !task.done && dayDiff(task.day) > 0)
    .sort((left, right) => {
      if (left.day !== right.day) return left.day < right.day ? -1 : 1;
      if (left.time === right.time) return left.createdAt - right.createdAt;
      if (left.time === "") return 1;
      if (right.time === "") return -1;
      return left.time.localeCompare(right.time);
    });
}

/**
 * Tab Hôm nay: một vòng tiến độ trên header, danh sách việc hôm nay, dải thói
 * quen và những việc sắp tới được hé dần khi cuộn.
 *
 * Thêm việc dùng `BottomSheet` (kéo lên từ đáy), xoá bằng nhấn giữ + `Dialog`
 * xác nhận. Cả hai overlay nằm trong `Page.overlays` nên barrier phủ cả header.
 */
export function TodayScreen(props: {
  index: number;
  badges?: Record<string, string | undefined>;
  onTab: (index: number) => void;
  onOpenTask: (id: string) => void;
}) {
  const tasks = useTasks();
  const habits = useHabits();
  const prefs = usePrefs();
  const stats = todayStats(tasks);
  const habitDone = habits.filter((habit) => habitStats(habit).doneToday).length;

  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState<Project>("Cá nhân");
  const [priority, setPriority] = useState<Priority>("normal");
  const [minutes, setMinutes] = useState(30);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const day = todayKey();
  const today = tasksForDay(tasks, day);
  const todays = prefs.showDone
    ? today
    : today.filter((task) => !task.done);
  const later = upcomingTasks(tasks);
  const visibleLater = later.slice(0, page * PAGE);

  const rows: TodayRow[] = [
    {
      kind: "section",
      title: "Hôm nay",
      note:
        stats.total === 0
          ? "Chưa có việc nào"
          : `${stats.remaining} việc còn lại · ${formatMinutes(stats.minutes)}`,
    },
    ...(todays.length === 0
      ? ([{ kind: "empty" }] as TodayRow[])
      : todays.map((task) => ({ kind: "task", task }) as TodayRow)),
    { kind: "habits" },
    {
      kind: "section",
      title: "Sắp tới",
      note: `${formatNumber(later.length)} việc trong những ngày tới`,
    },
    ...visibleLater.map((task) => ({ kind: "task", task }) as TodayRow),
    { kind: "more", remaining: later.length - visibleLater.length },
  ];

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
  };

  const submit = () => {
    if (saving) return;
    const value = title.trim();
    if (value.length === 0) {
      void showToast("Đặt tên cho việc đã nhé", { icon: "error" });
      return;
    }
    setSaving(true);
    // Một nhịp chờ ngắn để thấy nút loading và vòng xoay của iOS; dữ liệu vẫn
    // là bộ nhớ cục bộ nên đây chỉ là phản hồi thị giác.
    setTimeout(() => {
      addTask({ title: value, project, priority, minutes });
      setSaving(false);
      setSheetOpen(false);
      setTitle("");
      setPriority("normal");
      setMinutes(30);
      void showToast(`Đã thêm “${value}”`, { icon: "success" });
    }, 600);
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Sổ Việc"
          subtitle={longDay(day)}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        >
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Card style={{ gap: 14 }}>
              <Row style={{ alignItems: "center", gap: 14 }}>
                <ProgressRing
                  size={82}
                  percent={stats.percent}
                  color={colors.brand}
                >
                  <Text
                    style={{
                      fontSize: 19,
                      fontWeight: "bold",
                      color: colors.ink,
                    }}
                  >
                    {`${stats.percent}%`}
                  </Text>
                  <Text style={{ fontSize: 9.5, color: colors.muted }}>
                    hôm nay
                  </Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}
                  >
                    {greeting()}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: colors.muted }}>
                    {stats.total === 0
                      ? "Một ngày trống — thêm việc đầu tiên nhé."
                      : `${stats.done}/${stats.total} việc đã xong · còn ${formatMinutes(stats.minutes)}`}
                  </Text>
                  <Row style={{ gap: 6, marginTop: 3 }}>
                    <Pill
                      label={`${formatNumber(stats.remaining)} việc`}
                      bg={colors.brandSoft}
                      fg={colors.brand}
                    />
                    <Pill
                      label={`${habitDone}/${habits.length} thói quen`}
                      bg={colors.accentSoft}
                      fg={colors.accent}
                    />
                  </Row>
                </View>
              </Row>
            </Card>
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
          <Positioned right={18} bottom={18}>
            <Pressable
              testID="quick-add"
              accessibleLabel="Thêm việc mới"
              onPress={() => setSheetOpen(true)}
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: {
                  color: "rgba(47,109,92,0.35)",
                  offsetY: 6,
                  blurRadius: 16,
                },
              }}
            >
              <Icon name="plus" size={22} color={colors.white} />
            </Pressable>
          </Positioned>

          <BottomSheet
            visible={sheetOpen}
            onClose={closeSheet}
            height={448}
            testID="quick-sheet"
          >
            <View style={{ gap: 14 }}>
              <Row
                style={{
                  justifyContent: "spaceBetween",
                  alignItems: "center",
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text
                    style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}
                  >
                    Việc mới
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.muted }}>
                    Thêm vào hôm nay, chỉ mất vài giây.
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

              <TextField
                value={title}
                placeholder="Bạn cần làm gì?"
                onInput={setTitle}
                autoFocus
                maxLength={80}
                testID="new-title"
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.line,
                  color: colors.ink,
                }}
              />

              <View style={{ gap: 6 }}>
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
                >
                  Ưu tiên
                </Text>
                <Row style={{ gap: 8 }}>
                  {PRIORITIES.map((entry) => (
                    <Chip
                      key={entry}
                      label={priorityLabel(entry)}
                      active={priority === entry}
                      onPress={() => setPriority(entry)}
                      testID={`priority-${entry}`}
                    />
                  ))}
                </Row>
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}
                >
                  Nhóm
                </Text>
                <Row style={{ gap: 8 }}>
                  {PROJECTS.map((entry) => (
                    <Chip
                      key={entry}
                      label={entry}
                      active={project === entry}
                      onPress={() => setProject(entry)}
                      testID={`project-${entry}`}
                    />
                  ))}
                </Row>
              </View>

              <View style={{ gap: 4 }}>
                <Row style={{ justifyContent: "spaceBetween" }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.muted,
                    }}
                  >
                    Thời lượng dự kiến
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.brand,
                    }}
                  >
                    {formatMinutes(minutes)}
                  </Text>
                </Row>
                <Slider
                  value={minutes}
                  min={15}
                  max={120}
                  step={15}
                  onChange={(event) => setMinutes(event.value)}
                  testID="new-minutes"
                />
              </View>

              <Button
                onPress={submit}
                loading={saving}
                disabled={title.trim().length === 0}
                icon="plus"
                testID="create-task"
              >
                {saving ? "Đang thêm…" : "Thêm việc"}
              </Button>
            </View>
          </BottomSheet>

          <Dialog
            visible={pendingDelete != null}
            title="Xoá việc này?"
            confirmText="Xoá"
            cancelText="Giữ lại"
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              if (pendingDelete) {
                deleteTask(pendingDelete);
                void showToast("Đã xoá việc", { icon: "success" });
              }
              setPendingDelete(null);
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
              Việc sẽ biến mất khỏi mọi ngày trong kế hoạch. Thói quen và số liệu
              tuần không bị ảnh hưởng.
            </Text>
          </Dialog>
        </>
      }
    >
      <ListView<TodayRow>
        testID="today-list"
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 96,
        }}
        data={rows}
        initialCount={16}
        onEndReached={() => setPage((previous) => previous + 1)}
        empty={
          <EmptyState
            icon="check"
            title="Sổ đang trống"
            caption="Chạm nút + ở góc dưới để thêm việc đầu tiên."
          />
        }
        renderItem={(row) => {
          if (row.kind === "task") {
            return (
              <View style={{ marginBottom: 8 }}>
                <TaskRow
                  task={row.task}
                  onToggle={() => toggleTask(row.task.id)}
                  onOpen={() => props.onOpenTask(row.task.id)}
                  onLongPress={() => setPendingDelete(row.task.id)}
                />
              </View>
            );
          }
          if (row.kind === "habits") {
            return (
              <View style={{ gap: 8, paddingVertical: 8 }}>
                <SectionHeader
                  title="Thói quen hôm nay"
                  note="Chạm để đánh dấu — không cần mở tab khác"
                />
                <ScrollView
                  horizontal
                  showsScrollIndicator={false}
                  style={{ height: 96 }}
                >
                  <Row style={{ gap: 10, paddingRight: 4 }}>
                    {habits.map((habit) => {
                      const statsOfHabit = habitStats(habit);
                      return (
                        <Pressable
                          key={habit.id}
                          testID={`today-habit-${habit.id}`}
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
                            width: 142,
                            padding: 11,
                            gap: 6,
                            borderRadius: radius.md,
                            backgroundColor: habitSoft(habit),
                            borderWidth: 1,
                            borderColor: statsOfHabit.doneToday
                              ? habit.color
                              : colors.line,
                          }}
                        >
                          <Row
                            style={{
                              justifyContent: "spaceBetween",
                              alignItems: "center",
                            }}
                          >
                            <Icon
                              name={habit.icon}
                              size={18}
                              color={habit.color}
                            />
                            <Text
                              style={{
                                fontSize: 10.5,
                                fontWeight: "600",
                                color: statsOfHabit.doneToday
                                  ? habit.color
                                  : colors.muted,
                              }}
                            >
                              {statsOfHabit.doneToday
                                ? "Đã xong"
                                : `${statsOfHabit.doneThisWeek}/${habit.target}`}
                            </Text>
                          </Row>
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: colors.ink,
                              lineHeight: 16,
                            }}
                          >
                            {habit.name}
                          </Text>
                          <ProgressBar
                            percent={statsOfHabit.percent}
                            color={habit.color}
                          />
                        </Pressable>
                      );
                    })}
                  </Row>
                </ScrollView>
              </View>
            );
          }
          if (row.kind === "section") {
            return (
              <View style={{ paddingTop: 8, paddingBottom: 6 }}>
                <SectionHeader title={row.title} note={row.note} />
              </View>
            );
          }
          if (row.kind === "empty") {
            return (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <EmptyState
                  icon="check"
                  title="Hôm nay đã sạch việc"
                  caption="Mọi việc trong ngày đều đã xong. Nghỉ một chút nhé."
                />
              </View>
            );
          }
          return (
            <View
              style={{
                alignItems: "center",
                gap: 3,
                paddingTop: 14,
                paddingBottom: 24,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {row.remaining > 0
                  ? `Còn ${row.remaining} việc · cuộn để xem thêm`
                  : "Đã hiển thị hết những ngày tới"}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                {row.remaining > 0
                  ? "Danh sách tải theo từng trang 4 việc"
                  : formatDay(day)}
              </Text>
            </View>
          );
        }}
      />
    </Page>
  );
}

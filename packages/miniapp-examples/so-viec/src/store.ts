import { createStorage, useEffect, useState } from "@mna/qchat";

/**
 * Sổ Việc — dữ liệu của một cuốn sổ tay cá nhân giả lập.
 *
 * Toàn bộ state là JSON thuần: 27 việc trải từ hôm qua tới 5 ngày tới, bốn
 * thói quen và ba tuỳ chọn. Ngày tháng được tính từ `Date` thật của máy, nên
 * mở app hôm nào thì "Hôm nay" là hôm đó; không có ngày nào bị hard-code.
 */

export type Priority = "high" | "normal" | "low";
export type Project = "Công việc" | "Cá nhân" | "Học tập" | "Sức khoẻ";

export const PROJECTS: readonly Project[] = [
  "Công việc",
  "Cá nhân",
  "Học tập",
  "Sức khoẻ",
];

export const PRIORITIES: readonly Priority[] = ["high", "normal", "low"];

export interface Task {
  id: string;
  title: string;
  note: string;
  /** `YYYY-MM-DD`. */
  day: string;
  /** `HH:mm`, hoặc rỗng khi việc không hẹn giờ. */
  time: string;
  minutes: number;
  project: Project;
  priority: Priority;
  done: boolean;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Số lần muốn làm trong một tuần. */
  target: number;
  /** Những ngày đã hoàn thành, dạng `YYYY-MM-DD`. */
  days: string[];
}

export interface Prefs {
  weeklyGoal: number;
  remind: boolean;
  showDone: boolean;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAYS_LONG = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

/* ------------------------------------------------------------------ */
/* Ngày                                                                */
/* ------------------------------------------------------------------ */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
}

export function todayKey(): string {
  return dateKeyOf(new Date());
}

/** Ngày cách hôm nay `offset` ngày; âm là quá khứ. */
export function dayOffset(offset: number): string {
  const now = new Date();
  return dateKeyOf(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset),
  );
}

/** Số ngày từ hôm nay tới `key`; âm là đã qua. */
export function dayDiff(key: string): number {
  const today = dateFromKey(todayKey());
  const target = dateFromKey(key);
  const start = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const end = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** `Hôm qua`, `Hôm nay`, `Ngày mai` hoặc `Thứ Ba, 03/11`. */
export function formatDay(key: string): string {
  const diff = dayDiff(key);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff === -1) return "Hôm qua";
  const date = dateFromKey(key);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** `Thứ Ba, 28/10` — dùng cho tiêu đề phụ của màn hình. */
export function longDay(key: string): string {
  const date = dateFromKey(key);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function monthLabel(): string {
  const now = new Date();
  return `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
}

/** Nhãn ngắn cho chip ngày: `T3`, `T4`… và số ngày. */
export function weekdayShort(key: string): string {
  return WEEKDAYS[dateFromKey(key).getDay()] ?? "T2";
}

export function dayNumber(key: string): string {
  return pad(dateFromKey(key).getDate());
}

/** Bảy ngày của tuần hiện tại, bắt đầu từ thứ Hai. */
export function weekKeys(): string[] {
  const now = new Date();
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const keys: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    keys.push(
      dateKeyOf(
        new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
      ),
    );
  }
  return keys;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/* ------------------------------------------------------------------ */
/* Dữ liệu mẫu                                                         */
/* ------------------------------------------------------------------ */

interface TaskSeed {
  title: string;
  note: string;
  offset: number;
  time: string;
  minutes: number;
  project: Project;
  priority: Priority;
  done?: boolean;
}

const TASK_SEEDS: readonly TaskSeed[] = [
  // Hôm nay — 7 việc, 3 việc đã xong.
  {
    title: "Gửi báo cáo tuần cho chị Hạnh",
    note: "Kèm số liệu 4 tuần gần nhất và hai gợi ý cho sprint tới.",
    offset: 0,
    time: "08:30",
    minutes: 45,
    project: "Công việc",
    priority: "high",
    done: true,
  },
  {
    title: "Họp nhóm thiết kế lúc 10h",
    note: "Mang theo bản thử nghiệm luồng đăng ký mới.",
    offset: 0,
    time: "10:00",
    minutes: 30,
    project: "Công việc",
    priority: "high",
  },
  {
    title: "Uống đủ 2 lít nước",
    note: "Đặt bình ở bàn làm việc để không quên.",
    offset: 0,
    time: "",
    minutes: 5,
    project: "Sức khoẻ",
    priority: "normal",
    done: true,
  },
  {
    title: "Đọc 20 trang “Nghệ thuật tinh gọn”",
    note: "Đọc trước khi ngủ, ghi lại ba ý hay nhất.",
    offset: 0,
    time: "21:00",
    minutes: 25,
    project: "Học tập",
    priority: "normal",
  },
  {
    title: "Đi bộ 30 phút quanh hồ",
    note: "Không mang tai nghe để nghe tiếng thành phố.",
    offset: 0,
    time: "06:30",
    minutes: 30,
    project: "Sức khoẻ",
    priority: "normal",
    done: true,
  },
  {
    title: "Mua quà sinh nhật cho mẹ",
    note: "Mẹ thích trà hoa cúc; ghé tiệm trên đường Nguyễn Du.",
    offset: 0,
    time: "18:00",
    minutes: 40,
    project: "Cá nhân",
    priority: "high",
  },
  {
    title: "Dọn hộp thư đến",
    note: "Trả lời ba email còn treo từ thứ Sáu.",
    offset: 0,
    time: "16:30",
    minutes: 20,
    project: "Công việc",
    priority: "low",
  },

  // Hôm qua — việc đã xong, để chuỗi năng suất có dữ liệu.
  {
    title: "Chốt lịch họp với đối tác",
    note: "",
    offset: -1,
    time: "09:00",
    minutes: 20,
    project: "Công việc",
    priority: "high",
    done: true,
  },
  {
    title: "Gia hạn gói lưu trữ ảnh",
    note: "",
    offset: -1,
    time: "15:00",
    minutes: 10,
    project: "Cá nhân",
    priority: "low",
    done: true,
  },
  {
    title: "Chạy bộ 20 phút",
    note: "",
    offset: -1,
    time: "06:15",
    minutes: 20,
    project: "Sức khoẻ",
    priority: "normal",
    done: true,
  },

  // Ngày mai.
  {
    title: "Chuẩn bị slide demo sản phẩm",
    note: "Sáu slide: vấn đề, cách làm, số liệu, lộ trình.",
    offset: 1,
    time: "09:00",
    minutes: 60,
    project: "Công việc",
    priority: "high",
  },
  {
    title: "Nộp bài tập tuần 4",
    note: "Kiểm tra lại phần trích dẫn trước khi nộp.",
    offset: 1,
    time: "20:00",
    minutes: 45,
    project: "Học tập",
    priority: "high",
  },
  {
    title: "Gọi điện cho bà",
    note: "Hỏi thăm vườn rau trên sân thượng.",
    offset: 1,
    time: "19:30",
    minutes: 15,
    project: "Cá nhân",
    priority: "normal",
  },
  {
    title: "Tập yoga 25 phút",
    note: "",
    offset: 1,
    time: "06:00",
    minutes: 25,
    project: "Sức khoẻ",
    priority: "low",
  },

  // +2 ngày.
  {
    title: "Đọc lại hợp đồng thuê nhà",
    note: "Chú ý điều khoản gia hạn và mức tăng giá năm sau.",
    offset: 2,
    time: "14:00",
    minutes: 35,
    project: "Cá nhân",
    priority: "high",
  },
  {
    title: "Học 10 từ vựng tiếng Anh",
    note: "",
    offset: 2,
    time: "21:30",
    minutes: 15,
    project: "Học tập",
    priority: "normal",
  },
  {
    title: "Đặt lịch khám răng định kỳ",
    note: "",
    offset: 2,
    time: "11:00",
    minutes: 10,
    project: "Sức khoẻ",
    priority: "low",
  },

  // +3 ngày.
  {
    title: "Team lunch cuối tuần",
    note: "Đặt bàn cho 6 người ở quán bún chả sau văn phòng.",
    offset: 3,
    time: "12:00",
    minutes: 90,
    project: "Công việc",
    priority: "normal",
  },
  {
    title: "Viết nhật ký tuần",
    note: "Ba điều biết ơn, một điều muốn thử lại.",
    offset: 3,
    time: "22:00",
    minutes: 20,
    project: "Cá nhân",
    priority: "normal",
  },
  {
    title: "Sạc lại tai nghe dự phòng",
    note: "",
    offset: 3,
    time: "",
    minutes: 5,
    project: "Cá nhân",
    priority: "low",
  },

  // +4 ngày.
  {
    title: "Lên kế hoạch cho tuần sau",
    note: "Chọn tối đa ba việc quan trọng nhất.",
    offset: 4,
    time: "17:00",
    minutes: 30,
    project: "Công việc",
    priority: "normal",
  },
  {
    title: "Đi chợ cuối tuần",
    note: "Rau, trứng, sữa chua và cà phê hạt.",
    offset: 4,
    time: "08:00",
    minutes: 60,
    project: "Cá nhân",
    priority: "normal",
  },
  {
    title: "Đọc xong chương 5",
    note: "",
    offset: 4,
    time: "20:30",
    minutes: 40,
    project: "Học tập",
    priority: "low",
  },
  {
    title: "Tưới cây ban công",
    note: "",
    offset: 4,
    time: "",
    minutes: 10,
    project: "Sức khoẻ",
    priority: "low",
  },

  // +5 ngày.
  {
    title: "Gửi lời cảm ơn tới mentor",
    note: "Cảm ơn vì buổi góp ý hôm thứ Năm.",
    offset: 5,
    time: "09:30",
    minutes: 15,
    project: "Công việc",
    priority: "normal",
  },
  {
    title: "Chuẩn bị đồ đi làm thứ Hai",
    note: "Là áo sơ mi, sạc laptop, thẻ ra vào.",
    offset: 5,
    time: "21:00",
    minutes: 15,
    project: "Cá nhân",
    priority: "low",
  },
  {
    title: "Nghe podcast về thiết kế",
    note: "Tập mới về khoảng trắng trong giao diện.",
    offset: 5,
    time: "18:30",
    minutes: 30,
    project: "Học tập",
    priority: "low",
  },
];

const DEFAULT_PREFS: Prefs = { weeklyGoal: 20, remind: true, showDone: true };

function seedTasks(): Task[] {
  const now = Date.now();
  return TASK_SEEDS.map((seed, index) => ({
    id: `t${index + 1}`,
    title: seed.title,
    note: seed.note,
    day: dayOffset(seed.offset),
    time: seed.time,
    minutes: seed.minutes,
    project: seed.project,
    priority: seed.priority,
    done: seed.done === true,
    createdAt: now - (TASK_SEEDS.length - index) * 3_600_000,
  }));
}

function seedHabits(): Habit[] {
  return [
    {
      id: "nuoc",
      name: "Uống đủ 2 lít nước",
      icon: "heart",
      color: "#2f6d5c",
      target: 7,
      days: [dayOffset(0), dayOffset(-1), dayOffset(-2), dayOffset(-4)],
    },
    {
      id: "di-bo",
      name: "Đi bộ 30 phút",
      icon: "nearby",
      color: "#39699e",
      target: 5,
      days: [
        dayOffset(0),
        dayOffset(-1),
        dayOffset(-2),
        dayOffset(-3),
        dayOffset(-4),
      ],
    },
    {
      id: "doc-sach",
      name: "Đọc 20 trang sách",
      icon: "official",
      color: "#a8801f",
      target: 4,
      days: [dayOffset(0), dayOffset(-2), dayOffset(-4), dayOffset(-6)],
    },
    {
      id: "nhat-ky",
      name: "Viết nhật ký",
      icon: "pencil",
      color: "#c06a2b",
      target: 3,
      days: [dayOffset(-1), dayOffset(-3)],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let tasks: Task[] = seedTasks();
let habits: Habit[] = seedHabits();
let prefs: Prefs = { ...DEFAULT_PREFS };
let nextTaskId = 100;
let hydrated = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const storage = createStorage("so-viec");

interface Snapshot {
  tasks: Task[];
  habits: Habit[];
  prefs: Prefs;
  nextTaskId: number;
}

function persist(): void {
  void storage
    .set("state", {
      tasks,
      habits,
      prefs,
      nextTaskId,
    } satisfies Snapshot)
    .catch(() => {
      // Lưu trữ là tuỳ chọn: thiếu quyền không được làm app hỏng.
    });
}

/** Nạp state đã lưu một lần khi app khởi động. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const saved = await storage.get<Snapshot>("state");
    if (!saved) return;
    if (Array.isArray(saved.tasks)) tasks = saved.tasks;
    if (Array.isArray(saved.habits)) habits = saved.habits;
    prefs = { ...DEFAULT_PREFS, ...(saved.prefs ?? {}) };
    if (typeof saved.nextTaskId === "number") nextTaskId = saved.nextTaskId;
    emit();
  } catch {
    // Lần chạy đầu hoặc quyền bị từ chối: dữ liệu mẫu vẫn dùng được.
  }
}

export function useTasks(): Task[] {
  const [snapshot, setSnapshot] = useState<Task[]>(tasks);
  useEffect(() => subscribe(() => setSnapshot(tasks)), []);
  return snapshot;
}

export function useHabits(): Habit[] {
  const [snapshot, setSnapshot] = useState<Habit[]>(habits);
  useEffect(() => subscribe(() => setSnapshot(habits)), []);
  return snapshot;
}

export function usePrefs(): Prefs {
  const [snapshot, setSnapshot] = useState<Prefs>(prefs);
  useEffect(() => subscribe(() => setSnapshot(prefs)), []);
  return snapshot;
}

/* ------------------------------------------------------------------ */
/* Việc                                                                */
/* ------------------------------------------------------------------ */

export function sortTasks(list: readonly Task[]): Task[] {
  return [...list].sort((left, right) => {
    if (left.time === right.time) {
      return left.createdAt - right.createdAt;
    }
    if (left.time === "") return 1;
    if (right.time === "") return -1;
    return left.time.localeCompare(right.time);
  });
}

/** Việc của một ngày: chưa xong trước, đã xong sau, mỗi nhóm theo giờ. */
export function tasksForDay(list: readonly Task[], key: string): Task[] {
  const day = sortTasks(list.filter((task) => task.day === key));
  return [
    ...day.filter((task) => !task.done),
    ...day.filter((task) => task.done),
  ];
}

export function taskById(id: string): Task | null {
  return tasks.find((task) => task.id === id) ?? null;
}

export interface NewTask {
  title: string;
  project: Project;
  priority: Priority;
  minutes?: number;
  day?: string;
}

export function addTask(input: NewTask): Task {
  const task: Task = {
    id: `t${nextTaskId}`,
    title: input.title.trim(),
    note: "",
    day: input.day ?? todayKey(),
    time: "",
    minutes: input.minutes ?? 30,
    project: input.project,
    priority: input.priority,
    done: false,
    createdAt: Date.now(),
  };
  nextTaskId += 1;
  tasks = [...tasks, task];
  emit();
  persist();
  return task;
}

export function toggleTask(id: string): void {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  );
  emit();
  persist();
}

export function setTaskNote(id: string, note: string): void {
  tasks = tasks.map((task) => (task.id === id ? { ...task, note } : task));
  emit();
  persist();
}

export function deleteTask(id: string): void {
  tasks = tasks.filter((task) => task.id !== id);
  emit();
  persist();
}

export function clearDoneTasks(): number {
  const removed = tasks.filter((task) => task.done).length;
  tasks = tasks.filter((task) => !task.done);
  emit();
  persist();
  return removed;
}

/* ------------------------------------------------------------------ */
/* Thói quen                                                           */
/* ------------------------------------------------------------------ */

export function toggleHabit(id: string): boolean {
  const key = todayKey();
  let nowDone = false;
  habits = habits.map((habit) => {
    if (habit.id !== id) return habit;
    const done = habit.days.includes(key);
    nowDone = !done;
    return {
      ...habit,
      days: done ? habit.days.filter((day) => day !== key) : [...habit.days, key],
    };
  });
  emit();
  persist();
  return nowDone;
}

export function resetHabitWeek(): void {
  habits = habits.map((habit) => ({ ...habit, days: [] }));
  emit();
  persist();
}

export interface HabitStats {
  doneThisWeek: number;
  percent: number;
  streak: number;
  doneToday: boolean;
}

/** Chuỗi ngày liên tiếp tính tới hôm nay; hôm nay chưa làm thì tính tới hôm qua. */
export function habitStats(habit: Habit): HabitStats {
  const week = weekKeys();
  const doneThisWeek = week.filter((key) => habit.days.includes(key)).length;
  const percent = Math.min(
    100,
    Math.round((doneThisWeek / Math.max(1, habit.target)) * 100),
  );
  const cursor = new Date();
  if (!habit.days.includes(dateKeyOf(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (habit.days.includes(dateKeyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    doneThisWeek,
    percent,
    streak,
    doneToday: habit.days.includes(todayKey()),
  };
}

/* ------------------------------------------------------------------ */
/* Số liệu                                                             */
/* ------------------------------------------------------------------ */

export interface TodayStats {
  total: number;
  done: number;
  remaining: number;
  percent: number;
  /** Số phút còn lại của những việc chưa xong. */
  minutes: number;
}

export function todayStats(list: readonly Task[]): TodayStats {
  const day = list.filter((task) => task.day === todayKey());
  const done = day.filter((task) => task.done).length;
  return {
    total: day.length,
    done,
    remaining: day.length - done,
    percent: day.length === 0 ? 0 : Math.round((done / day.length) * 100),
    minutes: day
      .filter((task) => !task.done)
      .reduce((sum, task) => sum + task.minutes, 0),
  };
}

export interface WeekStats {
  total: number;
  done: number;
  percent: number;
  goal: number;
  goalPercent: number;
}

export function weekStats(
  list: readonly Task[],
  options: Prefs = prefs,
): WeekStats {
  const week = weekKeys();
  const inWeek = list.filter((task) => week.includes(task.day));
  const done = inWeek.filter((task) => task.done).length;
  const goal = Math.max(1, options.weeklyGoal);
  return {
    total: inWeek.length,
    done,
    percent: inWeek.length === 0 ? 0 : Math.round((done / inWeek.length) * 100),
    goal,
    goalPercent: Math.min(100, Math.round((done / goal) * 100)),
  };
}

export function habitSummary(list: readonly Habit[]): {
  doneToday: number;
  total: number;
  bestStreak: number;
} {
  let doneToday = 0;
  let bestStreak = 0;
  for (const habit of list) {
    const stats = habitStats(habit);
    if (stats.doneToday) doneToday += 1;
    if (stats.streak > bestStreak) bestStreak = stats.streak;
  }
  return { doneToday, total: list.length, bestStreak };
}

/* ------------------------------------------------------------------ */
/* Tuỳ chọn và đặt lại                                                 */
/* ------------------------------------------------------------------ */

export function updatePrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  emit();
  persist();
}

export function resetAll(): void {
  tasks = seedTasks();
  habits = seedHabits();
  prefs = { ...DEFAULT_PREFS };
  nextTaskId = 100;
  void storage.remove("state").catch(() => {
    // Xoá thất bại vẫn để app chạy với dữ liệu mẫu trong bộ nhớ.
  });
  emit();
}

/* ------------------------------------------------------------------ */
/* Định dạng                                                           */
/* ------------------------------------------------------------------ */

let numberFormat: Intl.NumberFormat | null = null;

/** `Intl` đến từ `@mna/qchat/env/auto`, được cài một lần ở `main.tsx`. */
export function formatNumber(value: number): string {
  if (!numberFormat) {
    numberFormat = new Intl.NumberFormat("vi-VN");
  }
  return numberFormat.format(value);
}

export function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

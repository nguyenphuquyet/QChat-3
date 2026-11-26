import "@mna/qchat/env/auto";

import {
  navigateBack,
  navigateTo,
  start,
  useEffect,
  useLifecycle,
  useState,
} from "@mna/qchat";
import {
  habitStats,
  hydrate,
  todayStats,
  useHabits,
  usePrefs,
  useTasks,
} from "./store.js";
import { AboutScreen } from "./screens/about.js";
import { HabitsScreen } from "./screens/habits.js";
import { MeScreen } from "./screens/me.js";
import { PlanScreen } from "./screens/plan.js";
import { TaskScreen } from "./screens/task.js";
import { TodayScreen } from "./screens/today.js";

/**
 * Sổ Việc — app gốc.
 *
 * Bốn tab do app tự vẽ; hai route nội bộ (`/task/:id`, `/about`) nằm ngoài
 * thanh tab. Route stack do host giữ: app chỉ dịch mỗi `navigate`/`back` thành
 * màn hình tương ứng, nên khung hình gửi lên đúng là khung hình host trượt vào.
 */
function App() {
  const tasks = useTasks();
  const habits = useHabits();
  const prefs = usePrefs();
  const stats = todayStats(tasks);
  const habitsLeft = habits.filter(
    (habit) => !habitStats(habit).doneToday,
  ).length;

  const [index, setIndex] = useState(0);
  const [routes, setRoutes] = useState<string[]>([]);
  const route = routes.length > 0 ? routes[routes.length - 1] : null;

  useEffect(() => {
    void hydrate();
  }, []);

  useLifecycle((event, payload) => {
    if (event !== "navigate" && event !== "back") return;
    const data = (payload ?? {}) as { path?: string | null };
    const path =
      typeof data.path === "string" && data.path.length > 0 ? data.path : null;
    setRoutes((current) => {
      if (path == null) return current.length === 0 ? current : [];
      if (current[current.length - 1] === path) return current;
      if (current[current.length - 2] === path) return current.slice(0, -1);
      return [...current, path];
    });
  });

  // Host gọi trước để route được đánh dấu trước khung hình của app: đó là thứ
  // biến lần chuyển màn hình thành cú trượt Cupertino thay vì cắt ngang.
  const push = (path: string) => {
    void navigateTo(path).catch(() => {
      // Host xem trước không có router vẫn hiển thị được màn hình.
    });
    setRoutes((current) => [...current, path]);
  };

  const back = () => {
    void navigateBack().catch(() => {
      // Cùng lý do như trên.
    });
    setRoutes((current) => current.slice(0, -1));
  };

  const selectTab = (next: number) => {
    setIndex(next);
    setRoutes((current) => (current.length === 0 ? current : []));
  };

  if (route && route.startsWith("/task/")) {
    return (
      <TaskScreen taskId={route.slice("/task/".length)} onBack={back} />
    );
  }

  if (route === "/about") {
    return <AboutScreen onBack={back} />;
  }

  const badges: Record<string, string | undefined> = {
    today: stats.remaining > 0 ? String(stats.remaining) : undefined,
    habits: habitsLeft > 0 ? String(habitsLeft) : undefined,
  };

  if (index === 0) {
    return (
      <TodayScreen
        index={index}
        badges={badges}
        onTab={selectTab}
        onOpenTask={(id) => push(`/task/${id}`)}
      />
    );
  }

  if (index === 1) {
    return (
      <PlanScreen
        index={index}
        badges={badges}
        onTab={selectTab}
        onOpenTask={(id) => push(`/task/${id}`)}
      />
    );
  }

  if (index === 2) {
    return (
      <HabitsScreen index={index} badges={badges} onTab={selectTab} />
    );
  }

  return (
    <MeScreen
      index={index}
      badges={badges}
      onTab={selectTab}
      onOpenAbout={() => push("/about")}
    />
  );
}

start(App);

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
  hydrate,
  overBudgetCount,
  todayCount,
  useBudgets,
  useTxns,
} from "./store.js";
import { AboutScreen } from "./screens/about.js";
import { BudgetsScreen } from "./screens/budgets.js";
import { GalleryScreen } from "./screens/gallery.js";
import { MeScreen } from "./screens/me.js";
import { OverviewScreen } from "./screens/overview.js";
import { TxnScreen } from "./screens/txn.js";
import { TxnsScreen } from "./screens/txns.js";

/**
 * Ví Nhỏ — app gốc.
 *
 * Bốn tab do app tự vẽ; ba route nội bộ (`/giao-dich/:id`, `/bo-dieu-khien`,
 * `/about`) nằm ngoài thanh tab. Route stack do host giữ: app chỉ dịch mỗi
 * `navigate`/`back` thành màn hình tương ứng, nên khung hình gửi lên đúng là
 * khung hình host trượt vào.
 */
function App() {
  const txns = useTxns();
  const budgets = useBudgets();

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

  if (route && route.startsWith("/giao-dich/")) {
    return (
      <TxnScreen
        txnId={route.slice("/giao-dich/".length)}
        onBack={back}
      />
    );
  }

  if (route === "/bo-dieu-khien") {
    return <GalleryScreen onBack={back} />;
  }

  if (route === "/about") {
    return (
      <AboutScreen onBack={back} onOpenGallery={() => push("/bo-dieu-khien")} />
    );
  }

  const over = overBudgetCount(txns, budgets);
  const today = todayCount(txns);
  const badges: Record<string, string | undefined> = {
    txns: today > 0 ? String(today) : undefined,
    budgets: over > 0 ? String(over) : undefined,
  };

  if (index === 0) {
    return (
      <OverviewScreen
        index={index}
        badges={badges}
        onTab={selectTab}
        onOpenTxn={(id) => push(`/giao-dich/${id}`)}
      />
    );
  }

  if (index === 1) {
    return (
      <TxnsScreen
        index={index}
        badges={badges}
        onTab={selectTab}
        onOpenTxn={(id) => push(`/giao-dich/${id}`)}
      />
    );
  }

  if (index === 2) {
    return (
      <BudgetsScreen index={index} badges={badges} onTab={selectTab} />
    );
  }

  return (
    <MeScreen
      index={index}
      badges={badges}
      onTab={selectTab}
      onOpenGallery={() => push("/bo-dieu-khien")}
      onOpenAbout={() => push("/about")}
    />
  );
}

start(App);

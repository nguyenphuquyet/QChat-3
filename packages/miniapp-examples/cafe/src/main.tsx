import "@mna/qchat/env/auto";

import { navigateTo, start, useEffect, useLifecycle, useState } from "@mna/qchat";
import { TabBar, View } from "@mna/qchat/ui";
import type { TabItem } from "@mna/qchat/ui";
import { cartCount, hydrate, useCart, useOrders } from "./store.js";
import { colors } from "./theme.js";
import { AccountScreen } from "./screens/account.js";
import { DrinkScreen } from "./screens/drink.js";
import { LegalScreen } from "./screens/legal.js";
import { MenuScreen } from "./screens/menu.js";
import { OffersScreen } from "./screens/offers.js";
import { OrdersScreen } from "./screens/orders.js";

const TABS = [
  { key: "menu", label: "Thực đơn", icon: "chats" },
  { key: "orders", label: "Đơn hàng", icon: "receipt" },
  { key: "offers", label: "Ưu đãi", icon: "ticketPercent" },
  { key: "me", label: "Tài khoản", icon: "me" },
] as const;

function App() {
  const [index, setIndex] = useState(0);
  const [route, setRoute] = useState<string | null>(null);
  const cart = useCart();
  const orders = useOrders();

  useEffect(() => {
    void hydrate();
  }, []);

  // The host owns the route stack. It reports every push and pop, and the app
  // only decides which screen that path means.
  useLifecycle((event, payload) => {
    if (event === "navigate") {
      const data = (payload ?? {}) as { path?: string | null };
      setRoute(typeof data.path === "string" ? data.path : null);
      return;
    }
    if (event === "back") {
      const data = (payload ?? {}) as { path?: string | null };
      setRoute(typeof data.path === "string" && data.path.length > 0 ? data.path : null);
    }
  });

  const openDrink = (id: string) => {
    setRoute(`/drink/${id}`);
    void navigateTo(`/drink/${id}`).catch(() => {
      // A preview host without a router still shows the page.
    });
  };

  if (route && route.startsWith("/drink/")) {
    const id = route.slice("/drink/".length);
    return <DrinkScreen drinkId={id} onBack={() => setRoute(null)} />;
  }

  if (route === "/legal") {
    return <LegalScreen onBack={() => setRoute(null)} />;
  }

  const activeOrders = orders.filter(
    (order) => order.status === "brewing" || order.status === "delivering",
  ).length;

  const tabs: TabItem[] = TABS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.icon,
    badge:
      entry.key === "menu" && cartCount(cart) > 0
        ? String(cartCount(cart))
        : entry.key === "orders" && activeOrders > 0
          ? String(activeOrders)
          : undefined,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {index === 0 ? <MenuScreen onOpenDrink={openDrink} /> : null}
      {index === 1 ? <OrdersScreen onGoMenu={() => setIndex(0)} /> : null}
      {index === 2 ? <OffersScreen onGoMenu={() => setIndex(0)} /> : null}
      {index === 3 ? (
        <AccountScreen
          onOpenLegal={() => {
            setRoute("/legal");
            void navigateTo("/legal").catch(() => {
              // Same fallback as above.
            });
          }}
        />
      ) : null}

      <TabBar
        tabs={tabs}
        activeIndex={index}
        onChange={(event) => {
          setIndex(event.index);
          setRoute(null);
        }}
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      />
    </View>
  );
}

start(App);

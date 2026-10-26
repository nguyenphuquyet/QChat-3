import "@mna/qchat/env/auto";

import { start, useLifecycle, useState } from "@mna/qchat";
import { NavBar, TabBar, View } from "@mna/qchat/ui";
import type { TabItem } from "@mna/qchat/ui";
import { pushLog, useLogs } from "./store.js";
import { colors } from "./theme.js";
import { DetailScreen } from "./screens/detail.js";
import { DebugScreen } from "./screens/debug.js";
import { FormScreen } from "./screens/form.js";
import { HostApiScreen } from "./screens/host-api.js";
import { OverviewScreen } from "./screens/overview.js";
import { UiKitScreen } from "./screens/ui-kit.js";

/** `title` and `subtitle` feed the NavBar; `label`/`icon` feed the TabBar. */
interface DemoTab extends TabItem {
  title: string;
  subtitle: string;
}

const TABS: DemoTab[] = [
  {
    key: "overview",
    label: "Tổng quan",
    icon: "chats",
    title: "Demo Kit",
    subtitle: "NavBar + TabBar + host API",
  },
  {
    key: "ui",
    label: "UI Kit",
    icon: "grid",
    title: "UI Kit",
    subtitle: "Mọi thành phần và style key",
  },
  {
    key: "form",
    label: "Form",
    icon: "keyboard",
    title: "Form",
    subtitle: "Nhập liệu, kiểm tra, gửi",
  },
  {
    key: "host",
    label: "API",
    icon: "miniApps",
    title: "Host API",
    subtitle: "Thiết bị, QChat, storage, mạng",
  },
  {
    key: "debug",
    label: "Debug",
    icon: "radar",
    title: "Debug",
    subtitle: "Log, timer, vòng đời",
  },
];

function App() {
  const [index, setIndex] = useState(0);
  const [route, setRoute] = useState<string | null>(null);
  const logs = useLogs();
  const tab = TABS[index] ?? TABS[0];

  // The host reports every route change and every pause/resume. Recording them
  // in the shared log is how the Debug tab shows lifecycle traffic.
  useLifecycle((event, payload) => {
    if (event === "navigate" || event === "back") {
      const data = (payload ?? {}) as { path?: string | null };
      const path =
        typeof data.path === "string" && data.path.length > 0
          ? data.path
          : null;
      setRoute(path);
      pushLog("route", `${event} → ${path ?? "(về gốc)"}`);
      return;
    }
    if (event === "resume" || event === "pause") {
      pushLog("lifecycle", event, event === "pause" ? "warn" : "info");
    }
  });

  const tabs: TabItem[] = TABS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.icon,
    badge:
      entry.key === "debug" && logs.length > 0
        ? logs.length > 99
          ? "99+"
          : String(logs.length)
        : undefined,
  }));

  if (route) {
    return <DetailScreen path={route} tabs={tabs} activeIndex={index} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title={tab.title}
        subtitle={tab.subtitle}
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      />
      {tab.key === "overview" ? <OverviewScreen /> : null}
      {tab.key === "ui" ? <UiKitScreen /> : null}
      {tab.key === "form" ? <FormScreen /> : null}
      {tab.key === "host" ? <HostApiScreen /> : null}
      {tab.key === "debug" ? <DebugScreen /> : null}
      <TabBar
        tabs={tabs}
        activeIndex={index}
        onChange={(event) => {
          setIndex(event.index);
          pushLog("tab", `chuyển sang ${TABS[event.index]?.key ?? event.key}`);
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

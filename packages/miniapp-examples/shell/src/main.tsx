import { createContext, start, useContext, useEffect, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { getStorage, setStorage } from "@mna/qchat/storage";
import {
  Button,
  ListView,
  NavBar,
  ScrollView,
  Switch,
  TabBar,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import type { TabItem } from "@mna/qchat/ui";

const TABS: TabItem[] = [
  { key: "home", label: "Trang chủ", icon: "chats" },
  { key: "discover", label: "Khám phá", icon: "discover" },
  { key: "jobs", label: "Công việc", icon: "grid" },
  { key: "profile", label: "Cá nhân", icon: "me" },
];

type Theme = "light" | "dark";
/** The header and screens read the theme through context, not props. */
const ThemeContext = createContext<Theme>("light");

const STORAGE_KEY = "shell.notifications";

/** A child component that owns its state; the parent never touches it. */
function SearchBox() {
  const [query, setQuery] = useState("");
  useEffect(() => {
    return () => {
      // Runs when the tab unmounts.
    };
  }, []);
  return (
    <View style={{ backgroundColor: "#ffffff" }}>
      <TextField
        value={query}
        placeholder="Tìm trong ứng dụng"
        onChange={(event) => setQuery(event.value)}
        style={{
          borderTopWidth: 1,
          borderTopColor: "#ededed",
          borderBottomWidth: 1,
          borderBottomColor: "#ededed",
        }}
      />
    </View>
  );
}

function Home() {
  const [notifications, setNotifications] = useState(false);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    let active = true;
    void getStorage<boolean>(STORAGE_KEY).then((value) => {
      if (active && typeof value === "boolean") setNotifications(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (value: boolean) => {
    setNotifications(value);
    void setStorage(STORAGE_KEY, value);
  };

  return (
    <View style={{ gap: 12, padding: 16 }}>
      <SearchBox />
      <View
        style={{
          gap: 8,
          padding: 14,
          borderRadius: 12,
          backgroundColor: theme === "dark" ? "#101010" : "#f6f6f6",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>Xin chào</Text>
        <Text style={{ color: "#666666" }}>
          Header, TabBar và form này đều là widget Flutter thật.
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "spaceBetween",
            alignItems: "center",
          }}
        >
          <Text>Nhận thông báo</Text>
          <Switch value={notifications} onChange={(event) => toggle(event.value)} />
        </View>
      </View>
      <Button onPress={() => void showToast("Đã đồng bộ")}>Đồng bộ dữ liệu</Button>
    </View>
  );
}

function Discover() {
  const items = Array.from({ length: 60 }, (_item, index) => `Mục #${index + 1}`);
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Khám phá</Text>
      <Text style={{ color: "#666666" }}>
        Danh sách dài chỉ gửi một phần đầu tiên trong frame.
      </Text>
      <ListView
        data={items}
        initialCount={20}
        renderItem={(label) => (
          <View
            style={{
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: "#efefef",
            }}
          >
            <Text>{label}</Text>
          </View>
        )}
      />
    </View>
  );
}

const TASKS = ["Viết tài liệu", "Kiểm tra hợp đồng", "Gửi báo cáo"];

function Jobs() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Công việc</Text>
      {TASKS.map((task) => (
        <View
          key={task}
          style={{ padding: 12, borderRadius: 10, backgroundColor: "#f6f6f6" }}
        >
          <Text>{task}</Text>
        </View>
      ))}
    </View>
  );
}

function Profile() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Cá nhân</Text>
      <Text style={{ color: "#666666" }}>
        Thông tin hồ sơ lấy từ QChat qua host; màn hình này chỉ là ví dụ.
      </Text>
    </View>
  );
}

function App() {
  const [index, setIndex] = useState(0);
  const tab = TABS[index] ?? TABS[0];

  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <NavBar title={tab.label} />
      <ScrollView style={{ flex: 1 }}>
        {tab.key === "home" ? <Home /> : null}
        {tab.key === "discover" ? <Discover /> : null}
        {tab.key === "jobs" ? <Jobs /> : null}
        {tab.key === "profile" ? <Profile /> : null}
      </ScrollView>
      <TabBar
        tabs={TABS}
        activeIndex={index}
        onChange={(event) => setIndex(event.index)}
      />
    </View>
  );
}

start(App);

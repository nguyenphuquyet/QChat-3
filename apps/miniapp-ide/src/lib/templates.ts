export const STARTER_SOURCE = `import "@mna/qchat/env/auto";
import { start, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { Button, Text, View } from "@mna/qchat/ui";

const highlights = [
  "Compiled to a sandboxed JS bundle",
  "Rendered with real Flutter widgets",
  "No DOM and no WebView",
];

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c6cff" }}>
        QCHAT MINI APP
      </Text>
      <Text style={{ fontSize: 30, fontWeight: "bold", lineHeight: 1.15 }}>
        Build once. Run natively.
      </Text>
      <Text style={{ fontSize: 15, color: "#8b93a7", lineHeight: 1.5 }}>
        This TSX file becomes a .japp package and runs inside the QChat
        QuickJS host.
      </Text>

      <View style={{ gap: 8, marginTop: 8 }}>
        {highlights.map((item) => (
          <Text key={item} style={{ fontSize: 14, color: "#b9c0d0" }}>
            • {item}
          </Text>
        ))}
      </View>

      <View
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 18,
          backgroundColor: "#121722",
          borderWidth: 1,
          borderColor: "#252e40",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600" }}>
          Tapped {count} {count === 1 ? "time" : "times"}
        </Text>
        <Button
          onPress={() => {
            setCount((value) => value + 1);
            void showToast("Hello from JavaScript");
          }}
        >
          Increment
        </Button>
      </View>
    </View>
  );
}

start(App);
`;

export const COUNTER_SOURCE = `import "@mna/qchat/env/auto";
import { start, useEffect, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { getStorage, setStorage } from "@mna/qchat/storage";
import { Button, Row, Text, View } from "@mna/qchat/ui";

const STORAGE_KEY = "counter.value";

function App() {
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getStorage<number>(STORAGE_KEY).then((value) => {
      if (!mounted) return;
      if (typeof value === "number" && Number.isFinite(value)) setCount(value);
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loaded) void setStorage(STORAGE_KEY, count);
  }, [loaded, count]);

  return (
    <View style={{ flex: 1, padding: 24, gap: 18, justifyContent: "center" }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#7c6cff" }}>
        PERSISTENT COUNTER
      </Text>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Counter</Text>
      <Text style={{ fontSize: 15, color: "#8b93a7", lineHeight: 1.5 }}>
        The value survives a reload because storage is handled by the QChat
        host.
      </Text>
      <Text
        testID="count"
        style={{ fontSize: 64, fontWeight: "bold", textAlign: "center" }}
      >
        {count}
      </Text>
      <Row style={{ gap: 10, justifyContent: "center" }}>
        <Button variant="secondary" onPress={() => setCount(count - 1)}>
          Decrement
        </Button>
        <Button onPress={() => setCount(count + 1)}>Increment</Button>
      </Row>
      <Button
        variant="text"
        onPress={() => {
          setCount(0);
          void showToast("Counter reset");
        }}
      >
        Reset
      </Button>
    </View>
  );
}

start(App);
`;

export const BLANK_SOURCE = `import "@mna/qchat/env/auto";
import { start, useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";

export default function App() {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>New mini app</Text>
      <Text style={{ fontSize: 15, color: "#8b93a7" }}>
        Edit src/main.tsx and run the build.
      </Text>
      <Button onPress={() => setPressed(true)}>
        {pressed ? "Pressed" : "Tap me"}
      </Button>
    </View>
  );
}

start(App);
`;

export const TEMPLATE_LABELS: Record<
  "starter" | "counter" | "blank",
  { title: string; description: string; source: string }
> = {
  starter: {
    title: "Starter",
    description: "A polished first screen with state and a toast.",
    source: STARTER_SOURCE,
  },
  counter: {
    title: "Counter",
    description: "Persistent state through the host storage API.",
    source: COUNTER_SOURCE,
  },
  blank: {
    title: "Blank",
    description: "One button, one state value, zero noise.",
    source: BLANK_SOURCE,
  },
};

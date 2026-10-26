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

  const update = (next: number) => {
    setCount(next);
  };

  return (
    <View style={{ flex: 1, padding: 24, gap: 18, justifyContent: "center" }}>
      <Text style={{ fontSize: 26, fontWeight: "bold" }}>Counter</Text>
      <Text style={{ fontSize: 16, color: "#666666" }}>
        State lives in JavaScript. Each press re-renders the virtual tree and
        Flutter rebuilds the widgets.
      </Text>
      <Text testID="count" style={{ fontSize: 56, fontWeight: "bold", textAlign: "center" }}>
        {count}
      </Text>
      <Row style={{ gap: 10, justifyContent: "center" }}>
        <Button variant="secondary" onPress={() => update(count - 1)}>
          Decrement
        </Button>
        <Button onPress={() => update(count + 1)}>Increment</Button>
      </Row>
      <Button
        variant="text"
        onPress={() => {
          update(0);
          void showToast("Counter reset");
        }}
      >
        Reset
      </Button>
    </View>
  );
}

start(App);

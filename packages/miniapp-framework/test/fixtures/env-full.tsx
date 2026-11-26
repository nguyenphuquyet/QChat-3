import "@mna/qchat/env/auto";
import { start, useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";

function App() {
  const [count, setCount] = useState(0);
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text>Env app {new Intl.NumberFormat("vi-VN").format(1234.5)}</Text>
      <Button onPress={() => setCount(count + 1)}>Add</Button>
    </View>
  );
}

start(App);

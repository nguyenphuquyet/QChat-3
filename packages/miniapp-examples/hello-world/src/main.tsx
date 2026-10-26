import { start, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { Button, Text, View } from "@mna/qchat/ui";

function App() {
  const [greeted, setGreeted] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        gap: 14,
        justifyContent: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <Text style={{ fontSize: 30, fontWeight: "bold", color: "#111111" }}>
        Hello from TSX
      </Text>
      <Text style={{ fontSize: 15, color: "#555555" }}>
        This screen was compiled to app.js, executed by the QChat JavaScript
        runtime and rendered with real Flutter widgets. No WebView is used.
      </Text>
      {greeted ? (
        <Text style={{ fontSize: 14, color: "#0f7b45" }}>
          The host handled the button event and the state update.
        </Text>
      ) : null}
      <Button
        onPress={() => {
          setGreeted(true);
          void showToast("Hello from the QChat host");
        }}
      >
        Say hello
      </Button>
    </View>
  );
}

start(App);

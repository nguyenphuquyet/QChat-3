import { installIntl } from "@mna/qchat/env";
import { start } from "@mna/qchat";
import { Text, View } from "@mna/qchat/ui";

installIntl({ locale: "vi-VN" });

function App() {
  return (
    <View style={{ padding: 16 }}>
      <Text>Intl app {new Intl.NumberFormat("vi-VN").format(1234.5)}</Text>
    </View>
  );
}

start(App);

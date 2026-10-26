import { navigateBack, navigateTo } from "@mna/qchat/navigation";
import { NavBar, TabBar, Text, View } from "@mna/qchat/ui";
import type { TabItem } from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  KeyValue,
  Note,
  ScreenShell,
  Section,
} from "../components.js";
import { pushLog } from "../store.js";
import { colors } from "../theme.js";

/**
 * The pushed route. The host owns the route stack: `navigateTo` pushes and
 * `navigateBack` pops, and both come back to the app as lifecycle events, so
 * this screen only has to read the path it was given.
 */
export function DetailScreen(props: {
  path: string;
  tabs: TabItem[];
  activeIndex: number;
}) {
  const segments = props.path.split("/").filter((part) => part.length > 0);
  const last = segments.length > 0 ? segments[segments.length - 1] : "?";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Route nội bộ"
        subtitle={props.path}
        showBack
        reserveRight={16}
        onBack={() => {
          pushLog("route", "nút back trên NavBar");
          void navigateBack();
        }}
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      />
      <ScreenShell>
        <Section
          title="Route đang mở"
          caption="Host giữ ngăn xếp route; app chỉ vẽ theo đường dẫn nhận được."
        >
          <Card>
            <KeyValue label="path" value={props.path} />
            <KeyValue label="Số đoạn" value={String(segments.length)} />
            <KeyValue label="Tham số cuối" value={last} />
            <KeyValue label="Tab đang chọn" value={String(props.activeIndex)} />
          </Card>
        </Section>

        <Section
          title="Đi sâu hoặc quay lại"
          caption="navigateTo('/detail/42/step-2') rồi bấm back của host để kiểm tra ngăn xếp."
        >
          <Card style={{ gap: 8 }}>
            <ActionButton
              icon="chevronRight"
              label={`navigateTo('${props.path}/${last === "step-2" ? "3" : "step-2"}')`}
              onPress={() =>
                void navigateTo(
                  `${props.path}/${last === "step-2" ? "3" : "step-2"}`,
                )
              }
            />
            <ActionButton
              variant="primary"
              icon="back"
              label="navigateBack()"
              onPress={() => void navigateBack()}
            />
          </Card>
        </Section>

        <Note>
          Nút back của hệ thống, nút back trên header và nút dưới đây đều đi qua
          đúng một hàm navigateBack(); log ở tab Debug ghi lại từng sự kiện
          navigate/back kèm path.
        </Note>
      </ScreenShell>
      <TabBar
        tabs={props.tabs}
        activeIndex={props.activeIndex}
        onChange={() => {
          pushLog("route", "chọn tab từ trang con · quay về gốc");
          void navigateBack();
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

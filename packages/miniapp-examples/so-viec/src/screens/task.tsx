import { share, showToast, useState } from "@mna/qchat";
import {
  Button,
  Checkbox,
  Dialog,
  NavBar,
  Page,
  Row,
  ScrollView,
  Tag,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  deleteTask,
  formatDay,
  formatMinutes,
  longDay,
  setTaskNote,
  toggleTask,
  useTasks,
} from "../store.js";
import { colors, projectTone, radius } from "../theme.js";
import {
  Card,
  EmptyState,
  InfoRow,
  Pill,
  priorityPill,
  SectionHeader,
} from "../ui.js";

/**
 * Route `/task/:id`: chi tiết một việc, sửa ghi chú, đánh dấu xong, chia sẻ
 * hoặc xoá. `NavBar.showBack` vẽ nút quay lại bằng `CupertinoButton`, còn
 * `Dialog` xác nhận xoá nằm trong `Page.overlays` nên phủ kín cả header.
 */
export function TaskScreen(props: { taskId: string; onBack: () => void }) {
  const tasks = useTasks();
  const task = tasks.find((entry) => entry.id === props.taskId) ?? null;
  const [note, setNote] = useState(task?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!task) {
    return (
      <Page
        style={{ backgroundColor: colors.bg }}
        header={
          <NavBar
            title="Không tìm thấy"
            showBack
            onBack={props.onBack}
            style={{ backgroundColor: colors.bg, color: colors.ink }}
          />
        }
      >
        <View style={{ padding: 20, gap: 16 }}>
          <EmptyState
            icon="info"
            title="Việc này không còn"
            caption="Có thể nó đã bị xoá ở tab khác. Quay lại danh sách để chọn việc khác."
          />
          <Button variant="secondary" onPress={props.onBack}>
            Quay lại
          </Button>
        </View>
      </Page>
    );
  }

  const tone = projectTone(task.project);

  const shareTask = () => {
    void share({
      title: "Sổ Việc",
      text: `${task.title} · ${formatDay(task.day)}${task.time ? ` lúc ${task.time}` : ""}`,
    })
      .then((shared) => {
        void showToast(shared ? "Đã mở bảng chia sẻ" : "Chưa chia sẻ được", {
          icon: shared ? "success" : "error",
        });
      })
      .catch(() => {
        void showToast("Chưa chia sẻ được", { icon: "error" });
      });
  };

  return (
    <Page
      style={{ backgroundColor: colors.bg }}
      header={
        <NavBar
          title="Chi tiết việc"
          subtitle={longDay(task.day)}
          showBack
          onBack={props.onBack}
          style={{ backgroundColor: colors.bg, color: colors.ink }}
        />
      }
      overlays={
        <Dialog
          visible={confirmDelete}
          title="Xoá việc này?"
          confirmText="Xoá"
          cancelText="Giữ lại"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteTask(task.id);
            setConfirmDelete(false);
            props.onBack();
            void showToast("Đã xoá việc", { icon: "success" });
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
            “{task.title}” sẽ bị xoá khỏi {formatDay(task.day).toLowerCase()}.
            Không thể hoàn tác.
          </Text>
        </Dialog>
      }
    >
      <ScrollView style={{ flex: 1 }} showsScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 30,
            gap: 14,
          }}
        >
          <Card style={{ gap: 12 }}>
            <Checkbox
              checked={task.done}
              label={
                task.done ? "Đã hoàn thành" : "Đánh dấu đã hoàn thành"
              }
              onChange={() => toggleTask(task.id)}
              testID="detail-done"
            />
            <Text
              style={{
                fontSize: 21,
                fontWeight: "bold",
                lineHeight: 28,
                color: task.done ? colors.muted : colors.ink,
                textDecoration: task.done ? "lineThrough" : "none",
              }}
            >
              {task.title}
            </Text>
            <Row style={{ gap: 6, flexWrap: "wrap" }}>
              {priorityPill(task)}
              <Pill label={task.project} bg={tone.bg} fg={tone.fg} />
              <Tag tone={task.done ? "success" : "warning"}>
                {task.done ? "Đã xong" : "Đang làm"}
              </Tag>
            </Row>
          </Card>

          <SectionHeader title="Thông tin" note="Kế hoạch của việc này" />
          <Card style={{ gap: 14 }}>
            <InfoRow
              icon="clock"
              label="Thời gian"
              value={`${formatDay(task.day)}${task.time ? ` · ${task.time}` : " · cả ngày"}`}
              color={colors.brand}
            />
            <InfoRow
              icon="folderOpen"
              label="Nhóm"
              value={task.project}
              color={tone.fg}
            />
            <InfoRow
              icon="official"
              label="Thời lượng dự kiến"
              value={formatMinutes(task.minutes)}
              color={colors.gold}
            />
          </Card>

          <SectionHeader
            title="Ghi chú"
            note="Chỉ lưu trên thiết bị qua storage"
          />
          <Card style={{ gap: 10 }}>
            <TextField
              value={note}
              placeholder="Thêm chi tiết, đường dẫn, người liên hệ…"
              onInput={setNote}
              multiline
              maxLength={400}
              testID="task-note"
              style={{
                minHeight: 96,
                backgroundColor: colors.soft,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.ink,
              }}
            />
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <Text style={{ fontSize: 10.5, color: colors.muted }}>
                {`${note.length}/400 ký tự`}
              </Text>
              <Button
                size="sm"
                variant="secondary"
                icon="pencil"
                testID="save-note"
                onPress={() => {
                  setTaskNote(task.id, note.trim());
                  void showToast("Đã lưu ghi chú", { icon: "success" });
                }}
              >
                Lưu ghi chú
              </Button>
            </Row>
          </Card>

          <Row style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                icon="share"
                testID="share-task"
                onPress={shareTask}
              >
                Chia sẻ
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="danger"
                icon="delete"
                testID="delete-task"
                onPress={() => setConfirmDelete(true)}
              >
                Xoá việc
              </Button>
            </View>
          </Row>

          <Text
            style={{
              fontSize: 10.5,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            Nhấn giữ một dòng việc ở tab Hôm nay cũng mở hộp xoá nhanh.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

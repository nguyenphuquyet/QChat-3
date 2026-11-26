import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import { findNode, runQapp, textContent, walkTree } from "../src/tester.js";
import type { RenderNode, SerializedTree } from "../src/protocol.js";

const projectDir = path.resolve(
  import.meta.dirname,
  "../../miniapp-examples/so-viec",
);

function byTestId(
  tree: SerializedTree | null,
  id: string,
): RenderNode | null {
  return findNode(tree, (node) => node.props.testID === id);
}

function byPrefix(
  tree: SerializedTree | null,
  prefix: string,
): RenderNode[] {
  const found: RenderNode[] = [];
  walkTree(tree, (node) => {
    if (
      typeof node.props.testID === "string" &&
      node.props.testID.startsWith(prefix)
    ) {
      found.push(node);
    }
  });
  return found;
}

/** Lets the host bridge's promises settle outside the virtual timer queue. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

test("so-viec plans the day, keeps habits and edits a task end to end", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-so-viec-"));
  try {
    const result = await compileProject({
      projectDir,
      outfile: path.join(directory, "app.japp"),
      typecheck: true,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const harness = runQapp(result.bytes);
    try {
      // 1. Bốn tab, tab Hôm nay mang badge số việc còn lại.
      const tabBar = () =>
        findNode(harness.latest(), (node) => node.type === "TabBar");
      assert.ok(tabBar(), "the app renders a TabBar");
      assert.deepEqual(
        harness.logs.filter((entry) => entry.level === "error"),
        [],
        "the first frame renders without runtime errors",
      );
      const tabs = tabBar()!.props.tabs as Array<Record<string, unknown>>;
      assert.equal(tabs.length, 4);
      assert.deepEqual(
        tabs.map((tab) => tab.label),
        ["Hôm nay", "Kế hoạch", "Thói quen", "Tôi"],
      );
      assert.match(String(tabs[0]!.badge), /^\d+$/, "today carries a badge");

      const list = () =>
        findNode(harness.latest(), (node) => node.type === "ListView");
      assert.ok(list(), "Hôm nay renders a windowed ListView");
      const firstWindow = list()!.children?.length ?? 0;
      assert.ok(firstWindow >= 12, "the first window holds today and next days");
      harness.dispatch(list()!.id, "endReached", { type: "endReached" });
      assert.ok(
        (list()!.children?.length ?? 0) > firstWindow,
        "endReached reveals the next page",
      );

      // 2. Đánh dấu một việc: vòng tiến độ và số đếm đổi ngay.
      const checkboxes = byPrefix(harness.latest(), "task-");
      assert.ok(checkboxes.length > 0, "task rows expose a checkbox");
      const beforeToggle = textContent(harness.latest());
      const checkbox = checkboxes.find((node) =>
        (node.events ?? []).includes("change"),
      );
      assert.ok(checkbox, "the task checkbox fires change");
      harness.dispatch(checkbox!.id, "change", {
        type: "change",
        value: true,
      });
      assert.notEqual(
        textContent(harness.latest()),
        beforeToggle,
        "toggling a task updates the header",
      );

      // 3. Thêm việc qua BottomSheet: gõ tên, chọn ưu tiên, chờ nút loading.
      const add = byTestId(harness.latest(), "quick-add");
      assert.ok(add, "the floating add button is rendered");
      harness.dispatch(add!.id, "press", { type: "press" });
      const titleField = byTestId(harness.latest(), "new-title");
      assert.ok(titleField, "the sheet asks for a title");
      harness.dispatch(titleField!.id, "input", "Mua pin cho điều khiển");
      const urgent = byTestId(harness.latest(), "priority-high");
      assert.ok(urgent, "the sheet exposes priority chips");
      harness.dispatch(urgent!.id, "press", { type: "press" });
      const create = byTestId(harness.latest(), "create-task");
      assert.ok(create, "the sheet has a create button");
      harness.dispatch(create!.id, "press", { type: "press" });
      harness.timers.advance(700);
      assert.match(
        textContent(harness.latest()),
        /Mua pin cho điều khiển/,
        "the new task joins today's list",
      );
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("Mua pin"),
        ),
        "the app confirms the new task with a toast",
      );
      assert.ok(
        harness.calls.some((call) => call.method === "setStorage"),
        "the new task is persisted",
      );

      // 4. Mở chi tiết, lưu ghi chú rồi xoá việc qua Dialog.
      const open = byTestId(harness.latest(), "open-t1");
      assert.ok(open, "a task row links to its detail route");
      harness.dispatch(open!.id, "press", { type: "press" });
      assert.ok(
        byTestId(harness.latest(), "task-note"),
        "the task row opens the detail route",
      );
      const note = byTestId(harness.latest(), "task-note");
      assert.ok(note, "the detail screen exposes a note field");
      harness.dispatch(note!.id, "input", "Mang bản in cho chị Hạnh");
      const save = byTestId(harness.latest(), "save-note");
      assert.ok(save, "the note can be saved");
      harness.dispatch(save!.id, "press", { type: "press" });
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            call.params.message === "Đã lưu ghi chú",
        ),
        "saving the note confirms it",
      );
      const remove = byTestId(harness.latest(), "delete-task");
      assert.ok(remove, "the detail screen can delete the task");
      harness.dispatch(remove!.id, "press", { type: "press" });
      const dialog = () =>
        findNode(
          harness.latest(),
          (node) => node.type === "Dialog" && node.props.visible === true,
        );
      assert.ok(dialog(), "deleting asks for confirmation");
      harness.dispatch(dialog()!.id, "confirm", { type: "confirm" });
      assert.ok(tabBar(), "confirming returns to the tab shell");
      assert.doesNotMatch(
        textContent(harness.latest()),
        /Gửi báo cáo tuần cho chị Hạnh/,
        "the deleted task is gone",
      );

      // 5. Thói quen: lưới hai cột, chạm để đánh dấu, đặt lại tuần qua Dialog.
      harness.dispatch(tabBar()!.id, "change", {
        type: "change",
        index: 2,
        key: "habits",
      });
      const grid = findNode(harness.latest(), (node) => node.type === "GridView");
      assert.ok(grid, "Thói quen renders a GridView");
      assert.equal(
        byPrefix(harness.latest(), "habit-").filter((node) =>
          (node.events ?? []).includes("press"),
        ).length,
        4,
        "all four habits are tappable",
      );
      const water = byTestId(harness.latest(), "habit-nuoc");
      assert.ok(water, "the water habit is rendered");
      harness.dispatch(water!.id, "press", { type: "press" });
      assert.match(textContent(harness.latest()), /Còn 2 thói quen hôm nay/);
      const reset = byTestId(harness.latest(), "reset-habits");
      assert.ok(reset, "the week can be reset");
      harness.dispatch(reset!.id, "press", { type: "press" });
      assert.ok(dialog(), "resetting asks for confirmation");
      harness.dispatch(dialog()!.id, "confirm", { type: "confirm" });
      assert.match(
        textContent(harness.latest()),
        /Còn 4 thói quen hôm nay/,
        "every habit restarts the week at zero",
      );

      // 6. Kế hoạch: slider mục tiêu, công tắc nhắc nhở, chọn ngày và xong hết.
      harness.dispatch(tabBar()!.id, "change", {
        type: "change",
        index: 1,
        key: "plan",
      });
      assert.ok(
        findNode(harness.latest(), (node) => node.type === "Slider"),
        "the weekly goal is a slider",
      );
      assert.ok(
        findNode(harness.latest(), (node) => node.type === "Switch"),
        "the reminder is a switch",
      );
      const days = byPrefix(harness.latest(), "day-");
      assert.equal(days.length, 7, "the header offers a week of days");
      harness.dispatch(days[days.length - 1]!.id, "press", {
        type: "press",
      });
      const finish = byTestId(harness.latest(), "finish-day-button");
      assert.ok(finish, "the day can be completed in one tap");
      harness.dispatch(finish!.id, "press", { type: "press" });
      assert.match(textContent(harness.latest()), /Ngày này đã xong/);

      // 7. Tôi: hồ sơ từ host, đồng bộ có loading, chia sẻ và xoá dữ liệu.
      harness.dispatch(tabBar()!.id, "change", {
        type: "change",
        index: 3,
        key: "me",
      });
      await settle();
      assert.match(textContent(harness.latest()), /Test User/);
      assert.ok(
        harness.calls.some((call) => call.method === "getUserInfo"),
        "the profile comes from the host",
      );
      const sync = byTestId(harness.latest(), "sync");
      assert.ok(sync, "the profile can sync");
      harness.dispatch(sync!.id, "press", { type: "press" });
      assert.ok(
        findNode(
          harness.latest(),
          (node) => node.type === "ActivityIndicator",
        ),
        "syncing shows an ActivityIndicator",
      );
      harness.timers.advance(1000);
      assert.equal(
        findNode(
          harness.latest(),
          (node) => node.type === "ActivityIndicator",
        ),
        null,
        "the spinner stops when the sync finishes",
      );
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("Đã đồng bộ"),
        ),
        "the sync reports back",
      );
      const share = byTestId(harness.latest(), "share-app");
      assert.ok(share, "the profile can share progress");
      harness.dispatch(share!.id, "press", { type: "press" });
      await settle();
      assert.ok(
        harness.calls.some((call) => call.method === "share"),
        "share reaches the host",
      );
      const clear = byTestId(harness.latest(), "clear-data");
      assert.ok(clear, "all data can be cleared");
      harness.dispatch(clear!.id, "press", { type: "press" });
      assert.ok(dialog(), "clearing asks for confirmation");
      harness.dispatch(dialog()!.id, "confirm", { type: "confirm" });
      assert.ok(
        harness.calls.some((call) => call.method === "removeStorage"),
        "the saved snapshot is removed",
      );
      assert.ok(tabBar(), "clearing data lands back on Hôm nay");
      assert.ok(
        byTestId(harness.latest(), "today-list"),
        "today's list is rendered again",
      );
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

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
  "../../miniapp-examples/vi-nho",
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

test("vi-nho records spending, filters, edits and resets end to end", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-vi-nho-"));
  try {
    const result = await compileProject({
      projectDir,
      outfile: path.join(directory, "app.japp"),
      typecheck: true,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const harness = runQapp(result.bytes);
    try {
      // 1. Bốn tab, thẻ ngân sách và badge số khoản hôm nay.
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
        ["Tổng quan", "Giao dịch", "Ngân sách", "Tôi"],
      );
      assert.match(
        textContent(harness.latest()),
        /Ngân sách tháng/,
        "the overview starts with the budget card",
      );
      assert.match(
        textContent(harness.latest()),
        /Còn lại trong tháng/,
        "the overview shows the remaining budget",
      );

      // 2. Thêm một khoản qua BottomSheet: gõ tên, số tiền và chờ nút loading.
      const add = byTestId(harness.latest(), "open-add");
      assert.ok(add, "the overview opens the add sheet");
      harness.dispatch(add!.id, "press", { type: "press" });
      const titleField = byTestId(harness.latest(), "txn-title");
      assert.ok(titleField, "the sheet asks for a title");
      harness.dispatch(titleField!.id, "input", "Trà sữa chiều");
      const amountField = byTestId(harness.latest(), "txn-amount");
      assert.ok(amountField, "the sheet asks for an amount");
      harness.dispatch(amountField!.id, "input", "35000");
      const create = byTestId(harness.latest(), "create-txn");
      assert.ok(create, "the sheet has a create button");
      harness.dispatch(create!.id, "press", { type: "press" });
      harness.timers.advance(700);
      assert.match(
        textContent(harness.latest()),
        /Trà sữa chiều/,
        "the new transaction joins the recent list",
      );
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("Trà sữa chiều"),
        ),
        "the app confirms the new transaction with a toast",
      );
      assert.ok(
        harness.calls.some((call) => call.method === "setStorage"),
        "the new transaction is persisted",
      );

      // 3. Tab Giao dịch: tìm kiếm, tải thêm, chọn nhiều và xoá hàng loạt.
      harness.dispatch(tabBar()!.id, "change", {
        type: "change",
        index: 1,
        key: "txns",
      });
      const search = byTestId(harness.latest(), "txn-search");
      assert.ok(search, "the transactions tab has a search field");
      assert.ok(
        findNode(harness.latest(), (node) => node.type === "ListView"),
        "the transactions tab pages a ListView",
      );

      const list = () =>
        findNode(harness.latest(), (node) => node.type === "ListView");
      const firstWindow = list()!.children?.length ?? 0;
      harness.dispatch(list()!.id, "endReached", { type: "endReached" });
      assert.ok(
        (list()!.children?.length ?? 0) > firstWindow,
        "endReached reveals the next page",
      );

      harness.dispatch(search!.id, "input", "phở");
      assert.match(
        textContent(harness.latest()),
        /Phở bò/,
        "search keeps the matching transaction",
      );
      assert.doesNotMatch(
        textContent(harness.latest()),
        /Tiền nhà/,
        "search hides the others",
      );
      harness.dispatch(
        byTestId(harness.latest(), "txn-search")!.id,
        "input",
        "",
      );

      const mode = byTestId(harness.latest(), "select-mode");
      harness.dispatch(mode!.id, "press", { type: "press" });
      const checkbox = byPrefix(harness.latest(), "txn-check-").find((node) =>
        (node.events ?? []).includes("change"),
      );
      assert.ok(checkbox, "selecting shows a Checkbox per row");
      const selectedId = String(checkbox!.props.testID).slice(
        "txn-check-".length,
      );
      harness.dispatch(checkbox!.id, "change", {
        type: "change",
        value: true,
      });
      assert.equal(
        byTestId(harness.latest(), `txn-check-${selectedId}`)?.props.checked,
        true,
        "the selected checkbox is checked",
      );
      const bulk = byTestId(harness.latest(), "bulk-delete");
      assert.ok(bulk, "the selection exposes a delete button");
      harness.dispatch(bulk!.id, "press", { type: "press" });
      const dialog = () =>
        findNode(
          harness.latest(),
          (node) => node.type === "Dialog" && node.props.visible === true,
        );
      assert.ok(dialog(), "deleting several transactions asks first");
      harness.dispatch(dialog()!.id, "confirm", { type: "confirm" });
      assert.equal(
        byTestId(harness.latest(), `txn-row-${selectedId}`),
        null,
        "the selected transaction is gone",
      );
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("Đã xoá"),
        ),
        "the bulk delete reports back",
      );

      // 4. Mở chi tiết, sửa ghi chú, đối chiếu, lưu rồi quay lại.
      const row = byPrefix(harness.latest(), "txn-row-").find((node) =>
        (node.events ?? []).includes("press"),
      );
      assert.ok(row, "a transaction row links to its detail route");
      harness.dispatch(row!.id, "press", { type: "press" });
      const note = byTestId(harness.latest(), "detail-note");
      assert.ok(note, "the transaction detail exposes a multiline note");
      harness.dispatch(note!.id, "input", "Đã khớp hoá đơn giấy");
      const reconciled = byTestId(harness.latest(), "detail-reconciled");
      assert.ok(reconciled, "the detail marks reconciliation");
      harness.dispatch(reconciled!.id, "change", {
        type: "change",
        value: true,
      });
      const saveTxn = byTestId(harness.latest(), "save-txn");
      assert.ok(saveTxn, "the detail can save changes");
      harness.dispatch(saveTxn!.id, "press", { type: "press" });
      harness.timers.advance(600);
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            call.params.message === "Đã lưu thay đổi",
        ),
        "saving the detail confirms it",
      );
      const navBar = findNode(
        harness.latest(),
        (node) =>
          node.type === "NavBar" && (node.events ?? []).includes("back"),
      );
      assert.ok(navBar, "the detail has a back button");
      harness.dispatch(navBar!.id, "back", { type: "back" });
      assert.ok(tabBar(), "back returns to the tab shell");
      assert.ok(
        byTestId(harness.latest(), "txn-list"),
        "the transactions list is rendered again",
      );

      // 5. Ngân sách: kéo tổng ngân sách và sửa hạn mức của một nhóm.
      harness.dispatch(tabBar()!.id, "change", {
        type: "change",
        index: 2,
        key: "budgets",
      });
      const slider = byTestId(harness.latest(), "budget-slider");
      assert.ok(slider, "the monthly budget is a Slider");
      harness.dispatch(slider!.id, "change", {
        type: "change",
        value: 20000000,
      });
      assert.match(
        textContent(harness.latest()),
        /20\.000\.000đ/,
        "the slider updates the monthly budget",
      );
      const editFood = byTestId(harness.latest(), "edit-budget-food");
      assert.ok(editFood, "each budget group can be edited");
      harness.dispatch(editFood!.id, "press", { type: "press" });
      const limit = byTestId(harness.latest(), "limit-input");
      assert.ok(limit, "the edit sheet asks for a limit");
      harness.dispatch(limit!.id, "input", "2000000");
      const saveLimit = byTestId(harness.latest(), "save-limit");
      harness.dispatch(saveLimit!.id, "press", { type: "press" });
      harness.timers.advance(600);
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("Đã đặt hạn mức ăn uống"),
        ),
        "the new limit is confirmed",
      );
      assert.match(
        textContent(harness.latest()),
        /Hạn mức 2\.000\.000đ/,
        "the budget row shows the new limit",
      );
      const remind = byTestId(harness.latest(), "budget-remind");
      assert.ok(remind, "bill reminders are a Switch");
      harness.dispatch(remind!.id, "change", {
        type: "change",
        value: false,
      });

      // 6. Tôi: hồ sơ host, đồng bộ có loading, PIN bảo mật và bộ điều khiển.
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
      assert.ok(sync, "the wallet can sync");
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

      const pin = byTestId(harness.latest(), "me-pin");
      assert.ok(pin, "the wallet can set a secure PIN");
      assert.equal(pin!.props.secureTextEntry, true);
      harness.dispatch(pin!.id, "input", "1234");
      const savePin = byTestId(harness.latest(), "save-pin");
      harness.dispatch(savePin!.id, "press", { type: "press" });
      harness.timers.advance(600);
      assert.ok(
        harness.calls.some(
          (call) =>
            call.method === "showToast" &&
            String(call.params.message).includes("mã PIN"),
        ),
        "saving the PIN confirms it",
      );
      assert.match(textContent(harness.latest()), /Đã đặt mã/);

      const gallery = byTestId(harness.latest(), "open-gallery");
      assert.ok(gallery, "the control gallery is one tap away");
      harness.dispatch(gallery!.id, "press", { type: "press" });
      assert.ok(
        byTestId(harness.latest(), "gallery-slider"),
        "the gallery renders a Slider",
      );
      assert.ok(
        byTestId(harness.latest(), "gallery-secret"),
        "the gallery renders a secure TextField",
      );
      assert.ok(
        byTestId(harness.latest(), "gallery-badge"),
        "the gallery renders a Badge",
      );
      const galleryBack = findNode(
        harness.latest(),
        (node) =>
          node.type === "NavBar" && (node.events ?? []).includes("back"),
      );
      assert.ok(galleryBack, "the gallery has a back button");
      harness.dispatch(galleryBack!.id, "back", { type: "back" });
      assert.ok(
        byTestId(harness.latest(), "reset-data"),
        "back returns to the profile tab",
      );

      // 7. Đặt lại dữ liệu mẫu: dialog xác nhận và xoá bản lưu.
      const reset = byTestId(harness.latest(), "reset-data");
      harness.dispatch(reset!.id, "press", { type: "press" });
      assert.ok(dialog(), "resetting asks for confirmation");
      harness.dispatch(dialog()!.id, "confirm", { type: "confirm" });
      assert.ok(
        harness.calls.some((call) => call.method === "removeStorage"),
        "the saved snapshot is removed",
      );
      assert.ok(tabBar(), "resetting lands back on the overview");
      assert.match(textContent(harness.latest()), /Ngân sách tháng/);
      assert.deepEqual(
        harness.logs.filter((entry) => entry.level === "error"),
        [],
        "the whole flow runs without runtime errors",
      );
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

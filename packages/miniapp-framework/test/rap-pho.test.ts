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
  "../../miniapp-examples/rap-pho",
);

function byTestId(
  tree: SerializedTree | null,
  id: string,
): RenderNode | null {
  return findNode(tree, (node) => node.props.testID === id);
}

test("rap-pho pages the movie list and books a seat end to end", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-rap-pho-"));
  try {
    const result = await compileProject({
      projectDir,
      outfile: path.join(directory, "app.japp"),
      typecheck: true,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const harness = runQapp(result.bytes);
    try {
      // 1. Tab Phim: the window starts at 12 movies plus the "more" row, and
      //    the host's endReached event lets the app reveal the next page.
      const tabBar = findNode(harness.latest(), (node) => node.type === "TabBar");
      assert.ok(tabBar);
      harness.dispatch(tabBar!.id, "change", {
        type: "change",
        index: 1,
        key: "movies",
      });
      const list = () =>
        findNode(harness.latest(), (node) => node.type === "ListView");
      assert.ok(list(), "the Phim tab renders a windowed ListView");
      assert.equal(list()!.children?.length, 13, "12 movies + one more row");
      harness.dispatch(list()!.id, "endReached", { type: "endReached" });
      assert.equal(list()!.children?.length, 25, "the second page is revealed");
      assert.match(textContent(harness.latest()), /Còn \d+ phim/);

      // 2. Back to Khám phá and open the featured movie from its poster.
      harness.dispatch(tabBar!.id, "change", {
        type: "change",
        index: 0,
        key: "discover",
      });
      const poster = byTestId(harness.latest(), "poster-dem-sai-gon");
      assert.ok(poster, "the discover rail exposes a movie poster");
      harness.dispatch(poster!.id, "press", { type: "press" });
      assert.match(textContent(harness.latest()), /Chọn suất chiếu/);
      assert.ok(byTestId(harness.latest(), "seat-A1"), "the seat map is rendered");

      // 3. Pick a showtime, then the first free seat.
      const showtime = findNode(
        harness.latest(),
        (node) =>
          typeof node.props.testID === "string" &&
          node.props.testID.startsWith("showtime-") &&
          (node.events ?? []).includes("press"),
      );
      assert.ok(showtime, "at least one showtime is bookable");
      harness.dispatch(showtime!.id, "press", { type: "press" });

      const seats: RenderNode[] = [];
      walkTree(harness.latest(), (node) => {
        const id = node.props.testID;
        if (
          typeof id === "string" &&
          id.startsWith("seat-") &&
          (node.events ?? []).includes("press")
        ) {
          seats.push(node);
        }
      });
      assert.ok(seats.length > 0, "the seat map exposes tappable seats");
      let selected = false;
      for (const seat of seats) {
        harness.dispatch(seat.id, "press", { type: "press" });
        if (textContent(harness.latest()).includes("1 ghế")) {
          selected = true;
          break;
        }
      }
      assert.ok(selected, "a free seat can be selected");

      // 4. Pay: the sheet needs the terms checkbox before the button enables.
      const pay = byTestId(harness.latest(), "pay");
      assert.ok(pay, "the bottom bar exposes the pay action");
      harness.dispatch(pay!.id, "press", { type: "press" });
      const agree = byTestId(harness.latest(), "agree");
      assert.ok(agree, "the sheet asks for the terms checkbox");
      harness.dispatch(agree!.id, "change", { type: "change", value: true });
      const confirm = byTestId(harness.latest(), "confirm-pay");
      assert.ok(confirm, "the confirm button is rendered");
      harness.dispatch(confirm!.id, "press", { type: "press" });

      // 5. The app lands on the ticket route with a QR page and a fresh code.
      assert.ok(
        byTestId(harness.latest(), "ticket-page"),
        "booking navigates to /ticket/:code",
      );
      const text = textContent(harness.latest());
      assert.match(text, /Đưa mã này cho nhân viên soát vé/);
      assert.match(text, /RP4790/);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

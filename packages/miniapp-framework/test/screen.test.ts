import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import type { RenderNode } from "../src/protocol.js";
import { findNode, runQapp } from "../src/tester.js";

/**
 * A frame only carries positional node ids, so the host cannot tell a widget
 * apart from the widget another screen puts in the same slot. The runtime
 * therefore stamps every frame with the component trail that produced it; the
 * host keeps per-screen state apart with it (a scroll offset in one tab must
 * not become the offset of the next one) and restores that state when the user
 * comes back.
 */
const SOURCE = `
  import { start, useState } from "@mna/qchat";
  import { Button, View } from "@mna/qchat/ui";

  function First(props: { onNext: () => void }) {
    const [count, setCount] = useState(0);
    return (
      <View testID="first">
        <Button testID="bump" onPress={() => setCount(count + 1)}>
          {String(count)}
        </Button>
        <Button testID="next" onPress={props.onNext}>
          next
        </Button>
      </View>
    );
  }

  function Second(props: { onNext: () => void }) {
    return (
      <View testID="second">
        <Button testID="back" onPress={props.onNext}>
          back
        </Button>
      </View>
    );
  }

  function App() {
    const [tab, setTab] = useState(0);
    return tab === 0 ? (
      <First onNext={() => setTab(1)} />
    ) : (
      <Second onNext={() => setTab(0)} />
    );
  }

  start(App);
`;

function build() {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-screen-"));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      format: "qapp",
      name: "Screen Harness",
      version: "1.0.0",
      entry: "app.js",
      sdkVersion: "1.0.0",
      minRuntimeVersion: "1.0.0",
      requestedPermissions: [],
      source: "src/main.tsx",
    }),
  );
  mkdirSync(path.join(directory, "src"), { recursive: true });
  writeFileSync(path.join(directory, "src", "main.tsx"), SOURCE);
  return compileProject({
    projectDir: directory,
    outfile: path.join(directory, "dist", "app.japp"),
    typecheck: true,
  }).then((result) => ({ result, directory }));
}

function press(harness: ReturnType<typeof runQapp>, testID: string) {
  const node = findNode(
    harness.latest(),
    (child: RenderNode) => child.props.testID === testID,
  );
  assert.ok(node, `the ${testID} button exists`);
  harness.dispatch(node!.id, "press", { type: "press" });
}

test("a frame names the screen that produced it", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      const first = harness.latest()!;
      assert.match(first.screen, /^\d+(\.\d+)*$/, "first frame has a trail");
      assert.ok(findNode(first, (node) => node.props.testID === "first"));

      // Re-rendering the same screen keeps its identity: state survives.
      press(harness, "bump");
      const again = harness.latest()!;
      assert.equal(again.screen, first.screen);
      assert.equal(again.revision, first.revision + 1);

      // Another screen is another trail, even though the node ids repeat.
      press(harness, "next");
      const second = harness.latest()!;
      assert.ok(findNode(second, (node) => node.props.testID === "second"));
      assert.notEqual(second.screen, first.screen);
      assert.equal(
        second.root?.id,
        first.root?.id,
        "both screens use the same root id, which is why the screen is needed",
      );

      // And coming back restores the identity of the first screen.
      press(harness, "back");
      assert.equal(harness.latest()!.screen, first.screen);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

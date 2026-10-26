import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import { findNode, runQapp, textContent, walkTree } from "../src/tester.js";
import { assertKnownType } from "../src/runtime.js";

const SOURCE = `
  import { start, useState } from "@mna/qchat";
  import {
    BottomSheet,
    Button,
    Checkbox,
    Dialog,
    ListView,
    Modal,
    NavBar,
    ScrollView,
    Slider,
    Switch,
    TabBar,
    Text,
    TextField,
    View,
  } from "@mna/qchat/ui";

  function App() {
    const [enabled, setEnabled] = useState(false);
    const [tab, setTab] = useState(0);
    const [visible, setVisible] = useState(false);

    return (
      <View style={{ flex: 1 }}>
        <NavBar title="Shell" />
        <ScrollView showsScrollIndicator={false}>
          <Switch value={enabled} onChange={(event) => setEnabled(event.value)} />
          <Checkbox
            label="Agree"
            onChange={(event) => setEnabled(event.value)}
          />
          <Slider
            value={tab}
            min={0}
            max={3}
            step={1}
            onChange={(event) => setTab(event.value)}
          />
          <TextField
            placeholder="Name"
            onChange={(event) => setTab(event.value.length)}
          />
          <Button onPress={() => setVisible(true)}>Open</Button>
          <ListView
            data={[{ id: 1 }, { id: 2 }]}
            renderItem={(item) => <Text>{String(item.id)}</Text>}
          />
        </ScrollView>
        <Modal visible={visible} onClose={() => setVisible(false)}>
          <Text>modal</Text>
        </Modal>
        <BottomSheet visible={false} onClose={() => setVisible(false)}>
          <Text>sheet</Text>
        </BottomSheet>
        <Dialog
          visible={false}
          title="Sure?"
          onClose={() => setVisible(false)}
          onConfirm={() => setVisible(false)}
          confirmText="OK"
        />
        <TabBar
          tabs={[
            { key: "home", label: "Home", icon: "home" },
            { key: "jobs", label: "Jobs", icon: "briefcase" },
          ]}
          activeIndex={tab}
          onChange={(event) => setTab(event.index)}
        />
        <Text>{enabled ? "on" : "off"}</Text>
      </View>
    );
  }

  start(App);
`;

function build() {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-components-"));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      format: "qapp",
      name: "Components Harness",
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
    typecheck: false,
  }).then((result) => ({ result, directory }));
}

test("every dashed component and their events reach the tree", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      const types = new Set<string>();
      walkTree(harness.latest(), (node) => types.add(node.type));
      for (const type of [
        "NavBar",
        "ScrollView",
        "Switch",
        "Checkbox",
        "Slider",
        "TextField",
        "Button",
        "ListView",
        "Modal",
        "BottomSheet",
        "Dialog",
        "TabBar",
      ]) {
        assert.ok(types.has(type), `tree contains ${type}`);
        assertKnownType(type);
      }
      const switchNode = findNode(harness.latest(), (node) => node.type === "Switch");
      assert.ok(switchNode);
      assert.deepEqual(switchNode!.events, ["change"]);
      assert.equal(
        textContent(harness.latest()).includes("off"),
        true,
        "initial switch state renders",
      );
      // The host sends the standardized object payload.
      const next = harness.dispatch(switchNode!.id, "change", {
        type: "change",
        value: true,
      });
      assert.ok(textContent(next).includes("on"));
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ListView only serializes the first window of a long list", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-longlist-"));
  try {
    writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        schemaVersion: 2,
        format: "qapp",
        name: "Long List",
        version: "1.0.0",
        entry: "app.js",
        sdkVersion: "1.0.0",
        minRuntimeVersion: "1.0.0",
        requestedPermissions: [],
        source: "src/main.tsx",
      }),
    );
    mkdirSync(path.join(directory, "src"), { recursive: true });
    writeFileSync(
      path.join(directory, "src", "main.tsx"),
      `
        import { start } from "@mna/qchat";
        import { ListView, Text } from "@mna/qchat/ui";

        const data = Array.from({ length: 500 }, (_item, index) => index);

        function App() {
          return (
            <ListView
              data={data}
              initialCount={10}
              renderItem={(item) => <Text>{String(item)}</Text>}
            />
          );
        }

        start(App);
      `,
    );
    const result = await compileProject({
      projectDir: directory,
      outfile: path.join(directory, "dist", "app.japp"),
      typecheck: false,
    });
    const harness = runQapp(result.bytes);
    try {
      const root = harness.latest()!.root!;
      assert.equal(root.type, "ListView");
      assert.equal(root.children?.length, 10, "only initialCount items are serialized");
      assert.equal(root.props.totalCount, 500);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

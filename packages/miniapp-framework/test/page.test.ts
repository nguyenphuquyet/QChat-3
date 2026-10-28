import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import type { RenderNode } from "../src/protocol.js";
import { findNode, runQapp } from "../src/tester.js";

/**
 * `Page` is the screen frame a Mini App is supposed to use: header, body,
 * footer, overlays. It is only a composition of host views, so this test checks
 * the shape it hands to the renderer — a body that starts where the header ends
 * instead of at y = 0 under it.
 */
const SOURCE = `
  import { start } from "@mna/qchat";
  import {
    NavBar,
    Page,
    ScrollView,
    TabBar,
    Text,
    View,
  } from "@mna/qchat/ui";

  function App() {
    return (
      <Page
        testID="page"
        header={<NavBar title="Vé điện tử" showBack onBack={() => {}} />}
        footer={
          <TabBar
            activeIndex={0}
            hideOnKeyboard={false}
            tabs={[{ key: "home", label: "Home", icon: "home" }]}
          />
        }
      >
        <ScrollView testID="body">
          <View style={{ padding: 16 }}>
            <Text>Body</Text>
          </View>
        </ScrollView>
      </Page>
    );
  }

  start(App);
`;

function build(source = SOURCE) {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-page-"));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      format: "qapp",
      name: "Page Harness",
      version: "1.0.0",
      entry: "app.js",
      sdkVersion: "1.0.0",
      minRuntimeVersion: "1.0.0",
      requestedPermissions: [],
      source: "src/main.tsx",
    }),
  );
  mkdirSync(path.join(directory, "src"), { recursive: true });
  writeFileSync(path.join(directory, "src", "main.tsx"), source);
  return compileProject({
    projectDir: directory,
    outfile: path.join(directory, "dist", "app.japp"),
    typecheck: false,
  }).then((result) => ({ result, directory }));
}

function styleOf(node: RenderNode | undefined): Record<string, unknown> {
  return (node?.props.style ?? {}) as Record<string, unknown>;
}

test("a Page puts the body between the header and the footer", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      const tree = harness.latest();
      const page = findNode(tree, (node) => node.props.testID === "page");
      assert.ok(page, "the page view exists");
      assert.equal(page!.type, "View");
      assert.equal(styleOf(page).flex, 1);

      assert.deepEqual(
        page!.children?.map((child) => child.type),
        ["NavBar", "Stack", "TabBar"],
        "header, body stack, footer — in that order",
      );

      const stack = page!.children![1];
      assert.equal(styleOf(stack).flex, 1);
      const body = stack.children?.[0];
      assert.equal(body?.type, "Positioned");
      assert.equal(styleOf(body).position, "absolute");
      assert.equal(styleOf(body).top, 0);
      assert.equal(styleOf(body).bottom, 0);
      assert.equal(
        body?.children?.[0]?.props.testID,
        "body",
        "the body is pinned inside the stack, so it fills the page",
      );

      // The keyboard rule travels to the renderer with the node.
      const footer = page!.children![2];
      assert.equal(footer.props.hideOnKeyboard, false);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a Page without a footer still gives the body the whole page", async () => {
  const { result, directory } = await build(`
    import { start } from "@mna/qchat";
    import { Page, Text, View } from "@mna/qchat/ui";

    function App() {
      return (
        <Page testID="page">
          <View style={{ flex: 1 }}>
            <Text>Body</Text>
          </View>
        </Page>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      const page = findNode(
        harness.latest(),
        (node) => node.props.testID === "page",
      );
      assert.ok(page);
      assert.deepEqual(
        page!.children?.map((child) => child.type),
        ["Stack"],
        "no header and no footer leaves one full-size stack",
      );
      assert.equal(page!.children?.[0]?.children?.[0]?.type, "Positioned");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

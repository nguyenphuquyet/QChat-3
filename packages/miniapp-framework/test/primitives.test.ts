import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import type { RenderNode, SerializedTree } from "../src/protocol.js";
import { findNode, runQapp, textContent, walkTree } from "../src/tester.js";
import { assertKnownType } from "../src/runtime.js";

/**
 * The phase 1 primitives (`Text`, `RichText`, `Link`, `Button`, `Divider`,
 * `Spacer`, `SafeArea`, `Badge`, `Tag`, `Avatar`) are exercised through the real
 * compiler and the real runtime, so a prop the contract declares but the
 * runtime drops shows up here.
 */
const SOURCE = `
  import { start, useState } from "@mna/qchat";
  import {
    Avatar,
    Badge,
    Button,
    Divider,
    Link,
    RichText,
    SafeArea,
    Spacer,
    Tag,
    Text,
    View,
  } from "@mna/qchat/ui";

  function App() {
    const [last, setLast] = useState("none");

    return (
      <SafeArea edges={["top"]}>
        <View style={{ padding: 16, gap: 8 }}>
          <Text selectable numberOfLines={2}>Long paragraph</Text>
          <RichText numberOfLines={3}>
            <Text style={{ fontWeight: "bold" }}>Bold</Text>
            <Text>{" and "}</Text>
            <Link href="/details">more</Link>
          </RichText>
          <Link href="/details" onPress={() => setLast("details")}>Details</Link>
          <Link href="https://example.com" external>Website</Link>
          <Button variant="outline" size="lg" icon="plus" onPress={() => setLast("add")}>
            Add
          </Button>
          <Badge count={120} max={99}>
            <Avatar name="Quyet Guic" size={40} shape="rounded" />
          </Badge>
          <Badge dot tone="success" />
          <Tag tone="danger" size="sm">Hot</Tag>
          <Tag>Plain</Tag>
          <Divider vertical inset={8} thickness={2} />
          <Divider />
          <Spacer size={12} />
          <Text testID="last-event">{last}</Text>
        </View>
      </SafeArea>
    );
  }

  start(App);
`;

function build(source = SOURCE) {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-primitives-"));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      format: "qapp",
      name: "Primitives Harness",
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

/** Lets the microtask queue drain so a fire-and-forget host call lands. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function nodesOfType(tree: SerializedTree | null, type: string): RenderNode[] {
  const found: RenderNode[] = [];
  walkTree(tree, (node) => {
    if (node.type === type) found.push(node);
  });
  return found;
}

test("the phase 1 primitives reach the tree with their props", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      const tree = harness.latest();
      const types = new Set<string>();
      walkTree(tree, (node) => types.add(node.type));
      for (const type of [
        "SafeArea",
        "RichText",
        "Link",
        "Button",
        "Badge",
        "Tag",
        "Avatar",
        "Divider",
        "Spacer",
      ]) {
        assert.ok(types.has(type), `tree contains ${type}`);
        assertKnownType(type);
      }

      const rich = findNode(tree, (node) => node.type === "RichText");
      assert.ok(rich);
      assert.equal(rich!.props.numberOfLines, 3);
      assert.deepEqual(
        rich!.children?.map((child) => child.type),
        ["Text", "Text", "Link"],
        "RichText keeps its inline children as nodes",
      );
      const inlineLink = rich!.children?.[2];
      assert.equal(inlineLink?.props.href, "/details");
      assert.deepEqual(inlineLink?.events, ["press"]);

      const links = nodesOfType(tree, "Link");
      const details = links.find((node) => node.props.href === "/details");
      assert.ok(details);
      assert.equal(details!.props.external, false);
      const external = links.find((node) => node.props.external === true);
      assert.ok(external, "an external Link keeps its flag");
      assert.equal(external!.props.href, "https://example.com");

      const button = findNode(tree, (node) => node.type === "Button");
      assert.ok(button);
      assert.equal(button!.props.variant, "outline");
      assert.equal(button!.props.size, "lg");
      assert.equal(button!.props.icon, "plus");

      const badges = nodesOfType(tree, "Badge");
      assert.equal(badges.length, 2);
      assert.equal(badges[0].props.count, 120);
      assert.equal(badges[0].props.max, 99);
      assert.equal(badges[0].children?.[0].type, "Avatar");
      assert.equal(badges[1].props.dot, true);
      assert.equal(badges[1].props.tone, "success");

      const avatar = findNode(tree, (node) => node.type === "Avatar");
      assert.equal(avatar!.props.name, "Quyet Guic");
      assert.equal(avatar!.props.shape, "rounded");
      assert.equal(avatar!.props.size, 40);

      const tags = nodesOfType(tree, "Tag");
      assert.equal(tags[0].props.tone, "danger");
      assert.equal(tags[0].props.size, "sm");
      assert.equal(
        tags[1].props.tone,
        undefined,
        "an omitted tone stays omitted",
      );

      const dividers = nodesOfType(tree, "Divider");
      assert.equal(dividers[0].props.vertical, true);
      assert.equal(dividers[0].props.inset, 8);
      assert.equal(dividers[0].props.thickness, 2);
      assert.equal(dividers[1].props.vertical, undefined);

      const spacer = findNode(tree, (node) => node.type === "Spacer");
      assert.equal(spacer!.props.size, 12);

      const safeArea = findNode(tree, (node) => node.type === "SafeArea");
      assert.deepEqual(safeArea!.props.edges, ["top"]);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an in-app Link routes through the host and rerenders", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.ok(textContent(harness.latest()).includes("none"));
      const link = findNode(
        harness.latest(),
        (node) =>
          node.type === "Link" &&
          node.props.href === "/details" &&
          node.children?.[0]?.props.text === "Details",
      );
      assert.ok(link);
      const next = harness.dispatch(link!.id, "press", {
        type: "press",
        href: "/details",
        external: false,
      });
      assert.ok(textContent(next).includes("details"), "state changed");
      await flush();
      const navigate = harness.calls.filter(
        (call) => call.method === "navigateTo",
      );
      assert.equal(navigate.length, 1, "one router call");
      assert.deepEqual(navigate[0].params, { path: "/details" });
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an external Link reports the tap without navigating the Mini App", async () => {
  const { result, directory } = await build();
  try {
    const harness = runQapp(result.bytes);
    try {
      const external = findNode(
        harness.latest(),
        (node) => node.type === "Link" && node.props.external === true,
      );
      assert.ok(external);
      harness.dispatch(external!.id, "press", {
        type: "press",
        href: "https://example.com",
        external: true,
      });
      await flush();
      assert.equal(
        harness.calls.some((call) => call.method === "navigateTo"),
        false,
        "the host router is not asked to open a website",
      );
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../src/compiler.js";
import { runQapp, textContent, walkTree } from "../src/tester.js";
import type { RenderNode, SerializedTree } from "../src/protocol.js";

/**
 * These tests execute the compiled bundle with the same synchronous
 * render/dispatch loop the Dart QuickJS host uses. The Dart suite also runs the
 * Hello World bundle in the real QuickJS engine; this file covers the hook
 * semantics, which are engine independent.
 */
function buildApp(source: string) {
  const directory = mkdtempSync(path.join(tmpdir(), "qchat-hooks-"));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      format: "qapp",
      name: "Hooks Harness",
      version: "1.0.0",
      entry: "app.js",
      sdkVersion: "1.0.0",
      minRuntimeVersion: "1.0.0",
      requestedPermissions: ["toast", "storage"],
      source: "src/main.tsx",
    }),
  );
  mkdirSync(path.join(directory, "src"), { recursive: true });
  writeFileSync(path.join(directory, "src", "main.tsx"), source);
  return { directory };
}

function load(source: string) {
  const { directory } = buildApp(source);
  return compileProject({
    projectDir: directory,
    outfile: path.join(directory, "dist", "app.japp"),
    typecheck: false,
  }).then((result) => ({ result, directory }));
}

function buttons(tree: SerializedTree | null): RenderNode[] {
  const found: RenderNode[] = [];
  walkTree(tree, (node) => {
    if (node.type === "Button" || node.type === "Pressable") found.push(node);
  });
  return found;
}

test("a child component keeps its own state", async () => {
  const { result, directory } = await load(`
    import { start, useState } from "@mna/qchat";
    import { Button, Text, View } from "@mna/qchat/ui";

    function Counter({ label }: { label: string }) {
      const [count, setCount] = useState(0);
      return (
        <View>
          <Text>{label}</Text>
          <Text>{String(count)}</Text>
          <Button onPress={() => setCount(count + 1)}>add</Button>
        </View>
      );
    }

    function App() {
      return (
        <View>
          <Counter label="A" />
          <Counter label="B" />
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.equal(textContent(harness.latest()), "A0addB0add");
      const list = buttons(harness.latest());
      assert.equal(list.length, 2);
      const next = harness.dispatch(list[0].id, "press", {});
      assert.equal(textContent(next), "A1addB0add");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("effects run once, respect deps and clean up on unmount", async () => {
  const { result, directory } = await load(`
    import { start, useEffect, useState } from "@mna/qchat";
    import { showToast } from "@mna/qchat/navigation";
    import { Button, Text, View } from "@mna/qchat/ui";

    function Child() {
      useEffect(() => {
        void showToast("mounted");
        return () => {
          void showToast("cleanup");
        };
      }, []);
      return <Text>child</Text>;
    }

    function App() {
      const [show, setShow] = useState(true);
      return (
        <View>
          <Button onPress={() => setShow(!show)}>toggle</Button>
          {show ? <Child /> : null}
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    const toasts = () =>
      harness.calls.filter((call) => call.method === "showToast").map((call) => call.params.message);
    try {
      assert.deepEqual(toasts(), ["mounted"]);
      const toggle = buttons(harness.latest())[0];
      harness.dispatch(toggle.id, "press", {});
      assert.deepEqual(toasts(), ["mounted", "cleanup"]);
      const toggleAgain = buttons(harness.latest())[0];
      harness.dispatch(toggleAgain.id, "press", {});
      assert.deepEqual(toasts(), ["mounted", "cleanup", "mounted"]);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("useEffect deps decide whether the effect re-runs", async () => {
  const { result, directory } = await load(`
    import { start, useEffect, useState } from "@mna/qchat";
    import { showToast } from "@mna/qchat/navigation";
    import { Button, Text, View } from "@mna/qchat/ui";

    function App() {
      const [n, setN] = useState(0);
      const [other, setOther] = useState(0);
      useEffect(() => {
        void showToast("n:" + n);
      }, [n]);
      return (
        <View>
          <Button onPress={() => setN(n + 1)}>bump</Button>
          <Button onPress={() => setOther(other + 1)}>other</Button>
          <Text testID="n">{String(n)}</Text>
          <Text testID="o">{String(other)}</Text>
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    const toasts = () =>
      harness.calls.filter((call) => call.method === "showToast").map((call) => call.params.message);
    try {
      assert.deepEqual(toasts(), ["n:0"]);
      harness.dispatch(buttons(harness.latest())[0].id, "press", {});
      assert.deepEqual(toasts(), ["n:0", "n:1"]);
      harness.dispatch(buttons(harness.latest())[1].id, "press", {});
      assert.deepEqual(toasts(), ["n:0", "n:1"]);
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reordering a keyed list keeps each child's state", async () => {
  const { result, directory } = await load(`
    import { start, useState } from "@mna/qchat";
    import { Button, Text, View } from "@mna/qchat/ui";

    function Item({ label }: { label: string }) {
      const [n, setN] = useState(0);
      return (
        <View>
          <Text>{label}</Text>
          <Text>{String(n)}</Text>
          <Button onPress={() => setN(n + 1)}>inc</Button>
        </View>
      );
    }

    function App() {
      const [reversed, setReversed] = useState(false);
      const order = reversed ? ["b", "a"] : ["a", "b"];
      return (
        <View>
          <Button onPress={() => setReversed(!reversed)}>flip</Button>
          {order.map((key) => (
            <Item key={key} label={key} />
          ))}
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.equal(textContent(harness.latest()), "flipa0incb0inc");
      // Button 0 is flip; button 1 is item "a"'s increment.
      harness.dispatch(buttons(harness.latest())[1].id, "press", {});
      assert.equal(textContent(harness.latest()), "flipa1incb0inc");
      harness.dispatch(buttons(harness.latest())[0].id, "press", {});
      assert.equal(textContent(harness.latest()), "flipb0inca1inc");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("useContext reads the nearest provider value", async () => {
  const { result, directory } = await load(`
    import { createContext, start, useContext, useState } from "@mna/qchat";
    import { Button, Text, View } from "@mna/qchat/ui";

    const Theme = createContext("light");

    function Label() {
      const theme = useContext(Theme);
      return <Text>{theme}</Text>;
    }

    function App() {
      const [theme, setTheme] = useState("light");
      return (
        <View>
          <Button onPress={() => setTheme(theme === "light" ? "dark" : "light")}>
            switch
          </Button>
          <Theme.Provider value={theme}>
            <Label />
          </Theme.Provider>
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.equal(textContent(harness.latest()), "switchlight");
      harness.dispatch(buttons(harness.latest())[0].id, "press", {});
      assert.equal(textContent(harness.latest()), "switchdark");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("several setState calls in one event produce a single frame", async () => {
  const { result, directory } = await load(`
    import { start, useState } from "@mna/qchat";
    import { Button, Text, View } from "@mna/qchat/ui";

    function App() {
      const [n, setN] = useState(0);
      return (
        <View>
          <Button
            onPress={() => {
              setN(1);
              setN(2);
              setN(3);
            }}
          >
            go
          </Button>
          <Text>{String(n)}</Text>
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.equal(harness.renders.length, 1);
      harness.dispatch(buttons(harness.latest())[0].id, "press", {});
      assert.equal(harness.renders.length, 2, "one frame for the whole event");
      assert.equal(textContent(harness.latest()), "go3");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("useLayoutEffect and useId run per instance", async () => {
  const { result, directory } = await load(`
    import { start, useId, useLayoutEffect, useState } from "@mna/qchat";
    import { showToast } from "@mna/qchat/navigation";
    import { Text, View } from "@mna/qchat/ui";

    function Row() {
      const id = useId();
      useLayoutEffect(() => {
        void showToast("layout:" + id);
      }, []);
      return <Text>{id}</Text>;
    }

    function App() {
      const [visible, setVisible] = useState(true);
      return (
        <View>
          {visible ? <Row /> : null}
          <Text testID="id">{useId()}</Text>
        </View>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      const layouts = harness.calls.filter(
        (call) => call.method === "showToast" && String(call.params.message).startsWith("layout:"),
      );
      assert.equal(layouts.length, 1);
      const ids = [...String(textContent(harness.latest())).matchAll(/qapp_[A-Za-z0-9_]+/g)].map(
        (match) => match[0],
      );
      assert.equal(new Set(ids).size, ids.length, "ids are unique per instance");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("text-only and multiple root children still render", async () => {
  const { result, directory } = await load(`
    import { Fragment, start } from "@mna/qchat";
    import { Text } from "@mna/qchat/ui";

    function App() {
      return (
        <Fragment>
          <Text>one</Text>
          <Text>two</Text>
        </Fragment>
      );
    }

    start(App);
  `);
  try {
    const harness = runQapp(result.bytes);
    try {
      assert.equal(textContent(harness.latest()), "onetwo");
    } finally {
      harness.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

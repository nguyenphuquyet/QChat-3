import "@mna/qchat/env/auto";
import { start, useEffect, useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";

/** Fixed instant so the formatted date is the same in every test run. */
const INSTANT = new Date(Date.UTC(2026, 9, 26, 14, 5, 9));
const UTC = { timeZone: "UTC" } as const;

const numbers = [
  new Intl.NumberFormat("vi-VN").format(1234567.5),
  new Intl.NumberFormat("en-US").format(1234567.5),
  new Intl.NumberFormat("vi-VN", { style: "percent" }).format(0.125),
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(2500000),
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(1234.5),
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(15200),
].join(" | ");

const dates = [
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", ...UTC }).format(INSTANT),
  new Intl.DateTimeFormat("en-US", { dateStyle: "full", ...UTC }).format(INSTANT),
  new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", ...UTC }).format(
    INSTANT,
  ),
  new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", ...UTC }).format(
    INSTANT,
  ),
].join(" | ");

const link = new URL("/api/items?page=2", "https://qchat.vn/base/");
link.searchParams.append("q", "xin chào");
link.searchParams.set("page", "3");
const urlText = `${link.origin}${link.pathname}${link.search}`;

const bytes = new TextEncoder().encode("QChat ⌘");
const byteText = `${bytes.length} bytes`;
const decoded = new TextDecoder().decode(bytes);

const clone = structuredClone({ nested: { ok: true }, list: [1, 2, 3] });
const cloneText = `${clone.nested.ok}/${clone.list.length}`;

const controller = new AbortController();
controller.signal.addEventListener("abort", () => {
  console.log("signal aborted");
});
controller.abort();

function App() {
  const [order, setOrder] = useState("waiting");
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    // Timers run in delay order, and a cleared timer never runs. The interval
    // is stopped by another timer, so the frame count is deterministic.
    const seen: string[] = [];
    const publish = () => setOrder(seen.join(","));
    setTimeout(() => {
      seen.push("late");
      publish();
    }, 30);
    const cancelled = setTimeout(() => {
      seen.push("cancelled");
      publish();
    }, 5);
    clearTimeout(cancelled);
    setTimeout(() => {
      seen.push("early");
      publish();
    }, 10);
    const interval = setInterval(() => setTicks((value) => value + 1), 15);
    setTimeout(() => clearInterval(interval), 50);
    queueMicrotask(() => console.log("microtask ran", order));
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log("env demo ready", { numbers: 6, dates: 4 });
    console.warn("this is a warning");
    console.debug("this is debug output");
  }, []);

  return (
    <View style={{ flex: 1, padding: 16, gap: 10, backgroundColor: "#ffffff" }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>QChat environment</Text>
      <Text testID="numbers">So: {numbers}</Text>
      <Text testID="dates">Ngay: {dates}</Text>
      <Text testID="url">URL: {urlText}</Text>
      <Text testID="bytes">
        Bytes: {byteText} / {decoded}
      </Text>
      <Text testID="clone">Clone: {cloneText}</Text>
      <Text testID="timers">Timers: {order}</Text>
      <Text testID="ticks">Ticks: {ticks}</Text>
      <Text testID="abort">Aborted: {String(controller.signal.aborted)}</Text>
      <Button onPress={() => setTicks(0)}>Dat lai</Button>
    </View>
  );
}

start(App);

import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { COMPONENT_REGISTRY, type RenderNode, type ViewEvent } from "@qchat/miniapp-contracts";
import {
  COMPONENTS_SOURCE,
  WEB_COMPONENTS,
  createViewRenderer,
  imageEventDetail,
  inputEventDetail,
  p0ComponentsCovered,
  p1ComponentsCovered,
  scrollEventDetail,
  webComponentByName,
  webComponentByTag,
} from "../src/index.js";
import { ShimEvent, createDomShim, type DomShim } from "./dom-shim.js";
import { FakeDomAdapter } from "./fake-dom.js";

interface ComponentHarness {
  shim: DomShim;
  make(tag: string, attrs?: Record<string, string>): any;
}

function setup(): ComponentHarness {
  const shim = createDomShim();
  vm.runInContext(COMPONENTS_SOURCE, vm.createContext(shim.context));
  return {
    shim,
    make(tag, attrs = {}) {
      const ctor = shim.customElements.get(tag);
      assert.ok(ctor, `${tag} is not registered`);
      const element: any = new ctor();
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
      element.connectedCallback();
      return element;
    },
  };
}

/** Values built inside the `vm` context are cross-realm; compare JSON data. */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

test("every P0 registry component has a matching web component", () => {
  assert.equal(p0ComponentsCovered(), true);
  for (const definition of COMPONENT_REGISTRY.filter((component) => component.priority === "P0")) {
    const web = webComponentByName(definition.name);
    assert.ok(web, `${definition.name} has no web component`);
    assert.equal(web.tag, `wx-${definition.name}`);
    assert.deepEqual([...web.observedAttributes], [...definition.properties]);
    assert.deepEqual([...web.events], [...definition.events]);
  }
});

test("every P1 registry component has a matching web component", () => {
  assert.equal(p1ComponentsCovered(), true);
  for (const definition of COMPONENT_REGISTRY.filter((component) => component.priority === "P1")) {
    const web = webComponentByName(definition.name);
    assert.ok(web, `${definition.name} has no web component`);
    assert.equal(web.tag, `wx-${definition.name}`);
    assert.deepEqual([...web.observedAttributes], [...definition.properties]);
    assert.deepEqual([...web.events], [...definition.events]);
  }
});

test("web component tags are unique and prefixed", () => {
  const tags = WEB_COMPONENTS.map((component) => component.tag);
  assert.equal(new Set(tags).size, tags.length);
  for (const tag of tags) {
    assert.match(tag, /^wx-[a-z-]+$/);
    assert.equal(webComponentByTag(tag)?.tag, tag);
  }
  assert.equal(webComponentByName("navigation-bar")?.tag, "wx-navigation-bar");
  assert.equal(webComponentByName("textarea")?.tag, "wx-textarea");
  assert.equal(webComponentByName("checkbox-group")?.tag, "wx-checkbox-group");
});

test("COMPONENTS_SOURCE registers every web component and is idempotent", () => {
  const shim = createDomShim();
  const context = vm.createContext(shim.context);
  vm.runInContext(COMPONENTS_SOURCE, context);
  for (const definition of WEB_COMPONENTS) {
    assert.ok(shim.customElements.get(definition.tag), `${definition.tag} is not registered`);
  }
  // Loading the bootstrap twice must not throw on a duplicate definition.
  vm.runInContext(COMPONENTS_SOURCE, context);
});

test("the bootstrap has no bridge, network or storage access", () => {
  assert.doesNotMatch(COMPONENTS_SOURCE, /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|__qchatCall|__qchatResponse/);
});

test("view renders a slot and applies hover-class on touch", () => {
  const { shim, make } = setup();
  const element = make("wx-view", { "hover-class": "pressed", "hover-start-time": "0" });
  assert.ok(element.shadowRoot.querySelector("slot"));
  element.dispatchEvent(new ShimEvent("touchstart"));
  shim.runTimers();
  assert.equal(element.classList.contains("pressed"), true);
  element.dispatchEvent(new ShimEvent("touchend"));
  shim.runTimers();
  assert.equal(element.classList.contains("pressed"), false);
});

test("view ignores hover on a disabled element", () => {
  const { shim, make } = setup();
  const element = make("wx-view", { "hover-class": "pressed", disabled: "" });
  element.dispatchEvent(new ShimEvent("touchstart"));
  shim.runTimers();
  assert.equal(element.classList.contains("pressed"), false);
});

test("text decodes entities and applies space modes to its light DOM", () => {
  const { shim, make } = setup();
  const element = make("wx-text", { decode: "true", space: "nbsp" });
  const node = shim.text("a &amp; b");
  element.appendChild(node);
  element.connectedCallback();
  assert.equal(node.nodeValue, "a\u00a0&\u00a0b");
});

test("image reflects src, mode and lazy-load, then emits load", () => {
  const { make } = setup();
  const element = make("wx-image", { src: "https://cdn.test/a.png", mode: "aspectFit", "lazy-load": "true" });
  const image = element.__qchatImage;
  assert.equal(image.getAttribute("src"), "https://cdn.test/a.png");
  assert.equal(image.style.objectFit, "contain");
  assert.equal(image.loading, "lazy");
  image.naturalWidth = 12;
  image.naturalHeight = 8;
  image.dispatchEvent(new ShimEvent("load"));
  const event = element.dispatched.find((entry: ShimEvent) => entry.type === "load");
  assert.deepEqual({ ...event?.detail }, { width: 12, height: 8 });
});

test("image emits error when the source fails", () => {
  const { make } = setup();
  const element = make("wx-image", { src: "https://cdn.test/missing.png" });
  element.__qchatImage.dispatchEvent(new ShimEvent("error"));
  const event = element.dispatched.find((entry: ShimEvent) => entry.type === "error");
  assert.match(String(event?.detail.errMsg), /image load failed/);
});

test("button reflects attributes and emits tap with coordinates", () => {
  const { make } = setup();
  const element = make("wx-button", { type: "primary", size: "mini", loading: "true" });
  const button = element.__qchatButton;
  assert.equal(button.dataset.type, "primary");
  assert.equal(button.dataset.size, "mini");
  assert.equal(button.dataset.loading, "true");
  assert.equal(button.getAttribute("aria-busy"), "true");
  button.dispatchEvent(new ShimEvent("click", { clientX: 7, clientY: 9 }));
  const tap = element.dispatched.find((entry: ShimEvent) => entry.type === "tap");
  assert.deepEqual({ ...tap?.detail }, { x: 7, y: 9 });
});

test("button does not emit tap while disabled", () => {
  const { make } = setup();
  const element = make("wx-button", { disabled: "" });
  element.__qchatButton.dispatchEvent(new ShimEvent("click"));
  assert.equal(element.dispatched.some((entry: ShimEvent) => entry.type === "tap"), false);
});

test("input reflects value, type, placeholder and emits input detail", () => {
  const { make } = setup();
  const element = make("wx-input", {
    value: "hi",
    type: "number",
    placeholder: "Name",
    "confirm-type": "search",
    maxlength: "10",
  });
  const input = element.__qchatInput;
  assert.equal(input.type, "text");
  assert.equal(input.value, "hi");
  assert.equal(input.placeholder, "Name");
  assert.equal(input.getAttribute("enterkeyhint"), "search");
  assert.equal(input.maxLength, 10);
  input.value = "hello";
  input.selectionStart = 2;
  input.dispatchEvent(new ShimEvent("input"));
  const event = element.dispatched.find((entry: ShimEvent) => entry.type === "input");
  assert.deepEqual({ ...event?.detail }, { value: "hello", cursor: 2, keyCode: 0 });
});

test("input password mode wins over type and emits confirm on Enter", () => {
  const { make } = setup();
  const element = make("wx-input", { password: "true", type: "text" });
  const input = element.__qchatInput;
  assert.equal(input.type, "password");
  input.value = "secret";
  input.dispatchEvent(new ShimEvent("keydown", { key: "Enter" }));
  const confirm = element.dispatched.find((entry: ShimEvent) => entry.type === "confirm");
  assert.deepEqual({ ...confirm?.detail }, { value: "secret" });
});

test("scroll-view applies axes, scroll position and emits scroll details", () => {
  const { make } = setup();
  const element = make("wx-scroll-view", {
    "scroll-y": "true",
    "scroll-top": "12",
    "upper-threshold": "0",
    "lower-threshold": "0",
  });
  const scroller = element.__qchatScroller;
  assert.equal(scroller.dataset.y, "true");
  assert.equal(scroller.dataset.x, "false");
  assert.equal(scroller.scrollTop, 12);
  scroller.scrollHeight = 100;
  scroller.clientHeight = 50;
  scroller.scrollTop = 60;
  scroller.dispatchEvent(new ShimEvent("scroll"));
  const event = element.dispatched.find((entry: ShimEvent) => entry.type === "scroll");
  assert.equal(event?.detail.scrollTop, 60);
  assert.equal(event?.detail.scrollHeight, 100);
  assert.equal(event?.detail.deltaY, 60);
  assert.ok(element.dispatched.some((entry: ShimEvent) => entry.type === "scrolltolower"));
});

test("navigation-bar reflects title, back, colors and emits navback", () => {
  const { make } = setup();
  const element = make("wx-navigation-bar", {
    title: "Notes",
    back: "true",
    color: "#123456",
    background: "#ffffff",
  });
  assert.equal(element.shadowRoot.querySelector(".title").textContent, "Notes");
  assert.equal(element.shadowRoot.querySelector(".back").hidden, false);
  assert.equal(element.style.color, "#123456");
  assert.equal(element.style.background, "#ffffff");
  element.shadowRoot.querySelector(".back").dispatchEvent(new ShimEvent("click"));
  assert.ok(element.dispatched.some((entry: ShimEvent) => entry.type === "navback"));
});

test("navigation-bar hides the back button when back is false", () => {
  const { make } = setup();
  const element = make("wx-navigation-bar", { title: "Home" });
  assert.equal(element.shadowRoot.querySelector(".back").hidden, true);
  assert.equal(element.shadowRoot.querySelector(".spinner").hidden, true);
});

test("the renderer creates every P0 element and forwards its events", () => {
  const dom = new FakeDomAdapter();
  const events: ViewEvent[] = [];
  const view = createViewRenderer(dom, { onEvent: (event) => events.push(event) });
  const p0 = COMPONENT_REGISTRY.filter((component) => component.priority === "P0");
  const children: RenderNode[] = p0.map((component) => ({
    type: "element",
    tag: `wx-${component.name}`,
    props: {},
    events: component.events.length > 0 ? { [component.events[0]]: { handler: `on_${component.name}` } } : undefined,
    children: [],
  }));
  view.render({ type: "element", tag: "wx-view", props: { class: "page" }, children });
  for (const component of p0) {
    assert.ok(dom.createdTags.includes(`wx-${component.name}`), `${component.name} was not created`);
  }
  dom.dispatch(dom.handleForTag("wx-button"), "tap", { x: 1, y: 2 });
  assert.equal(events.length, 1);
  assert.equal(events[0].handler, "on_button");
  assert.deepEqual(events[0].detail, { x: 1, y: 2 });
});

test("event detail helpers match the documented shapes", () => {
  assert.deepEqual(inputEventDetail("abc"), { value: "abc", cursor: 3, keyCode: 0 });
  assert.deepEqual(inputEventDetail("abc", 0, 13), { value: "abc", cursor: 0, keyCode: 13 });
  assert.deepEqual(
    scrollEventDetail({ scrollTop: 1, scrollLeft: 2, scrollHeight: 3, scrollWidth: 4 }),
    { scrollTop: 1, scrollLeft: 2, scrollHeight: 3, scrollWidth: 4, deltaX: 0, deltaY: 0 },
  );
  assert.deepEqual(
    scrollEventDetail({ scrollTop: 1, scrollLeft: 2, scrollHeight: 3, scrollWidth: 4, deltaX: 5, deltaY: -6 }),
    { scrollTop: 1, scrollLeft: 2, scrollHeight: 3, scrollWidth: 4, deltaX: 5, deltaY: -6 },
  );
  assert.deepEqual(imageEventDetail(40, 30), { width: 40, height: 30 });
});

test("textarea reflects value, placeholder and maxlength, then emits input and confirm", () => {
  const { make } = setup();
  const element = make("wx-textarea", { value: "hello", placeholder: "Write", maxlength: "20", "auto-height": "true" });
  const area = element.__qchatInput;
  assert.equal(area.value, "hello");
  assert.equal(area.placeholder, "Write");
  assert.equal(area.maxLength, 20);
  area.value = "hi";
  area.selectionStart = 1;
  area.dispatchEvent(new ShimEvent("input"));
  const input = element.dispatched.find((entry: ShimEvent) => entry.type === "input");
  assert.deepEqual({ ...input?.detail }, { value: "hi", cursor: 1, keyCode: 0 });
  area.dispatchEvent(new ShimEvent("keydown", { key: "Enter" }));
  const confirm = element.dispatched.find((entry: ShimEvent) => entry.type === "confirm");
  assert.deepEqual({ ...confirm?.detail }, { value: "hi" });
});

test("checkbox reflects checked and emits its state; the group collects checked values", () => {
  const { make } = setup();
  const box = make("wx-checkbox", { value: "a", checked: "true" });
  assert.equal(box.__qchatInput.checked, true);
  box.__qchatInput.checked = false;
  box.__qchatInput.dispatchEvent(new ShimEvent("change"));
  const change = box.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...change?.detail }, { value: false });

  const group = make("wx-checkbox-group");
  const first = make("wx-checkbox", { value: "a", checked: "true" });
  const second = make("wx-checkbox", { value: "b" });
  group.appendChild(first);
  group.appendChild(second);
  group.dispatchEvent(new ShimEvent("change"));
  const collected = group.dispatched.filter((entry: ShimEvent) => entry.type === "change").pop();
  assert.deepEqual(plain(collected?.detail), { value: ["a"] });
  assert.deepEqual(plain(group.__qchatValue), ["a"]);
});

test("radio-group keeps one selection and reports its value", () => {
  const { make } = setup();
  const group = make("wx-radio-group");
  const first = make("wx-radio", { value: "a", checked: "true" });
  const second = make("wx-radio", { value: "b", checked: "true" });
  group.appendChild(first);
  group.appendChild(second);
  group.dispatchEvent(new ShimEvent("change"));
  const change = group.dispatched.filter((entry: ShimEvent) => entry.type === "change").pop();
  assert.deepEqual(plain(change?.detail), { value: "a" });
  assert.equal(second.__qchatInput.checked, false);
});

test("switch toggles on tap and ignores a disabled tap", () => {
  const { make } = setup();
  const element = make("wx-switch", { checked: "false" });
  element.__qchatSwitch.dispatchEvent(new ShimEvent("click"));
  const change = element.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...change?.detail }, { value: true });
  assert.equal(element.__qchatSwitch.dataset.checked, "true");

  const disabled = make("wx-switch", { checked: "false", disabled: "true" });
  disabled.__qchatSwitch.dispatchEvent(new ShimEvent("click"));
  assert.equal(disabled.dispatched.some((entry: ShimEvent) => entry.type === "change"), false);
});

test("slider reflects min, max and step, then emits changing and change", () => {
  const { make } = setup();
  const element = make("wx-slider", { value: "25", min: "10", max: "50", step: "5", activeColor: "#123456" });
  const input = element.__qchatInput;
  assert.equal(input.min, "10");
  assert.equal(input.max, "50");
  assert.equal(input.step, "5");
  assert.equal(input.value, "25");
  assert.equal(input.style.accentColor, "#123456");
  input.value = "30";
  input.dispatchEvent(new ShimEvent("input"));
  input.dispatchEvent(new ShimEvent("change"));
  const changing = element.dispatched.find((entry: ShimEvent) => entry.type === "changing");
  const change = element.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...changing?.detail }, { value: 30 });
  assert.deepEqual({ ...change?.detail }, { value: 30 });
});

test("picker builds selector options and reports the selected index", () => {
  const { make } = setup();
  const element = make("wx-picker", { mode: "selector", range: '["A","B","C"]', value: "1" });
  const select = element.__qchatSelect;
  assert.equal(select.childNodes.length, 3);
  assert.equal(select.value, "1");
  select.value = "2";
  select.dispatchEvent(new ShimEvent("change"));
  const change = element.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...change?.detail }, { value: 2 });
});

test("picker date mode uses a native date input", () => {
  const { make } = setup();
  const element = make("wx-picker", { mode: "date", value: "2026-11-28", start: "2020-01-01", end: "2030-12-31" });
  const date = element.__qchatDate;
  assert.equal(date.type, "date");
  assert.equal(date.value, "2026-11-28");
  assert.equal(date.min, "2020-01-01");
  assert.equal(date.max, "2030-12-31");
  date.value = "2026-12-01";
  date.dispatchEvent(new ShimEvent("change"));
  const change = element.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...change?.detail }, { value: "2026-12-01" });
});

test("form collects named values on submit and reports reset", () => {
  const { make } = setup();
  const form = make("wx-form");
  form.appendChild(make("wx-input", { name: "title", value: "hello" }));
  form.appendChild(make("wx-switch", { name: "done", checked: "true" }));
  form.dispatchEvent(new ShimEvent("formsubmit"));
  const submit = form.dispatched.find((entry: ShimEvent) => entry.type === "submit");
  assert.deepEqual(plain(submit?.detail), { value: { title: "hello", done: true } });

  form.dispatchEvent(new ShimEvent("formreset"));
  assert.equal(form.dispatched.some((entry: ShimEvent) => entry.type === "reset"), true);
});

test("swiper applies the current index, dots and a change event", () => {
  const { shim } = setup();
  const Swiper = shim.customElements.get("wx-swiper");
  assert.ok(Swiper);
  const swiper: any = new Swiper();
  swiper.setAttribute("current", "1");
  swiper.setAttribute("indicator-dots", "true");
  swiper.appendChild(shim.element("wx-swiper-item"));
  swiper.appendChild(shim.element("wx-swiper-item"));
  swiper.connectedCallback();
  assert.equal(swiper.__qchatSwiper.track.style.transform, "translateX(-100%)");
  assert.equal(swiper.__qchatSwiper.dots.childNodes.length, 2);
  const change = swiper.dispatched.find((entry: ShimEvent) => entry.type === "change");
  assert.deepEqual({ ...change?.detail }, { current: 1, source: "setData" });
});

test("tab bar draws items and reports the selected index", () => {
  const { make } = setup();
  const element = make("wx-tab-bar", { items: '[{"text":"Home"},{"text":"Mine"}]', selected: "0" });
  const buttons = element.__qchatBar.childNodes.filter((node: any) => node.tagName === "button");
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].childNodes[0].textContent, "Mine");
  buttons[1].dispatchEvent(new ShimEvent("click"));
  assert.equal(element.getAttribute("selected"), "1");
  const change = element.dispatched.filter((entry: ShimEvent) => entry.type === "change").pop();
  assert.deepEqual({ ...change?.detail }, { index: 1 });
});

test("the renderer creates every P1 element", () => {
  const dom = new FakeDomAdapter();
  const view = createViewRenderer(dom);
  const p1 = COMPONENT_REGISTRY.filter((component) => component.priority === "P1");
  const children: RenderNode[] = p1.map((component) => ({
    type: "element",
    tag: `wx-${component.name}`,
    props: {},
    children: [],
  }));
  view.render({ type: "element", tag: "wx-view", props: { class: "page" }, children });
  for (const component of p1) {
    assert.ok(dom.createdTags.includes(`wx-${component.name}`), `${component.name} was not created`);
  }
});

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

test("web component tags are unique and prefixed", () => {
  const tags = WEB_COMPONENTS.map((component) => component.tag);
  assert.equal(new Set(tags).size, tags.length);
  for (const tag of tags) {
    assert.match(tag, /^wx-[a-z-]+$/);
    assert.equal(webComponentByTag(tag)?.tag, tag);
  }
  assert.equal(webComponentByName("navigation-bar")?.tag, "wx-navigation-bar");
  assert.equal(webComponentByName("textarea"), undefined);
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

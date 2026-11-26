/// Fixtures shared by the framework tests and the scratch bisect script.
///
/// `phaseFourProject` exercises the Phase 4 built-ins: swiper, picker, form,
/// label, rich-text, plus `text`'s `space`/`decode` and the checkbox-group
/// empty-value fix.
export function phaseFourProject(): Record<string, string | Buffer> {
  return {
    "app.json": JSON.stringify({
      pages: ["pages/index/index"],
      window: { navigationBarTitleText: "Phase 4" },
    }),
    "app.js": "App({ globalData: { events: [] } });\n",
    "app.wxss": "",
    "manifest.json": JSON.stringify({ name: "Phase 4", version: "1.0.0" }),
    "pages/index/index.json": JSON.stringify({}),
    "pages/index/index.js": `function log(name, detail) {
  getApp().globalData.events.push({ name, detail: detail === undefined ? null : detail });
}
Page({
  data: {
    current: 0,
    picked: 0,
    multi: [0, 0],
    time: "08:30",
    date: "2026-02-03",
    notes: "",
    agree: false,
    choice: "b",
    tags: ["t1"],
    fruit: 0,
    emptyTags: ["a"],
    spaced: "a b",
    entity: "&lt;b&gt;",
    ranges: {
      one: ["a", "b", "c"],
      multi: [["x", "y"], ["1", "2"]],
      fruit: ["apple", "pear"],
    },
    html: "<b>bold</b><script>alert(1)</script><img src='javascript:alert(1)' onerror='x()'>",
    richNodes: [
      { name: "p", attrs: { class: "x", onclick: "x()" }, children: [{ type: "text", text: "hi" }] },
      { name: "script", children: [{ type: "text", text: "bad()" }] },
    ],
  },
  onSwiper(event) {
    log("swiper:" + event.type, event.detail);
    this.setData({ current: event.detail.current });
  },
  onSelect(event) { log("picker:selector", event.detail); this.setData({ picked: event.detail.value }); },
  onMulti(event) { log("picker:multi", event.detail); this.setData({ multi: event.detail.value }); },
  onColumn(event) { log("picker:column", event.detail); },
  onTime(event) { log("picker:time", event.detail); this.setData({ time: event.detail.value }); },
  onDate(event) { log("picker:date", event.detail); this.setData({ date: event.detail.value }); },
  onRegion(event) { log("picker:region", event.detail); },
  onNote(event) { this.setData({ notes: event.detail.value }); },
  onAgree(event) { this.setData({ agree: event.detail.value }); },
  onChoice(event) { this.setData({ choice: event.detail.value }); },
  onSubmit(event) { log("form:submit", event.detail); },
  onReset() { log("form:reset", {}); },
  clearTags() { this.setData({ emptyTags: [] }); },
});
`,
    "pages/index/index.wxml": `<view id="root">
  <swiper id="sw" current="{{current}}" duration="0" indicator-dots="{{true}}" bindchange="onSwiper" bindanimationfinish="onSwiper">
    <swiper-item id="s0"><view>one</view></swiper-item>
    <swiper-item id="s1"><view>two</view></swiper-item>
  </swiper>

  <picker id="pk" mode="selector" range="{{ranges.one}}" value="{{picked}}" bindchange="onSelect">
    <view>pick</view>
  </picker>
  <picker id="mp" mode="multiSelector" range="{{ranges.multi}}" value="{{multi}}" bindchange="onMulti" bindcolumnchange="onColumn">
    <view>multi</view>
  </picker>
  <picker id="tp" mode="time" value="{{time}}" bindchange="onTime"><view>time</view></picker>
  <picker id="dp" mode="date" value="{{date}}" bindchange="onDate"><view>date</view></picker>
  <picker id="rp" mode="region" binderror="onRegion"><view>region</view></picker>

  <form id="fm" bindsubmit="onSubmit" bindreset="onReset">
    <input name="note" value="{{notes}}" bindinput="onNote" />
    <switch name="agree" checked="{{agree}}" bindchange="onAgree" />
    <radio-group name="choice" value="{{choice}}" bindchange="onChoice">
      <radio value="a">A</radio>
      <radio value="b">B</radio>
    </radio-group>
    <checkbox-group name="tags" value="{{tags}}">
      <checkbox value="t1">T1</checkbox>
      <checkbox value="t2">T2</checkbox>
    </checkbox-group>
    <slider name="level" value="30" />
    <picker name="fruit" mode="selector" range="{{ranges.fruit}}" value="{{fruit}}"><view>fruit</view></picker>
    <button id="submit" form-type="submit">Submit</button>
    <button id="reset" form-type="reset">Reset</button>
  </form>

  <label id="lab" for="lab-switch">toggle</label>
  <switch id="lab-switch" checked="{{agree}}" bindchange="onAgree" />

  <checkbox-group id="cg2" value="{{emptyTags}}">
    <checkbox value="a">A</checkbox>
    <checkbox value="b">B</checkbox>
  </checkbox-group>

  <text id="space" space="nbsp">{{spaced}}</text>
  <text id="decode" decode>{{entity}}</text>
  <rich-text id="rich" nodes="{{html}}" />
  <rich-text id="rich2" nodes="{{richNodes}}" />
</view>\n`,
  };
}

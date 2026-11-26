import type { ProjectFile } from "./miniapp";

/// Project templates.
///
/// Each template is a complete WeChat project: `app.json`, `app.js`, `app.wxss`,
/// `manifest.json`, `project.config.json`, pages and (for the starter) a custom
/// component. The Studio writes these files over the scaffold produced by
/// `qchat create`, so a new project is a real Mini Program the official
/// `glass-easel` pipeline can build immediately. There is no TSX template.

export type TemplateId = "starter" | "counter" | "blank";

export type Template = {
  title: string;
  description: string;
  files: ProjectFile[];
};

const README = (name: string, note: string) => `# ${name}

A QChat Mini Program written as a WeChat project.

${note}

\`\`\`sh
qchat build
qchat dev      # http://127.0.0.1:5273
\`\`\`

- \`app.json\` declares the pages, the window and the tab bar.
- \`pages/<route>/\` holds one \`.js\`, \`.json\`, \`.wxml\` and \`.wxss\` per screen.
- \`components/<name>/\` holds reusable components; register them with
  \`usingComponents\` and set \`"component": true\` in the component JSON.
- \`manifest.json\` carries the store metadata (name, version, permissions).

WXML, WXSS, \`Page\`, \`Component\` and \`App\` are compiled by the official
\`glass-easel\` toolchain. QChat supplies the host runtime: the page stack,
\`wx.*\`, storage, permissions and the built-in components.
`;

const PROJECT_CONFIG = (name: string) =>
  `${JSON.stringify(
    {
      projectname: name,
      compileType: "miniprogram",
      description: "QChat Mini Program",
      appid: "qchat",
      setting: { es6: true, minified: true, postcss: true },
    },
    null,
    2,
  )}\n`;

const SITEMAP = `${JSON.stringify(
  { desc: "QChat Mini Program sitemap", rules: [{ action: "allow", page: "*" }] },
  null,
  2,
)}\n`;

const MANIFEST = (name: string, description: string, permissions: string[]) =>
  `${JSON.stringify(
    {
      name,
      version: "1.0.0",
      description,
      requestedPermissions: permissions,
    },
    null,
    2,
  )}\n`;

const STARTER_APP_JSON = `${JSON.stringify(
  {
    pages: ["pages/index/index", "pages/about/about"],
    window: {
      navigationBarTitleText: "QChat Starter",
      navigationBarBackgroundColor: "#ffffff",
      navigationBarTextStyle: "black",
      backgroundColor: "#f7f7f7",
      backgroundTextStyle: "dark",
    },
    tabBar: {
      color: "#7a7e83",
      selectedColor: "#07c160",
      backgroundColor: "#ffffff",
      borderStyle: "black",
      list: [
        { pagePath: "pages/index/index", text: "Home" },
        { pagePath: "pages/about/about", text: "About" },
      ],
    },
    usingComponents: { "demo-card": "/components/demo-card/demo-card" },
  },
  null,
  2,
)}\n`;

const STARTER_APP_JS = `App({
  globalData: {
    launches: 0,
  },
  onLaunch() {
    this.globalData.launches += 1;
  },
});
`;

const STARTER_APP_WXSS = `page {
  background: #f7f7f7;
  color: #1f2329;
}
.container {
  padding: 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.muted {
  color: #8a8a8a;
  font-size: 26rpx;
}
.row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
.card {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
`;

const STARTER_INDEX_JS = `Page({
  data: {
    count: 0,
    items: ["WXML", "WXSS", "glass-easel", "Components"],
    launches: 0,
  },
  onLoad() {
    this.setData({ launches: getApp().globalData.launches });
  },
  increment() {
    this.setData({ count: this.data.count + 1 });
  },
  reset() {
    this.setData({ count: 0 });
    wx.showToast({ title: "Counter reset", icon: "none" });
  },
  onCardTap(event) {
    wx.showToast({ title: event.detail.title, icon: "none" });
  },
});
`;

const STARTER_INDEX_WXML = `<view class="container">
  <view class="card">
    <text class="title">{{count}} taps</text>
    <text class="muted">Rendered by the official glass-easel pipeline</text>
    <view class="row">
      <button type="primary" size="mini" bindtap="increment">Tap me</button>
      <button size="mini" bindtap="reset">Reset</button>
    </view>
  </view>

  <demo-card
    title="Built with WXML"
    body="Every node here is compiled by the official template compiler."
    bindcardtap="onCardTap"
  />

  <view class="card">
    <text class="muted">App launches: {{launches}}</text>
    <view wx:for="{{items}}" wx:key="*this" class="list-row">
      <text>{{index + 1}}. {{item}}</text>
    </view>
  </view>
</view>
`;

const STARTER_INDEX_WXSS = `.list-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
`;

const STARTER_ABOUT_JS = `Page({
  data: {
    year: new Date().getFullYear(),
  },
  openDocs() {
    wx.showToast({ title: "See docs/MINIAPP-DEVELOPER-GUIDE.md", icon: "none" });
  },
});
`;

const STARTER_ABOUT_WXML = `<view class="container">
  <view class="card">
    <text class="title">About {{year}}</text>
    <text class="muted">
      QChat serves the compiled package from a verified local archive and draws
      the native navigation bar and tab bar.
    </text>
    <button size="mini" bindtap="openDocs">Where are the docs?</button>
  </view>
</view>
`;

const STARTER_COMPONENT_JS = `Component({
  properties: {
    title: { type: String, value: "" },
    body: { type: String, value: "" },
  },
  methods: {
    tapCard() {
      this.triggerEvent("cardtap", { title: this.data.title });
    },
  },
});
`;

const STARTER_COMPONENT_WXML = `<view class="card" bindtap="tapCard">
  <text class="card__title">{{title}}</text>
  <text class="card__body">{{body}}</text>
  <slot />
</view>
`;

const STARTER_COMPONENT_WXSS = `.card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
  margin-top: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
.card__title {
  font-size: 30rpx;
  font-weight: 600;
}
.card__body {
  color: #6b6b6b;
  font-size: 26rpx;
}
`;

const COUNTER_APP_JSON = `${JSON.stringify(
  {
    pages: ["pages/index/index"],
    window: {
      navigationBarTitleText: "Counter",
      navigationBarBackgroundColor: "#ffffff",
      navigationBarTextStyle: "black",
    },
  },
  null,
  2,
)}\n`;

const COUNTER_APP_JS = `App({
  globalData: {
    storageKey: "counter.value",
  },
});
`;

const COUNTER_APP_WXSS = `page {
  background: #10131a;
  color: #f5f7fa;
}
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 64rpx 32rpx;
}
.label {
  font-size: 24rpx;
  letter-spacing: 2rpx;
  color: #7c6cff;
}
.value {
  font-size: 128rpx;
  font-weight: 700;
}
.hint {
  font-size: 26rpx;
  color: #8b93a7;
  text-align: center;
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}
`;

const COUNTER_INDEX_JS = `Page({
  data: {
    count: 0,
    loaded: false,
  },
  onLoad() {
    const key = getApp().globalData.storageKey;
    const stored = wx.getStorageSync(key);
    if (typeof stored === "number" && Number.isFinite(stored)) {
      this.setData({ count: stored });
    }
    this.setData({ loaded: true });
  },
  persist() {
    if (!this.data.loaded) return;
    wx.setStorageSync(getApp().globalData.storageKey, this.data.count);
  },
  decrement() {
    this.setData({ count: this.data.count - 1 }, () => this.persist());
  },
  increment() {
    this.setData({ count: this.data.count + 1 }, () => this.persist());
  },
  reset() {
    this.setData({ count: 0 }, () => this.persist());
    wx.showToast({ title: "Counter reset", icon: "none" });
  },
});
`;

const COUNTER_INDEX_WXML = `<view class="container">
  <text class="label">PERSISTENT COUNTER</text>
  <text class="value">{{count}}</text>
  <text class="hint">
    The value survives a reload because storage is handled by the QChat host.
  </text>
  <view class="actions">
    <button size="mini" bindtap="decrement">-1</button>
    <button size="mini" type="primary" bindtap="increment">+1</button>
    <button size="mini" bindtap="reset">Reset</button>
  </view>
</view>
`;

const BLANK_APP_JSON = `${JSON.stringify(
  {
    pages: ["pages/index/index"],
    window: {
      navigationBarTitleText: "New Mini Program",
      navigationBarBackgroundColor: "#ffffff",
      navigationBarTextStyle: "black",
    },
  },
  null,
  2,
)}\n`;

const BLANK_APP_JS = `App({
  globalData: {},
});
`;

const BLANK_APP_WXSS = `page {
  background: #ffffff;
  color: #1f2329;
}
.container {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 48rpx 32rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 600;
}
.muted {
  color: #8a8a8a;
  font-size: 28rpx;
}
`;

const BLANK_INDEX_JS = `Page({
  data: {
    pressed: false,
  },
  press() {
    this.setData({ pressed: true });
    wx.showToast({ title: "Hello from the host", icon: "none" });
  },
});
`;

const BLANK_INDEX_WXML = `<view class="container">
  <text class="title">New Mini Program</text>
  <text class="muted">Edit pages/index/index.wxml, then run Build or Dev.</text>
  <button type="primary" bindtap="press">
    {{pressed ? "Pressed" : "Tap me"}}
  </button>
</view>
`;

export const TEMPLATES: Record<TemplateId, Template> = {
  starter: {
    title: "Starter",
    description: "Two tabs, a custom component, a counter and a toast.",
    files: [
      { relative: "app.json", content: STARTER_APP_JSON },
      { relative: "app.js", content: STARTER_APP_JS },
      { relative: "app.wxss", content: STARTER_APP_WXSS },
      { relative: "manifest.json", content: MANIFEST("Starter", "A polished first Mini Program.", ["toast"]) },
      { relative: "project.config.json", content: PROJECT_CONFIG("starter") },
      { relative: "sitemap.json", content: SITEMAP },
      { relative: "pages/index/index.js", content: STARTER_INDEX_JS },
      { relative: "pages/index/index.json", content: `${JSON.stringify({ navigationBarTitleText: "Home" }, null, 2)}\n` },
      { relative: "pages/index/index.wxml", content: STARTER_INDEX_WXML },
      { relative: "pages/index/index.wxss", content: STARTER_INDEX_WXSS },
      { relative: "pages/about/about.js", content: STARTER_ABOUT_JS },
      { relative: "pages/about/about.json", content: `${JSON.stringify({ navigationBarTitleText: "About" }, null, 2)}\n` },
      { relative: "pages/about/about.wxml", content: STARTER_ABOUT_WXML },
      { relative: "pages/about/about.wxss", content: "" },
      { relative: "components/demo-card/demo-card.js", content: STARTER_COMPONENT_JS },
      {
        relative: "components/demo-card/demo-card.json",
        content: `${JSON.stringify({ component: true, usingComponents: {} }, null, 2)}\n`,
      },
      { relative: "components/demo-card/demo-card.wxml", content: STARTER_COMPONENT_WXML },
      { relative: "components/demo-card/demo-card.wxss", content: STARTER_COMPONENT_WXSS },
      {
        relative: "README.md",
        content: README(
          "Starter",
          "Two pages, a tab bar and a custom `demo-card` component. Tap the counter, then open the About tab.",
        ),
      },
    ],
  },
  counter: {
    title: "Counter",
    description: "Persistent state through wx.setStorageSync.",
    files: [
      { relative: "app.json", content: COUNTER_APP_JSON },
      { relative: "app.js", content: COUNTER_APP_JS },
      { relative: "app.wxss", content: COUNTER_APP_WXSS },
      {
        relative: "manifest.json",
        content: MANIFEST("Counter", "A counter that survives a reload.", ["storage", "toast"]),
      },
      { relative: "project.config.json", content: PROJECT_CONFIG("counter") },
      { relative: "sitemap.json", content: SITEMAP },
      { relative: "pages/index/index.js", content: COUNTER_INDEX_JS },
      { relative: "pages/index/index.json", content: `${JSON.stringify({ navigationBarTitleText: "Counter" }, null, 2)}\n` },
      { relative: "pages/index/index.wxml", content: COUNTER_INDEX_WXML },
      { relative: "pages/index/index.wxss", content: "" },
      {
        relative: "README.md",
        content: README(
          "Counter",
          "The value is written with `wx.setStorageSync` and read back in `onLoad`, so it survives a reload. The `storage` permission is declared in `manifest.json`.",
        ),
      },
    ],
  },
  blank: {
    title: "Blank",
    description: "One page, one button, zero noise.",
    files: [
      { relative: "app.json", content: BLANK_APP_JSON },
      { relative: "app.js", content: BLANK_APP_JS },
      { relative: "app.wxss", content: BLANK_APP_WXSS },
      { relative: "manifest.json", content: MANIFEST("New Mini Program", "A blank QChat Mini Program.", []) },
      { relative: "project.config.json", content: PROJECT_CONFIG("blank") },
      { relative: "sitemap.json", content: SITEMAP },
      { relative: "pages/index/index.js", content: BLANK_INDEX_JS },
      { relative: "pages/index/index.json", content: `${JSON.stringify({ navigationBarTitleText: "New Mini Program" }, null, 2)}\n` },
      { relative: "pages/index/index.wxml", content: BLANK_INDEX_WXML },
      { relative: "pages/index/index.wxss", content: "" },
      {
        relative: "README.md",
        content: README("New Mini Program", "Start from one page and add screens under `pages/`."),
      },
    ],
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

/// Kept as the import name the dialogs already use.
export const TEMPLATE_LABELS = TEMPLATES;

/// Applies a template over the scaffold created by `qchat create`, keeping the
/// files the template does not own (`.gitignore`, `assets/`, ...).
export function templateFiles(
  template: TemplateId,
  overrides: { name?: string; description?: string; version?: string; permissions?: string[] },
): ProjectFile[] {
  const source = TEMPLATES[template] ?? TEMPLATES.blank;
  return source.files.map((file) => {
    if (file.relative === "manifest.json") {
      const manifest = JSON.parse(file.content) as Record<string, unknown>;
      if (overrides.name) manifest.name = overrides.name;
      if (overrides.description !== undefined) manifest.description = overrides.description;
      if (overrides.version) manifest.version = overrides.version;
      if (overrides.permissions) manifest.requestedPermissions = overrides.permissions;
      return { relative: file.relative, content: `${JSON.stringify(manifest, null, 2)}\n` };
    }
    if (file.relative === "project.config.json") {
      const config = JSON.parse(file.content) as Record<string, unknown>;
      if (overrides.name) config.projectname = overrides.name;
      return { relative: file.relative, content: `${JSON.stringify(config, null, 2)}\n` };
    }
    if (file.relative === "README.md" && overrides.name) {
      return {
        relative: file.relative,
        content: file.content.replace(/^# .+$/m, `# ${overrides.name}`),
      };
    }
    return file;
  });
}

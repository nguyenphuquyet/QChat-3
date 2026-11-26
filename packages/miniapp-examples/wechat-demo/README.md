# QChat WeChat Demo

A WeChat-shaped Mini Program used as the Phase 3 sample for the QChat host. It is
authored exactly like a WeChat project (`app.json`, `app.js`, `app.wxss`,
`pages/<route>/{js,json,wxml,wxss}`, `components/`) and built by the official
`glass-easel` Webpack pipeline through `@mna/qchat`.

```sh
node packages/miniapp-framework/dist/cli.js build packages/miniapp-examples/wechat-demo
node packages/miniapp-framework/dist/cli.js validate packages/miniapp-examples/wechat-demo
```

What it exercises:

- `pages/home/home`: `view`, `text`, `button`, `image`, `scroll-view`,
  `progress`, a custom `section` component with a slot, and `navigator`.
- `pages/form/form`: `input`, `textarea`, `switch`, `checkbox-group`,
  `radio-group`, `slider` and the submit path.
- `pages/about/about`: `navigator`, `wx.getSystemInfoSync`,
  `getCurrentPages`, `wx.navigateBack` and `wx.showToast`.

The automated check is `packages/miniapp-framework/test/sample.test.ts`. It boots
the built bundle in jsdom, walks home → form → about and asserts the rendered
`wx-*` hosts and event details. Device results are not part of this sample yet;
see `docs/BUILTIN-COMPONENTS-AUDIT.md` §8.

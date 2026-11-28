# qchat-hello

The M3 sample Mini App, in the native WeChat source format.

- `app.json` declares the page list and `qxColorScheme`.
- `app.js` registers `App`; `pages/index/index.js` registers `Page` with data and
  a `setData` handler.
- `pages/index/index.wxml` uses `{{ }}`, `wx:if`, `wx:for` and `bindtap`.
- `app.wxss` imports `styles/base.wxss`; page WXSS uses `rpx` and
  `[data-theme="dark"]`.

`@qchat/miniapp-test-harness` compiles this package and runs it end to end in
Node: the JavaScript executes in the isolated engine, the WXML renders through
the View Runtime, and a tap updates only the changed text.

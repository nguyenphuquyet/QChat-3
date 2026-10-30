# QChat Mini Apps — Hướng dẫn phát triển đầy đủ

Tài liệu này là bản tham chiếu duy nhất cho việc viết một Mini App chạy trong
QChat: kiến trúc, CLI, manifest, vòng đời, hooks, toàn bộ component, hệ style,
API host, giới hạn đóng gói, kiểm thử và các lỗi thường gặp.

- Đối tượng: lập trình viên viết Mini App bằng TypeScript/TSX.
- SDK: `@mna/qchat` 1.0.0 — protocol `1`, runtime `1.1.0`.
- Tên API, tên prop, tên style giữ nguyên tiếng Anh; phần giải thích là tiếng Việt.
- Nguồn sự thật của component/event/style/permission là
  `packages/contracts/miniapp-ui.contract.json`; bảng sinh tự động nằm ở
  [`docs/miniapp-ui-reference.md`](./miniapp-ui-reference.md), còn tài liệu này
  giải thích cách dùng và hành vi thực tế của host.

---

## Mục lục

1. [TL;DR](#1-tldr)
2. [Kiến trúc](#2-kiến-trúc)
3. [Cài đặt và CLI](#3-cài-đặt-và-cli)
4. [Cấu trúc dự án](#4-cấu-trúc-dự-án)
5. [manifest.json](#5-manifestjson)
6. [Vòng đời ứng dụng](#6-vòng-đời-ứng-dụng)
7. [Runtime và JSX](#7-runtime-và-jsx)
8. [Hooks](#8-hooks)
9. [Sự kiện](#9-sự-kiện)
10. [Component](#10-component)
11. [Hệ style](#11-hệ-style)
12. [Layout và các bẫy thường gặp](#12-layout-và-các-bẫy-thường-gặp)
13. [Host API](#13-host-api)
14. [Môi trường JavaScript](#14-môi-trường-javascript)
15. [Ảnh và asset](#15-ảnh-và-asset)
16. [Đóng gói và giới hạn](#16-đóng-gói-và-giới-hạn)
17. [Kiểm thử](#17-kiểm-thử)
18. [Công thức mẫu](#18-công-thức-mẫu)
19. [Lỗi và cách xử lý](#19-lỗi-và-cách-xử-lý)
20. [Checklist trước khi upload](#20-checklist-trước-khi-upload)

---

## 1. TL;DR

```tsx
import "@mna/qchat/env/auto";
import { start, useState } from "@mna/qchat";
import { Button, Page, NavBar, Text, View } from "@mna/qchat/ui";

function App() {
  const [count, setCount] = useState(0);

  return (
    <Page header={<NavBar title="Đếm" />}>
      <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "bold" }}>Count: {count}</Text>
        <Button onPress={() => setCount((value) => value + 1)}>Tăng</Button>
      </View>
    </Page>
  );
}

start(App);
```

```powershell
npx qchat create my-app
cd my-app
npm install
npx qchat dev        # build khi lưu file
npx qchat test       # render thử + bấm nút đầu tiên
npx qchat build      # dist/my-app-1.0.0.japp
```

Bốn điều quan trọng nhất:

1. Mỗi màn hình nên bọc trong `<Page>`; nó là layout duy nhất xử lý đúng
   header + body + footer + overlay.
2. Không có DOM, không có CSS, không có `localStorage`. Chỉ có những gì tài liệu
   này liệt kê.
3. Mọi state mất khi app đóng. Dữ liệu cần giữ phải nằm trong `setStorage`.
4. Mỗi lần `setState` gửi **toàn bộ cây** đã serialize sang Flutter. Giữ cây nhỏ
   (≤ 4000 node, sâu ≤ 64) và dùng `ListView`/`GridView` cho danh sách dài.

---

## 2. Kiến trúc

```
┌─────────────────────────────┐
│  src/main.tsx (TSX)         │
│  @mna/qchat + @mna/qchat/ui │
└──────────────┬──────────────┘
               │ esbuild + tsc
               ▼
┌─────────────────────────────┐
│  app.js  (IIFE, ES2020)     │
│  manifest.json              │
│  metadata.json              │
│  permissions.json           │
│  assets/**                  │
└──────────────┬──────────────┘
               │ .japp = zip
               ▼
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  QuickJS trong app QChat    │  call  │  Flutter host (Dart)         │
│  - h()/hooks, không DOM     │ ─────► │  - validate method/tham số   │
│  - serialize cây mỗi render │        │  - permission, rate limit    │
│  - timer do host đánh thức  │ ◄───── │  - renderer QChat + TDesign  │
└─────────────────────────────┘ render └──────────────────────────────┘
```

Điểm cần hiểu:

- **Không có WebView và không có DOM.** JSX không tạo DOM; `h()` tạo một cây
  `VNode`, runtime biến nó thành cây node thuần JSON (`View`, `Text`,
  `Button`…) rồi gửi sang Flutter.
- **Không có reconciliation kiểu React.** Mỗi render dựng lại cây host từ đầu.
  State của component nằm trong slot của runtime, gắn với *vị trí* trong cây và
  `key` của element.
- **QuickJS chỉ có ECMAScript.** Không có `setTimeout`, `console`, `URL`,
  `Intl`, `TextEncoder`, `AbortController`, `structuredClone`. Chúng được cài
  bởi `@mna/qchat/env` (xem §14).
- **Host sở hữu mọi quyền.** JS không bao giờ cầm token QChat; mọi việc đặc
  quyền đi qua `call(method, params)` và bị kiểm tra lại ở Dart.
- **Một "screen" là một nhánh component.** Frame gửi kèm `screen` (đường đi các
  component tạo ra node gốc). Nhờ đó host giữ offset scroll/ô nhập riêng cho
  từng tab hoặc từng route, và khôi phục khi quay lại.
- **Timer bị tạm dừng khi người dùng chạm/kéo hoặc khi layout đổi kích thước**,
  để không giật trong lúc thao tác.

Giới hạn cứng của một frame (host kiểm tra):

| Giới hạn | Giá trị | Mã lỗi khi vượt |
| --- | --- | --- |
| Số node | 4000 | `TREE_TOO_LARGE` |
| Độ sâu | 64 | `TREE_TOO_DEEP` |
| Tổng ký tự chuỗi | 8 × 1024 × 1024 | `TREE_TOO_LARGE` |
| Stack QuickJS | 1 MiB | lỗi runtime |

---

## 3. Cài đặt và CLI

### 3.1 Yêu cầu

- Node.js ≥ 20.
- TypeScript 5.9 (do `qchat create` thêm vào `devDependencies`).
- SDK `@mna/qchat` (CLI nằm trong cùng package, lệnh là `qchat`).

### 3.2 Các lệnh

| Lệnh | Việc nó làm |
| --- | --- |
| `qchat create <name> [--dir <directory>]` | Tạo project mới: `manifest.json`, `tsconfig.json`, `package.json`, `src/main.tsx`, `README.md`. Từ chối nếu thư mục đã tồn tại. |
| `qchat dev [--dir <project>] [--once] [--out <file.japp>]` | Build `--no-typecheck`, rồi watch `src`, `assets`, `manifest.json` (debounce 250 ms). `--once` chỉ build một lần. |
| `qchat build [--dir <project>] [--out <file.japp>] [--no-typecheck]` | Typecheck (mặc định), bundle, đóng gói, validate, ghi `.japp`. |
| `qchat bundle [--dir <project>] [--out <file>] [--no-typecheck]` | Chỉ bundle thành **một tệp JS** (mặc định `dist/app.js`), không đóng gói. Dùng để nhúng vào công cụ xem trước. |
| `qchat package ...` | Alias của `build`. |
| `qchat validate <file.japp>` | Kiểm tra package: manifest, entry, hash, kích thước, version. |
| `qchat inspect <file.japp>` | In JSON manifest + metadata + sha256 + danh sách file. |
| `qchat test [--dir <project>]` | Build rồi chạy harness: render, log, bấm `Button`/`Pressable` đầu tiên. |
| `qchat version` | In phiên bản compiler và SDK. |

`build` mặc định ghi `dist/<slug>-<version>.japp`. Slug giữ dấu tiếng Việt đúng:
`Cà Phê Nhà` → `ca-phe-nha`.

### 3.3 Typecheck

- `build` chạy `tsc --noEmit` với một tsconfig tạm (`.qchat-tsconfig.json`,
  tự xoá sau khi chạy), trỏ `@mna/qchat` về bản SDK đi kèm compiler.
- Nếu `tsconfig.json` khai báo `lib: ["DOM"]` hoặc `types: ["node"]`, compiler
  cảnh báo: qapp chạy trong QuickJS, không có DOM/Node. Giữ `lib: ["ES2020"]`.
- Không có `tsconfig.json`, hoặc không tìm thấy TypeScript → typecheck bị bỏ qua
  và có warning (build vẫn tiếp tục).
- `--no-typecheck` dùng khi cần build nhanh; **không** dùng cho bản phát hành.

---

## 4. Cấu trúc dự án

```
my-app/
├── manifest.json          # bắt buộc
├── package.json
├── tsconfig.json
├── src/
│   └── main.tsx           # entry mặc định (manifest.source)
├── assets/                # tuỳ chọn, đóng gói thành assets/**
│   ├── images/logo.png
│   └── data/seed.json
└── dist/
    └── my-app-1.0.0.japp  # sinh ra bởi qchat build
```

- Entry thật lấy từ `manifest.source`, mặc định `src/main.tsx`.
- `assets/` được copy nguyên cây vào package. Chỉ các đuôi file trong danh sách
  §16 mới được nhận; file khác bị bỏ kèm warning.
- File `.japp` là zip, không phải thư mục; đừng sửa tay.
- `dist/`, `node_modules/` không bị watch bởi `qchat dev`.

`package.json` do `qchat create` sinh ra có các script:

```json
{
  "scripts": {
    "dev": "qchat dev",
    "build": "qchat build",
    "validate": "qchat validate dist/*.japp",
    "test": "qchat test"
  },
  "dependencies": { "@mna/qchat": "^1.0.0" },
  "devDependencies": { "typescript": "5.9.3" }
}
```

---

## 5. manifest.json

```json
{
  "schemaVersion": 2,
  "format": "qapp",
  "name": "Ví Nhỏ",
  "description": "Sổ chi tiêu cá nhân",
  "version": "1.0.0",
  "entry": "app.js",
  "sdkVersion": "1.0.0",
  "minRuntimeVersion": "1.0.0",
  "requestedPermissions": ["storage", "toast"],
  "source": "src/main.tsx",
  "icon": "assets/icon.png"
}
```

### 5.1 Trường và giới hạn

| Trường | Bắt buộc | Kiểu / giới hạn | Ghi chú |
| --- | --- | --- | --- |
| `schemaVersion` | ✔ | phải đúng `2` | `1`/HTML cũ bị từ chối (`MANIFEST_SCHEMA`). |
| `format` | ✔ | `"qapp"` | Sai → `MANIFEST_FORMAT`. |
| `name` | ✔ | chuỗi 1–60 ký tự (trim) | Tên hiển thị. |
| `description` | ✖ | chuỗi 0–500 | Mặc định `""`. |
| `version` | ✔ | semver, 5–40 ký tự | `1.0.0`, `2.3.1-beta.1`. |
| `entry` | ✖ | phải là `"app.js"` | Giá trị khác → `MANIFEST_INVALID`. |
| `sdkVersion` | ✖ | semver, mặc định `1.0.0` | SDK đã build. |
| `minRuntimeVersion` | ✖ | semver, mặc định `1.0.0` | Runtime QChat tối thiểu; thấp hơn → `RUNTIME_TOO_OLD`. |
| `requestedPermissions` | ✖ | mảng con của 7 quyền | Trùng lặp bị loại; quyền lạ → `MANIFEST_INVALID`. |
| `source` | ✖ | đường dẫn tương đối an toàn, 1–200 | Mặc định `src/main.tsx`; bị **xoá** khỏi manifest trong package. |
| `icon` | ✖ | chuỗi 1–200 | Không xử lý đặc biệt ở runtime hiện tại. |
| `appId` | ✖ | **cấm** | Server cấp appId; khai báo → `MANIFEST_APP_ID_FORBIDDEN`. |
| `buildHash`, `appSha256` | — | do compiler thêm | Không tự viết. |

### 5.2 Quyền

| Permission | Mở khoá |
| --- | --- |
| `toast` | `showToast` |
| `user.profile` | `getUserInfo`, `request` tới `/users/me` và `/friends` |
| `media.choose` | `chooseImage` |
| `share` | `share` |
| `storage` | `getStorage`, `setStorage`, `removeStorage` |
| `qchat.api` | `request` tới `/conversations` |
| `network` | `fetch` (HTTPS) |

Quy tắc:

- Khai báo **ít nhất** những gì app dùng. Gọi API chưa khai báo → host trả
  `PERMISSION_DENIED` (không có hộp thoại xin quyền).
- Host hỏi người dùng **một lần cho mỗi app** ở lần dùng đầu và ghi nhớ câu trả
  lời; người dùng có thể thu hồi trong phần quản lý Mini App.
- `permissions.json` được sinh tự động trong package; đó là bản sao để server
  kiểm tra, không phải chỗ để sửa.

---

## 6. Vòng đời ứng dụng

### 6.1 Trình tự

```
JS bundle nạp
  └─ import "@mna/qchat/env/auto"     (cài timer, console, URL, Intl…)
  └─ start(App)
       ├─ reset instances/handlers
       ├─ install __qchatDispatch, __qchatLifecycle
       ├─ host.send("ready", { sdkVersion })
       └─ render lần 1 → host.send("render", frame)
```

Sau đó host điều khiển bằng cách gọi vào hai global:

| Global | Việc |
| --- | --- |
| `__qchatDispatch(id, event, payload)` | Chuyển một sự kiện UI tới handler của node. |
| `__qchatLifecycle(event, payload)` | Phát sự kiện vòng đời tới mọi `useLifecycle`. |

### 6.2 Các sự kiện vòng đời

| Event | Payload | Khi nào |
| --- | --- | --- |
| `resume` | `null` | App quay lại foreground. |
| `pause` | `null` | App vào background. |
| `destroy` | `null` | App bị đóng/huỷ. |
| `navigate` | `{ path: string, depth: number }` | Sau khi `navigateTo()` (hoặc `Link` nội bộ) đẩy route mới; `depth` là độ sâu host đang giữ. |
| `back` | `{ path: string \| null, depth: number }` | Host quay lại; `path` là route còn lại, `null` nếu về gốc. |

```tsx
import { useLifecycle, useState } from "@mna/qchat";

function App() {
  const [routes, setRoutes] = useState<string[]>([]);

  useLifecycle((event, payload) => {
    if (event !== "navigate" && event !== "back") return;
    const path = (payload as { path?: string | null } | undefined)?.path ?? null;
    setRoutes((current) => {
      if (path == null) return [];
      if (current[current.length - 1] === path) return current;
      if (current[current.length - 2] === path) return current.slice(0, -1);
      return [...current, path];
    });
  });

  // …
}
```

Điểm quan trọng: **gọi `navigateTo(path)` rồi để `useLifecycle` cập nhật state
route**, đừng `setState` route trước rồi mới gọi. Host ghi nhận route và phát
`navigate` ngay trong lời gọi `navigateTo`, tức trước frame kế tiếp; hiệu ứng
trượt Cupertino được ghép với chính frame mà app render cho route mới. Nếu app
tự đổi route trước, frame đó tới lúc host chưa có route mới, và màn hình sẽ cắt
ngang hoặc trượt sai chiều.

### 6.3 Kết thúc

- App không có "background service". Khi bị đóng, `dispose()` xoá instance,
  handler, lifecycle listener và cây cuối.
- Cleanup của `useEffect`/`useLayoutEffect` chạy khi component unmount, khi deps
  đổi, và khi runtime bị dispose.
- Trước khi app bị đóng, nếu cần lưu dữ liệu, hãy ghi storage ngay khi dữ liệu
  thay đổi (đừng chờ `destroy`: lúc đó không còn cơ hội `await` đáng tin cậy).

---

## 7. Runtime và JSX

### 7.1 Export công khai

Từ `@mna/qchat`:

```ts
// runtime
h, node, Fragment, start, dispose,
useState, useReducer, useRef, useMemo, useCallback,
useEffect, useLayoutEffect, useId,
createContext, useContext, useLifecycle,
getRenderTree, dispatchEvent, hostNodeTypes;

// protocol
PROTOCOL_VERSION, SDK_VERSION, RUNTIME_VERSION, QChatError,
normalizeStyleEnum;

// host APIs
getAppInfo, getSystemInfo, getUserInfo, chooseImage, share,
navigateTo, navigateBack, closeMiniApp, showToast, openExternal,
getStorage, setStorage, removeStorage, createStorage,
request, fetch, fetchJson;
```

Từ `@mna/qchat/ui`: toàn bộ component và type (`Style`, `ButtonProps`, …).

Từ `@mna/qchat/env`: các hàm cài môi trường (`installEnv`, `installTimers`,
`installConsole`, `installIntl`, `installUrl`, `installEncoding`,
`installAbort`, `installStructuredClone`) và type đi kèm. `@mna/qchat/env/auto`
gọi `installEnv()` ngay khi import.

### 7.2 JSX

- `jsx: "react-jsx"`, `jsxImportSource: "@mna/qchat"` — không cần
  `import React`.
- `children` nhận: `VNode`, chuỗi, số, `boolean`, `null`, `undefined`, hoặc mảng
  (mảng được làm phẳng). `null`/`false`/`undefined` không vẽ gì.
- `key` dùng để giữ state khi danh sách đổi thứ tự. Không có `key`, state gắn với
  index.
- `ref` được chấp nhận cho type-check nhưng **không** đi xuống host và không có
  API đo/scroll bằng ref.
- Thẻ lạ (không nằm trong contract) ném `UNSUPPORTED_COMPONENT` và app hiện màn
  hình lỗi.

### 7.3 Mô hình render

- `setState` → `scheduleRender()` → dựng lại toàn bộ cây → `render` frame.
- Trong một handler sự kiện, nhiều `setState` gộp thành **một** frame.
- Trong thân component, gọi `setState` sẽ bị hoãn tới cuối lượt render hiện tại.
- Không có async render, không có Suspense.
- `getRenderTree()` trả frame cuối (chủ yếu cho test/dev).
- `dispatchEvent(id, event, payload)` cho phép tự phát sự kiện (test/dev).

### 7.4 Ví dụ state

```tsx
const [count, setCount] = useState(0);
setCount(1);                    // giá trị mới
setCount((value) => value + 1); // dựa trên giá trị mới nhất
```

Setter ổn định giữa các render (`setCount` không đổi identity), nên có thể đưa
vào `useEffect` deps mà không gây vòng lặp.

---

## 8. Hooks

Tất cả hook phải gọi **vô điều kiện**, theo cùng thứ tự mỗi render. Hook gọi
ngoài component → `HOOK_OUTSIDE_COMPONENT`.

| Hook | Chữ ký | Ghi chú |
| --- | --- | --- |
| `useState` | `useState<T>(initial: T \| (() => T))` | Initializer dạng hàm chỉ chạy lần đầu. Bỏ qua update nếu `Object.is` bằng. |
| `useReducer` | `useReducer<S, A>(reducer, initial)` | Trả `[state, dispatch(action)]`. |
| `useRef` | `useRef<T>(initial)` | Trả `{ current }` ổn định; đổi `.current` **không** gây render. |
| `useMemo` | `useMemo(factory, deps?)` | So sánh deps bằng `Object.is`, so cả độ dài. |
| `useCallback` | `useCallback(fn, deps?)` | `useMemo` cho hàm. |
| `useEffect` | `useEffect(effect, deps?)` | Chạy **sau** khi frame đã gửi. Không truyền `deps` → chạy mỗi render. |
| `useLayoutEffect` | `useLayoutEffect(effect, deps?)` | Chạy **trước** khi frame gửi (trước `useEffect`). `setState` bên trong vẫn tạo frame kế tiếp. |
| `useId` | `useId()` | `qapp_<vị-trí>_<chỉ-số>`, ổn định cho instance + vị trí hook. |
| `useContext` | `useContext(ctx)` | Đọc giá trị provider gần nhất tại thời điểm render. |
| `useLifecycle` | `useLifecycle((event, payload) => void)` | Đăng ký một lần; luôn gọi listener mới nhất. |

### 8.1 Cleanup

```tsx
useEffect(() => {
  const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
  return () => clearInterval(timer);
}, []);
```

- Cleanup chạy trước effect kế tiếp, khi unmount, và khi runtime dispose.
- Nếu một render bỏ qua hook (ví dụ đặt `useEffect` sau `if`), slot dư bị xoá và
  cleanup của nó được gọi. Đây là lý do phải giữ thứ tự hook.

### 8.2 Context

```tsx
import { createContext, useContext } from "@mna/qchat";

const Theme = createContext<"light" | "dark">("light");

function Badge() {
  const theme = useContext(Theme);
  return <Text>{theme}</Text>;
}

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <Theme.Provider value={theme}>
      <Badge />
      <Button onPress={() => setTheme(theme === "light" ? "dark" : "light")}>
        Đổi
      </Button>
    </Theme.Provider>
  );
}
```

Giới hạn: context không tự đăng ký subscriber. `useContext` chỉ đọc
`context.value` lúc render, nên consumer chỉ cập nhật khi **cha** render lại
(ví dụ vì `setTheme` ở trên). Với dữ liệu thay đổi thường xuyên, truyền prop
hoặc dùng state ngay tại component cần.

### 8.3 `useLifecycle` chi tiết

- Listener được lưu trong `useRef` nên không cần `useCallback`.
- Đăng ký trong `useEffect(..., [])`: listener có hiệu lực từ frame thứ hai.
  Đừng giả định nó bắt được sự kiện phát trước frame đầu.
- Nhiều component có thể cùng nghe; mỗi listener chạy độc lập, lỗi của listener
  này không chặn listener khác.

---

## 9. Sự kiện

### 9.1 Bảng component → event

| Component | Event | Prop JSX |
| --- | --- | --- |
| `Link` | `press` | `onPress` |
| `Image` | `press` | `onPress` |
| `Button`, `Pressable` | `press`, `longPress` | `onPress`, `onLongPress` |
| `TextField` | `input`, `change`, `submit`, `focus`, `blur` | `onInput`, `onChange`, `onSubmit`, `onFocus`, `onBlur` |
| `Checkbox` | `change` | `onChange`, `onCheckedChange` |
| `Switch` | `change`, `valueChange` | `onChange`, `onValueChange` |
| `Slider` | `change`, `valueChange` | `onChange`, `onValueChange` |
| `ScrollView` | `scroll` | `onScroll` |
| `ListView`, `GridView` | `endReached` | `onEndReached` |
| `Modal`, `BottomSheet` | `close` | `onClose` |
| `Dialog` | `close`, `confirm` | `onClose`, `onConfirm` |
| `NavBar` | `back` | `onBack` |
| `TabBar` | `change` | `onChange` |

Các event `refresh`, `select`, `press` của `NavBar` có tên trong contract nhưng
**không** component nào phát ở renderer hiện tại — đừng dựa vào chúng.

### 9.2 Payload thực tế

| Nguồn | Payload |
| --- | --- |
| `Button`/`Pressable` `press`, `longPress` | `null` |
| `Image` `press` | `null` |
| `Link` `press` | `{ type: "press", href: string, external: boolean }` |
| `TextField` `input` | **chuỗi thô** (không phải object) |
| `TextField` `change`/`submit` | `{ type, value: string, text: string }` |
| `TextField` `focus`/`blur` | `{ type }` |
| `Checkbox` `change` | `{ type: "change", value: boolean }` |
| `Switch` `change`/`valueChange` | `{ type, value: boolean }` |
| `Slider` `change`/`valueChange` | `{ type, value: number }` (đã snap theo `step`) |
| `ScrollView` `scroll` | `{ type: "scroll", x, y, value: { x, y } }` |
| `ListView`/`GridView` `endReached` | `{ type: "endReached" }` |
| `Modal`/`BottomSheet` `close` | `{ type: "close" }` |
| `Dialog` `close`/`confirm` | `{ type: "close" }` / `{ type: "confirm" }` |
| `NavBar` `back` | `{ type: "back" }` |
| `TabBar` `change` | `{ type: "change", index, key, value: { index, key, value } }` (giá trị trong `value.value` là `key`) |

Type tương ứng:

```ts
interface QappEvent<T> { type: EventName; value: T }
interface QappTextEvent extends QappEvent<string> { text: string }
interface QappToggleEvent extends QappEvent<boolean> {}
interface QappNumberEvent extends QappEvent<number> {}
interface QappScrollEvent extends QappEvent<{ x: number; y: number }> {
  x: number; y: number;
}
interface QappTabEvent extends QappEvent<{ index: number; key: string; value: string }> {
  index: number; key: string;
}
```

### 9.3 Quy tắc

- Prop không nằm trong `PROP_EVENT_MAP` (ví dụ `onSomething`) bị **bỏ**, không
  lọt xuống host.
- Nhiều prop cùng map một event (`onChange` + `onCheckedChange`) → event chỉ xuất
  hiện một lần; prop sau (theo thứ tự object) thắng.
- Handler được gắn lại sau **mỗi** frame. Không cần (và không nên) tự
  add/remove listener.
- Handler chạy đồng bộ trên JS thread; không `await` trong handler — hãy
  `void somePromise()` và cập nhật state khi xong.
- `ScrollView` chỉ phát `scroll` khi có `onScroll` (host không gắn listener khi
  không cần, để đỡ frame).

---

## 10. Component

### 10.0 Prop chung (`BaseProps`)

Mọi component nhận:

| Prop | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `key` | `string \| number` | Giữ state theo identity khi danh sách đổi. |
| `ref` | `{ current } \| (value) => void` | Chỉ để type-check; không có hành vi runtime. |
| `style` | `Style` | Xem §11. |
| `children` | `VNodeChild` | Nội dung. |
| `testID` | `string` | Khoá widget trong Flutter (dùng cho test host). |
| `accessibleLabel` | `string` | Nhãn screen reader; `Button` dùng làm label nút. |
| `pointerEvents` | `"auto" \| "none"` | `none` → bọc `IgnorePointer`. |

`style` **luôn thắng** palette của TDesign: nếu app đặt `backgroundColor`,
`color`, `borderColor`, `borderWidth`, `borderRadius`, `padding`, host dùng giá
trị đó thay vì theme.

---

### 10.1 Layout: `View`, `Row`, `Column`

```tsx
<View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: "#ffffff" }}>
  <Row style={{ gap: 8, alignItems: "center" }}>
    <Avatar name="Nguyễn An" size={36} />
    <Column style={{ flex: 1 }}>
      <Text style={{ fontWeight: "600" }}>Nguyễn An</Text>
      <Text style={{ fontSize: 12, color: "#8a8a8a" }}>Đang hoạt động</Text>
    </Column>
  </Row>
</View>
```

- `View`: khối flex, mặc định `flexDirection: "column"`.
- `Row`: `View` với `flexDirection: "row"` (style của bạn ghi đè được).
- `Column`: `View` với `flexDirection: "column"`.
- `flex: 1` để lấp phần còn lại. Trong `Column`/`Row`, một `View` không có
  `flex` chỉ cao/rộng theo nội dung.
- `gap`, `rowGap`, `columnGap` dùng `spacing` của Flutter (không phải margin).
- `padding`/`margin` nhận số, hoặc các biến thể `paddingHorizontal`,
  `paddingVertical`, `paddingTop/Right/Bottom/Left` (tương tự cho margin).

Chú ý: `Row`/`Column` là component **của SDK**, chúng render thành node `View`
với `flexDirection`. Nếu bạn tự viết `<View style={{ flexDirection: "row" }}>`
thì kết quả tương đương.

---

### 10.2 `Page`

Khung màn hình chuẩn: header trên, body ở giữa, footer dưới, overlay phủ tất cả.

```tsx
<Page
  header={<NavBar title="Ví của tôi" showBack onBack={back} />}
  footer={
    <TabBar
      tabs={[
        { key: "home", label: "Trang chủ", icon: "home" },
        { key: "me", label: "Tôi", icon: "me" },
      ]}
      activeKey={tab}
      onChange={(event) => setTab(event.key)}
    />
  }
  overlays={
    <Dialog
      visible={confirming}
      title="Xoá giao dịch?"
      confirmText="Xoá"
      cancelText="Huỷ"
      onConfirm={remove}
      onClose={() => setConfirming(false)}
    />
  }
>
  <ScrollView>{/* nội dung */}</ScrollView>
</Page>
```

| Prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `header` | `VNodeChild` | Thường là một `NavBar`. |
| `footer` | `VNodeChild` | Thường là một `TabBar`. |
| `overlays` | `VNodeChild` | `Dialog`/`Modal`/`BottomSheet`; được vẽ **phủ cả header và footer**. |
| `children` | `VNodeChild` | Body; luôn lấp đúng khoảng giữa header và footer. |
| `style` | `Style` | `flex: 1` được thêm sẵn; style của bạn ghi đè được. |

Vì sao phải dùng `Page`: nếu tự đặt `NavBar` trong `Stack` và cho body
`height: "100%"`, nội dung sẽ bắt đầu ở y = 0 và trượt xuống dưới header. `Page`
neo body vào phần còn lại, và đặt overlay là **sibling của cả cột** nên scrim
phủ luôn header/TabBar.

---

### 10.3 `Stack`, `Positioned`

```tsx
<Stack alignment="center" style={{ height: 160 }}>
  <Image src="assets/images/cover.jpg" width={160} height={160} fit="cover" />
  <Positioned bottom={8} right={8}>
    <Badge count={3} />
  </Positioned>
</Stack>
```

| `Stack` prop | Kiểu | Mặc định |
| --- | --- | --- |
| `alignment` | `topLeft`…`bottomRight` | `topLeft` |
| `style` | `Style` | — |

| `Positioned` prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `top`/`right`/`bottom`/`left` | `number` | Đặt `position: "absolute"` tự động. |

- Con của `Stack` được vẽ theo thứ tự, trừ khi có `zIndex` (sắp xếp tăng dần,
  ổn định khi bằng nhau).
- `Modal`/`BottomSheet`/`Dialog` nằm trong `Stack` tự động được `Positioned.fill`
  để barrier phủ toàn stack.
- `Positioned` lồng nhiều con sẽ tạo `Stack` bên trong.

---

### 10.4 `Spacer`

| Prop | Kiểu | Mặc định / giới hạn |
| --- | --- | --- |
| `size` | `number` | `0`; clamp `0…400` |

- `size > 0`: một khoảng trống cố định cả hai chiều.
- `size == 0` và đang nằm trong flex: `Expanded` (đẩy các phần tử ra hai đầu).
- `size == 0` ngoài flex: cao 8.

---

### 10.5 `Divider`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `color` | `string` | màu đường kẻ của theme |
| `thickness` | `number` | `1`, clamp `0.5…24` |
| `vertical` | `boolean` | `false` |
| `inset` | `number` | `0`, clamp `0…400` |

- Ngang: dùng `TDivider` của TDesign, `inset` là lề trái.
- Dọc: `SizedBox` + `ColoredBox`; `inset` là lề trên. Trong `Row` không có
  chiều cao xác định, mặc định cao 24.

---

### 10.6 `SafeArea`

```tsx
<SafeArea edges={["bottom"]}>
  <Text>Nội dung</Text>
</SafeArea>
```

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `edges` | `("top"\|"right"\|"bottom"\|"left")[]` | cả bốn |

- Con được xếp thành một cột stretch.
- `NavBar`/`TabBar` đã tự xử lý safe area của chúng; đừng bọc thêm nếu không cần.

---

### 10.7 `ScrollView`

```tsx
<ScrollView
  style={{ flex: 1, padding: 16, gap: 12 }}
  onScroll={(event) => setY(event.y)}
  showsScrollIndicator
>
  {items.map((item) => (
    <Row key={item.id}>{item.title}</Row>
  ))}
</ScrollView>
```

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `horizontal` | `boolean` | `false` (dọc) |
| `vertical` | `boolean` | Không có tác dụng; dọc là mặc định |
| `showsScrollIndicator` | `boolean` | `true` |
| `onScroll` | `(event: QappScrollEvent) => void` | — |
| `grid` | `boolean` | `false` |
| `numColumns` | `number` | `2`, clamp `1…12` |
| `style` | `Style` | `gap`, `padding`, `aspectRatio` được dùng |

- **`padding` trên scroller là khoảng đệm bên trong vùng cuộn**, đúng như
  `ListView(padding: …)` của Flutter: viewport vẫn phủ kín vùng được cấp (từ mép
  header tới mép `TabBar`, hết chiều ngang), padding chỉ đẩy nội dung vào trong
  và đi theo nội dung khi cuộn. `paddingHorizontal` / `paddingVertical` /
  `paddingTop`… hoạt động như §11.1, và **không** cần bọc thêm `View` để lấy lề.
  `margin`, `backgroundColor`, border và radius vẫn ở lớp ngoài, nên nền phủ kín
  viewport chứ không co theo padding.
- `grid: true` biến nội dung thành lưới **không cuộn riêng** bên trong scroller
  (grid dùng `shrinkWrap`, `NeverScrollableScrollPhysics`), `gap` làm cả hai
  khoảng cách, `style.aspectRatio` làm tỉ lệ ô (mặc định 1). Padding của
  `ScrollView` được tính **một lần**; lưới bên trong không cộng thêm lề.
- `scroll` chỉ phát khi có `onScroll`; tần suất được throttle theo thời gian và
  khoảng cách; `x` chỉ có nghĩa khi `horizontal`.
- Offset được nhớ theo **screen** (xem §2): rời tab rồi quay lại vẫn giữ chỗ.
- Scroller lồng trong scroller cùng hướng sẽ tự nhường việc cuộn cho scroller
  ngoài thay vì crash.

> Hành vi này là của runtime `1.1.0`. Trước đó `padding` bị áp cả ngoài lẫn
> trong nên viewport bị thu nhỏ và nội dung bị cắt đúng một padding ở sát header,
> `TabBar` và mép phải. App cần chắc chắn chạy trên host đã sửa hãy khai
> `"minRuntimeVersion": "1.1.0"` trong manifest.

---

### 10.8 `ListView`

```tsx
<ListView
  data={transactions}
  initialCount={30}
  style={{ flex: 1, paddingHorizontal: 16 }}
  empty={<Text style={{ color: "#8a8a8a" }}>Chưa có giao dịch</Text>}
  renderItem={(item) => (
    <Row key={item.id} style={{ paddingVertical: 16, gap: 12 }}>
      <Text style={{ flex: 1 }}>{item.title}</Text>
      <Text>{formatVnd(item.amount)}</Text>
    </Row>
  )}
  onEndReached={() => void loadMore()}
/>
```

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `data` | `readonly T[]` | `[]` |
| `renderItem` | `(item, index) => VNodeChild` | — |
| `empty` | `VNodeChild` | — |
| `initialCount` | `number` | `60` (tối thiểu 1) |
| `horizontal` | `boolean` | `false` |
| `onEndReached` | `() => void` | — |
| `keyExtractor` | `(item, index) => string` | Nhận nhưng host chưa dùng |

`style.padding` trên `ListView` cũng là khoảng đệm **bên trong** vùng cuộn: danh
sách vẫn chiếm trọn ô flex được cấp, item đầu cách mép trên đúng bằng padding, và
cuộn hết danh sách thì item cuối dừng cách mép dưới đúng bằng padding. Dùng
`paddingHorizontal` để lề hai bên mà item vẫn chạm sát mép trên/dưới khi cuộn.

Cách hoạt động:

1. Frame đầu chỉ chứa `initialCount` item đầu.
2. Khi cuộn tới cách cuối **240 px**, host phát `endReached`.
3. SDK tăng cửa sổ thêm `initialCount` và render lại; `onEndReached` của bạn
   cũng chạy, dùng nó để tải trang dữ liệu tiếp theo.
4. Có latch: mỗi cửa sổ chỉ báo một lần, tránh spam khi danh sách không tăng.
5. `data.length === 0` → chỉ render `empty`.

Vì `data` là mảng thật trong JS, đừng đưa 10 000 phần tử vào rồi mong host tự
phân trang: cửa sổ giúp giảm số node, nhưng mảng vẫn nằm trong bộ nhớ QuickJS.

---

### 10.9 `GridView`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `data` | `readonly T[]` | `[]` |
| `numColumns` | `number` | `2` |
| `renderItem` | `(item, index) => VNodeChild` | — |
| `empty` | `VNodeChild` | — |
| `initialCount` | `number` | `60` |
| `onEndReached` | `() => void` | — |

Cơ chế cửa sổ và `endReached` giống `ListView`. Grid cuộn dọc, mỗi item do
`renderItem` quyết định kích thước; dùng `style.aspectRatio` nếu cần ô vuông.
`style.padding` (và `gap`) áp bên trong vùng cuộn: `aspectRatio` được tính trên
bề rộng ô còn lại **sau** padding và `gap`, nên ô không bị tràn ngang khi có lề.

```tsx
<GridView
  data={stories}
  numColumns={2}
  style={{ flex: 1, padding: 16, gap: 12, aspectRatio: 0.8 }}
  renderItem={(item) => <StoryCard item={item} />}
/>
```

---

### 10.10 `Text`, `RichText`

```tsx
<Text
  numberOfLines={2}
  selectable
  style={{ fontSize: 15, lineHeight: 21, textTransform: "uppercase" }}
>
  Xin chào
</Text>

<RichText style={{ fontSize: 15 }}>
  Bạn có <Text style={{ fontWeight: "bold" }}>3</Text> tin nhắn mới,{" "}
  <Link href="/messages" style={{ color: "#0f7b45" }}>xem ngay</Link>.
</RichText>
```

| Prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `numberOfLines` | `number` | Cắt bằng `…`. |
| `selectable` | `boolean` | Chọn chữ + bong bóng copy của QChat. |

`RichText`: con là `Text`, `Link` hoặc chuỗi; chúng được làm phẳng thành **một**
paragraph native. Không nhận HTML. Style ở `Text` con được áp cho đoạn đó.

Style chữ: `fontSize`, `fontWeight`, `fontStyle`, `lineHeight` (số point tuyệt đối,
ví dụ `21` cho `fontSize: 15`), `letterSpacing`, `textAlign`, `textDecoration`,
`textTransform`, `color`. `fontFamily` được chấp nhận nhưng QChat không đóng gói
font — chỉ dùng font hệ thống.

---

### 10.11 `Link`

```tsx
<Link href="/detail/42">Xem chi tiết</Link>
<Link href="https://qchat.vn" external onPress={openInBrowserHint}>
  Website
</Link>
```

| Prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `href` | `string` | Route nội bộ hoặc URL. |
| `external` | `boolean` | `true` → không tự điều hướng. |
| `onPress` | `() => void` | Luôn chạy trước khi điều hướng. |
| `disabled` | `boolean` | — |

- `external` không được đặt: SDK gọi `navigateTo(href)` (host kiểm tra path).
  Lỗi điều hướng bị nuốt để một route sai không làm chết app; `onPress` vẫn chạy.
- `external: true`: chỉ báo `press` với `{ href, external: true }`. **Host chưa
  mở app ngoài** (`openExternal` trả `NOT_SUPPORTED`), nên hãy coi đây là tín
  hiệu để app tự hiển thị hướng dẫn.
- `href` nội bộ phải khớp `^[A-Za-z0-9._~/-]{1,300}$`.

---

### 10.12 `Badge`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `count` | `number` | — (0 hoặc âm → ẩn) |
| `max` | `number` | `99`, clamp `1…999`; vượt → `max+` |
| `dot` | `boolean` | `false` |
| `visible` | `boolean` | `true` |
| `tone` | `neutral`\|`success`\|`warning`\|`danger`\|`info` | Nhận nhưng host chưa dùng (badge luôn theo palette đỏ của TDesign) |

```tsx
<Badge count={12}>
  <Icon name="chats" size={26} />
</Badge>

<Badge dot>
  <Avatar name="An" />
</Badge>
```

`count={0}` hoặc không có `count` và không `dot` → không vẽ gì, chỉ còn con.

---

### 10.13 `Tag`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `tone` | `neutral`\|`success`\|`warning`\|`danger`\|`info` | `neutral` |
| `size` | `sm`\|`md`\|`lg` | `md` |

Nội dung là text thuần (con được ghép thành chuỗi). Vẽ bằng `TTag`.

---

### 10.14 `Avatar`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `src` | `string` | — |
| `name` | `string` | — (lấy chữ cái đầu của 2 từ) |
| `size` | `number` | `style.width` hoặc `40`, clamp `16…160` |
| `shape` | `circle`\|`rounded` | `circle` |

- Không có `src` (hoặc ảnh lỗi) → hiện initials trên nền xanh nhạt; không có
  `name` → icon `user`.
- `src` theo đúng chính sách ảnh §15.

---

### 10.15 `Image`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `src` | `string` | — |
| `width` | `number` | `style.width` |
| `height` | `number` | `style.height` |
| `fit` | `cover`\|`contain`\|`fill`\|`fitWidth`\|`fitHeight` | `cover` |
| `borderRadius` | `number` | `0` |
| `onPress` | `() => void` | — |

```tsx
<Image
  src="assets/images/logo.png"
  width={72}
  height={72}
  fit="contain"
  borderRadius={16}
/>
```

- `src` chỉ nhận: `data:` URL, đường dẫn đóng gói bắt đầu bằng `assets/`, hoặc
  `https://…`. Giá trị khác → khung xám thay thế.
- Ảnh lỗi/tải chậm cũng hiện khung thay thế, không làm sập app.
- Có `onPress` → bọc `GestureDetector`.

---

### 10.16 `Icon`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `name` | `string` | bắt buộc về type; thiếu → `miniApps` |
| `size` | `number` | `style.fontSize` hoặc `22` |
| `color` | `string` | `style.color` hoặc màu chữ TDesign |

Tên được tra theo bảng TDesign trước, không có thì rơi về bộ glyph QChat:

**TDesign:** `check`, `close`, `chevronRight`, `chevronLeft`, `plus`, `minus`,
`heart`, `share`, `delete`, `refresh`, `info`, `clock`, `grid`, `me`,
`addFriend`, `groups`, `mail`, `call`, `videoCall`, `camera`, `image`,
`location`, `nearby`, `file`, `folderOpen`, `music`, `lock`, `pencil`, `official`,
`star`, `search`, `service`, `wallet`, `payments`, `eye`, `tag`, `undo`, `send`,
`miniApps`, `discover`, `chats`, `contacts`.

**Fallback QChat:** `arrowLeft`, `chats`, `contacts`, `discover`, `me`,
`addFriend`, `groups`, `tag`, `service`, `official`, `chevron`, `chevronRight`,
`close`, `check`, `clock`, `delete`, `gear`, `gift`, `heart`, `heartHandshake`,
`image`, `info`, `lock`, `unlock`, `mail`, `miniApps`, `more`, `music`, `pencil`,
`play`, `pause`, `qr`, `qrCode`, `radar`, `receipt`, `refresh`, `refreshCw`,
`scan`, `scanQrCode`, `share`, `shieldCheck`, `star`, `transfer`, `undo`,
`userRound`, `videoCall`, `wallet`, `coins`, `creditCard`, `banknoteUp`,
`banknoteDown`, `piggyBank`, `ticketPercent`, `trainFront`, `plane`, `hotel`,
`stethoscope`, `carFront`, `landmark`, `headset`, `keyboard`, `mobile`,
`smartphone`, `download`, `eye`, `eyeOff`, `female`, `male`, `arrowLeftRight`,
`call`, `camera`, `file`, `folderOpen`, `grid`, `location`, `receipt`.

Tên không có trong cả hai bảng → ô trống. Đừng dùng tên ngoài danh sách.

---

### 10.17 `Button`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `onPress` | `() => void` | — |
| `onLongPress` | `() => void` | — |
| `disabled` | `boolean` | `false` |
| `variant` | `primary`\|`secondary`\|`outline`\|`text`\|`danger` | `primary` |
| `size` | `sm`\|`md`\|`lg` | `md` (cao tối thiểu 32/40/48) |
| `loading` | `boolean` | `false` |
| `icon` | `string` | — (tên icon, vẽ cạnh nhãn) |

```tsx
<Button
  variant="danger"
  icon="delete"
  loading={deleting}
  onPress={() => void remove()}
>
  Xoá giao dịch
</Button>
```

- Nhãn lấy từ text con (ghép chuỗi).
- `style.color`, `backgroundColor`, `borderColor`, `borderWidth`,
  `borderRadius`, `padding` ghi đè TDesign.
- Nền, viền và bo góc do chính nút vẽ, và `padding` của bạn chỉ được dùng một
  lần. Không đặt `borderRadius` thì nút bo **6pt**, nên chỉ đặt
  `backgroundColor` vẫn ra nút bo góc chứ không ra hình chữ nhật.
- `disabled` không gắn semantics bấm; `loading` hiện spinner TDesign.

---

### 10.18 `Pressable`

Một `View` có `onPress`/`onLongPress`, **giữ nguyên flex layout** (không bị ép
thành cột). Dùng cho card, hàng danh sách, ô lưới.

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `onPress` | `() => void` | — |
| `onLongPress` | `() => void` | — |
| `disabled` | `boolean` | `false` |

```tsx
<Pressable onPress={() => push(`/txn/${item.id}`)} style={{ flex: 1 }}>
  <Row style={{ padding: 16, gap: 12 }}>
    <Icon name="receipt" />
    <Text style={{ flex: 1 }}>{item.title}</Text>
    <Icon name="chevronRight" size={18} />
  </Row>
</Pressable>
```

---

### 10.19 `TextField`

| Prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `value` | `string` | Giá trị app kiểm soát. |
| `placeholder` | `string` | — |
| `onInput` | `(value: string) => void` | Nhận **chuỗi thô**. |
| `onChange` | `(event: QappTextEvent) => void` | `{ type, value, text }`. |
| `onSubmit` | `(event: QappTextEvent) => void` | Nút return. |
| `onFocus` / `onBlur` | `() => void` | — |
| `secureTextEntry` | `boolean` | Mật khẩu. |
| `multiline` | `boolean` | Nhiều dòng. |
| `maxLength` | `number` | Giới hạn ký tự. |
| `keyboardType` | `text`\|`number`\|`email`\|`phone`\|`url` | — |
| `editable` | `boolean` | `false` → chỉ đọc. |
| `autoFocus` | `boolean` | — |

```tsx
const [note, setNote] = useState("");

<TextField
  value={note}
  placeholder="Ghi chú"
  maxLength={120}
  multiline
  onInput={setNote}
  onChange={(event) => setNote(event.value)}
/>
```

Hành vi quan trọng:

- Ô nhập là component stateful phía Flutter. Nó chỉ nhận `value` mới khi prop
  **thực sự đổi**, nên một re-render lặp lại giá trị cũ không kéo con trỏ về
  đầu.
- Bàn phím mở làm host thu nhỏ cả Mini App. `TabBar` mặc định `hideOnKeyboard`
  để dính đáy; nếu bạn tự làm footer, hãy tính tới điều này.
- Text state không tự đồng bộ vào JS nếu bạn không truyền `value`; muốn
  controlled hoàn toàn thì luôn truyền `value` + `onInput`/`onChange`.
- Khung ô nhập chỉ được vẽ **một lần**. Nếu style của `TextField` có
  `backgroundColor` / `borderWidth` / `borderColor` / `borderRadius` / `shadow`
  thì host vẽ đúng khung đó và phần nhập chỉ là con chữ bên trong — nó không
  thêm nền hay lề 16 nào nữa, nên không bao giờ thấy hai lớp thiết kế lồng nhau.
  Không khai báo gì thì host vẽ ô nền xám 48pt, bo 8, lề ngang 12 để ô vẫn ra
  dáng ô nhập.
- Ô **một dòng** giữ chiều cao tự nhiên của một dòng chữ rồi mới được căn giữa
  trong hộp bạn khai, nên đặt cả `height` lẫn `padding` cũng không ép chữ lên
  trên. Lề ngang 12 mặc định chỉ áp khi bạn không đặt `padding`: có padding thì
  host dùng đúng padding đó.
- Chữ trong ô (và trong `Button`) luôn được căn giữa theo chiều dọc của hộp.
  `lineHeight` là chiều cao **dòng**, không phải chiều cao hộp: đặt
  `lineHeight` lớn hơn `fontSize` là hợp lệ, host tự cân lại để nét chữ nằm
  giữa dòng thay vì bị đẩy xuống đáy.

---

### 10.20 `Checkbox`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `checked` | `boolean` | `false` |
| `label` | `string` | — |
| `disabled` | `boolean` | `false` |
| `onChange` | `(event: QappToggleEvent) => void` | — |
| `onCheckedChange` | alias của `onChange` | — |

`Checkbox` stateful cục bộ giống `Switch`: chỉ nhận prop mới khi prop đổi.

---

### 10.21 `Switch`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `value` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `onChange` | `(event) => void` | event `change` |
| `onValueChange` | `(event) => void` | event `valueChange` |

Cả hai event cùng phát khi người dùng gạt (nếu cả hai handler được truyền).

---

### 10.22 `Slider`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `value` | `number` | `0` |
| `min` | `number` | `0` |
| `max` | `number` | `1` |
| `step` | `number` | — (không chia bước) |
| `disabled` | `boolean` | `false` |
| `onChange` | `(event: QappNumberEvent) => void` | — |
| `onValueChange` | `(event: QappNumberEvent) => void` | — |

- `step > 0` → chia `((max - min) / step)` divisions (clamp 1…1000) và snap giá
  trị.
- Event chỉ phát ở **cuối** thao tác kéo (`onChangeEnd`); trong lúc kéo, thumb
  chạy cục bộ.

---

### 10.23 `ActivityIndicator`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `size` | `number` | `20`, clamp `4…120` |
| `color` | `string` | `style.color` hoặc màu theme |

Spinner tròn của TDesign.

---

### 10.24 `AnimatedView`

```tsx
<AnimatedView animate="slideUp" duration={260}>
  <Card />
</AnimatedView>
```

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `animate` | `fadeIn`\|`slideUp`\|`scaleIn` | `fadeIn` |
| `duration` | `number` (ms) | `220`, clamp `0…2000` |

- Chạy **một lần khi mount** (hoặc khi node bị dựng lại), không chạy lại mỗi
  render.
- `slideUp`: trượt lên 20 px + fade; `scaleIn`: phóng từ 0.92; `fadeIn`: chỉ mờ.
- Dùng cho phần tử mới xuất hiện; đừng bọc cả màn hình nếu không cần.

---

### 10.25 `CustomPaint`

Vẽ bằng một ngôn ngữ path nhỏ, khai báo, không phải Dart tuỳ ý.

| Prop | Kiểu | Ghi chú |
| --- | --- | --- |
| `draw` | `string` | Chuỗi lệnh. |
| `width` | `number` | Kích thước. |
| `height` | `number` | Kích thước. |

Cú pháp:

```
fill:#rrggbb stroke:#rrggbb strokeWidth:2 cap:round M 0 0 L 100 0 L 100 40 Z
```

- Tiền tố tuỳ chọn: `fill:`, `stroke:`, `strokeWidth:` (mặc định 2, clamp
  `0.1…64`), `cap:` (`round` mặc định, `butt`, `square`).
- Không có `fill` lẫn `stroke` → nét đen mặc định (không phải "không vẽ gì").
- Lệnh tuyệt đối: `M x y`, `L x y`, `Q cx cy x y`, `C c1x c1y c2x c2y x y`,
  `Z`.
- Không có lệnh tương đối, không có arc, không có text.
- Chuỗi sai cú pháp → không vẽ gì (không ném lỗi vào cây widget).
- Dùng `cap:butt` cho cung tròn/gauge: `round` làm nét tràn quá góc bắt đầu.

Ví dụ (dấu check):

```tsx
<CustomPaint
  width={40}
  height={40}
  draw="stroke:#0f7b45 strokeWidth:4 cap:round M 8 20 L 17 29 L 32 12"
/>
```

Lưu ý: `A` (arc) **không** được hỗ trợ; hãy xấp xỉ bằng `Q`/`C`, hoặc vẽ nhiều
đoạn `L`. Cung tròn/gauge nên đặt `cap:butt` để nét không tràn quá điểm đầu.

---

### 10.26 `NavBar`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `title` | `string` | — |
| `subtitle` | `string` | — |
| `showBack` | `boolean` | `false` |
| `onBack` | `() => void` | — (chỉ vẽ nút khi có) |
| `safeArea` | `boolean` | `true` |
| `reserveRight` | `number` | `kQChatCapsuleWidth + 14`, clamp `0…240` |
| `transparent` | `boolean` | `false` |
| `blur` | `boolean` | `false` |
| `border` | `boolean` | `true` (bỏ qua khi `transparent`) |
| `children` | `VNodeChild` | Hàng phụ dưới thanh tiêu đề (search, tab, banner). |

```tsx
<NavBar
  title="Chi tiêu"
  subtitle="Tháng 10"
  showBack
  onBack={() => void navigateBack()}
>
  <TextField placeholder="Tìm giao dịch" />
</NavBar>
```

- Nút back chỉ xuất hiện khi `showBack` **và** có `onBack`.
- Nút back phát event `back` (không phải `press`).
- Vùng bên phải được chừa chỗ cho "capsule" nổi của QChat; đừng đặt nút ở đó.
- `transparent` cho phép nội dung chạy dưới header; `blur` làm mờ nền.

---

### 10.27 `TabBar`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `tabs` | `{ key, label, icon?, badge? }[]` | `[]` |
| `activeKey` | `string` | — |
| `activeIndex` | `number` | `0` nếu không khớp |
| `onChange` | `(event: QappTabEvent) => void` | — |
| `safeArea` | `boolean` | `true` |
| `hideOnKeyboard` | `boolean` | `true` |
| `style.height` | `number` | chiều cao chuẩn của QChat |

- Nếu có `activeKey` và tìm thấy, nó thắng `activeIndex`.
- Hàng tab cao 56 pt mặc định (trên vùng an toàn đáy): icon 25 pt bắt đầu cách
  hairline 9 pt, nhãn cách icon 4 pt. `style.height` đổi được.
- `tabs` ít hơn 2 phần tử được **đệm** cho đủ 2 (giới hạn của
  `CupertinoTabBar`); tab đệm không bao giờ phát `change`.
- `badge` là chuỗi, vẽ đè lên icon.
- Icon dùng bộ `QChatIcon`, không phải bộ TDesign.
- `hideOnKeyboard` giữ thanh dính đáy khi bàn phím mở; tắt nếu muốn thanh nổi
  lên trên bàn phím.

---

### 10.28 `Modal`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `visible` | `boolean` | `false` |
| `onClose` | `() => void` | — |
| `transparent` | `boolean` | `false` |
| `animationType` | `none`\|`fade`\|`slide` | `none` |

- `visible={false}` → không render gì.
- Barrier tap phát `close` **chỉ khi** có `onClose`; không có handler thì barrier
  không bắt tap.
- `transparent` chỉ đổi nền; nội dung vẫn do bạn vẽ.

---

### 10.29 `BottomSheet`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `visible` | `boolean` | `false` |
| `onClose` | `() => void` | — |
| `height` | `number` | theo nội dung (tối đa màn hình) |

- Luôn trượt lên từ đáy (kiểu `showCupertinoModalPopup`).
- Tự cộng safe-area đáy vào padding, vì overlay phủ tới mép vật lý.
- Nội dung cuộn được nếu dài.
- Barrier tap phát `close` khi có `onClose`.

---

### 10.30 `Dialog`

| Prop | Kiểu | Mặc định |
| --- | --- | --- |
| `visible` | `boolean` | `false` |
| `title` | `string` | — |
| `children` | `VNodeChild` | Nội dung |
| `confirmText` | `string` | — (không có nút nếu rỗng) |
| `cancelText` | `string` | — (không có nút nếu rỗng) |
| `onConfirm` | `() => void` | phát `confirm` |
| `onClose` | `() => void` | phát `close` |

- Có ít nhất một trong `confirmText`/`cancelText` mới có hàng nút.
- Barrier tap phát `close` khi có `onClose`.
- Animation: fade + scale từ 1.3 (kiểu `CupertinoDialogRoute`).
- Rộng tối đa 320, lề ngang 24.

---

## 11. Hệ style

`Style` là tập con hướng Flutter, không phải CSS. Số đo là **logical point**,
không có `px`, `rem`, `vw`, `calc`, `%` (trừ `width`/`height`).

### 11.1 Kích thước và khoảng cách

| Key | Kiểu | Ghi chú |
| --- | --- | --- |
| `width`, `height` | `number \| "50%"` | Chuỗi `%` tính theo cha. |
| `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | `number` | — |
| `padding`, `paddingHorizontal`, `paddingVertical`, `paddingTop/Right/Bottom/Left` | `number` | Khoá cụ thể thắng: `paddingTop` → `paddingVertical` → `padding`. Trên `ScrollView`/`ListView`/`GridView` đây là khoảng đệm **bên trong** vùng cuộn (§10.7). |
| `margin`, `marginHorizontal`, `marginVertical`, `marginTop/Right/Bottom/Left` | `number` | Cùng quy tắc thắng/thua như `padding`. |
| `gap`, `rowGap`, `columnGap` | `number` | Khoảng cách giữa con trong flex. |
| `aspectRatio` | `number` | Rộng/cao; `ScrollView grid` dùng làm tỉ lệ ô. |

### 11.2 Flex

| Key | Giá trị |
| --- | --- |
| `flex` | số; `1` = lấp phần còn lại |
| `flexGrow`, `flexShrink` | số |
| `flexBasis` | số hoặc `"50%"` |
| `flexDirection` | `row`, `column`, `row-reverse`, `column-reverse` |
| `flexWrap` | `nowrap`, `wrap` (alias `no-wrap`) |
| `alignItems` | `start`, `end`, `center`, `stretch`, `baseline` (alias `flex-start`, `flex-end`) |
| `justifyContent` | `start`, `end`, `center`, `spaceBetween`, `spaceAround`, `spaceEvenly` (alias có gạch nối) |
| `alignSelf` | `auto`, `start`, `end`, `center`, `stretch`, `baseline` |
| `alignContent` | như `justifyContent` |

### 11.3 Vị trí

| Key | Giá trị |
| --- | --- |
| `position` | `relative`, `absolute` |
| `top`, `right`, `bottom`, `left` | số |
| `zIndex` | số; chỉ có ý nghĩa trong `Stack` |
| `overflow` | `visible`, `hidden`, `clip` |
| `opacity` | `0…1` |
| `rotate` | độ |
| `scale` | hệ số |
| `translateX`, `translateY` | số |

### 11.4 Màu và viền

| Key | Kiểu |
| --- | --- |
| `backgroundColor`, `color`, `borderColor`, `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor` | chuỗi màu |
| `borderWidth`, `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth` | số |
| `borderRadius`, `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomLeftRadius`, `borderBottomRightRadius` | số |

Định dạng màu:

| Dạng | Ví dụ | Ghi chú |
| --- | --- | --- |
| Hex 3 | `#0f7` | Nở thành `#00ff77`. |
| Hex 6 | `#0f7b45` | Thêm alpha `ff`. |
| Hex 8 | `#800f7b45` | **AARRGGBB** (alpha đứng trước), không phải CSS RRGGBBAA. |
| `rgb()` / `rgba()` | `rgba(15,123,69,.5)` | Alpha `0…1`. |
| Tên | `transparent`, `none` | Trong suốt (không tô). |
| Tên cơ bản | `black`, `white`, `red`, `green`, `blue`, `grey`, `gray`, `orange`, `purple`, `yellow`, `pink` | Bảng cố định của host. |

Màu không hợp lệ → không tô (dùng mặc định của widget/theme).

### 11.5 Chữ

| Key | Giá trị |
| --- | --- |
| `fontSize` | số |
| `fontWeight` | `normal`, `bold`, `100`…`900` |
| `fontStyle` | `normal`, `italic` |
| `fontFamily` | chuỗi (chỉ font hệ thống; QChat không bundle font) |
| `lineHeight` | số, tính bằng logical point (ví dụ `21` với `fontSize: 15`); host chia cho `fontSize` để ra hệ số dòng. |
| `letterSpacing` | số |
| `textAlign` | `left`, `right`, `center`, `justify` (alias `start`, `end`) |
| `textDecoration` | `none`, `underline`, `lineThrough` (alias `line-through`) |
| `textTransform` | `none`, `uppercase`, `lowercase`, `capitalize` |
| `numberOfLines` | số |

### 11.6 Bóng và gradient

```ts
const card: Style = {
  backgroundColor: "#ffffff",
  borderRadius: 16,
  boxShadow: { color: "#14000000", offsetX: 0, offsetY: 4, blurRadius: 12 },
  gradient: {
    type: "linear",
    angle: 135,
    stops: [
      { offset: 0, color: "#0f7b45" },
      { offset: 1, color: "#0a5c33" },
    ],
  },
};
```

| Key | Kiểu |
| --- | --- |
| `boxShadow` | `{ color?, offsetX?, offsetY?, blurRadius?, spreadRadius? }` hoặc mảng |
| `shadow` | `boolean` (bóng mặc định của theme) |
| `elevation` | số |
| `gradient` | `{ type?: "linear", angle?, stops }` hoặc `{ type: "radial", stops }` |

`stops` là `{ offset: 0…1, color }`. Gradient không có `angle` mặc định chạy từ
trên xuống.

### 11.7 Alias enum

Ngoài giá trị chuẩn, host chấp nhận các alias CSS-like sau (chuẩn hoá ở một
chỗ duy nhất, `normalizeStyleEnum`):

| Key | Alias → chuẩn |
| --- | --- |
| `flexWrap` | `no-wrap` → `nowrap` |
| `alignItems` | `flex-start` → `start`, `flex-end` → `end` |
| `justifyContent` | `flex-start` → `start`, `flex-end` → `end`, `space-between` → `spaceBetween`, `space-around` → `spaceAround`, `space-evenly` → `spaceEvenly` |
| `alignSelf` | `flex-start` → `start`, `flex-end` → `end` |
| `textAlign` | `start` → `left`, `end` → `right` |
| `textDecoration` | `line-through` → `lineThrough` |
| `imageFit` | `cover-fill` → `cover` |
| `controlSize` | `small` → `sm`, `medium` → `md`, `large` → `lg` |
| `tagTone` | `default` → `neutral`, `error` → `danger` |
| `avatarShape` | `square` → `rounded` |

Các enum khác (component prop) **không** có alias: dùng đúng giá trị trong bảng.

---

## 12. Layout và các bẫy thường gặp

### 12.1 `flex: 1` không có cha xác định

`flex: 1` cần cha có kích thước xác định theo trục chính. Trong `Column` không
cao hạn, nó không có tác dụng. `Page` giải quyết việc này cho body; với màn hình
tự dựng, hãy đặt `style={{ flex: 1 }}` trên `ScrollView` và cho `View` gốc
`flex: 1`.

### 12.2 Scroller lồng nhau

- Hai scroller **cùng hướng** lồng nhau: scroller trong không cuộn được (host
  đổi nó thành nội dung tĩnh) — hãy để scroller ngoài lo việc cuộn.
- `ScrollView` trong `Row` không có chiều rộng để stretch; nó giữ kích thước tự
  nhiên của con.
- Đừng đặt `ListView` bên trong `ScrollView` cùng hướng; dùng một `ListView`
  duy nhất hoặc `ScrollView` + `map`.

### 12.3 Header đè nội dung

Triệu chứng: card đầu tiên nằm dưới header, chữ bị cắt. Nguyên nhân: body bắt
đầu ở y = 0 trong khi header vẽ đè. Dùng `Page`.

### 12.4 Scrim không phủ header

Triệu chứng: mở `Dialog`, header và `TabBar` vẫn sáng và bấm được. Nguyên nhân:
overlay đặt trong body. Đặt overlay ở `Page.overlays` (hoặc trong `Stack` bao
toàn bộ trang).

### 12.5 `height: "100%"` trong Column

`"100%"` tính theo cha; nếu cha không có chiều cao xác định, kết quả là 0. Ưu
tiên `flex: 1`.

### 12.6 Ảnh không có kích thước

`Image.network`/`Image.memory` cần `width`/`height` hoặc cha ràng buộc. Nếu
không, ảnh có thể nhảy layout khi tải xong. Đặt kích thước hoặc `aspectRatio`.

### 12.7 Bàn phím che nội dung

Host thu nhỏ Mini App khi bàn phím mở. `TabBar` có `hideOnKeyboard` mặc định
bật; nếu bạn tự vẽ footer, hãy kiểm tra trên thiết bị thật.

### 12.8 Danh sách dài

- Luôn dùng `ListView`/`GridView` thay vì `ScrollView` + `map` cho hàng trăm
  item.
- `initialCount` nhỏ (20–40) giúp frame đầu nhẹ; cửa sổ tự tăng khi cuộn.
- Giữ `key` ổn định trên item để state không nhảy khi dữ liệu đổi.

### 12.9 `Stack` không tự co giãn

`Stack` lấy kích thước của con lớn nhất. Muốn nó lấp cha, đặt `style={{ flex: 1 }}`
hoặc `width`/`height` cụ thể.

### 12.10 Overlay và `zIndex`

`zIndex` chỉ sắp xếp trong một `Stack`. Overlay (`Modal`, `Dialog`,
`BottomSheet`) nên nằm ở `Page.overlays`; nếu đặt trong một `Stack` con, barrier
chỉ phủ `Stack` đó.

### 12.11 `padding` trên scroller

Đặt `padding` lên chính `ScrollView`/`ListView`/`GridView` thay vì bọc một `View`
bên trong: padding của scroller là khoảng đệm **bên trong** vùng cuộn, nên
viewport vẫn phủ kín vùng được cấp và nội dung trượt sát mép.

```tsx
// Đúng: một lớp padding, viewport kín vùng giữa header và TabBar.
<ScrollView style={{ flex: 1, padding: 16, gap: 14 }}>{cards}</ScrollView>

// Thừa: cùng kết quả, nhưng phải giữ lề ở hai nơi và dễ cộng nhầm khi lồng
// scroller — dùng padding của chính scroller cho gọn.
<ScrollView style={{ flex: 1 }}>
  <View style={{ padding: 16, gap: 14 }}>{cards}</View>
</ScrollView>
```

Triệu chứng của runtime cũ (1.0.0): nội dung bị cắt đúng một padding ở sát
header, `TabBar` và mép phải, như có một lớp che. Từ runtime `1.1.0` padding chỉ
được áp một lần, bên trong; app cần chắc chắn khai `"minRuntimeVersion": "1.1.0"`
trong manifest.

---

## 13. Host API

Tất cả API trả `Promise` và ném `QChatError` với `code`/`message` khi lỗi.

```ts
import { QChatError } from "@mna/qchat";

try {
  await share({ text: "Xem nhé" });
} catch (error) {
  const code = error instanceof QChatError ? error.code : "UNKNOWN";
}
```

### 13.1 Bảng tổng hợp

| Hàm | Permission | Tham số | Kết quả |
| --- | --- | --- | --- |
| `getAppInfo()` | — | — | `AppInfo` |
| `getSystemInfo()` | — | — | `SystemInfo` |
| `getUserInfo()` | `user.profile` | — | `UserInfo` |
| `showToast(message, opts?)` | `toast` | `{ icon?: "success"\|"error"\|"none", duration?: number }` | `void` |
| `chooseImage(opts?)` | `media.choose` | `{ maxWidth?, maxHeight?, quality? }` | `ChosenImage` |
| `share(opts)` | `share` | `{ text?, url?, title? }` | `boolean` |
| `navigateTo(path)` | — | `path` | `void` |
| `navigateBack()` | — | — | `void` |
| `closeMiniApp()` | — | — | `void` |
| `openExternal(url)` | — | `url` | luôn `NOT_SUPPORTED` |
| `getStorage<T>(key)` | `storage` | `key` | `T \| null` |
| `setStorage(key, value)` | `storage` | `key`, giá trị JSON | `void` |
| `removeStorage(key)` | `storage` | `key` | `void` |
| `request<T>(path, opts?)` | `user.profile` / `qchat.api` (theo path) | xem §13.6 | `T` |
| `fetch<T>(url, opts?)` | `network` | xem §13.7 | `{ status, headers, data }` |
| `fetchJson<T>(url, opts?)` | `network` | như `fetch` | `data` |

### 13.2 Thông tin app và hệ thống

```ts
interface AppInfo {
  appId: string;
  name: string;
  version: string;
  runtimeVersion: string;
  minRuntimeVersion: string;
  permissions?: string[];
}

interface SystemInfo {
  platform: "android" | "ios" | "web" | "windows" | "linux" | "macos" | "test" | string;
  osVersion?: string;
  appVersion?: string;
  runtimeVersion?: string;
  locale?: string;
  theme?: "light" | "dark";
  screenWidth: number;
  screenHeight: number;
  pixelRatio?: number;
  safeAreaTop?: number;
  safeAreaBottom?: number;
}
```

`getAppInfo()` ở runtime còn trả `entry`, `format` (ngoài type) — đừng phụ thuộc
vào chúng trong type.

`getSystemInfo()` dùng để:

- chọn layout theo `screenWidth`;
- biết `theme` để đổi màu thủ công (nếu không dùng màu theme của host);
- canh theo `safeAreaTop`/`safeAreaBottom` khi tự vẽ chrome.

### 13.3 Người dùng

```ts
interface UserInfo {
  id: string;
  qchatId: string;
  nickname: string;
  avatarUrl?: string | null;
}
```

Hiện host trả `avatarUrl: null` (chưa nối ảnh đại diện); đừng phụ thuộc vào nó.

### 13.4 Toast

```ts
await showToast("Đã lưu", { icon: "success", duration: 1800 });
```

- `icon` mặc định `none`; `message` 1–200 ký tự.
- `duration` được SDK gửi nhưng host hiện bỏ qua và dùng thời lượng toast mặc
  định của QChat.
- Cần quyền `toast`.

### 13.5 Ảnh, chia sẻ

```ts
const image = await chooseImage({ maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
// image: { dataUrl, mimeType, width, height, size }

const shared = await share({
  title: "Ví Nhỏ",
  text: "Tháng này tôi tiết kiệm được 2 triệu",
  url: "https://qchat.vn/apps/vi-nho",
});
```

- `maxWidth` clamp `1…4096`, mặc định `1024`; `maxHeight` clamp `1…4096`, mặc
  định `4096`; `quality` clamp `0.1…1`, mặc định `0.85`.
- Ảnh > 5 MB bị từ chối (`INVALID_ARGUMENT`); người dùng đóng bộ chọn →
  `CANCELLED`.
- `chooseImage` có rate limit riêng: 5 lần / 10 giây.
- `chooseImage` mở bộ chọn ảnh WeChat của QChat (lưới 4 cột, chuyển album),
  không phải bộ chọn ảnh của hệ điều hành; ảnh được thu về đúng giới hạn
  `maxWidth`/`maxHeight` và `quality` trước khi trả `dataUrl`.
- `share` trả `true` nếu người dùng thực sự chia sẻ; `false` nếu huỷ.
- Giới hạn `share`: `text` ≤ 2000, `url` ≤ 2048, `title` ≤ 200 ký tự; phải có
  ít nhất `text` hoặc `url`, nếu không → `INVALID_ARGUMENT`.

### 13.6 `request` — QChat API

```ts
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignalLike;
}

const me = await request<UserInfo>("/users/me");
const friends = await request<Friend[]>("/friends", { query: { limit: 20 } });
```

- Chỉ 3 path: `/users/me`, `/friends`, `/conversations`. Path khác bị từ chối
  với `PERMISSION_DENIED`.
- Quyền theo path: `/users/me` và `/friends` cần `user.profile`;
  `/conversations` cần `qchat.api`. Khai báo đủ cả hai nếu app dùng cả hai nhóm.
- `body` được serialize JSON, tối đa **32 KB**.
- Response tối đa **1 MB**, quá → `RESPONSE_TOO_LARGE`.
- Timeout 20 giây → `TIMEOUT`.
- Redirect quá nhiều → `TOO_MANY_REDIRECTS`.
- `signal` chỉ huỷ phía JS; host vẫn có thể hoàn tất công việc.

### 13.7 `fetch` — HTTPS ra ngoài

```ts
const res = await fetch<Repo>("https://api.github.com/repos/mna/qchat", {
  headers: { Accept: "application/json" },
  timeoutMs: 8000,
});
console.log(res.status, res.data);
```

- Chỉ HTTPS. HTTP/other scheme → `INVALID_ARGUMENT`.
- URL ≤ 2048 ký tự, không có user info (`https://user:pass@…` bị từ chối).
- Không có allowlist host; mọi host HTTPS đều gọi được, nhưng vẫn bị kiểm tra
  URL, permission và kích thước.
- `body` là chuỗi, tối đa 32 KB.
- Response tối đa 1 MB.
- `timeoutMs` clamp `1000…15000`, mặc định `10000`; vượt → `TIMEOUT`.
- `fetchJson` là tiện ích trả thẳng `data`.

### 13.8 Storage

```ts
await setStorage("settings", { theme: "dark", budget: 5_000_000 });
const settings = await getStorage<{ theme: string }>("settings");
await removeStorage("settings");
```

```ts
const prefs = createStorage("prefs");
await prefs.set("currency", "VND");
const currency = await prefs.get<string>("currency");
```

| Giới hạn | Giá trị |
| --- | --- |
| Khoá | `^[A-Za-z0-9._-]{1,64}$` |
| Một value | 64 KB (JSON) |
| Toàn bộ namespace | 512 KB |
| Số key | 128 |
| Namespace | riêng cho từng app, không đọc chéo |

- Value được lưu dạng JSON; `undefined`, function, `Date`… sẽ mất kiểu (dùng
  chuỗi/số/object thuần).
- Vượt quota → `STORAGE_QUOTA_EXCEEDED`.
- `createStorage(ns)` chỉ thêm tiền tố đã làm sạch (tối đa 32 ký tự); **không**
  tạo namespace riêng ở tầng host.

### 13.9 Điều hướng

```ts
await navigateTo("/detail/42");
await navigateBack();
await closeMiniApp();
```

- Path khớp `^[A-Za-z0-9._~/-]{1,300}$`; không có `..`, không có `:`.
- Host giữ stack route của riêng nó: `navigateTo` đẩy vào stack, `navigateBack`
  lấy ra, rồi phát lifecycle `navigate`/`back` để app cập nhật UI.
- `navigateBack()` khi **không còn route nào để pop** (app chưa từng gọi
  `navigateTo`, hoặc đã về gốc) thì host đóng Mini App. Cử chỉ back của hệ thống
  đi qua đúng logic đó.
- Vì vậy đừng tự giữ route stack kiểu khác host: nếu app nghĩ còn route mà host
  đã cạn, cú back sẽ đóng app ngay.
- `closeMiniApp()` đóng ngay; dùng sau khi đã lưu dữ liệu.

### 13.10 Rate limit và timeout

| Giới hạn | Giá trị |
| --- | --- |
| Tổng số call | 60 / 10 giây |
| Mỗi method | 30 / 10 giây |
| `chooseImage` | 5 / 10 giây |
| Timeout `chooseImage` | 60 giây |
| Timeout `request`/`fetch` | 20 giây |
| Timeout method khác | 10 giây |
| Body request/fetch | 32 KB |
| Response | 1 MB |
| Ảnh chọn | 5 MB |

Vượt → `RATE_LIMITED` / `TIMEOUT`. Đừng gọi host API trong `onScroll` (chạy rất
nhiều lần); hãy debounce.

---

## 14. Môi trường JavaScript

QuickJS chỉ có ECMAScript thuần. Cài môi trường bằng một dòng:

```ts
import "@mna/qchat/env/auto";
```

Hoặc chọn từng phần:

```ts
import { installEnv } from "@mna/qchat/env";

installEnv({
  // xem InstallEnvOptions trong type
});
```

Những gì được cài:

| Nhóm | Cung cấp |
| --- | --- |
| Timers | `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `requestAnimationFrame`, `queueMicrotask` |
| Console | `console.log/info/warn/error/debug` → log về host |
| Clone | `structuredClone` |
| Encoding | `TextEncoder`, `TextDecoder` |
| URL | `URL`, `URLSearchParams` |
| Abort | `AbortController`, `AbortSignal` |
| Intl | `Intl` cho `vi-VN`/`en-US` (NumberFormat, DateTimeFormat, Collator, PluralRules, RelativeTimeFormat…) |

Ghi chú:

- Timer do host đánh thức; khi app ở background hoặc đang có gesture, tick có
  thể bị hoãn. **Không** dùng timer để đo thời gian chính xác.
- `Intl` là polyfill, không phải ICU đầy đủ; kiểm tra định dạng tiền tệ/ngày trên
  thiết bị thật.
- Không có `fetch` toàn cục, `localStorage`, `document`, `window`, `process`.
  Dùng `fetch` của SDK.
- Không có `import()` động; mọi thứ phải được bundle tĩnh.
- Stack 1 MiB: đệ quy sâu hoặc JSON quá lớn có thể làm runtime chết. Với dữ liệu
  lớn, xử lý theo trang.

---

## 15. Ảnh và asset

### 15.1 Nguồn ảnh hợp lệ

| `src` | Hành vi |
| --- | --- |
| `data:image/png;base64,…` | Giải mã trong bộ nhớ; sai định dạng → khung thay thế. |
| `assets/images/logo.png` | Đọc từ package qua host. |
| `https://…` | Tải qua mạng (cần mạng; không cần permission `network` cho ảnh). |
| Khác (`http:`, `file:`, đường dẫn tương đối) | Khung thay thế. |

### 15.2 Asset trong package

- Đặt dưới `assets/`; đường dẫn trong code là `assets/<đường-dẫn-tương-đối>`.
- Đuôi được nhận: `.png .jpg .jpeg .webp .gif .svg .ttf .otf .woff .woff2 .json
  .txt .mp3 .wav .mp4`.
- File khác bị bỏ kèm warning `Ignored unsupported asset`.
- Mỗi file ≤ 8 MB; tổng asset ≤ 12 MB.
- Symlink bị từ chối (`ASSET_SYMLINK`); đường dẫn không an toàn bị từ chối
  (`UNSAFE_ASSET_PATH`).
- Font được đóng gói nhưng **không** được đăng ký với renderer; đừng dựa vào
  `fontFamily` tuỳ chỉnh.

### 15.3 Ảnh từ API

`fetch` trả JSON, không trả binary. Muốn hiển thị ảnh từ API:

1. API trả URL HTTPS → dùng trực tiếp trong `src`.
2. API trả base64 → ghép `data:<mime>;base64,<…>`.
3. API trả ảnh binary → hiện chưa hỗ trợ; cần một endpoint trả URL/base64.

---

## 16. Đóng gói và giới hạn

### 16.1 Nội dung `.japp`

| File | Vai trò |
| --- | --- |
| `manifest.json` | Manifest đã chuẩn hoá, **không** có `source`, có `appSha256`. |
| `app.js` | Bundle IIFE đã minify, ES2020. |
| `metadata.json` | `formatVersion`, `compilerVersion`, `sdkVersion`, `version`, `builtAt`, `appSha256`, danh sách file + sha256 + size. |
| `permissions.json` | `{ requestedPermissions }`. |
| `assets/**` | Asset đã copy. |

### 16.2 Giới hạn

| Giới hạn | Giá trị | Lỗi |
| --- | --- | --- |
| Toàn package | 20 MB | `PACKAGE_TOO_LARGE` |
| Tổng kích thước sau giải nén | 80 MB | `PACKAGE_EXPANDED_TOO_LARGE` |
| `app.js` | 4 MB | `APP_JS_TOO_LARGE` (build) / `ENTRY_TOO_LARGE` (validate) |
| Một asset | 8 MB | `ASSET_TOO_LARGE` |
| Tổng asset | 12 MB | `ASSETS_TOO_LARGE` |
| Package rỗng | — | `PACKAGE_EMPTY` |
| Thiếu `manifest.json` | — | `MANIFEST_MISSING` |
| Thiếu `app.js` | — | `ENTRY_MISSING` |
| `app.js` rỗng / chứa `<html` | — | `ENTRY_EMPTY` / `ENTRY_INVALID` |
| `source` còn trong package | — | `MANIFEST_SOURCE_LEAK` |
| Version không khớp | — | `VERSION_MISMATCH` |
| Hash `app.js` lệch metadata/manifest | — | `APP_CHECKSUM_MISMATCH` |
| `permissions.json` khác manifest | — | `PERMISSIONS_MISMATCH` |
| File lạ ngoài 4 file chuẩn + `assets/` | — | `UNEXPECTED_FILE` |

`validate` kiểm tra: manifest hợp lệ và không còn `source`; `app.js` tồn tại,
không rỗng, ≤ 4 MB, không chứa `<html`; `sha256(app.js)` khớp `metadata.json`
và `manifest.appSha256`; `version` trong metadata khớp manifest;
`permissions.json` khớp `requestedPermissions`; mọi file còn lại nằm dưới
`assets/` với đuôi được phép. Nó **không** đối chiếu hash của từng asset, nên
đừng sửa tay asset sau khi build.

### 16.3 Tính tất định

- `now` (thời điểm build) mặc định là hiện tại; metadata chứa `builtAt` nên hai
  lần build khác giờ sẽ khác hash package (nhưng `appSha256` chỉ phụ thuộc code).
- `app.js` được minify mặc định; `--no-typecheck` không đổi output.
- Bundle cảnh báo nếu chứa `require(` — runtime không có `require`.

### 16.4 Cập nhật app

- Tăng `version` trong `manifest.json` mỗi lần phát hành.
- Upload `.japp` lên Developer Center; server cấp `appId` và phát hành.
- `minRuntimeVersion` cao hơn runtime của máy → app không chạy
  (`RUNTIME_TOO_OLD`).
- Runtime `1.1.0`: `padding` trên `ScrollView`/`ListView`/`GridView` là khoảng đệm
  bên trong vùng cuộn (§10.7, §12.11). App dựa vào bố cục đã sửa nên khai
  `"minRuntimeVersion": "1.1.0"`; app cũ để `1.0.0` vẫn chạy trên host cũ.

---

## 17. Kiểm thử

### 17.1 `qchat test`

```powershell
npx qchat test
```

Nó:

1. Build project (typecheck mặc định) vào `dist/qchat-test.japp`.
2. Chạy bundle trong QuickJS với host giả lập.
3. `timers.advance(0)` để chạy `requestAnimationFrame`/microtask.
4. In log của app.
5. Kiểm tra: có cây render không; có ít nhất một `Button`/`Pressable` không.
6. Bấm nút đầu tiên, chụp lại cây và in text.

Điều kiện fail (`TEST_FAILED`):

- Không có cây render (`start` không chạy, component ném lỗi ngay).
- Không có `Button`/`Pressable` nào.

Text không đổi sau khi bấm **không** làm fail; nó chỉ in ghi chú. Vì vậy hãy tự
kiểm tra thêm bằng mắt/log.

### 17.2 Host giả lập trong harness

Harness nội bộ của SDK (dùng bởi CLI và test của framework) có:

| Thành phần | Ý nghĩa |
| --- | --- |
| `latest()` | Frame mới nhất. |
| `renders` | Tất cả frame đã gửi. |
| `calls` | Các lệnh host đã gọi (`{ method, params }`). |
| `logs` | Log console/error. |
| `timers.now()`, `advance(ms)`, `pending()`, `nextDelay()` | Đồng hồ ảo. |
| `dispatch(id, event, payload)` | Bắn sự kiện. |

Mặc định host giả lập trả `getAppInfo`/`getSystemInfo` và `NOT_SUPPORTED` cho
mọi method khác; truyền `responses` để giả lập API riêng khi viết test trong
repo framework.

### 17.3 Test trong repo framework

```powershell
cd packages/miniapp-framework
corepack pnpm test        # tsx --test test/*.test.ts
corepack pnpm typecheck
```

Test chạy bundle thật trong QuickJS, nên nó bắt được lỗi protocol/validator mà
type-check không thấy.

### 17.4 Kiểm thử thủ công trên thiết bị

- Cài app qua Developer Center (hoặc chế độ dev của Studio).
- Kiểm tra: mở app, mở bàn phím, xoay/đổi kích thước, mở dialog, cuộn tab này
  rồi quay lại tab kia, back về gốc, kill app rồi mở lại.
- Xem log runtime trong màn hình lỗi; log `console.error` được chuyển về host.

---

## 18. Công thức mẫu

### 18.1 App shell: TabBar + route stack

```tsx
import "@mna/qchat/env/auto";
import {
  start,
  useLifecycle,
  useState,
} from "@mna/qchat";
import {
  Button,
  NavBar,
  Page,
  ScrollView,
  TabBar,
  Text,
  View,
} from "@mna/qchat/ui";
import { navigateBack, navigateTo } from "@mna/qchat";

const TABS = [
  { key: "home", label: "Trang chủ", icon: "chats" },
  { key: "stats", label: "Thống kê", icon: "grid" },
  { key: "me", label: "Tôi", icon: "me" },
];

function App() {
  const [tab, setTab] = useState("home");
  const [routes, setRoutes] = useState<string[]>([]);
  const route = routes[routes.length - 1] ?? null;

  useLifecycle((event, payload) => {
    if (event !== "navigate" && event !== "back") return;
    const path = (payload as { path?: string | null } | undefined)?.path ?? null;
    setRoutes((current) => {
      if (path == null) return [];
      if (current[current.length - 1] === path) return current;
      if (current[current.length - 2] === path) return current.slice(0, -1);
      return [...current, path];
    });
  });

  if (route) {
    return (
      <Page
        header={
          <NavBar
            title="Chi tiết"
            showBack
            onBack={() => void navigateBack()}
          />
        }
      >
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Text>Route: {route}</Text>
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page
      header={<NavBar title="Ví Nhỏ" />}
      footer={
        <TabBar
          tabs={TABS}
          activeKey={tab}
          onChange={(event) => setTab(event.key)}
        />
      }
    >
      {tab === "home" ? (
        <ScrollView style={{ flex: 1, padding: 16, gap: 12 }}>
          <Button onPress={() => void navigateTo("/txn/new")}>
            Thêm giao dịch
          </Button>
        </ScrollView>
      ) : tab === "stats" ? (
        <View style={{ flex: 1, padding: 16 }}>
          <Text>Thống kê</Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <Text>Tôi</Text>
        </View>
      )}
    </Page>
  );
}

start(App);
```

### 18.2 Form có kiểm tra

```tsx
function AddTxn({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    const value = Number(amount);
    if (title.trim().length === 0) return setError("Nhập tên giao dịch");
    if (!Number.isFinite(value) || value <= 0) return setError("Số tiền không hợp lệ");
    setError("");
    void setStorage(`txn.${Date.now()}`, { title, amount: value }).then(onDone);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <TextField
        value={title}
        placeholder="Tên giao dịch"
        maxLength={80}
        onInput={setTitle}
      />
      <TextField
        value={amount}
        placeholder="Số tiền"
        keyboardType="number"
        onInput={setAmount}
      />
      {error ? <Text style={{ color: "#d93025" }}>{error}</Text> : null}
      <Button onPress={save}>Lưu</Button>
    </View>
  );
}
```

### 18.3 Danh sách + tải thêm

```tsx
function TxnList() {
  const [items, setItems] = useState<Txn[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void load(0);
  }, []);

  async function load(next: number) {
    if (loading || done) return;
    setLoading(true);
    try {
      const batch = await fetchJson<Txn[]>(
        `https://api.example.com/txns?page=${next}`,
      );
      setItems((current) => [...current, ...batch]);
      setPage(next);
      if (batch.length === 0) setDone(true);
    } catch {
      void showToast("Không tải được", { icon: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ListView
      data={items}
      initialCount={30}
      empty={<Text>Chưa có dữ liệu</Text>}
      renderItem={(item) => (
        <Row key={item.id} style={{ padding: 16 }}>
          <Text style={{ flex: 1 }}>{item.title}</Text>
          <Text>{item.amount}</Text>
        </Row>
      )}
      onEndReached={() => void load(page + 1)}
    />
  );
}
```

### 18.4 Chọn ảnh + chia sẻ

```tsx
async function pickAndShare() {
  try {
    const image = await chooseImage({ maxWidth: 1200, quality: 0.85 });
    const ok = await share({
      title: "Ảnh mới",
      text: "Tôi vừa chụp",
      url: image.dataUrl,
    });
    if (!ok) void showToast("Đã huỷ chia sẻ");
  } catch (error) {
    const code = error instanceof QChatError ? error.code : "UNKNOWN";
    if (code !== "CANCELLED") {
      void showToast("Không chọn được ảnh", { icon: "error" });
    }
  }
}
```

Lưu ý: chia sẻ `dataUrl` dài có thể vượt giới hạn của host share; ưu tiên URL
HTTPS nếu có.

### 18.5 Dialog xác nhận

```tsx
const [confirming, setConfirming] = useState(false);

<>
  <Button variant="danger" onPress={() => setConfirming(true)}>
    Xoá
  </Button>

  <Dialog
    visible={confirming}
    title="Xoá giao dịch?"
    confirmText="Xoá"
    cancelText="Huỷ"
    onClose={() => setConfirming(false)}
    onConfirm={() => {
      setConfirming(false);
      void remove();
    }}
  />
</>
```

Đặt `Dialog` trong `Page.overlays` để scrim phủ cả header/TabBar.

### 18.6 BottomSheet chọn nhanh

```tsx
const [open, setOpen] = useState(false);

<Button onPress={() => setOpen(true)}>Chọn danh mục</Button>

<BottomSheet visible={open} onClose={() => setOpen(false)}>
  {categories.map((category) => (
    <Pressable
      key={category.id}
      onPress={() => {
        setCategory(category.id);
        setOpen(false);
      }}
      style={{ paddingVertical: 14 }}
    >
      <Text>{category.name}</Text>
    </Pressable>
  ))}
</BottomSheet>
```

### 18.7 Theme-aware màu

Host không tự đổi màu `style` khi dark mode. Lấy `theme` từ
`getSystemInfo()` và chọn bảng màu:

```tsx
const [theme, setTheme] = useState<"light" | "dark">("light");

useEffect(() => {
  void getSystemInfo().then((info) => {
    if (info.theme === "dark") setTheme("dark");
  });
}, []);

const colors =
  theme === "dark"
    ? { bg: "#111315", ink: "#f2f3f5", muted: "#9aa0a6" }
    : { bg: "#ffffff", ink: "#191919", muted: "#8a8a8a" };
```

---

## 19. Lỗi và cách xử lý

### 19.1 Mã lỗi host

| Mã | Nghĩa | Cách xử lý |
| --- | --- | --- |
| `PERMISSION_DENIED` | Chưa khai báo hoặc người dùng từ chối | Khai báo manifest; hiện thông báo, đừng thử lại liên tục. |
| `INVALID_ARGUMENT` | Tham số sai (path, key, URL, kiểu) | Kiểm tra lại input trước khi gọi. |
| `NOT_SUPPORTED` | Method/đường đi không hỗ trợ | `openExternal`, path API lạ. |
| `RATE_LIMITED` | Quá 60 call/10 s hoặc 30/method | Debounce, gộp call. |
| `TIMEOUT` | Host quá hạn (60/20/10 s) | Thử lại có giới hạn; hiện trạng thái. |
| `HOST_CLOSED` | App đã đóng | Không retry. |
| `HOST_ERROR` | Lỗi không xác định phía host | Log + thông báo chung. |
| `STORAGE_QUOTA_EXCEEDED` | Vượt 64 KB/value, 512 KB, 128 key | Dọn key cũ; lưu ít hơn. |
| `RESPONSE_TOO_LARGE` | Response > 1 MB | Thu hẹp query/pagination. |
| `TOO_MANY_REDIRECTS` | Redirect loop | Sửa URL/endpoint. |
| `CANCELLED` | Người dùng huỷ (chọn ảnh, share) | Không coi là lỗi. |
| `BRIDGE_UNAVAILABLE` | Chạy ngoài host QChat | Chỉ xảy ra khi test sai môi trường. |

### 19.2 Mã lỗi runtime/renderer

| Mã | Nghĩa |
| --- | --- |
| `UNSUPPORTED_COMPONENT` | JSX dùng thẻ không có trong contract. |
| `HOOK_OUTSIDE_COMPONENT` | Gọi hook ngoài thân component. |
| `TREE_INVALID` | Frame không đúng shape (node không phải object, thiếu field). |
| `TREE_TOO_DEEP` | Sâu > 64. |
| `TREE_TOO_LARGE` | > 4000 node hoặc > 8M ký tự. |
| `RUNTIME_ERROR` | Exception không bắt trong JS. |
| `RUNTIME_DISPOSED` | Gọi sau khi runtime đã đóng. |
| `RUNTIME_TOO_OLD` | `minRuntimeVersion` cao hơn runtime máy. |
| `RUNTIME_UNAVAILABLE` | Thiếu QuickJS backend. |
| `APP_CLOSED` | App đã đóng khi đang chạy. |
| `APP_SUSPENDED` | App bị treo bởi host. |
| `NETWORK_ERROR` / `CONNECTION_ERROR` | Lỗi mạng khi tải package. |
| `UNSUPPORTED_FORMAT` | Package không phải qapp hợp lệ. |
| `CHECKSUM_MISMATCH` / `CACHE_CHECKSUM_MISMATCH` | File tải về hỏng. |
| `VERSION_REVOKED` | Bản phát hành bị thu hồi. |
| `NOT_PUBLISHED` | App chưa được phát hành. |

### 19.3 Triệu chứng thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách sửa |
| --- | --- | --- |
| Màn hình trắng, log `UNSUPPORTED_COMPONENT` | Dùng thẻ không có trong contract (ví dụ `div`) | Dùng `View`/`Text`… |
| App không cập nhật khi bấm | Handler không được map (tên prop sai) | Dùng đúng `onPress`, `onChange`… |
| Text không hiện | `Text` lồng trong `Text` không phải `RichText` | Dùng `RichText` cho text trộn. |
| Scroll mất vị trí khi đổi tab | Tự dựng layout không qua `Page`/screen | Dùng `Page`, giữ cây màn hình ổn định. |
| Dialog không phủ header | Overlay nằm trong body | Đặt trong `Page.overlays`. |
| Nội dung nằm dưới header | Body bắt đầu y = 0 | Dùng `Page`. |
| Nút bấm không ăn | `pointerEvents="none"` ở cha | Bỏ `none`. |
| Ảnh trắng | `src` sai scheme hoặc asset sai đường dẫn | Dùng `assets/…` hoặc `https://`. |
| Bàn phím che nút | Footer tự vẽ, không xử lý keyboard | Dùng `TabBar`/`hideOnKeyboard`. |
| `TREE_TOO_LARGE` | Render quá nhiều node | `ListView`, giảm `initialCount`, chia màn hình. |
| `RATE_LIMITED` | Gọi API trong `onScroll`/`onInput` | Debounce, gọi ở `onEndReached`. |
| Build lỗi `TYPECHECK_FAILED` | Thiếu type/`lib` sai | Đọc output tsc; giữ `lib: ["ES2020"]`. |
| Build lỗi `APP_JS_TOO_LARGE` | Bundle > 4 MB | Bỏ dependency nặng, tránh import cả thư viện. |
| Build lỗi `ASSETS_TOO_LARGE` | Tổng asset > 12 MB | Nén ảnh, bỏ file thừa. |

---

## 20. Checklist trước khi upload

- [ ] `npx qchat build` sạch, không warning về `require(`/asset bị bỏ.
- [ ] `npx qchat validate dist/*.japp` in đúng tên, version, permission.
- [ ] `npx qchat test` pass.
- [ ] Manifest: `name` ≤ 60, `version` semver, `requestedPermissions` đúng và
      tối thiểu.
- [ ] Không có `appId` trong `manifest.json`.
- [ ] `.japp` ≤ 20 MB, `app.js` ≤ 4 MB, asset mỗi file ≤ 8 MB và tổng ≤ 12 MB.
- [ ] Mọi màn hình dùng `Page`; overlay ở `Page.overlays`.
- [ ] Danh sách dài dùng `ListView`/`GridView`, có `initialCount` hợp lý.
- [ ] Không có `http://`, không có `openExternal` như một tính năng.
- [ ] State quan trọng được lưu bằng `setStorage` ngay khi thay đổi.
- [ ] Kiểm tra dark mode, bàn phím, safe area, tab qua lại, back về gốc.
- [ ] Không hard-code màu chỉ hợp với nền sáng; dùng `getSystemInfo().theme`.
- [ ] Không dùng `ref` để đo/scroll (chưa hỗ trợ).
- [ ] Không dùng `keyExtractor` như thể host dùng nó; giữ thứ tự item ổn định.
- [ ] Đã thử trên thiết bị thật, không chỉ trên Studio.

---

## Phụ lục A — Bảng nhanh component

| Nhóm | Component | Vẽ bằng |
| --- | --- | --- |
| Layout | `View`, `Row`, `Column`, `Page`, `Stack`, `Positioned`, `Spacer`, `SafeArea` | Flutter widgets/QChat |
| Cuộn | `ScrollView`, `ListView`, `GridView` | Flutter/Cupertino physics |
| Chữ | `Text`, `RichText`, `Link` | QChat/Flutter |
| Media | `Image`, `Avatar`, `Icon` | QChat + TDesign glyph |
| Nhập liệu | `TextField`, `Checkbox`, `Switch`, `Slider` | TDesign |
| Hiển thị | `Button`, `Pressable`, `Badge`, `Tag`, `ActivityIndicator`, `Divider` | TDesign (trừ `Pressable`, `Avatar`) |
| Trang trí | `AnimatedView`, `CustomPaint` | Flutter |
| Chrome | `NavBar`, `TabBar` | QChat/Cupertino |
| Overlay | `Modal`, `BottomSheet`, `Dialog` | QChat + Cupertino motion |

## Phụ lục B — Những thứ **không** có

Đừng thiết kế quanh các API này; chúng không tồn tại trong runtime hiện tại:

- DOM, HTML, CSS, `className`, `style` dạng chuỗi CSS.
- `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`.
- `require`, `import()` động, `process`, `Buffer`, `fs`.
- `fetch` toàn cục, WebSocket, `XMLHttpRequest`.
- Clipboard, haptic feedback, mở app ngoài, deep link ra ngoài.
- `ref` để đo layout/scroll, `measure`, `onLayout`.
- Animation theo `Animated.Value`; chỉ có `AnimatedView` một lần khi mount.
- Font tuỳ chỉnh, icon ngoài bảng §10.16.
- Chạy nền, push notification, đa cửa sổ.
- Truy cập QChat API ngoài 3 path của `request`.
- `keyExtractor` có hiệu lực, `FlatList`/`SectionList`, `RefreshControl`
  (event `refresh` có tên nhưng không component nào phát).

## Phụ lục C — Đối chiếu nhanh prop → event

```ts
const PROP_EVENT_MAP = {
  onPress: "press",
  onClose: "close",
  onConfirm: "confirm",
  onBack: "back",
  onLongPress: "longPress",
  onChange: "change",
  onCheckedChange: "change",
  onInput: "input",
  onSubmit: "submit",
  onValueChange: "valueChange",
  onValueChangeEnd: "valueChange",
  onScroll: "scroll",
  onRefresh: "refresh",
  onFocus: "focus",
  onBlur: "blur",
  onSelect: "select",
  onEndReached: "endReached",
};
```

Chỉ những tên này mới trở thành event. Mọi function prop khác bị bỏ im lặng —
đây là lỗi phổ biến nhất khi handler "không chạy".

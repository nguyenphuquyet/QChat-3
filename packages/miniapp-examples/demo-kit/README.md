# Demo Kit — template Mini App qapp

Mini App mẫu để **thử mọi chức năng** của runtime qapp: một `NavBar` do app tự vẽ,
`TabBar` 5 tab, một route nội bộ (`/detail/...`) và gần như toàn bộ thành phần,
style key cùng host API mà SDK hỗ trợ.

Đây là điểm bắt đầu tốt khi làm app mới: copy thư mục này, đổi `name` trong
`manifest.json`, xoá những phần không dùng.

## Chạy và đóng gói

```sh
corepack pnpm --filter @mna/qchat build                # build SDK + CLI một lần
corepack pnpm qapp dev   --dir packages/miniapp-examples/demo-kit
corepack pnpm qapp test  --dir packages/miniapp-examples/demo-kit
corepack pnpm qapp build --dir packages/miniapp-examples/demo-kit
corepack pnpm qapp validate packages/miniapp-examples/demo-kit/dist/demo-kit-1.0.0.japp
corepack pnpm qapp inspect  packages/miniapp-examples/demo-kit/dist/demo-kit-1.0.0.japp
```

`qapp build` chạy `tsc --noEmit`, bundle TSX bằng esbuild cho QuickJS, băm từng
tệp và ghi `dist/demo-kit-1.0.0.japp`. Bản build chỉ chứa `manifest.json`,
`app.js`, `metadata.json`, `permissions.json` và `assets/`.

Để chạy thật: tạo app trong Developer Center, tải `.japp` lên, submit review rồi
release, sau đó mở trên app QChat. Không khai báo `appId` trong `manifest.json`
— server tự gán.

## Cấu trúc

```
manifest.json          schemaVersion 2, quyền và networkDomains
tsconfig.json          lib ES2020, jsxImportSource @mna/qchat
assets/logo.png        ảnh đóng gói kèm, có hash trong metadata.json
src/main.tsx           khung app: NavBar + TabBar + điều hướng theo lifecycle
src/theme.ts           bảng màu, bán kính, style dùng chung
src/store.ts           log dùng chung (module scope + subscription) và runCall()
src/components.tsx     ScreenShell, Card, Section, StatTile, Chip, LogList…
src/screens/overview.tsx   tab 1
src/screens/ui-kit.tsx     tab 2
src/screens/form.tsx       tab 3
src/screens/host-api.tsx   tab 4
src/screens/debug.tsx      tab 5
src/screens/detail.tsx     route nội bộ được host push
```

`src/main.tsx` bắt đầu bằng `import "@mna/qchat/env/auto"`, tức là bật
`console`, timer, `structuredClone`, `URL`, `TextEncoder`, `AbortController` và
`Intl` (vi-VN/en-US) cho QuickJS. Bỏ dòng đó thì bundle nhẹ hơn nhưng phải tự
`installEnv()` phần cần dùng.

## 5 tab kiểm tra những gì

| Tab | Nội dung |
| --- | --- |
| Tổng quan | `getAppInfo`/`getSystemInfo`, đồng hồ `setInterval`, `Dialog`, `BottomSheet`, `Modal`, `showToast`, `AnimatedView`, `CustomPaint`, `Switch`, bộ đếm lưu bằng `setStorage`/`getStorage`/`removeStorage`, `setTimeout` 900ms, `Button loading` |
| UI Kit | mọi thành phần: chữ và kiểu chữ, 4 biến thể `Button`, `Pressable` (press/longPress), `Checkbox`, `Switch`, `Slider`, `ActivityIndicator`, flex/`gap`/`flexWrap`, `Stack` + `Positioned`, `Spacer`, `Divider`, `aspectRatio`, gradient, `opacity`, `rotate`, `scale`, viền từng cạnh, `overflow`, `CustomPaint`, `Image` (asset, data URL, ảnh thiếu), 20 `Icon`, `ListView` cửa sổ, `ScrollView` ngang có `onScroll`, `GridView`, `TextField`, `SafeArea` |
| Form | `keyboardType` text/email/phone/number/url, `secureTextEntry`, `multiline`, `maxLength`, `editable={false}`, `onFocus`/`onBlur`/`onSubmit`, validate bằng `useMemo`, submit giả lập 1000ms rồi mở `Dialog`, ghi log mọi sự kiện |
| API | `getAppInfo`, `getSystemInfo`, `getUserInfo`, `request('/users/me' \| '/friends' \| '/conversations')`, `chooseImage` (xem lại ảnh bằng `Image`), `share`, `showToast` ba icon, storage ghi/đọc/xoá, `fetchJson` tới host trong allowlist và một host bị chặn, `navigateTo`, `openExternal`, `closeMiniApp` có xác nhận |
| Debug | log dùng chung (lọc theo mức, giới hạn 200 dòng), `setInterval` tự dừng sau 5 tick, `setTimeout`, `console.log` ra kênh log của host, `Intl.NumberFormat`/`DateTimeFormat`, sự kiện `resume`/`pause`/`navigate`/`back`, và một handler cố ý ném lỗi để thấy runtime bắt lỗi mà app vẫn chạy |

Route nội bộ: `navigateTo("/detail/42")` push một route, host phát sự kiện
`navigate` kèm `path`/`depth`; `navigateBack()` (nút back của host, nút trên
`NavBar` hoặc nút trong trang) pop route và phát `back`. App chỉ đọc `path` để
quyết định vẽ màn hình nào.

## Quyền đã khai báo

`toast`, `storage`, `user.profile`, `media.choose`, `share`, `qchat.api`,
`network` với `networkDomains: ["api.github.com"]`.

Khai báo là chưa đủ: host hỏi người dùng ở lần gọi đầu tiên và kiểm tra lại quyền
trên từng lời gọi. `network` bắt buộc đi cùng `networkDomains`; request chỉ được
HTTPS, chỉ tới host trong danh sách, tối đa 1 MB và **không** kèm token QChat.

## Lưu ý khi sửa

- Chỉ dùng style key và enum có trong `packages/contracts/miniapp-ui.contract.json`;
  một key lạ làm cả frame bị từ chối chứ không bị bỏ qua. Xem
  `docs/miniapp-ui-reference.md` để tra nhanh.
- Không có DOM, không có `fetch` của trình duyệt, không có `require`. Mọi thứ ra
  ngoài phải đi qua host API.
- `Modal`/`BottomSheet`/`Dialog` cần một `Stack` có kích thước xác định để lớp
  phủ `Positioned.fill` phủ hết màn hình — đó là lý do `ScreenShell` đặt
  `ScrollView` (`height: "100%"`) và phần overlay trong cùng một `Stack`.
- Mọi `setState` trong một sự kiện của host gộp thành một frame duy nhất, nên
  vòng lặp bắn 5 log ở tab Debug chỉ gây một lần render.

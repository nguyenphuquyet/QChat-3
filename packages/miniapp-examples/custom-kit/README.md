# Custom Kit — Mini App tự vẽ toàn bộ giao diện

Mini App mẫu thứ hai, đối lập với `demo-kit`: **không dùng thành phần giao diện
nào của host**. Không `NavBar`, không `TabBar`, không `Button`, `Switch`,
`Checkbox`, `Slider`, `Dialog`, `Icon`… Toàn bộ màn hình chỉ ghép từ tám
primitive:

`View` · `Text` · `Pressable` · `ScrollView` · `Stack` · `Positioned` ·
`SafeArea` · `CustomPaint`

Nhờ vậy nó trả lời câu hỏi "một Mini App trông khác QChat được đến đâu?" mà
không cần thêm quyền hay API lạ.

## Chạy và đóng gói

```sh
corepack pnpm --filter @mna/qchat build                # build SDK + CLI một lần
corepack pnpm qapp dev   --dir packages/miniapp-examples/custom-kit
corepack pnpm qapp test  --dir packages/miniapp-examples/custom-kit
corepack pnpm qapp build --dir packages/miniapp-examples/custom-kit
corepack pnpm qapp validate packages/miniapp-examples/custom-kit/dist/custom-kit-1.0.0.japp
```

`qapp build` chạy `tsc --noEmit`, bundle TSX cho QuickJS rồi ghi
`dist/custom-kit-1.0.0.japp`. Bản build chỉ có `manifest.json`, `app.js`,
`metadata.json`, `permissions.json` (không có `assets/` vì app không dùng ảnh).

## Cấu trúc

```
manifest.json              schemaVersion 2, chỉ xin toast + storage
tsconfig.json              lib ES2020, jsxImportSource @mna/qchat
src/theme.ts               bảng màu Aurora, accent, mix màu, gradient, token chữ
src/draw.ts                sinh chuỗi path: đường cong, vùng tô, cung tròn, sao
src/icons.tsx              24 glyph 24×24, mỗi glyph là path + component Glyph
src/components.tsx         Screen, Card, Ring, Sparkline, BarChart, Toggle,
                           Check, Radio, Chip, Stars, Stepper, Sheet, Toast…
src/screens/home.tsx       tab Home
src/screens/stats.tsx      tab Stats
src/screens/kit.tsx        tab Kit — gallery thành phần
src/screens/settings.tsx   tab You — accent, tuỳ chọn, reset
src/main.tsx               khung app: header tự vẽ, tab bar tự vẽ, sheet, toast
```

## Bốn tab

| Tab | Nội dung |
| --- | --- |
| Home | Hero gradient + sparkline `CustomPaint`, hai ô số liệu, ring mục tiêu có stepper, danh sách hoạt động, nút check-in tự vẽ |
| Stats | Segmented control tự vẽ, bar chart đổi theo Week/Month/Year, ring hiệu suất, chấm sao, các thanh tiến trình, stepper mục tiêu ngày |
| Kit | Gallery: 3 kiểu nút, toggle, checkbox, radio, chip, progress, ring + stepper, sao, avatar, 4 accent, 24 glyph |
| You | Hồ sơ, đổi accent (lưu bằng `setStorage`), 3 công tắc có tác dụng thật, mở sheet, gọi `showToast` của host, reset |

Ba công tắc ở tab You đều thay đổi giao diện thật: chuông ở header có/không có
chấm đỏ, bật/tắt animation của sheet và toast, và mật độ danh sách ở Home.

## Những chỗ đáng xem

- **Không có icon font.** `src/icons.tsx` giữ hình học của 24 icon dưới dạng
  chuỗi path trên lưới 24×24; `Glyph` scale path theo `size` và vẽ bằng
  `CustomPaint`. Icon nhiều nét là nhiều `CustomPaint` xếp trong một `Stack`.
- **Path language của host rất nhỏ**: chỉ `M L Q C Z` tuyệt đối, cộng tiền tố
  `fill:`, `stroke:`, `strokeWidth:` và `cap:`. Không có cung `A`. Vì vậy
  `draw.ts` tự tính cung tròn (chia mỗi 90° thành một cubic) và đường cong
  Catmull-Rom cho sparkline.
- **Cung tròn phải dùng `cap:butt`.** Mặc định của painter là `round`, và nét
  tròn phình ra nửa bề dày nét ở mỗi đầu: vòng gauge vẽ kiểu đó sẽ đè lên track
  xám ở 12 giờ và tạo một bậc, còn chấm ở đầu cung thì lệch nửa nét. `cap:butt`
  cắt đúng góc, chấm đặt đúng cuối cung.
- **Một `M` mới sẽ đóng subpath trước đó.** Hình hở phải nằm trong
  `CustomPaint` riêng; hình kín (chữ nhật, sao, vòng tròn) có thể gộp nhiều
  subpath trong một path.
- **Màu 8 chữ số là `#aarrggbb`** (alpha đứng trước, không như CSS), nên
  `tint(hex, alpha)` trong `theme.ts` sinh alpha trước.
- **Sheet và toast là overlay tự viết.** `Sheet` dùng `Positioned` phủ toàn
  màn hình, một `Pressable` `flex: 1` để bắt cú chạm ra ngoài, panel nằm dưới.
  Không có `Dialog`, `BottomSheet` hay `Modal`.
- **`flex: 1` chỉ có tác dụng khi node là con trực tiếp của một flex.** Bên
  trong `Pressable`, các con được xếp trong một `Column` không chia flex, nên
  chỗ nào cần giãn thì đặt `flex` lên chính `Pressable`.
- **`Pressable` nằm trong một `Row` sẽ co lại bằng nội dung.** Nó chỉ giãn hết
  bề ngang khi được đặt trong một cột (như nút trong `Card`) hoặc khi chính nó
  có `flex`.
- **Một `View`/`Row`/`Column` không có `flex` thì co theo nội dung.** Muốn nó
  phủ hết một `Stack` (nền, lớp chắn chạm) thì cho nó `flex: 1`, hoặc bọc bằng
  `Positioned` với đủ cạnh — nếu không, nó chỉ cao bằng nội dung và `Stack` sẽ
  đặt nó theo `alignment`.
- **Mọi thay đổi màu accent đi qua `theme.ts`.** `mix()` trộn hex ở phía TS để
  hero card luôn đủ tối cho chữ trắng, bất kể accent là mint, blue, violet hay
  amber.

## Quyền đã khai báo

`toast`, `storage`.

`storage` giữ accent đã chọn; `toast` chỉ dùng cho một dòng ở tab You để chứng
minh host API vẫn gọi được từ app tự vẽ. Không có `network`, không có
`user.profile`, không có `qchat.api`.

## Lưu ý khi sửa

- Chỉ dùng style key và enum trong `packages/contracts/miniapp-ui.contract.json`;
  một key lạ làm cả frame bị từ chối. Tra nhanh ở `docs/miniapp-ui-reference.md`.
- `CustomPaint` cần `width`/`height` tường minh (prop hoặc style) — host không
  suy ra kích thước từ path.
- `Positioned` chỉ có nghĩa bên trong `Stack`; đặt ở nơi khác thì host coi
  `left`/`top` như một phép dịch.
- Mọi `setState` trong một sự kiện được gộp vào một frame, nên đổi accent sẽ
  repaint cả app đúng một lần.

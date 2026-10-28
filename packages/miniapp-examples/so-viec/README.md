# Sổ Việc — Mini App demo

Một Mini App quản lý việc và thói quen hằng ngày, dùng để thử **toàn bộ bề mặt
Cupertino** của runtime trên nền sáng: bốn tab, hai route nội bộ, vòng tiến độ
vẽ bằng `CustomPaint`, bottom sheet thêm việc, dialog xác nhận, công tắc và
slider của iOS, cùng dữ liệu lưu qua `storage`.

App cố tình phủ hết các dạng màn hình mà một app thật cần:

| Màn hình | Khung | Điểm đáng xem |
| --- | --- | --- |
| Hôm nay | `Page` + `NavBar` có hàng dưới + `TabBar` | Vòng tiến độ, 7 việc hôm nay, dải thói quen cuộn ngang, danh sách "Sắp tới" phân trang, nút + nổi |
| Kế hoạch | `Page` + `NavBar` + chip ngày | `Slider` mục tiêu tuần, hai `Switch`, chọn ngày, nút "Đánh dấu xong N việc" |
| Thói quen | `Page` + `NavBar` | `GridView` hai cột, mỗi ô một vòng tiến độ và một chạm đánh dấu, dialog đặt lại tuần |
| Tôi | `Page` + `NavBar` | `Avatar` + `getUserInfo`, ba ô số liệu, `Slider`, `Switch`, nút đồng bộ có loading, chia sẻ, xoá dữ liệu |
| `/task/:id` | `Page` + `NavBar.showBack` | `Checkbox` có nhãn, `Tag`, chỉnh ghi chú, chia sẻ, dialog xoá |
| `/about` | `Page` + `NavBar.showBack` | Trang giới thiệu tĩnh, không đụng store |

## Cấu trúc

```
so-viec/
  manifest.json          # quyền: toast, storage, user.profile, share
  tsconfig.json          # strict, JSX của @mna/qchat
  src/
    main.tsx             # 4 tab, route /task/:id và /about, badge việc còn lại
    store.ts             # 27 việc (hôm qua → +5 ngày), 4 thói quen, tuỳ chọn
    theme.ts             # bảng màu giấy, bán kính, màu ưu tiên / nhóm việc
    ui.tsx               # AppTabBar, Card, Chip, ProgressRing, TaskRow, …
    screens/
      today.tsx          # hero + ListView phân trang + BottomSheet thêm việc
      plan.tsx           # chip ngày, mục tiêu tuần, công tắc, danh sách theo ngày
      habits.tsx         # GridView thói quen, vòng tiến độ, đặt lại tuần
      me.tsx             # hồ sơ host, đồng bộ, chia sẻ, xoá dữ liệu
      task.tsx           # chi tiết việc, ghi chú, chia sẻ, xoá
      about.tsx          # giới thiệu app
```

`store.ts` là một module scope cộng một `Set` listener — cùng kiểu với
`rap-pho`, không cần thư viện state. Việc, thói quen và tuỳ chọn ghi vào
`createStorage("so-viec")`; nếu quyền `storage` bị từ chối thì app vẫn chạy với
state trong bộ nhớ.

Ngày tháng không hard-code: 27 việc mẫu được sinh quanh `new Date()` của máy
(−1 → +5 ngày), nên mở app hôm nào thì "Hôm nay" là hôm đó và chuỗi thói quen
vẫn đúng.

## Luồng chính

1. **Hôm nay** — vòng tiến độ ở header đọc thẳng từ `todayStats`. Danh sách việc
   hôm nay nằm trên cùng, tiếp theo là dải thói quen cuộn ngang và những việc
   của các ngày tới. Chạm vào ô vuông để đánh dấu xong; nhấn giữ một dòng để mở
   `Dialog` xoá.
2. **Thêm việc** — nút + mở `BottomSheet`: `TextField` cho tên, chip ưu tiên,
   chip nhóm, `Slider` thời lượng. Nút "Thêm việc" hiện loading 600 ms rồi đóng
   sheet, thêm việc vào hôm nay và báo bằng toast.
3. **Kế hoạch** — chọn một trong bảy ngày trên header; danh sách và số đếm đổi
   theo. `Slider` chỉnh mục tiêu tuần (5 → 40 việc) và thanh tiến độ cập nhật
   ngay. Nút cuối màn hình đánh dấu xong toàn bộ việc còn lại của ngày.
4. **Thói quen** — lưới 2 cột; mỗi ô có vòng tiến độ tuần, số lần đã làm và
   chuỗi ngày. Chạm để bật/tắt hôm nay. "Đặt lại tuần này" hỏi lại bằng `Dialog`
   trước khi xoá dấu.
5. **Tôi** — hồ sơ lấy từ `getUserInfo`, số liệu tuần, mục tiêu, hai công tắc,
   nút đồng bộ (loading + `ActivityIndicator`, chờ 900 ms), chia sẻ tiến độ và
   xoá toàn bộ dữ liệu sau khi xác nhận.
6. **Chi tiết việc** — mở từ bất kỳ dòng nào. Sửa ghi chú rồi "Lưu ghi chú"
   (ghi vào storage), chia sẻ hoặc xoá. Xoá xong tự quay lại danh sách.

## Phân trang và `endReached`

Tab Hôm nay giữ toàn bộ việc trong bộ nhớ nhưng chỉ đưa 4 việc "Sắp tới" mỗi
trang vào `ListView`:

```tsx
const PAGE = 4;
const visibleLater = later.slice(0, page * PAGE);

<ListView
  data={rows}                        // hôm nay + thói quen + sắp tới + hàng "còn N"
  initialCount={16}
  onEndReached={() => setPage((previous) => previous + 1)}
/>
```

Hàng cuối cho biết còn bao nhiêu việc, nên không cần spinner giả. Đây là ví dụ
tham chiếu thứ hai (sau `rap-pho`) cho cơ chế cửa sổ của `ListView`.

## Vẽ vòng tiến độ

Ngôn ngữ vẽ của `CustomPaint` chỉ có `M/L/Q/C/Z`, không có cung tròn. Vòng tiến
độ vì vậy được dựng thành chuỗi đoạn thẳng 96 bước, mỗi vòng hai lớp: vòng nền
màu `line` và cung màu ở trên, cắt theo phần trăm.

```tsx
<CustomPaint
  width={size}
  height={size}
  draw={ringPath(size, percent, color, stroke)}  // "stroke:#2f6d5c strokeWidth:8 cap:butt M … L …"
/>
```

`cap:butt` là cố ý: đầu tròn sẽ nhô quá điểm bắt đầu của cung và đè lên vòng nền.

## Chạy và đóng gói

```powershell
node packages/miniapp-framework/dist/cli.js build    --dir packages/miniapp-examples/so-viec
node packages/miniapp-framework/dist/cli.js test     --dir packages/miniapp-examples/so-viec
node packages/miniapp-framework/dist/cli.js validate packages/miniapp-examples/so-viec/dist/so-viec-1.0.0.japp
```

Bài test thật nằm ở `packages/miniapp-framework/test/so-viec.test.ts`: nó build
app, chạy trong harness rồi đi hết luồng — đổi tab, phân trang, đánh dấu việc,
thêm việc qua sheet, mở chi tiết, lưu ghi chú, xoá việc, đánh dấu thói quen, đặt
lại tuần, chọn ngày, đồng bộ và xoá dữ liệu.

## Những gì app này kiểm tra

- **Điều khiển iOS**: `Checkbox`, `Switch`, `Slider` và `ActivityIndicator` đều
  đi qua widget Cupertino của runtime; app chỉ đặt màu và kích thước bằng
  `style`/props.
- **TabBar thật**: bốn tab là `CupertinoTabBar`, badge nằm trên icon; app tự đặt
  nền và hairline trên qua `style.backgroundColor`,
  `style.borderTopWidth`/`borderTopColor`.
- **Overlay theo mùa iOS**: `BottomSheet` trượt từ đáy, `Dialog` hiện bằng fade
  + scale, barrier phủ cả header nhờ `Page.overlays`.
- **Khung trang**: cả sáu màn hình dùng `Page` (`header` / `footer` / `overlays`)
  nên nội dung không bao giờ chui dưới header.
- **Load-more**: `ListView` cửa sổ + `onEndReached`; app tự phân trang.
- **Lưới**: `GridView` hai cột với `numColumns={2}` và `aspectRatio` để ô thói
  quen vuông vắn.
- **Cuộn ngang**: dải thói quen trên tab Hôm nay là `ScrollView horizontal` nằm
  trong `ListView` dọc.
- **Route nội bộ**: `navigateTo`/`navigateBack` của host, cộng bản sao ngăn xếp
  route trong `main.tsx` để khung hình gửi lên đúng là màn hình host trượt vào.
- **Host API**: `getUserInfo`, `getAppInfo`, `share`, `showToast` — mọi lời gọi
  đều có `catch`.
- **Lưu trữ**: `createStorage("so-viec")`, `hydrate()` một lần, mọi thay đổi
  persist ngay; "Xoá toàn bộ dữ liệu" gọi `removeStorage`.
- **Định dạng**: `Intl.NumberFormat("vi-VN")` cho số đếm, `Date` cho ngày và
  `formatMinutes` cho "1 giờ 55 phút".
- **Thành phần**: `Page`, `NavBar`, `TabBar`, `ListView`, `GridView`,
  `ScrollView`, `BottomSheet`, `Dialog`, `Checkbox`, `Switch`, `Slider`,
  `ActivityIndicator`, `Avatar`, `Tag`, `Divider`, `Icon`, `CustomPaint`,
  `Stack`, `Positioned`, `Button`, `Pressable`, `TextField`.

## Ghi chú khi copy làm app mới

1. Đổi `name`/`description` trong `manifest.json`; tên file `.japp` lấy từ
   `name` đã chuyển ASCII (`Sổ Việc` → `so-viec`).
2. Không cần `assets/`: mọi hình là vòng `CustomPaint`, ô màu và biểu tượng.
3. Helper component nào nhận `key` từ `.map()` phải khai báo
   `key?: string | number` trong props, vì runtime coi `key` là thuộc tính
   element chứ không phải prop thường.
4. `NavBar` nhận các hàng dưới qua `children`, không phải `bottom`.
5. Mỗi tab là một `Page` riêng, truyền `footer={<AppTabBar …/>}` để thanh tab
   không lặp lại ở từng màn hình.
6. `href` của `Link` đi qua router của host; route nội bộ vẫn nên gọi
   `navigateTo` trước khi đổi state để hiệu ứng trượt có khung hình đúng.

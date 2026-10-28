# Rạp Phố — Mini App demo

Một Mini App đặt vé xem phim hoàn chỉnh, dùng để thử **chuẩn header** của QChat
trên nền tối và toàn bộ đường đi của một app thật: khám phá → danh sách phim →
chi tiết phim → chọn suất chiếu → chọn ghế → thanh toán → ví vé điện tử có mã
QR, cộng ba route nội bộ.

App cố tình dùng cả ba bề mặt header trong cùng một luồng:

| Màn hình | Header | Vì sao |
| --- | --- | --- |
| Khám phá | `transparent` khi còn trên poster, `blur` khi cuộn qua, đặc khi cuộn sâu | Poster chạy dưới header, tiêu đề trắng vẫn đọc được |
| Phim | đặc, có `children` là ô tìm kiếm + chip thể loại + chip trạng thái | Header mở rộng xuống dưới, ba hàng |
| Vé của tôi | đặc, `children` là ba chip lọc | Header hai hàng, đổi nội dung theo bộ lọc |
| Tôi | đặc, không có hàng dưới | Header tối giản |
| Chi tiết phim, Vé, Điều khoản | đặc, `showBack` | Route nội bộ do host router mở |

## Cấu trúc

```
rap-pho/
  manifest.json          # quyền: toast, storage, user.profile, share
  tsconfig.json          # strict, JSX của @mna/qchat
  src/
    main.tsx             # 4 tab, route /movie/:id, /ticket/:code, /legal, badge vé
    store.ts             # 30 phim, suất chiếu/ghế tất định, vé, yêu thích, tuỳ chọn
    theme.ts             # bảng màu tối, bán kính, poster gradient, tông màu
    ui.tsx               # ScreenShell, Card, Section, Chip, Poster, EmptyState, …
    screens/
      discover.tsx       # header trong suốt/mờ/đặc, hero, rail phim, suất tối nay
      movies.tsx         # header 3 hàng dưới, ListView phân trang 12 phim
      movie.tsx          # chi tiết, chip ngày/suất, sơ đồ ghế 8×9, sheet thanh toán
      tickets.tsx        # ví vé, ba bộ lọc, thống kê chi tiêu
      ticket.tsx         # route nội bộ: mã QR CustomPaint, huỷ vé, chia sẻ
      account.tsx        # hồ sơ host, hạng thành viên, tuỳ chọn lưu storage
      legal.tsx          # route nội bộ: điều khoản, chính sách, ghi chú dữ liệu
```

`store.ts` là một module scope cộng một `Set` listener — không cần thư viện
state. Vé, yêu thích và tuỳ chọn đều ghi vào `createStorage("rap-pho")`, nên mở
lại app vẫn còn nguyên. Nếu quyền `storage` bị từ chối thì app vẫn chạy với
state trong bộ nhớ.

Suất chiếu và ghế đã bán được sinh tất định từ `codeHash(movieId + ngày + giờ)`,
nên hai lần mở app thấy cùng một rạp, cùng một sơ đồ ghế — không cần backend.

## Luồng đặt vé

1. **Khám phá** → chạm poster trong rail hoặc banner "Suất tối nay".
2. **Chi tiết phim** → chọn ngày (6 ngày tới) rồi chọn suất; mỗi suất có phòng,
   định dạng và giá riêng.
3. **Sơ đồ ghế** — `GridView` 9 cột × 8 hàng = 72 ghế, `initialCount={72}`.
   Hàng E và F là VIP, phụ thu 30.000đ/ghế. Ghế đã bán không chọn được, tối đa
   8 ghế mỗi lần đặt. Thanh dưới hiển thị số ghế và tổng tiền theo thời gian thực.
4. **Thanh toán** — `BottomSheet` xác nhận: poster, suất, ghế, combo bắp + nước
   (79.000đ), ba phương thức, ô điều khoản bắt buộc. Nút chốt chỉ bật khi đã
   đồng ý điều khoản.
5. **Vé điện tử** — app chuyển sang tab Vé và mở `/ticket/:code`. Trang vé vẽ mã
   QR 21×21 ô bằng ba lớp `CustomPaint` (ba ô định vị + dữ liệu băm từ mã vé),
   kèm nút chia sẻ, huỷ vé (trước suất 2 giờ) và nhắc nhở.

Mã vé bắt đầu từ `RP4790` và tăng dần; ví có sẵn hai vé mẫu `RP4788` (sắp tới)
và `RP4691` (đã dùng) để thấy đủ ba trạng thái lọc.

## Phân trang và `endReached`

Tab Phim giữ 30 phim trong bộ nhớ nhưng chỉ đưa 12 phim mỗi trang vào
`ListView`:

```tsx
const PAGE = 12;
const visible = filtered.slice(0, page * PAGE);

<ListView
  data={rows}
  initialCount={PAGE + 1}          // 12 phim + hàng "còn N phim"
  onEndReached={() => setPage((previous) => previous + 1)}
/>
```

Đây là ví dụ tham chiếu cho cơ chế **load-more tự động** của framework:
`ListView`/`GridView` chỉ dựng cửa sổ đầu tiên, host phát `endReached` khi người
dùng tới gần cuối, app nới `page` và cửa sổ lớn lên. Hàng cuối luôn nói còn bao
nhiêu phim, nên trạng thái "đang tải" không cần spinner giả.

## Chạy và đóng gói

```powershell
node packages/miniapp-framework/dist/cli.js build    --dir packages/miniapp-examples/rap-pho
node packages/miniapp-framework/dist/cli.js test     --dir packages/miniapp-examples/rap-pho
node packages/miniapp-framework/dist/cli.js validate packages/miniapp-examples/rap-pho/dist/rap-pho-1.0.0.japp
node packages/miniapp-framework/dist/cli.js inspect  packages/miniapp-examples/rap-pho/dist/rap-pho-1.0.0.japp
```

`build` chạy `tsc --noEmit`, bundle TSX bằng esbuild cho QuickJS, rồi ghi
`dist/rap-pho-1.0.0.japp`. App không dùng file ảnh nào: poster, gradient và mã QR
đều do `View`, `Text` và `CustomPaint` vẽ, nên gói chỉ có 4 file.

## Những gì app này kiểm tra

- **Header chuẩn**: `NavBar` với `transparent`, `blur`, màu tiêu đề qua
  `style.color`, `children` làm các hàng dưới (tìm kiếm + chip).
- **Capsule của host**: app không vẽ nút đóng; host float capsule ở góc phải,
  `reserveRight` mặc định giữ tiêu đề không chui xuống dưới capsule.
- **Load-more**: `ListView` cửa sổ + `onEndReached`, app tự phân trang.
- **Lưới lớn**: `GridView` 72 ghế với `initialCount={72}`, ô ghế đổi màu theo
  trạng thái trống / đang chọn / đã bán / VIP.
- **Sheet và dialog**: `BottomSheet` thanh toán (không lồng scroller), `Dialog`
  xác nhận huỷ vé, `Checkbox` điều khoản, `Switch` tuỳ chọn.
- **Route nội bộ**: `navigateTo`/`navigateBack` của host, cộng nhánh dự phòng để
  preview không có router vẫn xem được trang.
- **Host API**: `getUserInfo`, `share`, `showToast` — mọi lời gọi đều có `catch`.
- **Thành phần**: `ListView`, `GridView`, `BottomSheet`, `Dialog`, `Checkbox`,
  `Switch`, `Tag`, `Avatar`, `Icon`, `CustomPaint`, `Divider`, `TabBar`, `Page`.
- **Khung trang**: trang Vé điện tử dùng `Page` (`header` + `body` + `overlays`),
  nên thẻ vé luôn bắt đầu dưới header thay vì chui xuống dưới nó.
- **Định dạng**: `Intl.NumberFormat("vi-VN")` cho tiền, `Date` cho ngày và giờ,
  không có `setInterval` nào bị bỏ quên.

## Ghi chú khi copy làm app mới

1. Đổi `name`/`description` trong `manifest.json`; tên file `.japp` lấy từ
   `name` đã chuyển ASCII (`Rạp Phố` → `rap-pho`).
2. Không cần `assets/`: mọi hình là gradient + chữ cái đầu của phim. Nếu thêm
   ảnh thật, giữ `assets/` ở gốc dự án và tham chiếu `assets/<file>.png`.
3. Helper component nào nhận `key` từ `.map()` phải khai báo
   `key?: string | number` trong props, vì runtime coi `key` là thuộc tính
   element chứ không phải prop thường.
4. `NavBar` nhận các hàng dưới qua `children`, không phải qua `bottom`.
5. Trong `Stack`, con cần đặt theo cạnh nên dùng `Positioned`; style
   `position: "absolute"` cũng được runtime hiểu, nhưng `Positioned` rõ nghĩa
   hơn khi đọc code.
6. Mỗi trang dùng `Page` (`header` / `footer` / `overlays`) để nội dung luôn nằm
   dưới header. Chỉ tự dựng `Stack` khi cố ý cho ảnh chạy dưới header trong suốt,
   và khi đó phải tự chừa `paddingTop` cho nội dung.

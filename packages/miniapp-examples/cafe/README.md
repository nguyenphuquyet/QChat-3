# Cà Phê Nhà — Mini App demo

Một Mini App đặt đồ uống hoàn chỉnh, dùng để thử **chuẩn header** của QChat và
toàn bộ đường đi của một app thật: thực đơn → chi tiết món → giỏ hàng → đặt
đơn → lịch sử đơn → ưu đãi → tài khoản, cộng hai route nội bộ.

App cố tình dùng cả ba bề mặt header trong cùng một luồng:

| Màn hình | Header | Vì sao |
| --- | --- | --- |
| Thực đơn | `transparent` khi còn trên ảnh bìa, `blur` khi cuộn qua, đặc khi cuộn sâu | Ảnh bìa chạy dưới header, tiêu đề trắng vẫn đọc được |
| Đơn hàng | đặc, có `children` là ô tìm kiếm + chip lọc | Header mở rộng xuống dưới, nhiều hàng |
| Ưu đãi | đặc, không có hàng dưới | Header tối giản |
| Tài khoản | đặc, không có hàng dưới | Cùng chuẩn, khác nội dung |
| Chi tiết món, Điều khoản | đặc, `showBack` | Route nội bộ do host router mở |

## Cấu trúc

```
cafe/
  manifest.json          # quyền: toast, storage, user.profile, share
  tsconfig.json          # strict, JSX của @mna/qchat
  assets/                # hero + 6 ảnh món (PNG, đóng gói tự động)
  src/
    main.tsx             # 4 tab, route /drink/:id và /legal, badge giỏ hàng
    store.ts             # store một module + subscription, storage, tiền/giờ
    theme.ts             # bảng màu, bán kính, thẻ, chip, gradient
    ui.tsx               # ScreenShell, Card, Section, Chip, QtyStepper, …
    screens/
      menu.tsx           # header trong suốt/mờ/đặc, tìm kiếm, giỏ hàng sheet
      orders.tsx         # header 2 hàng dưới, chi tiết đơn, huỷ đơn, đặt lại
      offers.tsx         # đếm ngược, mã giảm giá, thẻ tem, CustomPaint
      account.tsx        # hồ sơ host, tuỳ chọn lưu storage, thông tin runtime
      drink.tsx          # route nội bộ: cỡ ly, mức đường, số lượng
      legal.tsx          # route nội bộ: RichText, Link nội bộ và external
```

`store.ts` là một module scope cộng một `Set` listener — không cần thư viện
state. Mọi thay đổi giỏ hàng, đơn, mã giảm giá và tuỳ chọn đều ghi vào
`createStorage("cafe")`, nên mở lại app vẫn còn nguyên. Nếu quyền `storage` bị
từ chối thì app vẫn chạy với state trong bộ nhớ.

## Chạy và đóng gói

```powershell
node packages/miniapp-framework/dist/cli.js build    --dir packages/miniapp-examples/cafe
node packages/miniapp-framework/dist/cli.js test     --dir packages/miniapp-examples/cafe
node packages/miniapp-framework/dist/cli.js validate packages/miniapp-examples/cafe/dist/ca-phe-nha-1.0.0.japp
node packages/miniapp-framework/dist/cli.js inspect  packages/miniapp-examples/cafe/dist/ca-phe-nha-1.0.0.japp
```

`build` chạy `tsc --noEmit`, bundle TSX bằng esbuild cho QuickJS, đóng gói
`assets/` và ghi `dist/ca-phe-nha-1.0.0.japp`. Tên file lấy từ `name` trong
manifest; dấu tiếng Việt được chuyển thành ASCII (`Cà Phê Nhà` → `ca-phe-nha`).

## Những gì app này kiểm tra

- **Header chuẩn**: `NavBar` với `transparent`, `blur`, màu tiêu đề qua
  `style.color`, và `children` làm các hàng dưới (ô tìm kiếm + chip).
- **Capsule của host**: app không vẽ nút đóng; host float capsule ở góc phải,
  `reserveRight` mặc định 112 giữ tiêu đề không chui xuống dưới capsule.
- **Giỏ hàng**: `BottomSheet` (không lồng scroller), `Slider` tip, `Checkbox`
  điểm, `Dialog` xác nhận, `placeOrder()` chốt đơn và xoá giỏ.
- **Route nội bộ**: `navigateTo`/`navigateBack` của host, cộng nhánh dự phòng
  để preview không có router vẫn xem được trang.
- **Host API**: `getUserInfo`, `getAppInfo`, `getSystemInfo`, `share`,
  `openExternal`, `showToast`, `closeMiniApp` — mọi lời gọi đều có `catch`.
- **Thành phần**: `Image`, `Tag`, `Badge`, `Avatar`, `Icon`, `RichText`,
  `Link`, `TextField`, `Switch`, `Slider`, `Checkbox`, `CustomPaint`,
  `Divider`, `BottomSheet`, `Dialog`, `TabBar`.
- **Định dạng**: `Intl.NumberFormat("vi-VN")` cho tiền, `Date` cho giờ, một
  `setInterval` cho đồng hồ đếm ngược (được dọn trong cleanup).

## Ghi chú khi copy làm app mới

1. Đổi `name`/`description` trong `manifest.json` và `name` trong `package.json`
   của thư mục (nếu có).
2. Giữ `assets/` ở gốc dự án; compiler đóng gói cả thư mục và app tham chiếu
   bằng `assets/<file>.png`.
3. Helper component nào nhận `key` từ `.map()` phải khai báo
   `key?: string | number` trong props, vì runtime coi `key` là thuộc tính
   element chứ không phải prop thường.
4. `NavBar` nhận các hàng dưới qua `children`, không phải qua `bottom`.

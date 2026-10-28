# Ví Nhỏ

Mini App quản lý chi tiêu cá nhân, viết hoàn toàn bằng TSX trên hợp đồng
`@mna/qchat`. Đây là app mẫu đầy đủ để xem **control TDesign** chạy trong khung
Mini App: mọi nút, nhãn, ô nhập, công tắc, thanh trượt và vòng xoay do
`tdesign_flutter` vẽ, còn khung trang, thanh tab và chuyển động overlay vẫn của
QChat/Cupertino.

## App có gì

Bốn tab:

- **Tổng quan** — thẻ ngân sách tháng, tỉ trọng chi theo nhóm, biểu đồ bảy
  ngày, bốn khoản gần nhất. Nút thêm mở bottom sheet; nhấn giữ một dòng để xoá.
- **Giao dịch** — tìm kiếm, lọc thu/chi, tải sáu khoản một lần qua
  `endReached`, chế độ chọn nhiều bằng `Checkbox` và xoá hàng loạt bằng
  `Dialog`.
- **Ngân sách** — `Slider` tổng ngân sách, sáu thẻ hạn mức nhóm với `Tag` trạng
  thái, sheet sửa hạn mức, công tắc nhắc nhở và gợi ý.
- **Tôi** — hồ sơ host, thống kê tháng, cài đặt, mã PIN bảo mật, đồng bộ giả
  lập và vùng đặt lại dữ liệu.

Ba route nội bộ:

- `/giao-dich/:id` — xem và sửa một khoản: tên, số tiền, thanh trượt, chiều thu
  chi, nhóm, phương thức, ghi chú nhiều dòng, đối chiếu hoá đơn, xoá.
- `/bo-dieu-khien` — bày đủ mười một control TDesign ở mọi trạng thái.
- `/about` — giới thiệu app và các host API đã dùng.

## Cấu trúc

```
manifest.json
tsconfig.json
src/
  main.tsx            # bốn tab + route stack + badge
  theme.ts            # màu, bán kính, thẻ, khoảng lề
  store.ts            # 28 khoản mẫu, hạn mức, tuỳ chọn, storage
  ui.tsx              # TabBar, Card, TxnRow, TagPick, ProgressBar, Icon…
  screens/
    overview.tsx
    txns.tsx
    budgets.tsx
    me.tsx
    txn.tsx
    gallery.tsx
    about.tsx
```

Không có `package.json` riêng: workspace cài dependency một lần, `qapp build`
đọc `tsconfig.json` và bundle `src/main.tsx`.

## Dữ liệu

`store.ts` giữ state ở cấp module, phát thay đổi qua một `Set` listener và ghi
snapshot vào `createStorage("vi-nho")`. Hai mươi tám khoản mẫu trải từ hôm nay
tới 24 ngày trước, tính theo `Date` thật của máy, nên tháng nào mở app cũng có
dữ liệu quanh ngày đó. Sáu hạn mức nhóm cố ý có đủ ba trạng thái: thoải mái,
sắp chạm trần và vượt hạn mức.

## Control TDesign được dùng

| Control | Nơi xuất hiện |
| --- | --- |
| `Button` | thêm, lưu, xoá, lọc, tải thêm; đủ variant, size, icon, loading, disabled |
| `Tag` | trạng thái ngân sách, nhóm, phương thức, sắc thái trong gallery |
| `Badge` | badge tab Giao dịch/Ngân sách; count, max, dot, ẩn trong gallery |
| `Checkbox` | chọn khoản để xoá, khoản định kỳ, đối chiếu, cài đặt |
| `Switch` | khoản thu, nhắc nhở, tổng kết, làm tròn |
| `Slider` | số tiền, tổng ngân sách, hạn mức nhóm |
| `TextField` | tìm kiếm, tên, số tiền, ghi chú nhiều dòng, PIN bảo mật |
| `ActivityIndicator` | đồng bộ giả lập, gallery |
| `Icon` | toàn app và lưới glyph trong gallery |
| `Divider` | ngăn cách trong thẻ, đường kẻ dày trong gallery |

`Tag` không có trạng thái nhấn, nên chỗ chọn nhóm/phương thức bọc `Tag` trong
`Pressable` (`TagPick` ở `src/ui.tsx`). Đây là cách app tự vẽ vùng chạm mà
không thêm một control mới.

## Build và kiểm tra

Từ gốc repo:

```powershell
node packages/miniapp-framework/dist/cli.js build --dir packages/miniapp-examples/vi-nho
node packages/miniapp-framework/dist/cli.js test --dir packages/miniapp-examples/vi-nho
node packages/miniapp-framework/dist/cli.js validate packages/miniapp-examples/vi-nho/dist/vi-nho-1.0.0.japp
node packages/miniapp-framework/dist/cli.js inspect packages/miniapp-examples/vi-nho/dist/vi-nho-1.0.0.japp
```

Hoặc qua script workspace: `corepack pnpm qapp build --dir packages/miniapp-examples/vi-nho`.

Test end-to-end của app nằm ở
`packages/miniapp-framework/test/vi-nho.test.ts`.

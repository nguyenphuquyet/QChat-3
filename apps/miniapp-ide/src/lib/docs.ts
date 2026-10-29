// In-app developer documentation for QChat Mini App Studio.
//
// The "studio" group is authored here in Vietnamese and tracks the current
// source. The "miniapp" group is the real repository documentation, imported as
// raw strings so the IDE and the repo can never drift apart. This module is
// deliberately free of React imports: it is plain data.
import miniappsRaw from "../../../../docs/MINIAPPS.md?raw";
import guideRaw from "../../../../docs/MINIAPP-DEVELOPER-GUIDE.md?raw";
import architectureRaw from "../../../../docs/ARCHITECTURE.md?raw";
import deploymentRaw from "../../../../docs/DEPLOYMENT.md?raw";

export interface DocSection {
  id: string;
  title: string;
  summary: string;
  content: string;
}

export interface DocGroup {
  id: "studio" | "miniapp";
  titleKey: string;
  sections: DocSection[];
}

const STUDIO_OVERVIEW = `QChat Mini App Studio (\`apps/miniapp-ide\`, gói \`@qchat/miniapp-ide\`) là IDE desktop để viết, build và kiểm tra mini app TSX chạy trên runtime QuickJS của QChat. Đây **không** phải WebView host: bảng xem trước chạy chính bundle mà runtime sẽ chạy, bên trong một \`iframe\` sandbox, rồi vẽ cây render bằng DOM; giao diện cuối cùng vẫn do Flutter vẽ nên bản xem trước là gần đúng chứ không pixel-perfect.

## Kiến trúc

| Lớp | Công nghệ | Nhiệm vụ |
| --- | --- | --- |
| Vỏ desktop | Tauri 2 (Rust) | Cửa sổ không viền, lệnh filesystem, chạy CLI, phát sự kiện dev |
| Giao diện | React 19 + Vite 8 + TypeScript | Explorer, tab Monaco, panel build, hộp thoại |
| Trình soạn thảo | Monaco Editor 0.57 | TSX, định nghĩa kiểu SDK và JSON schema cho \`manifest.json\` |
| Trạng thái | Zustand 5 | \`useStudio\` — một store duy nhất, persist vào \`localStorage\` |
| Đóng gói | \`qapp\` CLI (\`packages/miniapp-framework/dist/cli.js\`) | Typecheck, esbuild cho QuickJS, ghi \`.japp\` |

Luồng dữ liệu một chiều: React gọi \`lib/api.ts\` → \`invoke\` lệnh Rust → Rust chạy \`node cli.js ...\` → kết quả trả về store → panel cập nhật.

## Cây thư mục source

\`\`\`text
apps/miniapp-ide/
  src/
    App.tsx                 khung ứng dụng, phím tắt, vòng poll đồng bộ
    components/             ActivityBar, Sidebar, EditorArea, DevicePanel, hộp thoại
    lib/
      api.ts                cầu nối Tauri (invoke, chọn tệp, mở URL)
      store.ts              store Zustand: dự án, tab, log, build, artifact
      i18n.ts, useI18n.ts   đa ngôn ngữ, tiếng Việt mặc định
      utils.ts, templates.ts, monaco.ts
  src-tauri/
    src/lib.rs              lệnh Rust và vòng đời tiến trình qapp dev
    tauri.conf.json         cấu hình cửa sổ, bundle và NSIS
    icons/                  icon.ico, icon.icns và các PNG
  scripts/prepare-cli.mjs   sao chép CLI + esbuild + TypeScript vào resources
  scripts/generate-icons.py tạo icon.ico/icns/png từ một ảnh PNG gốc
  src-tauri/icons/source/  ảnh gốc qchat-app-icon.png để tái tạo icon
\`\`\`

## Store chính (\`src/lib/store.ts\`)

- Vòng đời dự án: \`bootstrap\`, \`detect\`, \`openProject\`, \`closeProject\`, \`refreshTree\`, \`refreshArtifacts\`.
- Tệp và tab: \`openFile\`, \`setActive\`, \`updateTab\`, \`saveFile\`, \`saveActive\`, \`closeTab\`, \`createEntry\`, \`renameEntry\`, \`deleteEntry\`.
- Build và kiểm tra: \`buildProject\`, \`runTests\`, \`validateArtifact\`, \`inspectArtifact\`, \`startDev\`, \`stopDev\`, \`runTerminal\`.
- Giao diện: \`setSidebarTab\`, \`setSidebarOpen\`, \`setBottomTab\`, \`setBottomOpen\`, \`setPreviewOpen\`, \`setCursor\`, \`updateSettings\`, \`appendLog\`, \`clearLogs\`.

## Luồng build

\`\`\`text
Ctrl+B → buildProject()
  → api.runCli(["build", "--dir", <project>])
  → Rust run_cli → node cli.js build --dir <project>
  → typecheck + esbuild (mục tiêu QuickJS) + băm SHA-256
  → dist/<slug>-<version>.japp
  → listArtifacts() → inspectArtifact() → qapp inspect
  → DevicePanel: manifest, quyền, kích thước, SHA-256
\`\`\`

\`Ctrl+Shift+B\` build bỏ qua typecheck (\`--no-typecheck\`), \`Ctrl+T\` chạy \`qapp test\`, \`F5\` bật watcher \`qapp dev\`. Tên gói luôn là \`dist/<slug>-<version>.japp\`. Bảng xem trước gọi \`qchat bundle\` trên cùng pipeline esbuild đó, nên nó không bao giờ lệch khỏi bản build thật; chỉ phần vẽ giao diện là khác runtime.

> Nếu CLI chưa sẵn sàng, hãy chạy \`corepack pnpm --filter @mna/qchat build\` rồi chọn **Tools → Re-detect CLI**.`;

const STUDIO_LIVE_PREVIEW = `Panel thiết bị (**Ctrl+Shift+P** bật/tắt) chạy mini app thật ngay trong IDE. Mỗi lần lưu tệp hoặc build thành công, store tăng \`previewRevision\` và panel build lại.

## Luồng một lần xem trước

\`\`\`text
previewRevision đổi
  → saveAllDirty() (nếu bật autoSave)
  → qchat bundle --dir <project> --no-typecheck
  → đọc dist/app.js + assets/** (base64, data URL)
  → iframe sandbox="allow-scripts" nạp bootstrap + app.js
  → app gọi host bridge → render frame → React vẽ cây thành DOM
\`\`\`

## Ranh giới

- **Cùng bundle**: \`qchat bundle\` dùng đúng pipeline esbuild của \`qchat build\`, chỉ dừng trước bước zip. Cái bạn thấy là cái sẽ chạy.
- **Không cùng công cụ vẽ**: runtime thật vẽ bằng Flutter/TDesign. Bản xem trước vẽ bằng DOM/CSS nên vẫn lệch vài pixel, vài hiệu ứng cuộn, vài chi tiết glyph.
- **Sandbox**: \`sandbox="allow-scripts"\` \`iframe\` không có \`allow-same-origin\`, nên app không chạm được DOM của Studio. Mọi host method đi qua \`postMessage\` có token.
- **Quyền**: manifest quyết định. Gọi API chưa xin quyền sẽ nhận lỗi \`PERMISSION_DENIED\` giống trên máy thật.
- **Giới hạn**: 60 lời gọi/10 giây và 30 lời gọi/phương thức (5 với \`chooseImage\`), body request 32 KB, response 1 MB, ảnh 5 MB, storage 64 KB/giá trị và 512 KB/app, tối đa 128 khoá.
- **Storage**: dùng \`localStorage\` của Studio với tiền tố \`qapp-preview:<appId>:\`, nên dữ liệu xem trước không lẫn với app khác.
- **Timer**: SDK thay \`setTimeout\`/\`clearTimeout\` bằng hàng đợi của nó; host giữ bản native trước khi SDK cài đặt để đồng hồ không tự gọi lại chính nó.
- **Mạng**: \`request\` trả \`NOT_SUPPORTED\`; \`fetch\` HTTPS đi qua Studio. Nếu máy không có mạng, app thấy lỗi mạng như trên thiết bị.

## Khi bản xem trước không chạy

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| "Live preview needs the desktop Studio" | Đang chạy \`pnpm dev\` trong trình duyệt; CLI chỉ có trong shell Tauri |
| Lỗi đỏ ngay khi mở | \`src/main.tsx\` ném lỗi lúc khởi động; xem tab Console trong panel |
| Trắng màn hình, không lỗi | App gọi \`close()\` hoặc không render gì; Console ghi lại sự kiện đó |
| Ảnh hiện khung xám | Đường dẫn không phải \`assets/…\`, hoặc tệp quá 4 MB / tổng quá 12 MB |

> Bản xem trước dùng theme sáng/tối của Studio và thông báo cùng theme đó qua \`getSystemInfo\`, nên hãy kiểm tra cả hai chế độ trước khi gửi duyệt.`;

const STUDIO_REALTIME = `Studio không khóa dự án của bạn: bạn có thể sửa tệp bằng trình soạn thảo bên ngoài (VS Code, \`git checkout\`, script sinh mã) và IDE sẽ tự phát hiện thay đổi.

## Lệnh Rust

| Lệnh | Tham số | Nhiệm vụ |
| --- | --- | --- |
| \`file_stamps\` | danh sách đường dẫn tuyệt đối | trả về mốc sửa đổi và kích thước hiện tại của từng tệp để so với trạng thái IDE đang giữ |
| \`tree_signature\` | thư mục gốc dự án | trả về chữ ký rẻ của cả cây thư mục; chữ ký chỉ đổi khi có tệp được thêm, xóa, đổi tên hoặc ghi nội dung |

Vòng poll gọi \`tree_signature\` trước; chỉ khi chữ ký thay đổi mới gọi \`file_stamps\` và \`refreshTree\`, nên IDE không đọc lại toàn bộ cây mỗi nhịp. Cả hai lệnh chạy qua \`spawn_blocking\` giống \`detect_cli\`/\`run_cli\` để không chặn luồng giao diện.

## Vòng poll trong \`App.tsx\`

Khi cửa sổ đang mở và có dự án, \`App.tsx\` chạy \`setInterval\` khoảng **1.5 giây**:

1. Gọi \`tree_signature(project.path)\`. Nếu chữ ký không đổi thì dừng — không đọc tệp nào.
2. Nếu chữ ký đổi, gọi \`file_stamps\` cho các tab đang mở (và cả \`manifest.json\`, kể cả khi tệp này chưa mở trong tab) rồi \`refreshTree()\` để cập nhật Explorer cùng panel Packages.
3. So sánh mốc sửa đổi/kích thước mới với giá trị IDE đã lưu cho từng tab.

Mỗi nhịp bị bỏ qua khi cửa sổ đang ẩn (\`document.visibilityState === "hidden"\`), và một cờ chống chồng lấn bảo đảm không có hai vòng poll chạy song song trên cây thư mục lớn.

## Quy tắc nạp lại tab

- **Tab không có thay đổi cục bộ** (\`content === saved\`): nội dung được nạp lại từ đĩa và cập nhật luôn cả bản \`saved\`.
- **Tab đang sửa dở** (\`content !== saved\`): IDE **không** ghi đè. Tab được đánh dấu xung đột để bạn tự quyết định giữa bản trên đĩa và bản đang sửa; thông báo có sẵn nút nạp lại từ đĩa.
- **Tệp bị xóa hoặc bị di chuyển** khỏi đĩa: tab được đánh dấu thiếu tệp và cũng không bị ghi đè.
- Tệp mới xuất hiện được thêm vào Explorer; tệp bị xóa khỏi đĩa cũng được phản ánh lại.

Khi một tab được nạp lại thành công, Studio hiển thị thông báo **"đã cập nhật từ đĩa"** để bạn biết nội dung vừa đổi không phải do mình gõ.

> Mẹo: bật \`autoSave\` trong **Cài đặt → Trình soạn thảo** để IDE ghi ngay mọi thay đổi; thao tác sửa từ bên ngoài vẫn được phát hiện như trên.`;

const STUDIO_BUILD_RELEASE = `Bộ cài Windows do Tauri tạo qua NSIS (kèm MSI), dùng icon và ảnh thương hiệu sinh ra từ một ảnh gốc duy nhất.

## Pipeline icon

Ảnh gốc duy nhất là \`assets/icon-source.png\` (PNG vuông). Bước chuẩn bị icon dùng **Python + Pillow** (\`python -m pip install Pillow\`) qua script \`scripts/generate-icons.py\`:

\`\`\`sh
cd apps/miniapp-ide
python scripts/generate-icons.py assets/icon-source.png
\`\`\`

\`\`\`text
assets/icon-source.png
  → src-tauri/icons/icon.ico          16/24/32/48/64/128/256 px (NSIS + cửa sổ Windows)
             src-tauri/icons/icon.icns        16…1024 px (macOS)
             src-tauri/icons/icon.png         1024×1024
             src-tauri/icons/32x32.png, 64x64.png, 128x128.png, 128x128@2x.png
             src-tauri/icons/StoreLogo.png, Square*Logo.png  (Windows Store/MSI)
             src-tauri/icons/source/qchat-app-icon.png       bản 1024 giữ lại để tái tạo
\`\`\`

\`bundle.icon\` trong \`tauri.conf.json\` trỏ tới đúng các tệp trong \`src-tauri/icons/\`. Sau khi thay ảnh gốc, hãy chạy lại bước tạo icon rồi mới build, nếu không bộ cài vẫn dùng icon cũ.

## Cấu hình NSIS (\`bundle.windows.nsis\`)

| Khóa | Giá trị | Ý nghĩa |
| --- | --- | --- |
| \`installerIcon\` | \`icons/icon.ico\` | Icon của bộ cài |
| \`uninstallerIcon\` | \`icons/icon.ico\` | Icon của trình gỡ cài đặt |
| \`headerImage\` | ảnh 150×57 | Ảnh tiêu đề ở đầu trang chào của NSIS |
| \`sidebarImage\` | ảnh 164×314 | Ảnh dọc hiện trong lúc cài |
| \`languages\` | \`["Vietnamese", "English"]\` | Ngôn ngữ của bộ cài |
| \`displayLanguageSelector\` | \`true\` | Cho người dùng chọn ngôn ngữ khi cài |
| \`installMode\` | \`currentUser\` | Cài cho người dùng hiện tại, không cần quyền admin |

## Lệnh đóng gói

\`\`\`sh
cd apps/miniapp-ide
corepack pnpm bundle:windows     # tauri build --bundles nsis,msi
\`\`\`

\`beforeBuildCommand\` tự chạy \`prepare:cli\` rồi \`build:web\` trước khi Tauri đóng gói. Đầu ra nằm trong \`src-tauri/target/release/bundle/\`:

\`\`\`text
target/release/bundle/
  nsis/QChat Mini App Studio_1.0.0_x64-setup.exe
  msi/QChat Mini App Studio_1.0.0_x64_en-US.msi
\`\`\`

Bộ cài Windows chưa ký số nên SmartScreen có thể cảnh báo; macOS cần Xcode command-line tools cho \`.dmg\`, Linux tạo \`.deb\`/AppImage. CI \`.github/workflows/miniapp-ide.yml\` chạy các bước này trên cả ba hệ điều hành.`;

const STUDIO_DEV_SETUP = `## Yêu cầu

- Node.js 20 trở lên (khuyến nghị 24)
- pnpm 10 qua Corepack (\`corepack enable\`)
- Rust stable và phụ thuộc hệ thống của Tauri 2 nếu muốn mở shell desktop
- WebView2 (Windows), WKWebView (macOS) hoặc WebKitGTK 4.1 (Linux)

Phần giao diện chạy được trong trình duyệt mà không cần Rust; mọi thao tác với tệp, CLI và watcher đều cần shell Tauri.

## Cài đặt và chạy

\`\`\`sh
corepack pnpm install                                    # tại gốc monorepo
corepack pnpm --filter @qchat/miniapp-ide dev            # UI trong trình duyệt (localhost:1420)
corepack pnpm --filter @qchat/miniapp-ide tauri dev      # ứng dụng desktop đầy đủ
corepack pnpm --filter @qchat/miniapp-ide typecheck      # tsc --noEmit
corepack pnpm --filter @qchat/miniapp-ide build          # typecheck + vite build
\`\`\`

\`beforeDevCommand\` và \`beforeBuildCommand\` tự chạy \`prepare:cli\` để sao chép CLI, esbuild và TypeScript vào \`src-tauri/resources/qapp\`. Thêm \`-- --with-node\` (hoặc đặt \`QAPP_BUNDLE_NODE=1\`) nếu muốn đóng gói kèm Node để máy đích không cần cài Node.

Khi chỉ chạy trong trình duyệt, các thao tác tệp và CLI bị vô hiệu hóa với thông báo "desktop runtime required".

## Biến môi trường

| Biến | Tác dụng |
| --- | --- |
| \`TAURI_DEV_HOST\` | Host để phát triển trên máy khác, ví dụ \`TAURI_DEV_HOST=192.168.1.10 corepack pnpm --filter @qchat/miniapp-ide tauri dev\`; Vite lắng nghe host này và HMR chuyển sang cổng 1421 |
| \`QCHAT_NODE\` | Đường dẫn \`node\` mà shell Tauri sẽ dùng |
| \`QCHAT_CLI\` | Đường dẫn \`cli.js\` của framework |
| \`QAPP_BUNDLE_NODE\` | Tương đương \`prepare:cli --with-node\` |

## Chạy \`qapp\` CLI trong repo

Build framework trước, sau đó gọi trực tiếp CLI đã biên dịch:

\`\`\`sh
corepack pnpm --filter @mna/qchat build
node packages/miniapp-framework/dist/cli.js version
node packages/miniapp-framework/dist/cli.js create my-app
node packages/miniapp-framework/dist/cli.js build --dir my-app
node packages/miniapp-framework/dist/cli.js inspect my-app/dist/my-app-1.0.0.japp
\`\`\`

Từ gốc repo cũng có thể dùng script \`qapp\` (\`corepack pnpm qapp <lệnh>\`). IDE dò CLI theo thứ tự: đường dẫn trong **Cài đặt → CLI & Studio** → biến \`QCHAT_NODE\`/\`QCHAT_CLI\` → tài nguyên đi kèm (\`resources/qapp/cli.js\`) → checkout repo (\`packages/miniapp-framework/dist/cli.js\`) → \`node\` trong \`PATH\`.`;

export const DOC_GROUPS: DocGroup[] = [
  {
    id: "studio",
    titleKey: "docs.groupStudio",
    sections: [
      {
        id: "studio-overview",
        title: "Tổng quan QChat Mini App Studio",
        summary:
          "Kiến trúc Tauri 2 + React 19, cây thư mục source, store Zustand và luồng build .japp.",
        content: STUDIO_OVERVIEW,
      },
      {
        id: "studio-live-preview",
        title: "Xem trước trực tiếp trong Studio",
        summary:
          "Bảng thiết bị chạy bundle thật trong iframe sandbox: host method, quyền, giới hạn và cách xử lý khi lỗi.",
        content: STUDIO_LIVE_PREVIEW,
      },
      {
        id: "studio-realtime",
        title: "Đồng bộ tệp theo thời gian thực",
        summary:
          "Phát hiện thay đổi từ đĩa qua file_stamps/tree_signature, vòng poll ~1.5 giây và xử lý xung đột.",
        content: STUDIO_REALTIME,
      },
      {
        id: "studio-build-release",
        title: "Đóng gói & phát hành (icon, NSIS, tiếng Việt)",
        summary:
          "Tạo icon từ PNG gốc bằng Pillow, cấu hình NSIS tiếng Việt và lệnh bundle:windows.",
        content: STUDIO_BUILD_RELEASE,
      },
      {
        id: "studio-dev-setup",
        title: "Môi trường phát triển",
        summary:
          "Node 20+, pnpm 10, Rust, các lệnh pnpm của IDE và cách chạy qapp CLI trong repo.",
        content: STUDIO_DEV_SETUP,
      },
    ],
  },
  {
    id: "miniapp",
    titleKey: "docs.groupMiniapp",
    sections: [
      {
        id: "miniapp-developer-guide",
        title: "Hướng dẫn phát triển Mini App",
        summary:
          "Hướng dẫn đầy đủ bằng tiếng Việt: kiến trúc, CLI, manifest, vòng đời, JSX, hooks, sự kiện, từng component, API host, đóng gói và kiểm thử.",
        content: guideRaw,
      },
      {
        id: "miniapps",
        title: "Mini App & nền tảng qapp",
        summary:
          "Vòng đời gói .japp, Store API, Developer API, định dạng gói và SDK @mna/qchat.",
        content: miniappsRaw,
      },
      {
        id: "architecture",
        title: "Kiến trúc hệ thống QChat",
        summary:
          "Flutter gọi Next.js REST, Socket.IO realtime, PostgreSQL/Redis/S3 và các ranh giới tin cậy.",
        content: architectureRaw,
      },
      {
        id: "deployment",
        title: "Triển khai & tự vận hành",
        summary:
          "Bật/tắt stack trên VPS bằng Docker Compose, Nginx Proxy Manager, lưu trữ Mini App, sao lưu và khôi phục.",
        content: deploymentRaw,
      },
    ],
  },
];

export function findDoc(id: string): DocSection | undefined {
  for (const group of DOC_GROUPS) {
    const section = group.sections.find((item) => item.id === id);
    if (section) return section;
  }
  return undefined;
}

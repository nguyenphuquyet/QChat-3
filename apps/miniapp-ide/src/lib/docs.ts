// In-app developer documentation for QChat Mini App Studio.
//
// The "studio" group is authored here in Vietnamese and tracks the current
// source. The "miniapp" group is the real repository documentation, imported as
// raw strings so the IDE and the repo can never drift apart. This module is
// deliberately free of React imports: it is plain data.
import wxmlRaw from "../../../../docs/WXML-COMPILER-INTEGRATION.md?raw";
import builtinsRaw from "../../../../docs/BUILTIN-COMPONENTS-AUDIT.md?raw";
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

const STUDIO_OVERVIEW = `QChat Mini App Studio (\`apps/miniapp-ide\`, gói \`@qchat/miniapp-ide\`) là IDE desktop để viết, build và kiểm tra **WeChat Mini Program** chạy trong QChat. Dự án là một project WeChat thật — \`app.json\`, \`app.js\`, \`app.wxss\`, \`pages/<route>/{js,json,wxml,wxss}\` và \`components/<name>/…\` — nên Studio không có định dạng riêng và không tự biên dịch WXML/WXSS. Nó mở project, sửa tệp, rồi gọi đúng CLI \`qchat\`; pipeline Webpack chính thức của \`glass-easel\` mới là thứ tạo ra gói \`.japp\`.

## Kiến trúc

| Lớp | Công nghệ | Nhiệm vụ |
| --- | --- | --- |
| Vỏ desktop | Tauri 2 (Rust) | Cửa sổ không viền, filesystem, chạy CLI, giữ tiến trình \`qchat dev\` |
| Giao diện | React 19 + Vite 8 + TypeScript | Explorer, tab Monaco, panel build, simulator, hộp thoại |
| Trình soạn thảo | Monaco Editor 0.57 | WXML/WXSS (Monarch), JS/TS, JSON schema cho \`app.json\`, page, component và \`manifest.json\` |
| Trạng thái | Zustand 5 | \`useStudio\` — một store duy nhất, persist vào \`localStorage\` |
| Đóng gói | \`qchat\` CLI (\`packages/miniapp-framework/dist/cli.js\`) | Webpack + \`glass-easel\` loaders, kiểm tra project, ghi \`.japp\` |

Luồng dữ liệu một chiều: React gọi \`lib/api.ts\` → \`invoke\` lệnh Rust → Rust chạy \`node cli.js ...\` → kết quả trả về store → panel cập nhật.

## Cây thư mục source

\`\`\`text
apps/miniapp-ide/
  src/
    App.tsx                 khung ứng dụng, phím tắt, vòng poll đồng bộ
    components/             ActivityBar, Sidebar, EditorArea, PreviewPanel, BottomPanel, hộp thoại
    lib/
      api.ts                cầu nối Tauri (invoke, chọn tệp, mở URL)
      miniapp.ts            mô hình project WeChat, chẩn đoán tĩnh, JSON schema, typings
      templates.ts          starter/counter/blank dưới dạng project WeChat đầy đủ
      monaco.ts             ngôn ngữ WXML/WXSS, completion/hover, schema, TS/JSON service
      store.ts              store Zustand: project, tab, chẩn đoán, build, dev, artifact
      i18n.ts, useI18n.ts   đa ngôn ngữ, tiếng Việt mặc định
  src-tauri/
    src/lib.rs              lệnh Rust và vòng đời tiến trình qchat dev
    tauri.conf.json         cấu hình cửa sổ, bundle và NSIS
    icons/                  icon.ico, icon.icns và các PNG
  scripts/prepare-cli.mjs   sao chép CLI framework vào resources
  scripts/generate-icons.py tạo icon.ico/icns/png từ một ảnh PNG gốc
\`\`\`

## Store chính (\`src/lib/store.ts\`)

- Vòng đời dự án: \`bootstrap\`, \`detect\`, \`openProject\`, \`closeProject\`, \`refreshTree\`, \`refreshArtifacts\`.
- Tệp và tab: \`openFile\`, \`setActive\`, \`updateTab\`, \`saveFile\`, \`saveActive\`, \`closeTab\`, \`createEntry\`, \`renameEntry\`, \`deleteEntry\`, \`revealLocation\`/\`consumeReveal\`.
- Chẩn đoán: \`diagnostics\`, \`runDiagnostics\` — chạy lại sau khi mở/lưu/build/validate/tạo/xóa tệp và khi tệp dự án đổi trên đĩa.
- Build và kiểm tra: \`buildProject\`, \`validateProject\`, \`inspectArtifact\`, \`startDev\`, \`stopDev\`, \`runTerminal\`.
- Thiết bị: \`devUrl\`, \`devRevision\`, \`devEvents\`, \`reloadDev\`, \`bumpPreview\`.
- Giao diện: \`setSidebarTab\`, \`setSidebarOpen\`, \`setBottomTab\`, \`setBottomOpen\`, \`setPreviewOpen\`, \`setCursor\`, \`updateSettings\`, \`appendLog\`, \`clearLogs\`.

## Luồng build

\`\`\`text
Ctrl+B → buildProject()
  → api.runCli(["build", "--dir", <project>])
  → Rust run_cli → node cli.js build --dir <project>
  → glass-easel Webpack pipeline (WXML + WXSS loader, official compilers)
  → dist/<slug>-<version>.japp
  → listArtifacts() → inspectArtifact() → qchat inspect
  → Packages: manifest, quyền, kích thước, tệp trong gói
\`\`\`

\`Ctrl+T\` chạy \`qchat validate --dir <project>\` để kiểm tra \`app.json\`, page, component và asset mà không đóng gói. \`F5\` bật/tắt \`qchat dev\`. Không còn build "bỏ typecheck": pipeline chính thức không typecheck JS của tác giả, còn \`validate\` là bước kiểm tra project thật. Tên gói luôn là \`dist/<slug>-<version>.japp\`.

> Nếu CLI chưa sẵn sàng, hãy chạy \`pnpm --filter @mna/qchat build\` (hoặc \`pnpm prepare:cli\`) rồi chọn **Tools → Re-detect CLI**.`;

const STUDIO_LIVE_PREVIEW = `Panel xem trước (**Ctrl+Shift+P** bật/tắt) hiển thị đúng trang mà \`qchat dev\` đang phục vụ. Khi bấm **Dev** (hoặc **F5**), Studio chạy \`qchat dev --dir <project> --port 5273\` và trỏ iframe vào \`http://127.0.0.1:5273/\`. Không có renderer riêng: WXML/WXSS được biên dịch bởi pipeline chính thức, còn \`glass-easel\` chạy trong WebView.

## Luồng xem trước

\`\`\`text
F5 → startDev() → qchat dev --dir <project>
  → buildMiniProgram() ghi .qchat-dev/preview.japp
  → HTTP server 127.0.0.1:5273 (CSP: script/style/img self, connect none)
  → PreviewPanel nạp iframe http://127.0.0.1:5273/
  → host runtime chạy App()/Page()/Component(), gửi sự kiện qua postMessage
  → Studio lọc source === "qchat-miniapp" và hiện ở Console / Network
\`\`\`

Lưu tệp trong project sẽ khiến \`qchat dev\` rebuild (debounce 120 ms); store bắt dòng \`rebuilt …\` trong log, làm mới danh sách gói và remount iframe để thấy bản mới. **Reload** trong panel chỉ remount iframe; **Open in browser** mở cùng URL ra ngoài Studio.

## Ba tab của panel

| Tab | Nội dung |
| --- | --- |
| Simulator | iframe trỏ tới \`qchat dev\`; chỉ có nội dung trang, chrome native do app QChat vẽ khi chạy thật |
| Console | \`console.*\` do host chuyển tiếp: \`{ level, message, at }\` |
| Network | \`wx.request\`/\`fetch\` do host chuyển tiếp: \`request\`, \`response\`, \`error\` kèm method, URL, status, duration |

Mọi message đều có \`source: "qchat-miniapp"\`; Studio cũng kiểm tra \`event.origin\` trước khi nhận, nên một iframe khác không thể giả log.

## Ranh giới và giới hạn

- **Cùng pipeline**: \`qchat dev\` gọi đúng \`buildMiniProgram()\` mà \`qchat build\` dùng, chỉ đổi đích ghi và bỏ bước đóng gói cuối.
- **Không phải thiết bị thật**: WebView của Studio không có thanh điều hướng, tab bar, capsule hay quyền hệ điều hành của app QChat. Những phần đó do Flutter host cung cấp trên máy thật.
- **Không fake API**: API chưa có trong capability registry trả lỗi kèm lý do; app không được giả lập hành vi OS trong JS.
- **Mạng bị chặn bởi CSP**: iframe chỉ cho \`connect-src 'none'\`; \`wx.request\` đi qua bridge của host, còn ảnh \`src\` từ xa chưa được proxy (chỉ \`self\`, \`data:\`, \`blob:\`).
- **Storage**: bản sync (\`wx.getStorageSync\`) chỉ đọc được cache đồng bộ trong phiên; bridge native là async nên không hydrate được lúc khởi động.
- **Built-in**: 21 component trong \`packages/miniapp-framework/builtin\` (view, text, image, button, scroll-view, input, textarea, switch, checkbox, radio, slider, navigator, progress, swiper, picker, form, label, rich-text cùng các group liên quan). Hành vi chưa hoàn chỉnh được ghi trong \`BUILTIN-COMPONENTS-AUDIT.md\`, không được coi là tương thích đầy đủ.

## Khi bản xem trước không chạy

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| "Dev server is not running" | Chưa bấm **Dev**, hoặc \`qchat dev\` thoát vì lỗi build; xem tab Output |
| iframe trắng, Console trống | \`qchat dev\` chưa rebuild xong, hoặc trang không render gì; xem Output của CLI |
| Lỗi đỏ ngay khi mở | \`app.js\`/\`Page()\` ném lỗi lúc khởi động; xem Console và tab Problems |
| Ảnh hiện khung xám | Đường dẫn không nằm trong gói, hoặc URL ngoài bị CSP chặn |
| Sửa tệp mà không đổi | \`qchat dev\` đang build dở; đợi dòng \`rebuilt\` rồi **Reload** |

> Trình mô phỏng dùng theme sáng/tối của Studio cho khung ngoài; màu bên trong trang do WXSS của app quyết định.`;

const STUDIO_PROJECT_MODEL = `Studio hiểu dự án theo đúng quy ước WeChat. \`src/lib/miniapp.ts\` là nguồn sự thật cho mô hình này; \`src/lib/templates.ts\` sinh project mẫu và \`src/lib/monaco.ts\` cấu hình trình soạn thảo từ cùng dữ liệu đó.

## Bố cục dự án

| Tệp | Vai trò |
| --- | --- |
| \`app.json\` | Bắt buộc; \`pages\` là danh sách route, thêm \`window\`, \`tabBar\`, \`usingComponents\` |
| \`app.js\` | Gọi \`App({...})\`; chạy một lần khi Mini Program khởi động |
| \`app.wxss\` | Style toàn cục |
| \`pages/<route>/<name>.{js,json,wxml,wxss}\` | Một page: script, cấu hình, markup, style |
| \`components/<name>/<name>.{js,json,wxml,wxss}\` | Custom component; \`<name>.json\` phải có \`"component": true\` |
| \`manifest.json\` | Metadata cửa hàng QChat: name, version, description, requestedPermissions |
| \`project.config.json\`, \`sitemap.json\` | Tùy chọn, giữ tương thích công cụ WeChat |

\`qchat create\` tạo khung tối thiểu; ba template **starter**, **counter**, **blank** trong Studio ghi đè bằng project đầy đủ (nhiều page, tab bar, custom component ở starter) nên không còn template TSX.

## Chẩn đoán tĩnh

\`diagnoseProject(files)\` chạy sau mỗi lần mở, lưu, build, validate, tạo/xóa tệp và khi project đổi trên đĩa:

- \`app.json\` phải parse được và có \`pages\`; mỗi route phải có \`.wxml\`, \`.js\`, \`.json\`, \`.wxss\`.
- Thẻ WXML phải đóng đúng; \`wx:for\` thiếu \`wx:key\` là cảnh báo.
- Handler trong \`bindtap\`, \`catchtap\`, \`bind:change\`… phải tồn tại trong script cùng page/component, nếu không là cảnh báo.
- \`usingComponents\` phải trỏ tới component thật (đường dẫn tương đối hoặc tuyệt đối trong project).
- Khối WXSS phải đóng đủ ngoặc.
- \`requestedPermissions\` trong \`manifest.json\` phải nằm trong capability registry.

Kết quả nằm ở \`diagnostics\`, hiện trong tab **Problems** cùng output của CLI (\`problems\`). Bấm một dòng sẽ mở đúng tệp và cuộn tới dòng qua \`revealLocation\`.

## Monaco

- \`wxml\` và \`wxss\` là ngôn ngữ riêng, có tokenizer, completion thẻ/thuộc tính và hover cho thẻ built-in.
- \`app.json\`, page JSON, component JSON và \`manifest.json\` có JSON schema riêng, gắn qua \`fileMatch\`.
- JavaScript/TypeScript dùng dịch vụ của Monaco với typings Mini Program (\`wx.*\`, \`Page\`, \`Component\`, \`App\`).
- Marker của chẩn đoán dùng owner \`qchat\`, nên không đè lỗi của TypeScript/JSON service.

## Kiểm thử

\`apps/miniapp-ide/test/miniapp.test.ts\` kiểm tra template, override manifest, danh sách built-in khớp các thư mục \`packages/miniapp-framework/builtin\`, ánh xạ phần mở rộng/ngôn ngữ, schema và từng quy tắc chẩn đoán. Chạy bằng \`pnpm --filter @qchat/miniapp-ide test\`; CI chạy cùng bước này trước khi build web.`;

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
2. Nếu chữ ký đổi, gọi \`file_stamps\` cho các tab đang mở (và cả \`app.json\`/\`manifest.json\`, kể cả khi chưa mở trong tab) rồi \`refreshTree()\` để cập nhật Explorer cùng panel Packages.
3. So sánh mốc sửa đổi/kích thước mới với giá trị IDE đã lưu cho từng tab; sau đó \`runDiagnostics()\` phân tích lại project.

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
corepack pnpm --filter @qchat/miniapp-ide test           # mô hình project + chẩn đoán
corepack pnpm --filter @qchat/miniapp-ide build          # typecheck + vite build
\`\`\`

\`beforeDevCommand\` và \`beforeBuildCommand\` tự chạy \`prepare:cli\` để sao chép CLI framework vào \`src-tauri/resources/qapp\`. Thêm \`-- --with-node\` (hoặc đặt \`QAPP_BUNDLE_NODE=1\`) nếu muốn đóng gói kèm Node để máy đích không cần cài Node.

Khi chỉ chạy trong trình duyệt, các thao tác tệp và CLI bị vô hiệu hóa với thông báo "desktop runtime required".

## Biến môi trường

| Biến | Tác dụng |
| --- | --- |
| \`TAURI_DEV_HOST\` | Host để phát triển trên máy khác, ví dụ \`TAURI_DEV_HOST=192.168.1.10 corepack pnpm --filter @qchat/miniapp-ide tauri dev\`; Vite lắng nghe host này và HMR chuyển sang cổng 1421 |
| \`QCHAT_NODE\` | Đường dẫn \`node\` mà shell Tauri sẽ dùng |
| \`QCHAT_CLI\` | Đường dẫn \`cli.js\` của framework |
| \`QAPP_BUNDLE_NODE\` | Tương đương \`prepare:cli --with-node\` |

## Chạy \`qchat\` CLI trong repo

Build framework trước, sau đó gọi trực tiếp CLI đã biên dịch:

\`\`\`sh
corepack pnpm --filter @mna/qchat build
node packages/miniapp-framework/dist/cli.js version
node packages/miniapp-framework/dist/cli.js create my-app
node packages/miniapp-framework/dist/cli.js build --dir my-app
node packages/miniapp-framework/dist/cli.js dev --dir my-app
node packages/miniapp-framework/dist/cli.js validate --dir my-app
node packages/miniapp-framework/dist/cli.js inspect my-app/dist/my-app-1.0.0.japp
\`\`\`

\`--dir\` là dạng tường minh của tham số thư mục; Studio luôn dùng nó và nó thắng tham số vị trí. IDE dò CLI theo thứ tự: đường dẫn trong **Cài đặt → CLI & Studio** → biến \`QCHAT_NODE\`/\`QCHAT_CLI\` → tài nguyên đi kèm (\`resources/qapp/cli.js\`) → checkout repo (\`packages/miniapp-framework/dist/cli.js\`) → \`node\` trong \`PATH\`.

## Kiểm thử trước khi gửi PR

\`\`\`sh
corepack pnpm --filter @mna/qchat test        # framework, chạy tuần tự
corepack pnpm --filter @qchat/miniapp-ide test
corepack pnpm --filter @qchat/miniapp-ide typecheck
corepack pnpm --filter @qchat/miniapp-ide build:web
\`\`\`

Thiết bị Android/iOS cần chạy thật trên máy ảo hoặc máy thật; máy build không có thiết bị thì không được tuyên bố tương thích.`;

export const DOC_GROUPS: DocGroup[] = [
  {
    id: "studio",
    titleKey: "docs.groupStudio",
    sections: [
      {
        id: "studio-overview",
        title: "Tổng quan QChat Mini App Studio",
        summary:
          "Kiến trúc Tauri 2 + React 19, cây thư mục source, store Zustand, luồng build .japp và validate project WeChat.",
        content: STUDIO_OVERVIEW,
      },
      {
        id: "studio-project-model",
        title: "Mô hình dự án WeChat & chẩn đoán",
        summary:
          "Bố cục app/pages/components, template starter/counter/blank, quy tắc chẩn đoán tĩnh, Monaco và kiểm thử.",
        content: STUDIO_PROJECT_MODEL,
      },
      {
        id: "studio-live-preview",
        title: "Xem trước trực tiếp trong Studio",
        summary:
          "Simulator trỏ tới qchat dev, ba tab Simulator/Console/Network, sự kiện host và các giới hạn đã biết.",
        content: STUDIO_LIVE_PREVIEW,
      },
      {
        id: "studio-realtime",
        title: "Đồng bộ tệp theo thời gian thực",
        summary:
          "Phát hiện thay đổi từ đĩa qua file_stamps/tree_signature, vòng poll ~1.5 giây, chẩn đoán lại và xử lý xung đột.",
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
          "Node 20+, pnpm 10, Rust, các lệnh pnpm của IDE, qchat CLI với --dir và bộ kiểm thử trước khi gửi PR.",
        content: STUDIO_DEV_SETUP,
      },
    ],
  },
  {
    id: "miniapp",
    titleKey: "docs.groupMiniapp",
    sections: [
      {
        id: "wxml-integration",
        title: "Tích hợp WXML & glass-easel",
        summary:
          "Quyết định dùng hệ sinh thái WeChat chính thức: pipeline build, compiler, bằng chứng kiểm chứng và những gì không được phép làm.",
        content: wxmlRaw,
      },
      {
        id: "builtin-audit",
        title: "Kiểm toán component built-in",
        summary:
          "Danh sách 21 component host, thuộc tính/sự kiện đã có, phần chưa hoàn chỉnh và API chưa hỗ trợ.",
        content: builtinsRaw,
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

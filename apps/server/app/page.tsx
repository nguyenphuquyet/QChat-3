import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Download,
  FileArchive,
  Globe2,
  PackageCheck,
  ShieldCheck,
  Users,
} from "lucide-react";
import { readSiteLinks } from "../src/services/site-links";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "QChat — Nhắn tin riêng tư, mở rộng bằng Mini Apps",
  description:
    "QChat là ứng dụng nhắn tin thời gian thực: bạn bè, khoảnh khắc, thanh toán, media riêng tư và nền tảng Mini App cho nhà phát triển.",
};

const features = [
  {
    icon: Activity,
    title: "Nhắn tin thời gian thực",
    body: "Tin nhắn, xác nhận đã gửi/đã đọc, trạng thái đang gõ, trích dẫn, thu hồi và gửi lại khi mất mạng. Gateway Socket.IO riêng, chống gửi trùng bằng client ID.",
  },
  {
    icon: FileArchive,
    title: "Media riêng tư",
    body: "Ảnh, video và tệp nằm trong bucket private. Trình duyệt nhận URL có chữ ký hết hạn nhanh, không có link công khai và không lộ đường dẫn lưu trữ.",
  },
  {
    icon: Users,
    title: "Bạn bè & Khoảnh khắc",
    body: "Kết bạn, chấp nhận lời mời, chặn, xem khoảnh khắc theo quyền riêng tư và nhận thông báo trong ứng dụng.",
  },
  {
    icon: Boxes,
    title: "Nền tảng Mini App",
    body: "Đóng gói ứng dụng nhỏ chạy trong QChat. Developer Center quản lý build bất biến, quyền truy cập, phiên bản phát hành và số liệu sử dụng.",
  },
  {
    icon: ShieldCheck,
    title: "Phiên đăng nhập & quản trị",
    body: "Phiên bền vững có thể thu hồi từ xa, refresh token lưu an toàn, nhật ký audit và công cụ quản trị tách riêng khỏi người dùng thường.",
  },
  {
    icon: Globe2,
    title: "Một mã nguồn, mọi nền tảng",
    body: "Flutter cho Android, iOS và web: cùng giao diện, cache theo từng tài khoản, mở lại ứng dụng là thấy dữ liệu đã tải trước đó.",
  },
];

const steps = [
  {
    title: "Tạo ứng dụng",
    body: "Đăng nhập Developer Center bằng tài khoản QChat, khai báo tên, danh mục và quyền cần dùng.",
  },
  {
    title: "Tải build & chờ duyệt",
    body: "Gói ZIP bất biến kèm manifest và checksum SHA-256. Quản trị viên duyệt trước khi phát hành.",
  },
  {
    title: "Phát hành & theo dõi",
    body: "Phát hành cho người dùng, theo dõi lượt mở, lỗi runtime và thu hồi phiên bản khi cần.",
  },
];

export default async function LandingPage() {
  const links = await readSiteLinks();
  const web = links.find((link) => link.platform === "web")!;
  const android = links.find((link) => link.platform === "android")!;
  const ios = links.find((link) => link.platform === "ios")!;
  const webReady = web.enabled && web.url.length > 0;

  const downloads = [
    {
      link: web,
      icon: Globe2,
      fallbackNote:
        "Ứng dụng chat trên trình duyệt đang được hoàn thiện. Bản web sẽ mở ngay tại đây khi được cấu hình.",
      action: webReady ? "Mở QChat" : "Sắp ra mắt",
    },
    {
      link: android,
      icon: Download,
      fallbackNote:
        "Tải APK trong mục Artifacts của workflow Flutter app trên GitHub.",
      action: "Tải APK",
    },
    {
      link: ios,
      icon: PackageCheck,
      fallbackNote:
        "IPA chưa ký, cần ký bằng chứng chỉ của bạn trước khi cài lên iPhone.",
      action: "Tải bản iOS",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f5f7f8]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight"
            href="/"
          >
            <span className="rounded-xl bg-[#0c3b2f] p-1.5 text-emerald-300">
              <Boxes size={19} />
            </span>
            QChat
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a className="hover:text-emerald-700" href="#tinh-nang">
              Tính năng
            </a>
            <a className="hover:text-emerald-700" href="#mini-apps">
              Mini Apps
            </a>
            <a className="hover:text-emerald-700" href="#tai-app">
              Tải app
            </a>
            <a className="hover:text-emerald-700" href="/developer">
              Developer Center
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              className="hidden rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 sm:inline-flex"
              href="/developer"
            >
              Dành cho nhà phát triển
            </a>
            <a
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
              href={webReady ? web.url : "#tai-app"}
            >
              {webReady ? "Mở QChat" : "Tải app"} <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#0c3b2f] text-white">
          <div
            aria-hidden
            className="absolute -right-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-48 -left-24 h-[26rem] w-[26rem] rounded-full bg-teal-300/10 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-emerald-200">
                <ShieldCheck size={14} /> Nhắn tin riêng tư · Mini Apps
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Trò chuyện, chia sẻ và mở rộng QChat theo cách của bạn.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/75">
                QChat gom nhắn tin thời gian thực, bạn bè, khoảnh khắc, thanh toán và
                một nền tảng ứng dụng nhỏ vào cùng một chỗ. Dữ liệu nằm trên máy chủ
                của bạn, không phụ thuộc dịch vụ bên thứ ba.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#0c3b2f] transition hover:bg-emerald-300"
                  href={webReady ? web.url : "#tai-app"}
                >
                  {webReady ? "Mở QChat trên web" : "Tải app cho điện thoại"}
                  <ArrowRight size={17} />
                </a>
                <a
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:border-emerald-300 hover:text-emerald-200"
                  href="/developer"
                >
                  <Boxes size={17} /> Xây dựng Mini App
                </a>
              </div>
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-sm text-emerald-100/70">
                <div>
                  <dt className="text-xs uppercase tracking-[.16em] text-emerald-300/60">
                    Nền tảng
                  </dt>
                  <dd className="mt-1 font-semibold text-white">
                    Android · iOS · Web
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[.16em] text-emerald-300/60">
                    Kết nối
                  </dt>
                  <dd className="mt-1 font-semibold text-white">HTTPS / WSS</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[.16em] text-emerald-300/60">
                    Lưu trữ
                  </dt>
                  <dd className="mt-1 font-semibold text-white">
                    Máy chủ tự vận hành
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/15 bg-white/5 p-4 shadow-2xl backdrop-blur">
                <div className="rounded-2xl bg-[#0a3329] p-5">
                  <div className="flex items-center justify-between text-xs text-emerald-200/70">
                    <span className="font-bold uppercase tracking-[.18em]">
                      Hộp thư
                    </span>
                    <span>Đang hoạt động</span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {[
                      ["Minh Anh", "Đã gửi ảnh cho bạn", "Vừa xong"],
                      ["Nhóm Dự án QChat", "Mai họp lúc 9h nhé", "2 phút"],
                      ["Tuấn", "👍", "14 phút"],
                    ].map(([name, text, time]) => (
                      <li
                        key={name}
                        className="flex items-center gap-3 rounded-xl bg-white/[.06] px-3.5 py-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-400/20 text-xs font-bold text-emerald-200">
                          {name.replace("Nhóm ", "").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-white">
                              {name}
                            </span>
                            <span className="shrink-0 text-[11px] text-emerald-200/50">
                              {time}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-emerald-100/60">
                            {text}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3.5 py-3 text-xs text-emerald-100/80">
                    <CheckCircle2 className="text-emerald-300" size={15} />
                    Tin nhắn được lưu bền vững và đồng bộ lại sau khi mất kết nối.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20" id="tinh-nang">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">
              Tính năng
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Đủ thứ cần cho một ứng dụng trò chuyện thật
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                key={title}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white py-20" id="mini-apps">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">
                  Mini Apps
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Biến QChat thành nền tảng của riêng bạn
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Viết ứng dụng bằng web tiêu chuẩn, đóng gói ZIP và phát hành qua
                  Developer Center. Mỗi bản build là bất biến, có checksum và được
                  duyệt trước khi tới người dùng.
                </p>
                <a
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#0c3b2f] px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
                  href="/developer"
                >
                  Vào Developer Center <ArrowRight size={17} />
                </a>
              </div>
              <ol className="space-y-4">
                {steps.map((step, index) => (
                  <li
                    className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5"
                    key={step.title}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-extrabold text-white">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{step.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        {step.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20" id="tai-app">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">
              Tải ứng dụng
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Chọn nền tảng bạn đang dùng
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Các liên kết dưới đây do quản trị viên cấu hình, nên luôn trỏ tới bản
              build mới nhất.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {downloads.map(({ link, icon: Icon, fallbackNote, action }) => {
              const ready = link.enabled && link.url.length > 0;
              return (
                <article
                  className={`flex flex-col rounded-2xl border bg-white p-6 ${
                    ready ? "border-emerald-200 shadow-sm" : "border-slate-200"
                  }`}
                  key={link.platform}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      ready
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon size={21} />
                  </span>
                  <h3 className="mt-4 flex items-center gap-2 text-base font-bold">
                    {link.label}
                    {!ready && link.platform === "web" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                        Todo
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                    {link.note || fallbackNote}
                  </p>
                  {ready ? (
                    <a
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                      href={link.url}
                      rel={link.url.startsWith("http") ? "noreferrer" : undefined}
                      target={link.url.startsWith("http") ? "_blank" : undefined}
                    >
                      {action} <ArrowRight size={16} />
                    </a>
                  ) : (
                    <span className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-400">
                      {action}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-extrabold">
              <span className="rounded-lg bg-[#0c3b2f] p-1 text-emerald-300">
                <Boxes size={15} />
              </span>
              QChat
            </p>
            <p className="mt-2 text-xs text-slate-500">
              chat.nguyenphuquyet.online · © {new Date().getFullYear()} QChat
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-600">
            <a className="hover:text-emerald-700" href="#tai-app">
              Tải ứng dụng
            </a>
            <a className="hover:text-emerald-700" href="/developer">
              Developer Center
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

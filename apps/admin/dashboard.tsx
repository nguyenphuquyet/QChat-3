"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileClock,
  Flag,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type Section = "overview" | "users" | "reports" | "audit" | "system";
type Session = { accessToken: string; refreshToken: string; userId: string };
type Stats = {
  users: number;
  messages: number;
  storage: number;
  conversations: number;
  disabledUsers: number;
  pendingReports: number;
  activeSessions: number;
  activity: { date: string; messages: number }[];
};
type User = {
  id: string;
  nickname: string;
  qchatId: string;
  email: string;
  role: string;
  disabled: boolean;
  createdAt: string;
};
type Report = {
  id: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
};
type Audit = {
  id: string;
  action: string;
  actorId: string;
  targetId: string;
  createdAt: string;
};
const navigation: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "users", label: "Người dùng", icon: Users },
  { id: "reports", label: "Báo cáo vi phạm", icon: Flag },
  { id: "audit", label: "Nhật ký quản trị", icon: FileClock },
  { id: "system", label: "Hệ thống", icon: Server },
];
const number = (value: number) => value.toLocaleString("vi-VN");
const date = (value: string) => new Date(value).toLocaleString("vi-VN");
const bytes = (value: number) =>
  value < 1024 ** 3
    ? `${(value / 1024 ** 2).toFixed(1)} MB`
    : `${(value / 1024 ** 3).toFixed(2)} GB`;
const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50";
const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50";
const primaryStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50";

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_0_#162e2610] ${className}`}
    >
      {children}
    </section>
  );
}
function Badge({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${warning ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      {children}
    </span>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-slate-500">
      <CheckCircle2 className="h-9 w-9 text-emerald-400" />
      {children}
    </div>
  );
}
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return (
    (
      {
        INVALID_CREDENTIALS: "Tài khoản hoặc mật khẩu không đúng.",
        FORBIDDEN: "Tài khoản này không có quyền quản trị.",
        INVALID_REFRESH: "Phiên đã bị thu hồi. Vui lòng đăng nhập lại.",
        SELF_LOCK: "Bạn không thể khóa tài khoản đang sử dụng.",
        RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      } as Record<string, string>
    )[code] ?? "Không thực hiện được yêu cầu. Vui lòng thử lại."
  );
}

export default function Dashboard() {
  const session = useRef<Session | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [sidebar, setSidebar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [confirm, setConfirm] = useState<User | null>(null);
  const revision = useRef(0);

  async function raw(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
  ) {
    return fetch(`/api${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function api(path: string, method = "GET", body?: unknown) {
    let response = await raw(path, method, body, session.current?.accessToken);
    if (response.status === 401 && session.current) {
      if (!refreshing.current)
        refreshing.current = (async () => {
          const current = session.current!;
          const refresh = await raw("/auth/refresh", "POST", {
            refreshToken: current.refreshToken,
          });
          if (!refresh.ok) {
            if (refresh.status === 401) {
              session.current = null;
              setSignedIn(false);
            }
            throw new Error("INVALID_REFRESH");
          }
          session.current = await refresh.json();
        })().finally(() => {
          refreshing.current = null;
        });
      await refreshing.current;
      response = await raw(path, method, body, session.current?.accessToken);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function load(target = section) {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      if (target === "overview") {
        const [summary, reportRows] = await Promise.all([
          api("/admin/stats"),
          api("/admin/reports"),
        ]);
        if (current !== revision.current) return;
        setStats(summary);
        setReports(reportRows);
      } else if (target === "users") {
        const result = await api(
          `/admin/users?page=${page}&q=${encodeURIComponent(search)}`,
        );
        if (current !== revision.current) return;
        setUsers(result.items);
        setTotal(result.total);
      } else if (target === "reports") {
        const result = await api("/admin/reports");
        if (current !== revision.current) return;
        setReports(result);
      } else if (target === "audit") {
        const result = await api("/admin/audit");
        if (current !== revision.current) return;
        setAudit(result);
      } else {
        const result = await raw("/health");
        const body = await result.json();
        if (current !== revision.current) return;
        setHealthy(result.ok && body.ok === true);
      }
      setUpdated(new Date());
    } catch (e) {
      if (current === revision.current) setError(failure(e));
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, section, page, search]);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const response = await raw("/auth/login", "POST", {
        identifier,
        password,
        deviceName: "QChat Admin",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      session.current = data;
      try {
        setStats(await api("/admin/stats"));
      } catch (e) {
        await raw("/auth/logout", "POST", {}, data.accessToken);
        session.current = null;
        throw e;
      }
      setPassword("");
      setSignedIn(true);
      setSection("overview");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setActionBusy(true);
    try {
      await api("/auth/logout", "POST", {});
      revision.current++;
      session.current = null;
      setSignedIn(false);
      setStats(null);
      setUsers([]);
      setReports([]);
      setAudit([]);
      setNotice("");
      setError("");
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  async function act(path: string, body: unknown) {
    setActionBusy(true);
    setNotice("");
    try {
      await api(path, "PATCH", body);
      setConfirm(null);
      setNotice("Đã cập nhật thành công.");
      await load();
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  function navigate(value: Section) {
    setSection(value);
    setSidebar(false);
    setNotice("");
    setError("");
  }
  const currentNav = navigation.find((item) => item.id === section)!;
  const openReports = reports.filter((row) => row.status === "OPEN");

  if (!signedIn)
    return (
      <main className="min-h-screen bg-[#f6f8f7] p-5 sm:p-10 lg:flex lg:items-center lg:justify-center">
        <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 lg:grid-cols-2">
          <section className="relative flex flex-col justify-between overflow-hidden bg-[#103d30] p-8 text-white sm:p-12">
            <div className="absolute -right-32 top-20 h-80 w-80 rounded-full border-[60px] border-emerald-300/5" />
            <div className="relative flex items-center gap-3 text-2xl font-extrabold">
              <span className="rounded-xl bg-emerald-400 p-2 text-[#103d30]">
                <MessageCircle size={25} fill="currentColor" />
              </span>
              QChat
              <span className="text-sm font-normal text-emerald-100/50">
                / admin
              </span>
            </div>
            <div className="relative my-14">
              <span className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">
                Không gian quản trị
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
                Mọi kết nối.
                <br />
                Một nơi quản lý.
              </h1>
              <p className="mt-5 max-w-xs text-sm leading-7 text-emerald-50/65">
                Theo dõi hoạt động, chăm sóc cộng đồng và giữ QChat vận hành ổn
                định.
              </p>
            </div>
            <div className="relative flex items-center gap-2 text-xs text-emerald-100/60">
              <ShieldCheck size={17} />
              Dành riêng cho quản trị viên được cấp quyền
            </div>
          </section>
          <section className="flex flex-col justify-center p-8 sm:p-12">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <LockKeyhole size={24} />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Chào mừng trở lại
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Đăng nhập để quản lý hệ thống QChat.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
              className="mt-8 space-y-5"
            >
              <label className="block text-sm font-semibold">
                QChat ID hoặc email
                <input
                  className={`${inputStyle} mt-2`}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  placeholder="Nhập tài khoản quản trị"
                  required
                />
              </label>
              <label className="block text-sm font-semibold">
                Mật khẩu
                <input
                  className={`${inputStyle} mt-2`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  required
                />
              </label>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <button className={`${primaryStyle} w-full`} disabled={busy}>
                {busy ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <>
                    Đăng nhập <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            <p className="mt-8 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-400">
              Quản trị viên quản lý tài khoản và báo cáo. Nội dung tin nhắn
              riêng tư không hiển thị trong bảng quản trị.
            </p>
          </section>
        </div>
      </main>
    );

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-[#20362f]">
      {sidebar && (
        <button
          aria-label="Đóng thanh điều hướng"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#103d30] px-5 py-8 text-white transition-transform lg:translate-x-0 ${sidebar ? "translate-x-0" : "-translate-x-full"}`}
      >
        <a
          href="/admin"
          className="flex items-center gap-3 px-3 text-2xl font-extrabold"
        >
          <span className="rounded-xl bg-emerald-400 p-2 text-[#103d30]">
            <MessageCircle size={23} fill="currentColor" />
          </span>
          QChat
          <span className="self-end pb-1 text-[10px] font-medium uppercase tracking-widest text-emerald-200/60">
            Admin
          </span>
        </a>
        <p className="mb-4 mt-12 px-4 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/40">
          Không gian làm việc
        </p>
        <nav aria-label="Quản trị" className="space-y-2">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={section === id ? "page" : undefined}
              onClick={() => navigate(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition ${section === id ? "bg-emerald-400 text-[#103d30] shadow-lg shadow-black/5" : "text-emerald-50/65 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon size={19} />
              {label}
              {id === "reports" && (stats?.pendingReports ?? 0) > 0 && (
                <span className="ml-auto rounded-md bg-white/15 px-1.5 text-xs">
                  {stats!.pendingReports}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <ShieldCheck className="mb-3 text-emerald-300" size={22} />
          <p className="text-sm font-semibold">Quản lý có trách nhiệm</p>
          <p className="mt-2 text-xs leading-5 text-emerald-50/50">
            Thay đổi tài khoản và báo cáo được ghi lại trong nhật ký.
          </p>
        </div>
        <button
          onClick={() => void logout()}
          disabled={actionBusy}
          className="mt-5 flex items-center gap-3 px-4 py-3 text-sm text-emerald-50/65 hover:text-white"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 backdrop-blur sm:px-9">
          <div className="flex items-center gap-3">
            <button
              aria-label="Mở điều hướng"
              className="lg:hidden"
              onClick={() => setSidebar(true)}
            >
              <Menu size={22} />
            </button>
            <span className="hidden text-sm text-slate-400 sm:inline">
              Không gian quản trị
            </span>
            <ChevronRight
              size={14}
              className="hidden text-slate-300 sm:block"
            />
            <span className="text-sm font-semibold">{currentNav.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:block">
              Quản trị viên
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e3eee8] font-bold text-[#245e47]">
              {identifier.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-9 sm:py-10">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-emerald-600">
                QChat console
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {currentNav.label}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {section === "overview"
                  ? "Một góc nhìn rõ ràng về cộng đồng của bạn."
                  : section === "users"
                    ? "Tìm kiếm và quản lý quyền truy cập tài khoản."
                    : section === "reports"
                      ? "Xem xét phản ánh để cộng đồng an toàn hơn."
                      : section === "audit"
                        ? "Theo dõi các thay đổi do quản trị viên thực hiện."
                        : "Kiểm tra khả năng phục vụ của hệ thống."}
              </p>
            </div>
            <button
              className={buttonStyle}
              onClick={() => void load()}
              disabled={busy}
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              <Check size={16} />
              {notice}
            </p>
          )}
          {busy && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 text-xs text-slate-500"
            >
              <Loader2 size={14} className="animate-spin" />
              Đang cập nhật dữ liệu…
            </div>
          )}

          {section === "overview" && stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Tổng người dùng",
                    value: number(stats.users),
                    detail: `${number(stats.disabledUsers)} tài khoản bị khóa`,
                    icon: Users,
                  },
                  {
                    label: "Tin nhắn đã gửi",
                    value: number(stats.messages),
                    detail: `${number(stats.conversations)} cuộc trò chuyện`,
                    icon: MessagesSquare,
                  },
                  {
                    label: "Dung lượng media",
                    value: bytes(stats.storage),
                    detail: "Tổng dung lượng tệp đã ghi nhận",
                    icon: Database,
                  },
                  {
                    label: "Báo cáo chờ xử lý",
                    value: number(stats.pendingReports),
                    detail: "Cần quản trị viên xem xét",
                    icon: Flag,
                  },
                ].map(({ label, value, detail, icon: Icon }) => (
                  <Card key={label} className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">
                        {label}
                      </span>
                      <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                        <Icon size={18} />
                      </span>
                    </div>
                    <p className="mt-5 text-3xl font-extrabold tracking-tight">
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{detail}</p>
                  </Card>
                ))}
              </div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.8fr_1fr]">
                <Card className="p-6">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Hoạt động tin nhắn</h2>
                      <p className="mt-1 text-xs text-slate-400">
                        7 ngày gần nhất · ngày theo UTC
                      </p>
                    </div>
                    <Badge>7 ngày</Badge>
                  </div>
                  <div className="mt-8 flex h-48 items-end gap-3 sm:gap-5">
                    {stats.activity.map((day) => (
                      <div
                        key={day.date}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-[10px] font-semibold text-slate-500">
                          {number(day.messages)}
                        </span>
                        <div
                          title={`${date(day.date)}: ${number(day.messages)} tin nhắn`}
                          className="w-full max-w-12 rounded-t-lg bg-emerald-400 transition-all hover:bg-emerald-500"
                          style={{
                            height: `${Math.max(day.messages ? 3 : 0, (day.messages / Math.max(1, ...stats.activity.map((d) => d.messages))) * 130)}px`,
                          }}
                        />
                        <span className="text-[10px] text-slate-400">
                          {new Date(day.date).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            timeZone: "UTC",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="flex flex-col p-6">
                  <span className="mb-5 w-fit rounded-xl bg-emerald-50 p-3 text-emerald-600">
                    <ShieldCheck size={25} />
                  </span>
                  <h2 className="text-lg font-bold">Phiên & quyền riêng tư</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    <strong className="text-[#20362f]">
                      {number(stats.activeSessions)}
                    </strong>{" "}
                    phiên đăng nhập còn hiệu lực. Đây là số phiên được cấp
                    quyền, không phải số người đang online.
                  </p>
                  <div className="mt-auto border-t border-slate-100 pt-5 text-xs leading-6 text-slate-400">
                    Bảng quản trị không truy cập nội dung tin nhắn riêng tư.
                  </div>
                </Card>
              </div>
              <Card className="mt-6">
                <div className="flex items-center justify-between border-b border-slate-100 p-6">
                  <div>
                    <h2 className="font-bold">Cần bạn xem xét</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Báo cáo đang mở trong 100 báo cáo mới nhất
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("reports")}
                    className="flex items-center gap-2 text-xs font-bold text-emerald-600"
                  >
                    Xem tất cả <ArrowRight size={15} />
                  </button>
                </div>
                {openReports.length === 0 ? (
                  <Empty>
                    Không có báo cáo đang mở trong danh sách gần đây.
                  </Empty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {openReports.slice(0, 4).map((row) => (
                      <div key={row.id} className="flex items-center gap-4 p-5">
                        <span className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                          <Flag size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {row.reason}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {date(row.createdAt)}
                          </p>
                        </div>
                        <Badge warning>Chờ xử lý</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {section === "users" && (
            <Card>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(query.trim());
                }}
                className="flex flex-wrap gap-3 border-b border-slate-100 p-5"
              >
                <div className="relative min-w-48 flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />
                  <input
                    aria-label="Tìm người dùng"
                    className={`${inputStyle} pl-10`}
                    value={query}
                    maxLength={100}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm theo tên, QChat ID hoặc email…"
                  />
                </div>
                <button className={buttonStyle}>Tìm kiếm</button>
              </form>
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50/70 text-xs text-slate-500">
                    <tr>
                      {[
                        "Người dùng",
                        "Email",
                        "Trạng thái",
                        "Vai trò",
                        "Thao tác",
                      ].map((label) => (
                        <th key={label} className="px-5 py-4 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <p className="font-semibold">{user.nickname}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            @{user.qchatId}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {user.email}
                        </td>
                        <td className="px-5 py-4">
                          <Badge warning={user.disabled}>
                            {user.disabled ? "Đã khóa" : "Hoạt động"}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {user.role === "ADMIN"
                            ? "Quản trị viên"
                            : "Thành viên"}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            className="text-xs font-semibold text-emerald-700 disabled:text-slate-400"
                            disabled={
                              user.id === session.current?.userId || actionBusy
                            }
                            onClick={() => setConfirm(user)}
                          >
                            {user.id === session.current?.userId
                              ? "Bạn"
                              : user.disabled
                                ? "Mở khóa"
                                : "Khóa tài khoản"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!busy && users.length === 0 && (
                <Empty>Không tìm thấy người dùng phù hợp.</Empty>
              )}
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
                <span>
                  {number(total)} người dùng · Trang {page}/
                  {Math.max(1, Math.ceil(total / 20))}
                </span>
                <div className="flex gap-2">
                  <button
                    aria-label="Trang trước"
                    className={buttonStyle}
                    disabled={page === 1 || busy}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    aria-label="Trang sau"
                    className={buttonStyle}
                    disabled={page * 20 >= total || busy}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {section === "reports" && (
            <Card>
              <div className="border-b border-slate-100 p-5">
                <h2 className="font-bold">Báo cáo gần đây</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Tối đa 100 báo cáo mới nhất
                </p>
              </div>
              {reports.length === 0 && !busy ? (
                <Empty>Chưa có báo cáo nào.</Empty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-start gap-5 p-5"
                    >
                      <span className="rounded-xl bg-amber-50 p-3 text-amber-600">
                        <Flag size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm font-semibold">
                          {row.reason}
                        </p>
                        <p className="mt-2 break-all text-xs text-slate-400">
                          Đối tượng: {row.targetId}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {date(row.createdAt)}
                        </p>
                        <div className="mt-3">
                          <Badge warning={row.status === "OPEN"}>
                            {row.status === "OPEN"
                              ? "Chờ xử lý"
                              : row.status === "RESOLVED"
                                ? "Đã xử lý"
                                : "Đã bỏ qua"}
                          </Badge>
                        </div>
                      </div>
                      {row.status === "OPEN" && (
                        <div className="flex gap-2">
                          <button
                            disabled={actionBusy}
                            className={buttonStyle}
                            onClick={() =>
                              void act(`/admin/reports/${row.id}`, {
                                status: "DISMISSED",
                              })
                            }
                          >
                            Bỏ qua
                          </button>
                          <button
                            disabled={actionBusy}
                            className={primaryStyle}
                            onClick={() =>
                              void act(`/admin/reports/${row.id}`, {
                                status: "RESOLVED",
                              })
                            }
                          >
                            <Check size={15} />
                            Đã xử lý
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {section === "audit" && (
            <Card>
              <div className="border-b border-slate-100 p-5">
                <h2 className="font-bold">Lịch sử thao tác</h2>
                <p className="mt-1 text-xs text-slate-400">
                  100 thay đổi gần nhất · ghi nhận tự động
                </p>
              </div>
              {audit.length === 0 && !busy ? (
                <Empty>Chưa có thao tác quản trị được ghi nhận.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {[
                          "Thao tác",
                          "Người thực hiện",
                          "Đối tượng",
                          "Thời gian",
                        ].map((label) => (
                          <th key={label} className="px-5 py-4">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {audit.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold">
                            {(
                              {
                                USER_LOCK: "Khóa tài khoản",
                                USER_UNLOCK: "Mở khóa tài khoản",
                                REPORT_RESOLVED: "Xử lý báo cáo",
                                REPORT_DISMISSED: "Bỏ qua báo cáo",
                              } as Record<string, string>
                            )[row.action] ?? row.action}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {row.actorId}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {row.targetId}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                            {date(row.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {section === "system" && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-7">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                    <Activity size={25} />
                  </span>
                  {healthy !== null && (
                    <Badge warning={!healthy}>
                      {healthy ? "Sẵn sàng phục vụ" : "Cần kiểm tra"}
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg font-bold">API & kết nối dữ liệu</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Kiểm tra API, truy vấn PostgreSQL và kết nối Redis trong cùng
                  một yêu cầu.
                </p>
                <button
                  onClick={() => void load("system")}
                  disabled={busy}
                  className={`${buttonStyle} mt-6`}
                >
                  <RefreshCw size={15} />
                  Kiểm tra lại
                </button>
              </Card>
              <Card className="p-7">
                <Database className="mb-6 text-emerald-600" size={28} />
                <h2 className="text-lg font-bold">Dữ liệu & lưu trữ</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Tin nhắn được lưu trong PostgreSQL, tệp đính kèm lưu trong kho
                  riêng tư. Trạng thái sức khỏe này không bao gồm kiểm tra kho
                  tệp.
                </p>
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600"
                >
                  Xem phản hồi API <ArrowRight size={16} />
                </a>
              </Card>
            </div>
          )}
          <footer className="mt-8 flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
            <span>QChat · Không gian quản trị</span>
            <span>
              {updated
                ? `Cập nhật lúc ${updated.toLocaleTimeString("vi-VN")}`
                : "Chưa tải dữ liệu"}
            </span>
          </footer>
        </main>
      </div>
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
          onClick={() => !actionBusy && setConfirm(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-xl font-bold">
              {confirm.disabled ? "Mở khóa" : "Khóa"} tài khoản?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {confirm.nickname} (@{confirm.qchatId}){" "}
              {confirm.disabled
                ? "sẽ có thể truy cập QChat trở lại."
                : "sẽ không thể truy cập QChat cho đến khi được mở khóa."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                className={buttonStyle}
                disabled={actionBusy}
                onClick={() => setConfirm(null)}
              >
                Hủy
              </button>
              <button
                className={primaryStyle}
                disabled={actionBusy}
                onClick={() =>
                  void act(`/admin/users/${confirm.id}`, {
                    disabled: !confirm.disabled,
                  })
                }
              >
                Xác nhận
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

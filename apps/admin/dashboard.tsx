"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileClock,
  Flag,
  Globe2,
  Inbox,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

type Permission =
  | "users"
  | "miniapps"
  | "reports"
  | "feedback"
  | "landing"
  | "audit"
  | "system";
type Section = "overview" | Permission;
type Me = { userId: string; role: string; permissions: Permission[] };
const permissions: { id: Permission; label: string; hint: string }[] = [
  { id: "users", label: "Người dùng", hint: "Tìm, khóa và đăng xuất tài khoản" },
  { id: "miniapps", label: "Mini App", hint: "Duyệt bản build và yêu cầu quyền" },
  { id: "reports", label: "Báo cáo", hint: "Xử lý báo cáo vi phạm" },
  { id: "feedback", label: "Phản hồi", hint: "Xử lý góp ý người dùng" },
  { id: "landing", label: "Trang chủ", hint: "Sửa liên kết tải app" },
  { id: "audit", label: "Nhật ký", hint: "Xem lịch sử thao tác quản trị" },
  { id: "system", label: "Hệ thống", hint: "Kiểm tra sức khỏe dịch vụ" },
];
const permissionLabel = (id: string) =>
  permissions.find((item) => item.id === id)?.label ?? id;
type SiteLink = {
  platform: "web" | "android" | "ios" | "github";
  label: string;
  url: string;
  note: string;
  enabled: boolean;
};
type Session = { accessToken: string; refreshToken: string; userId: string };
type Stats = {
  users: number;
  messages: number;
  storage: number;
  conversations: number;
  disabledUsers: number;
  pendingReports: number;
  pendingFeedback: number;
  activeSessions: number;
  usersToday: number;
  totalMiniApps: number;
  pendingMiniApps: number;
  pendingMiniAppPermissions: number;
  me: Me;
  activity: { date: string; messages: number }[];
};
type User = {
  id: string;
  nickname: string;
  qchatId: string;
  email: string;
  role: string;
  adminPermissions: Permission[];
  disabled: boolean;
  createdAt: string;
};
type UserDetail = {
  user: User;
  sessions: {
    id: string;
    deviceName: string;
    createdAt: string;
    expiresAt: string | null;
  }[];
  counts: {
    messages: number;
    moments: number;
    conversations: number;
    miniApps: number;
    media: number;
    reports: number;
  };
  wallet: { balance: number; bonusGranted: boolean } | null;
};
type QueueVersion = {
  id: string;
  version: string;
  status: string;
  createdAt: string;
  requestedPermissions: string[];
  miniApp: {
    appId: string;
    name: string;
    developerName: string;
    iconUrl: string;
    category: string;
    status: string;
  };
};
type QueuePermission = {
  id: string;
  permission: string;
  reason: string;
  createdAt: string;
  miniApp: { appId: string; name: string };
};
type MiniAppRow = {
  id: string;
  appId: string;
  name: string;
  category: string;
  status: string;
  currentVersion: string | null;
  updatedAt: string;
  developer: { qchatId: string; nickname: string };
  versions: { version: string; status: string; createdAt: string }[];
};
type Person = {
  id: string;
  qchatId: string;
  nickname: string;
  email: string;
  disabled: boolean;
};
type Report = {
  id: string;
  targetId: string;
  reporterId: string;
  reason: string;
  status: string;
  createdAt: string;
  conversation: {
    id: string;
    kind: string;
    title: string;
    createdAt: string;
    members: {
      role: string;
      user: { id: string; qchatId: string; nickname: string };
    }[];
    _count: { members: number };
  } | null;
  targetUser: Person | null;
  reporter: Person | null;
};
type Feedback = {
  id: string;
  userId: string;
  content: string;
  status: string;
  createdAt: string;
  handledAt: string | null;
  user: { id: string; qchatId: string; nickname: string; email: string } | null;
};
type Audit = {
  id: string;
  action: string;
  actorId: string;
  targetId: string;
  createdAt: string;
};
const navigation: {
  id: Section;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "users", label: "Người dùng", icon: Users, permission: "users" },
  {
    id: "miniapps",
    label: "Mini App",
    icon: Boxes,
    permission: "miniapps",
  },
  { id: "reports", label: "Báo cáo vi phạm", icon: Flag, permission: "reports" },
  { id: "feedback", label: "Phản hồi", icon: Inbox, permission: "feedback" },
  { id: "audit", label: "Nhật ký quản trị", icon: FileClock, permission: "audit" },
  { id: "landing", label: "Trang chủ", icon: Globe2, permission: "landing" },
  { id: "system", label: "Hệ thống", icon: Server, permission: "system" },
];
const number = (value: number) => value.toLocaleString("vi-VN");
const date = (value: string) => new Date(value).toLocaleString("vi-VN");
const bytes = (value: number) =>
  value < 1024 ** 3
    ? `${(value / 1024 ** 2).toFixed(1)} MB`
    : `${(value / 1024 ** 3).toFixed(2)} GB`;
const miniStatus = (status: string) =>
  (
    {
      DRAFT: "Nháp",
      REVIEWING: "Chờ duyệt",
      APPROVED: "Đã duyệt",
      REJECTED: "Từ chối",
      PUBLISHED: "Đã phát hành",
      SUSPENDED: "Tạm dừng",
      UPLOADED: "Đã tải lên",
      REVOKED: "Đã thu hồi",
    } as Record<string, string>
  )[status] ?? status;
const inputStyle =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50";
const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50";
const primaryStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50";
const sessionKey = "qchat-admin-session";
function storedSession(): Session | null {
  try {
    const saved = window.sessionStorage.getItem(sessionKey);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<Session>;
    return value.accessToken && value.refreshToken && value.userId
      ? (value as Session)
      : null;
  } catch {
    return null;
  }
}

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
function Spinner({ label = "Đang tải" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-48 items-center justify-center p-8"
    >
      <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
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
        SELF_ROLE: "Bạn không thể tự đổi vai trò của mình.",
        SELF_DELETE: "Bạn không thể xóa tài khoản đang sử dụng.",
        ADMIN_REQUIRED:
          "Chỉ quản trị viên toàn quyền mới thay đổi được vai trò hoặc quyền.",
        LAST_ADMIN: "Không thể gỡ quyền của quản trị viên cuối cùng.",
        NOT_FOUND: "Không tìm thấy dữ liệu cần thao tác.",
        INVALID_STATE: "Mục này vừa được xử lý ở nơi khác. Hãy làm mới.",
        REASON_REQUIRED: "Cần nhập lý do từ chối (ít nhất 3 ký tự).",
        RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      } as Record<string, string>
    )[code] ?? "Không thực hiện được yêu cầu. Vui lòng thử lại."
  );
}

export default function Dashboard() {
  const session = useRef<Session | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [restoring, setRestoring] = useState(true);
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
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [links, setLinks] = useState<SiteLink[]>([]);
  const [linkBusy, setLinkBusy] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [draftRole, setDraftRole] = useState("USER");
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [queue, setQueue] = useState<{
    versions: QueueVersion[];
    permissions: QueuePermission[];
  } | null>(null);
  const [apps, setApps] = useState<MiniAppRow[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [miniBusy, setMiniBusy] = useState("");
  const [appQuery, setAppQuery] = useState("");
  const [appSearch, setAppSearch] = useState("");
  const [manageApp, setManageApp] = useState<MiniAppRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
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
              window.sessionStorage.removeItem(sessionKey);
              setSignedIn(false);
            }
            throw new Error("INVALID_REFRESH");
          }
          session.current = await refresh.json();
          window.sessionStorage.setItem(
            sessionKey,
            JSON.stringify(session.current),
          );
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
        const summary: Stats = await api("/admin/stats");
        if (current !== revision.current) return;
        setStats(summary);
        setMe(summary.me);
        // A scoped manager may not hold the reports section at all.
        if (
          summary.me.role === "ADMIN" ||
          summary.me.permissions.includes("reports")
        ) {
          const reportRows = await api("/admin/reports");
          if (current !== revision.current) return;
          setReports(reportRows);
        } else {
          setReports([]);
        }
      } else if (target === "miniapps") {
        const [review, list] = await Promise.all([
          api("/admin/miniapps/review"),
          api(`/admin/miniapps?q=${encodeURIComponent(appSearch)}`),
        ]);
        if (current !== revision.current) return;
        setQueue(review);
        setApps(list.items);
        setAppTotal(list.total);
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
      } else if (target === "feedback") {
        const result = await api("/admin/feedback");
        if (current !== revision.current) return;
        setFeedbacks(result);
      } else if (target === "audit") {
        const result = await api("/admin/audit");
        if (current !== revision.current) return;
        setAudit(result);
      } else if (target === "landing") {
        const result = await api("/admin/links");
        if (current !== revision.current) return;
        setLinks(result);
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
    const saved = storedSession();
    if (!saved) {
      setRestoring(false);
      return;
    }
    session.current = saved;
    let active = true;
    void (async () => {
      try {
        const summary: Stats = await api("/admin/stats");
        if (active) setMe(summary.me);
        if (active) setSignedIn(true);
      } catch {
        if (!active) return;
        session.current = null;
        window.sessionStorage.removeItem(sessionKey);
        setSignedIn(false);
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, section, page, search]);
  useEffect(() => {
    // Losing a section (or signing in as a manager) must never leave the
    // console on a screen the account cannot read.
    if (!me || section === "overview" || me.role === "ADMIN") return;
    if (!me.permissions.includes(section)) setSection("overview");
  }, [me, section]);
  useEffect(() => {
    if (signedIn && section === "miniapps") void load("miniapps");
  }, [appSearch]);

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
        const summary: Stats = await api("/admin/stats");
        setStats(summary);
        setMe(summary.me);
      } catch (e) {
        await raw("/auth/logout", "POST", {}, data.accessToken);
        session.current = null;
        throw e;
      }
      setPassword("");
      window.sessionStorage.setItem(sessionKey, JSON.stringify(data));
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
      window.sessionStorage.removeItem(sessionKey);
      setSignedIn(false);
      setMe(null);
      setSelected(null);
      setDetail(null);
      setQueue(null);
      setApps([]);
      setStats(null);
      setUsers([]);
      setReports([]);
      setFeedbacks([]);
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
      setNotice("Đã cập nhật thành công.");
      await load();
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  async function saveLink(link: SiteLink) {
    setLinkBusy(link.platform);
    setNotice("");
    setError("");
    try {
      await api(`/admin/links/${link.platform}`, "PATCH", {
        label: link.label,
        url: link.url,
        note: link.note,
        enabled: link.enabled,
      });
      setNotice(`Đã lưu liên kết ${link.label}.`);
    } catch (e) {
      setError(failure(e));
    } finally {
      setLinkBusy("");
    }
  }
  function editLink(platform: SiteLink["platform"], patch: Partial<SiteLink>) {
    setLinks((rows) =>
      rows.map((row) =>
        row.platform === platform ? { ...row, ...patch } : row,
      ),
    );
  }
  function navigate(value: Section) {
    setSection(value);
    setSidebar(false);
    setNotice("");
    setError("");
  }
  async function refreshStats() {
    try {
      setStats(await api("/admin/stats"));
    } catch {
      // Dashboard counters are decorative; keep the current values.
    }
  }
  async function openUser(user: User) {
    setSelected(user);
    setDetail(null);
    setDetailError("");
    setDeleteArmed(false);
    setNotice("");
    setError("");
    setDetailBusy(true);
    try {
      const data: UserDetail = await api(`/admin/users/${user.id}`);
      setDetail(data);
      setDraftRole(data.user.role);
      setDraftPermissions(data.user.adminPermissions ?? []);
    } catch (e) {
      setDetailError(failure(e));
    } finally {
      setDetailBusy(false);
    }
  }
  function closeUser() {
    setSelected(null);
    setDetail(null);
    setDetailError("");
    setDeleteArmed(false);
  }
  async function reloadDetail(id: string) {
    const data: UserDetail = await api(`/admin/users/${id}`);
    setDetail(data);
    setDraftRole(data.user.role);
    setDraftPermissions(data.user.adminPermissions ?? []);
  }
  async function updateUser(id: string, body: unknown, message: string) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/users/${id}`, "PATCH", body);
      setNotice(message);
      await reloadDetail(id);
      await load("users");
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  async function revokeSessions(id: string) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(`/admin/users/${id}/sessions`, "POST", {});
      setNotice(`Đã thu hồi ${number(result.revoked)} phiên đăng nhập.`);
      await reloadDetail(id);
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  async function deleteUser(user: User) {
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/users/${user.id}`, "DELETE");
      closeUser();
      setNotice(`Đã xóa vĩnh viễn tài khoản @${user.qchatId}.`);
      await load("users");
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setActionBusy(false);
    }
  }
  async function decideVersion(version: QueueVersion, approve: boolean) {
    setMiniBusy(version.id);
    setError("");
    setNotice("");
    try {
      await api(`/admin/miniapps/versions/${version.id}/decision`, "POST", {
        approve,
        reason: (reasons[version.id] ?? "").trim(),
      });
      setNotice(
        `${approve ? "Đã duyệt" : "Đã từ chối"} ${version.miniApp.name} ${version.version}.`,
      );
      setReasons((rows) => ({ ...rows, [version.id]: "" }));
      await load("miniapps");
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setMiniBusy("");
    }
  }
  async function manageMiniApp(
    app: MiniAppRow,
    action: "suspend" | "restore",
  ) {
    setMiniBusy(app.id);
    setError("");
    setNotice("");
    try {
      await api(`/admin/miniapps/apps/${app.appId}/${action}`, "POST",
        action === "suspend" ? { reason: suspendReason.trim() } : {},
      );
      setNotice(
        `${action === "suspend" ? "Đã tạm dừng" : "Đã khôi phục"} ${app.name}.`,
      );
      setManageApp(null);
      setSuspendReason("");
      await load("miniapps");
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setMiniBusy("");
    }
  }
  async function decidePermission(request: QueuePermission, approve: boolean) {
    setMiniBusy(request.id);
    setError("");
    setNotice("");
    try {
      await api(`/admin/miniapps/permissions/${request.id}`, "POST", {
        approve,
      });
      setNotice(
        `${approve ? "Đã cấp" : "Đã từ chối"} quyền ${request.permission} cho ${request.miniApp.name}.`,
      );
      await load("miniapps");
      await refreshStats();
    } catch (e) {
      setError(failure(e));
    } finally {
      setMiniBusy("");
    }
  }
  const visibleNavigation = navigation.filter(
    (item) =>
      !item.permission ||
      me?.role === "ADMIN" ||
      me?.permissions.includes(item.permission),
  );
  const currentNav =
    navigation.find((item) => item.id === section) ?? navigation[0]!;
  const openReports = reports.filter((row) => row.status === "OPEN");
  const fullAdmin = me?.role === "ADMIN";

  if (restoring)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7]">
        <Spinner label="Đang khôi phục phiên đăng nhập" />
      </main>
    );

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
          {visibleNavigation.map(({ id, label, icon: Icon }) => (
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
              {id === "feedback" && (stats?.pendingFeedback ?? 0) > 0 && (
                <span className="ml-auto rounded-md bg-white/15 px-1.5 text-xs">
                  {stats!.pendingFeedback}
                </span>
              )}
              {id === "miniapps" &&
                (stats?.pendingMiniApps ?? 0) +
                  (stats?.pendingMiniAppPermissions ?? 0) >
                  0 && (
                  <span className="ml-auto rounded-md bg-white/15 px-1.5 text-xs">
                    {(stats!.pendingMiniApps ?? 0) +
                      (stats!.pendingMiniAppPermissions ?? 0)}
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
              {fullAdmin ? "Quản trị viên" : "Quản lý"}
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
                    ? "Tìm kiếm, phân quyền và quản lý tài khoản."
                    : section === "miniapps"
                    ? "Duyệt bản build và yêu cầu quyền của Mini App."
                    : section === "reports"
                      ? "Xem xét phản ánh để cộng đồng an toàn hơn."
                      : section === "feedback"
                        ? "Đọc góp ý người dùng gửi từ ứng dụng."
                        : section === "audit"
                        ? "Theo dõi các thay đổi do quản trị viên thực hiện."
                        : section === "landing"
                        ? "Quản lý liên kết hiển thị trên trang giới thiệu."
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

          {section === "overview" && stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    label: "Tổng người dùng",
                    value: number(stats.users),
                    detail: `${number(stats.usersToday)} mới hôm nay · ${number(stats.disabledUsers)} bị khóa`,
                    icon: Users,
                  },
                  {
                    label: "Tin nhắn đã gửi",
                    value: number(stats.messages),
                    detail: `${number(stats.conversations)} cuộc trò chuyện`,
                    icon: MessagesSquare,
                  },
                  {
                    label: "Mini App",
                    value: number(stats.totalMiniApps),
                    detail: `${number(stats.pendingMiniApps)} bản build và ${number(stats.pendingMiniAppPermissions)} yêu cầu quyền chờ duyệt`,
                    icon: Boxes,
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
                  {
                    label: "Phản hồi chờ xử lý",
                    value: number(stats.pendingFeedback),
                    detail: "Góp ý người dùng gửi từ ứng dụng",
                    icon: Inbox,
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
                            : user.adminPermissions.length
                              ? `Quản lý · ${user.adminPermissions.length} mục`
                              : "Thành viên"}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"
                            disabled={actionBusy}
                            onClick={() => void openUser(user)}
                          >
                            <UserCog size={14} /> Quản lý
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

          {section === "miniapps" && (
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                  <div>
                    <h2 className="font-bold">Bản build chờ duyệt</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {queue
                        ? `${queue.versions.length} bản build đang chờ quyết định`
                        : "Đang tải hàng chờ"}
                    </p>
                  </div>
                  <button
                    className={buttonStyle}
                    disabled={busy}
                    onClick={() => void load("miniapps")}
                  >
                    <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                    Làm mới
                  </button>
                </div>
                {busy && !queue ? (
                  <Spinner label="Đang tải hàng chờ duyệt" />
                ) : !queue || queue.versions.length === 0 ? (
                  <Empty>Không có bản build nào chờ duyệt.</Empty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {queue.versions.map((version) => (
                      <div key={version.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold">
                              {version.miniApp.name}{" "}
                              <span className="font-mono text-xs text-slate-400">
                                v{version.version}
                              </span>
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-400">
                              {version.miniApp.appId} ·{" "}
                              {version.miniApp.developerName ||
                                "Chưa có tên nhà phát triển"}{" "}
                              · {version.miniApp.category}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Gửi {date(version.createdAt)}
                            </p>
                          </div>
                          <Badge warning>Chờ duyệt</Badge>
                        </div>
                        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Quyền yêu cầu:{" "}
                          {version.requestedPermissions.length
                            ? version.requestedPermissions.join(", ")
                            : "không có"}
                        </p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="flex-1 text-xs font-semibold text-slate-600">
                            Lý do (bắt buộc khi từ chối)
                            <textarea
                              className={`${inputStyle} mt-1.5 min-h-[64px] resize-y`}
                              maxLength={500}
                              value={reasons[version.id] ?? ""}
                              onChange={(e) =>
                                setReasons((rows) => ({
                                  ...rows,
                                  [version.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              className={buttonStyle}
                              disabled={miniBusy === version.id}
                              onClick={() => void decideVersion(version, false)}
                            >
                              Từ chối
                            </button>
                            <button
                              className={primaryStyle}
                              disabled={miniBusy === version.id}
                              onClick={() => void decideVersion(version, true)}
                            >
                              <Check size={15} />
                              Duyệt
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="border-b border-slate-100 p-5">
                  <h2 className="font-bold">Yêu cầu quyền</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Quyền bổ sung do nhà phát triển xin sau khi phát hành
                  </p>
                </div>
                {busy && !queue ? (
                  <Spinner label="Đang tải yêu cầu quyền" />
                ) : !queue || queue.permissions.length === 0 ? (
                  <Empty>Không có yêu cầu quyền nào đang chờ.</Empty>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {queue.permissions.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-wrap items-start justify-between gap-4 p-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {request.miniApp.name}{" "}
                            <span className="font-mono text-xs text-emerald-700">
                              {request.permission}
                            </span>
                          </p>
                          <p className="mt-1 break-all text-xs text-slate-400">
                            {request.miniApp.appId} · {request.reason}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {date(request.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className={buttonStyle}
                            disabled={miniBusy === request.id}
                            onClick={() => void decidePermission(request, false)}
                          >
                            Từ chối
                          </button>
                          <button
                            className={primaryStyle}
                            disabled={miniBusy === request.id}
                            onClick={() => void decidePermission(request, true)}
                          >
                            <Check size={15} />
                            Cấp quyền
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                  <div>
                    <h2 className="font-bold">Danh sách Mini App</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {number(appTotal)} ứng dụng · 20 mục mỗi trang
                    </p>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setAppSearch(appQuery.trim());
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      aria-label="Tìm Mini App"
                      className={`${inputStyle} w-56 py-2`}
                      maxLength={80}
                      onChange={(e) => setAppQuery(e.target.value)}
                      placeholder="Tên, app id, nhà phát triển…"
                      value={appQuery}
                    />
                    <button className={buttonStyle}>
                      <Search size={15} /> Tìm
                    </button>
                  </form>
                </div>
                {busy && apps.length === 0 ? (
                  <Spinner label="Đang tải Mini App" />
                ) : apps.length === 0 ? (
                  <Empty>Chưa có Mini App nào được đăng ký.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-left text-sm">
                      <thead className="bg-slate-50/70 text-xs text-slate-500">
                        <tr>
                          {[
                            "Mini App",
                            "Nhà phát triển",
                            "Trạng thái",
                            "Bản mới nhất",
                            "Cập nhật",
                            "Thao tác",
                          ].map((label) => (
                            <th key={label} className="px-5 py-4 font-semibold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {apps.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-4">
                              <p className="font-semibold">{app.name}</p>
                              <p className="mt-1 font-mono text-[11px] text-slate-400">
                                {app.appId}
                              </p>
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-500">
                              {app.developer.nickname}
                              <span className="block text-slate-400">
                                @{app.developer.qchatId}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <Badge
                                warning={app.status !== "PUBLISHED"}
                              >
                                {miniStatus(app.status)}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 font-mono text-xs text-slate-500">
                              {app.versions[0]
                                ? `${app.versions[0].version} · ${miniStatus(app.versions[0].status)}`
                                : "—"}
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-500">
                              {date(app.updatedAt)}
                            </td>
                            <td className="px-5 py-4">
                              {app.status === "SUSPENDED" ? (
                                <button
                                  className="text-xs font-semibold text-emerald-700 disabled:text-slate-300"
                                  disabled={miniBusy === app.id}
                                  onClick={() => void manageMiniApp(app, "restore")}
                                >
                                  Khôi phục
                                </button>
                              ) : (
                                <button
                                  className="text-xs font-semibold text-red-600 disabled:text-slate-300"
                                  disabled={miniBusy === app.id}
                                  onClick={() => {
                                    setManageApp(app);
                                    setSuspendReason("");
                                  }}
                                >
                                  Tạm dừng
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
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
                        <p className="mt-2 text-xs font-semibold text-slate-600">
                          {row.conversation
                            ? `${row.conversation.kind === "DIRECT" ? "Trò chuyện riêng" : "Nhóm"}${row.conversation.title ? ` · ${row.conversation.title}` : ""} · ${number(row.conversation._count.members)} thành viên`
                            : row.targetUser
                              ? `Tài khoản ${row.targetUser.nickname} (@${row.targetUser.qchatId})`
                              : "Không tìm thấy đoạn chat — có thể đã bị xóa"}
                        </p>
                        {row.conversation && (
                          <p className="mt-1 break-words text-xs text-slate-500">
                            Thành viên:{" "}
                            {row.conversation.members
                              .map(
                                (member) =>
                                  `${member.user.nickname} (@${member.user.qchatId})`,
                              )
                              .join(", ")}
                            {row.conversation._count.members >
                              row.conversation.members.length &&
                              `, +${row.conversation._count.members - row.conversation.members.length}`}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          Người báo cáo:{" "}
                          {row.reporter
                            ? `${row.reporter.nickname} (@${row.reporter.qchatId})`
                            : row.reporterId}
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                          Mã đoạn chat: {row.targetId}
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

          {section === "feedback" && (
            <Card>
              <div className="border-b border-slate-100 p-5">
                <h2 className="font-bold">Phản hồi gần đây</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Tối đa 100 phản hồi mới nhất gửi từ ứng dụng
                </p>
              </div>
              {feedbacks.length === 0 && !busy ? (
                <Empty>Chưa có phản hồi nào.</Empty>
              ) : (
                <div className="divide-y divide-slate-100">
                  {feedbacks.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-start gap-5 p-5"
                    >
                      <span className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                        <Inbox size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm font-semibold">
                          {row.content}
                        </p>
                        <p className="mt-2 break-all text-xs text-slate-400">
                          {row.user
                            ? `${row.user.nickname} (@${row.user.qchatId}) · ${row.user.email}`
                            : row.userId}
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
                              void act(`/admin/feedback/${row.id}`, {
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
                              void act(`/admin/feedback/${row.id}`, {
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
                                FEEDBACK_RESOLVED: "Xử lý phản hồi",
                                FEEDBACK_DISMISSED: "Bỏ qua phản hồi",
                                USER_DELETE: "Xóa tài khoản",
                                USER_ROLE_UPDATE: "Đổi vai trò",
                                USER_PERMISSIONS_UPDATE: "Cập nhật quyền quản lý",
                                USER_SESSIONS_REVOKED: "Thu hồi phiên đăng nhập",
                                SITE_LINK_UPDATE: "Sửa liên kết trang chủ",
                                MINIAPP_APPROVED: "Duyệt Mini App",
                                MINIAPP_REJECTED: "Từ chối Mini App",
                                MINIAPP_PERMISSION_APPROVED: "Cấp quyền Mini App",
                                MINIAPP_PERMISSION_REJECTED: "Từ chối quyền Mini App",
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

          {section === "landing" && (
            <div className="space-y-5">
              <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="text-sm font-bold">
                    Liên kết trên trang giới thiệu
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Người dùng thấy các nút này ở trang chủ và mục tải app.
                    Tắt hiển thị nếu chưa có bản build.
                  </p>
                </div>
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"
                  href="/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Xem trang chủ <ExternalLink size={15} />
                </a>
              </Card>
              {busy && links.length === 0 ? (
                <Card className="p-7">
                  <Spinner label="Đang tải liên kết" />
                </Card>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  {links.map((link) => (
                    <Card key={link.platform} className="p-7">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[.15em] text-emerald-600">
                            {link.platform}
                          </p>
                          <h2 className="mt-1 text-lg font-bold">
                            {link.label}
                          </h2>
                        </div>
                        <Badge warning={!link.enabled}>
                          {link.enabled ? "Đang hiển thị" : "Đang ẩn"}
                        </Badge>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-sm font-semibold text-slate-700">
                          Tên hiển thị
                          <input
                            className={`${inputStyle} mt-2`}
                            maxLength={40}
                            onChange={(e) =>
                              editLink(link.platform, { label: e.target.value })
                            }
                            value={link.label}
                          />
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">
                          Liên kết
                          <input
                            className={`${inputStyle} mt-2 font-mono text-xs`}
                            maxLength={500}
                            onChange={(e) =>
                              editLink(link.platform, { url: e.target.value })
                            }
                            placeholder="https://…"
                            value={link.url}
                          />
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">
                          Ghi chú
                          <textarea
                            className={`${inputStyle} mt-2 min-h-[86px] resize-y`}
                            maxLength={300}
                            onChange={(e) =>
                              editLink(link.platform, { note: e.target.value })
                            }
                            value={link.note}
                          />
                        </label>
                        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                          <input
                            checked={link.enabled}
                            className="h-4 w-4 accent-emerald-600"
                            onChange={(e) =>
                              editLink(link.platform, {
                                enabled: e.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          Hiển thị trên trang chủ
                        </label>
                      </div>
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <button
                          className={primaryStyle}
                          disabled={linkBusy === link.platform}
                          onClick={() => void saveLink(link)}
                        >
                          {linkBusy === link.platform ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                          Lưu
                        </button>
                        {link.url && (
                          <a
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"
                            href={link.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Mở liên kết <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === "system" &&
            (busy && healthy === null ? (
              <Card>
                <Spinner label="Đang kiểm tra hệ thống" />
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-7">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                      <Activity size={25} />
                    </span>
                    {busy ? (
                      <Loader2
                        aria-label="Đang kiểm tra hệ thống"
                        className="h-5 w-5 animate-spin text-emerald-500"
                      />
                    ) : (
                      healthy !== null && (
                        <Badge warning={!healthy}>
                          {healthy ? "Sẵn sàng phục vụ" : "Cần kiểm tra"}
                        </Badge>
                      )
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
                    Tin nhắn được lưu trong PostgreSQL, tệp đính kèm lưu trong
                    kho riêng tư. Trạng thái sức khỏe này không bao gồm kiểm tra
                    kho tệp.
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
            ))}
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
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-5 sm:items-center"
          onClick={() => !actionBusy && closeUser()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-title"
            className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div className="min-w-0">
                <h2 id="user-title" className="truncate text-xl font-bold">
                  {selected.nickname}
                </h2>
                <p className="mt-1 break-all text-xs text-slate-400">
                  @{selected.qchatId} · {selected.email}
                </p>
              </div>
              <button
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
                disabled={actionBusy}
                onClick={closeUser}
              >
                <X size={20} />
              </button>
            </header>
            <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6">
              {detailBusy && !detail && <Spinner label="Đang tải hồ sơ" />}
              {detailError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {detailError}
                </p>
              )}
              {detail && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge warning={detail.user.disabled}>
                      {detail.user.disabled ? "Đã khóa" : "Hoạt động"}
                    </Badge>
                    <Badge warning={detail.user.role !== "ADMIN"}>
                      {detail.user.role === "ADMIN"
                        ? "Quản trị viên"
                        : detail.user.adminPermissions.length
                          ? `Quản lý · ${detail.user.adminPermissions.map(permissionLabel).join(", ")}`
                          : "Thành viên"}
                    </Badge>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                      Tham gia {date(detail.user.createdAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["Tin nhắn", detail.counts.messages],
                        ["Khoảnh khắc", detail.counts.moments],
                        ["Cuộc trò chuyện", detail.counts.conversations],
                        ["Mini App", detail.counts.miniApps],
                        ["Tệp media", detail.counts.media],
                        ["Bị báo cáo", detail.counts.reports],
                      ] as [string, number][]
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-100 p-3"
                      >
                        <p className="text-[11px] font-semibold text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 text-lg font-bold">
                          {number(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-bold">
                        Phiên đăng nhập ({detail.sessions.length})
                      </h3>
                      <button
                        className="text-xs font-semibold text-emerald-700 disabled:text-slate-300"
                        disabled={
                          actionBusy || detail.sessions.length === 0
                        }
                        onClick={() => void revokeSessions(detail.user.id)}
                      >
                        Đăng xuất mọi thiết bị
                      </button>
                    </div>
                    {detail.sessions.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Không có phiên nào đang hoạt động.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {detail.sessions.map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"
                          >
                            <span className="font-semibold text-slate-600">
                              {item.deviceName}
                            </span>
                            <span>{date(item.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {fullAdmin && detail.user.id !== me?.userId && (
                    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-bold">
                        Vai trò & quyền quản lý
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["USER", "Thành viên"],
                            ["ADMIN", "Quản trị viên toàn quyền"],
                          ] as [string, string][]
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${draftRole === value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                            disabled={actionBusy}
                            onClick={() => setDraftRole(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {permissions.map((permission) => (
                          <label
                            key={permission.id}
                            className={`flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs ${draftRole === "ADMIN" ? "opacity-50" : ""}`}
                          >
                            <input
                              checked={
                                draftRole === "ADMIN" ||
                                draftPermissions.includes(permission.id)
                              }
                              className="mt-0.5 h-4 w-4 accent-emerald-600"
                              disabled={actionBusy || draftRole === "ADMIN"}
                              onChange={(e) =>
                                setDraftPermissions((rows) =>
                                  e.target.checked
                                    ? [...rows, permission.id]
                                    : rows.filter((id) => id !== permission.id),
                                )
                              }
                              type="checkbox"
                            />
                            <span>
                              <span className="font-semibold">
                                {permission.label}
                              </span>
                              <span className="mt-0.5 block text-slate-400">
                                {permission.hint}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        {draftRole === "ADMIN"
                          ? "Quản trị viên toàn quyền luôn có tất cả các mục và có thể phân quyền cho người khác."
                          : "Người được cấp mục nào chỉ thấy và thao tác được mục đó; không thể đổi vai trò hay xóa tài khoản."}
                      </p>
                      <button
                        className={primaryStyle}
                        disabled={actionBusy}
                        onClick={() =>
                          void updateUser(
                            detail.user.id,
                            {
                              role: draftRole,
                              adminPermissions:
                                draftRole === "ADMIN" ? [] : draftPermissions,
                            },
                            "Đã cập nhật vai trò và quyền quản lý.",
                          )
                        }
                      >
                        <Save size={15} />
                        Lưu phân quyền
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button
                      className={buttonStyle}
                      disabled={
                        actionBusy || detail.user.id === me?.userId
                      }
                      onClick={() =>
                        void updateUser(
                          detail.user.id,
                          { disabled: !detail.user.disabled },
                          detail.user.disabled
                            ? "Đã mở khóa tài khoản."
                            : "Đã khóa tài khoản và thu hồi phiên đăng nhập.",
                        )
                      }
                    >
                      <LockKeyhole size={15} />
                      {detail.user.disabled ? "Mở khóa" : "Khóa tài khoản"}
                    </button>
                    {fullAdmin &&
                      detail.user.id !== me?.userId &&
                      (deleteArmed ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-red-600">
                            Xóa vĩnh viễn tin nhắn, media và Mini App của tài khoản?
                          </span>
                          <button
                            className={buttonStyle}
                            disabled={actionBusy}
                            onClick={() => setDeleteArmed(false)}
                          >
                            Hủy
                          </button>
                          <button
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                            disabled={actionBusy}
                            onClick={() => void deleteUser(detail.user)}
                          >
                            <Trash2 size={15} />
                            Xác nhận xóa
                          </button>
                        </div>
                      ) : (
                        <button
                          className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 disabled:text-slate-300"
                          disabled={actionBusy}
                          onClick={() => setDeleteArmed(true)}
                        >
                          <Trash2 size={15} />
                          Xóa tài khoản
                        </button>
                      ))}
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    Xóa tài khoản là vĩnh viễn: tin nhắn, khoảnh khắc, tệp media
                    và Mini App thuộc tài khoản sẽ bị xóa khỏi hệ thống.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {manageApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
          onClick={() => !miniBusy && setManageApp(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-title"
            className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="app-title" className="text-xl font-bold">
              Tạm dừng {manageApp.name}?
            </h2>
            <p className="mt-2 break-all text-xs text-slate-500">
              {manageApp.appId} · {manageApp.developer.nickname} (@
              {manageApp.developer.qchatId})
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Ứng dụng sẽ ngừng phục vụ người dùng cho đến khi được bạn khôi
              phục. Nhà phát triển vẫn thấy ứng dụng trong Developer Center.
            </p>
            <label className="mt-5 block text-xs font-semibold text-slate-600">
              Lý do (bắt buộc, được ghi vào nhật ký)
              <textarea
                className={`${inputStyle} mt-1.5 min-h-[72px] resize-y`}
                maxLength={300}
                onChange={(e) => setSuspendReason(e.target.value)}
                value={suspendReason}
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className={buttonStyle}
                disabled={miniBusy === manageApp.id}
                onClick={() => setManageApp(null)}
              >
                Hủy
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                disabled={
                  miniBusy === manageApp.id || suspendReason.trim().length < 3
                }
                onClick={() => void manageMiniApp(manageApp, "suspend")}
              >
                <Boxes size={15} />
                Tạm dừng
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

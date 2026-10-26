"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  Eye,
  FileArchive,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

type Lang = "vi" | "en";
type Section = "overview" | "apps" | "reviews" | "audit" | "docs" | "ide";
type Tab = "overview" | "builds" | "releases" | "permissions" | "analytics" | "team" | "keys";

type User = {
  userId: string;
  nickname: string;
  qchatId: string;
  email: string;
  role: string;
  reviewer: boolean;
};
type Version = {
  id: string;
  version: string;
  status: string;
  channel: string;
  size: number;
  sha256: string;
  entry: string;
  minRuntimeVersion: string;
  requestedPermissions: string[];
  createdAt: string;
  publishedAt: string | null;
  revokedAt: string | null;
  revokeReason: string;
  manifest: { name?: string; description?: string };
  reviews?: { decision: string; reason: string; createdAt: string }[];
};
type AppSummary = {
  appId: string;
  name: string;
  description: string;
  iconUrl: string;
  category: string;
  developerName: string;
  status: string;
  currentVersion: string | null;
  requestedPermissions: string[];
  createdAt: string;
  updatedAt: string;
  versions?: { version: string; status: string; createdAt: string }[];
};
type Release = {
  id: string;
  versionLabel: string;
  action: string;
  note: string;
  createdAt: string;
};
type PermissionRequest = {
  id: string;
  permission: string;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};
type Member = {
  id: string;
  role: string;
  user: { id: string; nickname: string; qchatId: string; avatarId: string | null };
};
type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
type PermissionInfo = {
  id: string;
  title: string;
  description: string;
  sensitive: boolean;
};
type AppDetail = {
  app: AppSummary & {
    supportUrl: string;
    privacyUrl: string;
    contactEmail: string;
    role: string;
  };
  versions: Version[];
  releases: Release[];
  permissions: PermissionRequest[];
  members: Member[];
  keys: ApiKey[];
  analytics: { opens: number; events: { event: string; count: number }[] };
  permissionCatalog: PermissionInfo[];
  runtimeVersion: string;
  storage: string;
};
type Dashboard = {
  apps: number;
  published: number;
  pendingBuilds: number;
  rejected: number;
  opens: number;
  storage: string;
  recent: {
    id: string;
    appId: string;
    name: string;
    action: string;
    version: string;
    note: string;
    createdAt: string;
  }[];
};
type IdeLink = {
  label: string;
  url: string;
  note: string;
  enabled: boolean;
};
type Analytics = {
  since: string;
  events: { event: string; count: number }[];
  versions: { version: string; count: number }[];
  errors: { errorCode: string; version: string; createdAt: string }[];
};
type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  createdAt: string;
};
type Queue = {
  versions: (Version & {
    miniApp: {
      appId: string;
      name: string;
      developerName: string;
      iconUrl: string;
      category: string;
      status: string;
    };
  })[];
  permissions: (PermissionRequest & { miniApp: { appId: string; name: string } })[];
};

const categories = [
  "utilities",
  "social",
  "productivity",
  "entertainment",
  "education",
  "finance",
  "health",
  "shopping",
  "tools",
  "games",
  "news",
  "travel",
] as const;

const copy = {
  vi: {
    workspace: "Không gian phát triển",
    overview: "Tổng quan",
    apps: "Ứng dụng",
    reviews: "Duyệt ứng dụng",
    audit: "Nhật ký",
    docs: "Tài liệu",
    developerCenter: "Developer Center",
    signOut: "Đăng xuất",
    language: "Ngôn ngữ",
    theme: "Giao diện",
    loginTitle: "Chào mừng nhà phát triển",
    loginSubtitle: "Đăng nhập bằng tài khoản QChat để quản lý Mini App.",
    identifier: "QChat ID hoặc email",
    password: "Mật khẩu",
    signIn: "Đăng nhập",
    heroTitle: "Xây dựng Mini App cho QChat",
    heroBody:
      "Phát triển, duyệt và phát hành ứng dụng nhỏ chạy trong QChat. Gói build bất biến, phân quyền rõ ràng và số liệu thật.",
    secure: "Phiên đăng nhập an toàn bằng cookie httpOnly",
    overviewTitle: "Tổng quan",
    overviewSubtitle: "Hoạt động 30 ngày gần nhất của các ứng dụng bạn quản lý.",
    appsTitle: "Ứng dụng của bạn",
    appsSubtitle: "Tạo ứng dụng, tải build và theo dõi trạng thái phát hành.",
    reviewsTitle: "Hàng chờ duyệt",
    reviewsSubtitle: "Chỉ quản trị viên có quyền duyệt build và yêu cầu quyền.",
    auditTitle: "Nhật ký hoạt động",
    auditSubtitle: "Các thao tác trên ứng dụng của bạn, mới nhất trước.",
    docsTitle: "Tài liệu Mini App",
    docsSubtitle: "Manifest, SDK, quy trình phát hành và giới hạn bảo mật.",
    totalApps: "Ứng dụng",
    published: "Đang phát hành",
    pendingBuilds: "Build chờ duyệt",
    opens: "Lượt mở (30 ngày)",
    rejected: "Build bị từ chối",
    recentActivity: "Hoạt động phát hành gần đây",
    storage: "Lưu trữ gói build",
    createApp: "Tạo ứng dụng",
    searchApps: "Tìm theo tên hoặc app ID",
    allStatuses: "Tất cả trạng thái",
    name: "Tên ứng dụng",
    description: "Mô tả",
    category: "Danh mục",
    developerName: "Tên nhà phát triển",
    contactEmail: "Email liên hệ",
    iconUrl: "URL biểu tượng (HTTPS)",
    supportUrl: "URL hỗ trợ (HTTPS)",
    privacyUrl: "URL chính sách (HTTPS)",
    cancel: "Huỷ",
    create: "Tạo ứng dụng",
    noApps: "Chưa có ứng dụng nào. Tạo ứng dụng đầu tiên để bắt đầu.",
    noResults: "Không tìm thấy ứng dụng phù hợp.",
    editApp: "Chỉnh sửa ứng dụng",
    saved: "Đã lưu thay đổi",
    deleteApp: "Xoá ứng dụng",
    deleteAppNote:
      "Xoá vĩnh viễn ứng dụng này cùng toàn bộ build và dữ liệu liên quan? Hành động này không thể hoàn tác.",
    deleteAppDone: "Đã xoá ứng dụng",
    updated: "Cập nhật",
    currentVersion: "Bản phát hành",
    open: "Mở",
    back: "Quay lại danh sách",
    appOverview: "Tổng quan",
    builds: "Build",
    releases: "Phát hành",
    permissions: "Quyền",
    analytics: "Phân tích",
    team: "Đội ngũ",
    keys: "API key",
    uploadBuild: "Tải build mới",
    version: "Phiên bản",
    channel: "Kênh",
    file: "Tệp .japp",
    upload: "Tải lên",
    uploading: "Đang tải lên",
    uploadHint:
      "Gói .japp chứa manifest.json ở thư mục gốc. Tối đa 20 MB, chỉ chứa mã đã biên dịch và assets.",
    noBuilds: "Chưa có build. Tải lên bản đầu tiên.",
    size: "Dung lượng",
    checksum: "SHA-256",
    entry: "Entry",
    runtime: "Runtime tối thiểu",
    status: "Trạng thái",
    actions: "Thao tác",
    submit: "Gửi duyệt",
    release: "Phát hành",
    republish: "Phát hành lại",
    rollback: "Quay lại bản này",
    revoke: "Thu hồi",
    revokeReason: "Lý do thu hồi (tối thiểu 3 ký tự)",
    confirm: "Xác nhận",
    noReleases: "Chưa có lịch sử phát hành.",
    action: "Hành động",
    note: "Ghi chú",
    declared: "Quyền khai báo trong manifest",
    permissionCatalog: "Danh mục quyền",
    permissionRequests: "Yêu cầu bổ sung quyền",
    requestPermission: "Gửi yêu cầu",
    reason: "Lý do",
    sensitive: "Nhạy cảm",
    noPermissions: "Chưa có yêu cầu quyền nào.",
    opensByVersion: "Lượt mở theo phiên bản",
    events: "Sự kiện",
    errors: "Lỗi runtime gần đây",
    noErrors: "Không có lỗi runtime trong 30 ngày.",
    noData: "Chưa có dữ liệu.",
    members: "Thành viên",
    addMember: "Thêm thành viên",
    memberIdentifier: "QChat ID hoặc email",
    role: "Vai trò",
    remove: "Xoá",
    owner: "Chủ sở hữu",
    noMembers: "Chưa có thành viên nào ngoài chủ sở hữu.",
    createKey: "Tạo API key",
    keyName: "Tên key",
    keyHint:
      "API key dùng cho CI tải build. Secret chỉ hiển thị một lần, không lưu trong trình duyệt.",
    noKeys: "Chưa có API key.",
    prefix: "Tiền tố",
    lastUsed: "Dùng gần nhất",
    revoked: "Đã thu hồi",
    copy: "Sao chép",
    copied: "Đã sao chép",
    secretOnce: "Secret mới (chỉ hiển thị một lần)",
    queueEmpty: "Hàng chờ trống.",
    reviewBuild: "Duyệt build",
    reviewPermission: "Duyệt quyền",
    approve: "Chấp thuận",
    reject: "Từ chối",
    rejectReason: "Lý do từ chối",
    suspend: "Tạm ngưng ứng dụng",
    restore: "Khôi phục ứng dụng",
    noPermissionRequests: "Không có yêu cầu quyền nào chờ duyệt.",
    logoutError: "Không thể đăng xuất.",
    retry: "Thử lại",
    refresh: "Làm mới",
    loading: "Đang tải",
    save: "Lưu",
    required: "Bắt buộc",
    search: "Tìm kiếm",
    filter: "Lọc",
    activityLog: "Nhật ký",
    target: "Đối tượng",
    time: "Thời gian",
    actor: "Người thực hiện",
    docsQuickstart: "Bắt đầu nhanh",
    docsManifest: "Manifest",
    docsSdk: "SDK",
    docsPublish: "Quy trình phát hành",
    docsSecurity: "Bảo mật",
    docsUpload: "Tải build bằng CI",
    ide: "IDE phát triển",
    ideTitle: "IDE phát triển Mini App",
    ideSubtitle:
      "Tải trình soạn thảo và bộ công cụ QChat để xây dựng Mini App trên máy của bạn.",
    ideDownload: "Tải IDE",
    ideUnavailable:
      "Quản trị viên chưa cấu hình liên kết tải IDE. Vui lòng quay lại sau.",
    ideReady: "Liên kết tải do quản trị viên cung cấp.",
    ideHint:
      "Mở IDE, tạo dự án từ @mna/qchat, chạy thử rồi đóng gói .japp để tải build lên đây.",
    preview: "Xem trước",
    previewTitle: "Xem trước bản build",
    previewNote:
      "Bản xem trước chỉ hiển thị tệp thô trong gói .japp. Mã chỉ chạy trên ứng dụng QChat.",
    openInNewTab: "Mở tab mới",
    close: "Đóng",
  },
  en: {
    workspace: "Developer workspace",
    overview: "Overview",
    apps: "Apps",
    reviews: "Review queue",
    audit: "Audit log",
    docs: "Docs",
    developerCenter: "Developer Center",
    signOut: "Sign out",
    language: "Language",
    theme: "Theme",
    loginTitle: "Welcome, developer",
    loginSubtitle: "Sign in with your QChat account to manage Mini Apps.",
    identifier: "QChat ID or email",
    password: "Password",
    signIn: "Sign in",
    heroTitle: "Build Mini Apps for QChat",
    heroBody:
      "Develop, review and ship small apps that run inside QChat. Immutable builds, explicit permissions and real data.",
    secure: "Session protected by an httpOnly cookie",
    overviewTitle: "Overview",
    overviewSubtitle: "Last 30 days across the apps you manage.",
    appsTitle: "Your apps",
    appsSubtitle: "Create apps, upload builds and follow releases.",
    reviewsTitle: "Review queue",
    reviewsSubtitle: "Administrators review builds and permission requests.",
    auditTitle: "Audit log",
    auditSubtitle: "Actions on your apps, newest first.",
    docsTitle: "Mini App docs",
    docsSubtitle: "Manifest, SDK, release flow and security limits.",
    totalApps: "Apps",
    published: "Published",
    pendingBuilds: "Builds in review",
    opens: "Opens (30 days)",
    rejected: "Rejected builds",
    recentActivity: "Recent release activity",
    storage: "Build storage",
    createApp: "Create app",
    searchApps: "Search by name or app ID",
    allStatuses: "All statuses",
    name: "App name",
    description: "Description",
    category: "Category",
    developerName: "Developer name",
    contactEmail: "Contact email",
    iconUrl: "Icon URL (HTTPS)",
    supportUrl: "Support URL (HTTPS)",
    privacyUrl: "Privacy URL (HTTPS)",
    cancel: "Cancel",
    create: "Create app",
    noApps: "No apps yet. Create your first app to get started.",
    noResults: "No matching apps.",
    editApp: "Edit app",
    saved: "Changes saved",
    deleteApp: "Delete app",
    deleteAppNote:
      "Permanently delete this app along with all builds and related data? This cannot be undone.",
    deleteAppDone: "App deleted",
    updated: "Updated",
    currentVersion: "Current release",
    open: "Open",
    back: "Back to apps",
    appOverview: "Overview",
    builds: "Builds",
    releases: "Releases",
    permissions: "Permissions",
    analytics: "Analytics",
    team: "Team",
    keys: "API keys",
    uploadBuild: "Upload a build",
    version: "Version",
    channel: "Channel",
    file: ".japp file",
    upload: "Upload",
    uploading: "Uploading",
    uploadHint:
      "The .japp contains manifest.json at its root. Max 20 MB, compiled code and assets only.",
    noBuilds: "No builds yet. Upload the first one.",
    size: "Size",
    checksum: "SHA-256",
    entry: "Entry",
    runtime: "Min runtime",
    status: "Status",
    actions: "Actions",
    submit: "Submit for review",
    release: "Release",
    republish: "Release again",
    rollback: "Roll back to this",
    revoke: "Revoke",
    revokeReason: "Revocation reason (at least 3 characters)",
    confirm: "Confirm",
    noReleases: "No releases yet.",
    action: "Action",
    note: "Note",
    declared: "Permissions declared in the manifest",
    permissionCatalog: "Permission catalog",
    permissionRequests: "Additional permission requests",
    requestPermission: "Request permission",
    reason: "Reason",
    sensitive: "Sensitive",
    noPermissions: "No permission requests yet.",
    opensByVersion: "Opens by version",
    events: "Events",
    errors: "Recent runtime errors",
    noErrors: "No runtime errors in the last 30 days.",
    noData: "No data yet.",
    members: "Members",
    addMember: "Add member",
    memberIdentifier: "QChat ID or email",
    role: "Role",
    remove: "Remove",
    owner: "Owner",
    noMembers: "No members besides the owner.",
    createKey: "Create API key",
    keyName: "Key name",
    keyHint:
      "API keys let CI upload builds. The secret is shown once and never stored in the browser.",
    noKeys: "No API keys yet.",
    prefix: "Prefix",
    lastUsed: "Last used",
    revoked: "Revoked",
    copy: "Copy",
    copied: "Copied",
    secretOnce: "New secret (shown once)",
    queueEmpty: "The queue is empty.",
    reviewBuild: "Review build",
    reviewPermission: "Review permission",
    approve: "Approve",
    reject: "Reject",
    rejectReason: "Rejection reason",
    suspend: "Suspend app",
    restore: "Restore app",
    noPermissionRequests: "No permission requests waiting.",
    logoutError: "Could not sign out.",
    retry: "Retry",
    refresh: "Refresh",
    loading: "Loading",
    save: "Save",
    required: "Required",
    search: "Search",
    filter: "Filter",
    activityLog: "Activity log",
    target: "Target",
    time: "Time",
    actor: "Actor",
    docsQuickstart: "Quick start",
    docsManifest: "Manifest",
    docsSdk: "SDK",
    docsPublish: "Release flow",
    docsSecurity: "Security",
    docsUpload: "Upload from CI",
    ide: "Development IDE",
    ideTitle: "Mini App development IDE",
    ideSubtitle:
      "Download the QChat editor and tooling to build Mini Apps on your machine.",
    ideDownload: "Download IDE",
    ideUnavailable:
      "The administrator has not configured an IDE download link yet. Check back later.",
    ideReady: "The download link is provided by an administrator.",
    ideHint:
      "Open the IDE, scaffold a project from @mna/qchat, test it, then package a .japp and upload the build here.",
    preview: "Preview",
    previewTitle: "Preview build",
    previewNote:
      "Preview only shows raw files inside the .japp package. Code runs only in the QChat app.",
    openInNewTab: "Open in new tab",
    close: "Close",
  },
} as const;

type CopyKey = keyof (typeof copy)["vi"];

const statusTone: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  UPLOADED: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REVIEWING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  PUBLISHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  SUSPENDED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  REVOKED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  PRODUCTION: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PREVIEW: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  DEVELOPMENT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PUBLISH: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ROLLBACK: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REVOKE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const danger =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/50";
const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

function bytes(value: number) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}
function when(value: string | null, lang: Lang) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
// Every API error code the Developer Center can receive is translated here so
// a failure never reaches the screen as a bare code such as VERSION_EXISTS.
const errorMessages: Record<string, { vi: string; en: string }> = {
  UNAUTHORIZED: {
    vi: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    en: "Your session has expired. Please sign in again.",
  },
  INVALID_CREDENTIALS: {
    vi: "QChat ID/email hoặc mật khẩu không đúng.",
    en: "Incorrect QChat ID/email or password.",
  },
  ACCOUNT_DISABLED: {
    vi: "Tài khoản này đã bị vô hiệu hoá.",
    en: "This account is disabled.",
  },
  CSRF_REQUIRED: {
    vi: "Yêu cầu bị chặn vì thiếu mã bảo vệ. Hãy tải lại trang rồi thử lại.",
    en: "The request was blocked because its security token was missing. Reload the page and try again.",
  },
  FORBIDDEN: {
    vi: "Bạn không có quyền thực hiện thao tác này.",
    en: "You do not have permission to do this.",
  },
  NOT_FOUND: {
    vi: "Không tìm thấy dữ liệu cần thao tác. Hãy làm mới trang.",
    en: "The item could not be found. Refresh the page.",
  },
  VALIDATION_ERROR: {
    vi: "Dữ liệu chưa hợp lệ. Kiểm tra lại các trường bắt buộc.",
    en: "The data is not valid. Check the required fields.",
  },
  INVALID_URL: {
    vi: "Đường dẫn phải là một URL HTTPS hợp lệ.",
    en: "The address must be a valid HTTPS URL.",
  },
  RATE_LIMITED: {
    vi: "Bạn thao tác quá nhanh. Vui lòng thử lại sau vài phút.",
    en: "Too many requests. Please try again in a few minutes.",
  },
  SERVICE_ERROR: {
    vi: "Máy chủ gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại.",
    en: "The server ran into a problem. Please try again.",
  },
  VERSION_EXISTS: {
    vi: "Phiên bản này đã tồn tại trong ứng dụng. Hãy dùng số phiên bản mới hơn rồi tải lên lại.",
    en: "This version already exists for the app. Use a new version number and upload again.",
  },
  VERSION_MISMATCH: {
    vi: "Số phiên bản trong manifest.json khác với phiên bản bạn nhập.",
    en: "The version in manifest.json does not match the version you entered.",
  },
  NO_VERSION: {
    vi: "Ứng dụng chưa có bản build nào.",
    en: "The app has no builds yet.",
  },
  NO_PUBLISHED_VERSION: {
    vi: "Ứng dụng chưa có phiên bản nào được phát hành.",
    en: "The app has no published version yet.",
  },
  NOT_PUBLISHED: {
    vi: "Phiên bản này chưa được phát hành.",
    en: "This version has not been published.",
  },
  VERSION_REVOKED: {
    vi: "Phiên bản này đã bị thu hồi, không thể phát hành lại.",
    en: "This version was revoked and cannot be released again.",
  },
  APP_SUSPENDED: {
    vi: "Ứng dụng đang bị tạm ngưng.",
    en: "The app is suspended.",
  },
  APP_QUOTA: {
    vi: "Bạn đã đạt giới hạn số ứng dụng được tạo.",
    en: "You have reached the app limit for your account.",
  },
  INVALID_STATE: {
    vi: "Trạng thái vừa thay đổi ở nơi khác. Hãy làm mới trang rồi thử lại.",
    en: "The state changed somewhere else. Refresh the page and try again.",
  },
  REASON_REQUIRED: {
    vi: "Cần nhập lý do dài ít nhất 3 ký tự.",
    en: "Enter a reason of at least 3 characters.",
  },
  ALREADY_DECLARED: {
    vi: "Quyền này đã được khai báo trong manifest.",
    en: "This permission is already declared in the manifest.",
  },
  ALREADY_OWNER: {
    vi: "Người này đã là chủ sở hữu ứng dụng.",
    en: "This person already owns the app.",
  },
  ALREADY_EXISTS: {
    vi: "Mục này đã tồn tại.",
    en: "This item already exists.",
  },
  OWNER_ONLY: {
    vi: "Chỉ chủ sở hữu ứng dụng mới thực hiện được thao tác này.",
    en: "Only the app owner can do this.",
  },
  OWNER_REQUIRED: {
    vi: "Thao tác này cần quyền chủ sở hữu ứng dụng.",
    en: "This action requires app owner rights.",
  },
  REVIEWER_REQUIRED: {
    vi: "Chỉ quản trị viên mới duyệt được mục này.",
    en: "Only administrators can review this item.",
  },
  USER_NOT_FOUND: {
    vi: "Không tìm thấy tài khoản QChat này.",
    en: "No QChat account matches that ID or email.",
  },
  NOTHING_TO_UPDATE: {
    vi: "Không có thay đổi nào để lưu.",
    en: "There is nothing to update.",
  },
  FILE_REQUIRED: {
    vi: "Chưa chọn tệp .japp để tải lên.",
    en: "Choose a .japp file to upload.",
  },
  BUILD_TOO_LARGE: {
    vi: "Gói build vượt quá giới hạn 20 MB.",
    en: "The build exceeds the 20 MB limit.",
  },
  BUILD_EMPTY: {
    vi: "Gói build rỗng, không có tệp nào.",
    en: "The build is empty and contains no files.",
  },
  MANIFEST_MISSING: {
    vi: "Gói .japp thiếu tệp manifest.json ở thư mục gốc.",
    en: "The .japp is missing manifest.json at its root.",
  },
  MANIFEST_INVALID_JSON: {
    vi: "manifest.json không phải JSON hợp lệ.",
    en: "manifest.json is not valid JSON.",
  },
  MANIFEST_INVALID: {
    vi: "Nội dung manifest.json chưa hợp lệ. Kiểm tra lại các trường bắt buộc.",
    en: "The contents of manifest.json are not valid. Check the required fields.",
  },
  MANIFEST_TOO_LARGE: {
    vi: "manifest.json vượt quá dung lượng cho phép.",
    en: "manifest.json is larger than allowed.",
  },
  ENTRY_MISSING: {
    vi: "Gói .japp thiếu tệp app.js.",
    en: "The .japp is missing app.js.",
  },
  ENTRY_INVALID: {
    vi: "app.js không hợp lệ (rỗng hoặc chứa HTML).",
    en: "app.js is not valid (empty or contains HTML).",
  },
  ENTRY_EMPTY: {
    vi: "app.js rỗng. Hãy build lại ứng dụng.",
    en: "app.js is empty. Rebuild the app.",
  },
  ENTRY_TOO_LARGE: {
    vi: "app.js vượt quá 4 MB.",
    en: "app.js exceeds 4 MB.",
  },
  DUPLICATE_ENTRY: {
    vi: "Gói .japp có hai tệp trùng tên.",
    en: "The .japp contains two files with the same name.",
  },
  METADATA_MISSING: {
    vi: "Gói .japp thiếu metadata.json.",
    en: "The .japp is missing metadata.json.",
  },
  METADATA_INVALID: {
    vi: "metadata.json không hợp lệ. Hãy build lại bằng CLI mới.",
    en: "metadata.json is invalid. Rebuild with the current CLI.",
  },
  METADATA_MISMATCH: {
    vi: "metadata.json không khớp với nội dung gói. Hãy build lại.",
    en: "metadata.json does not match the package. Rebuild it.",
  },
  METADATA_TOO_LARGE: {
    vi: "metadata.json vượt quá dung lượng cho phép.",
    en: "metadata.json is larger than allowed.",
  },
  PERMISSIONS_MISSING: {
    vi: "Gói .japp thiếu permissions.json.",
    en: "The .japp is missing permissions.json.",
  },
  PERMISSIONS_INVALID: {
    vi: "permissions.json không hợp lệ.",
    en: "permissions.json is invalid.",
  },
  PERMISSIONS_MISMATCH: {
    vi: "permissions.json không khớp với manifest.json.",
    en: "permissions.json does not match manifest.json.",
  },
  APP_CHECKSUM_MISMATCH: {
    vi: "Checksum của app.js không khớp. Hãy build lại.",
    en: "The app.js checksum does not match. Rebuild the app.",
  },
  UNEXPECTED_FILE: {
    vi: "Gói .japp chứa tệp không được phép ở thư mục gốc.",
    en: "The .japp contains a file that is not allowed at its root.",
  },
  UNSUPPORTED_ASSET: {
    vi: "Gói .japp chứa loại tệp không được hỗ trợ trong assets/.",
    en: "The .japp contains an unsupported file type under assets/.",
  },
  ZIP_INVALID: {
    vi: "Tệp tải lên không phải gói .japp hợp lệ.",
    en: "The uploaded file is not a valid .japp archive.",
  },
  ZIP_INVALID_NAME: {
    vi: "Gói .japp chứa đường dẫn không hợp lệ (../, đường dẫn tuyệt đối).",
    en: "The .japp contains an unsafe path (../ or an absolute path).",
  },
  ZIP_DUPLICATE_FILE: {
    vi: "Gói .japp có hai tệp trùng tên (không phân biệt hoa thường).",
    en: "The .japp contains duplicate file names (case-insensitive).",
  },
  ZIP_ENCRYPTED: {
    vi: "Gói .japp có tệp được mã hoá, không được phép.",
    en: "The .japp contains encrypted files, which are not allowed.",
  },
  ZIP_SYMLINK: {
    vi: "Gói .japp chứa symlink, không được phép.",
    en: "The .japp contains a symlink, which is not allowed.",
  },
  ZIP_FILE_TYPE: {
    vi: "Gói .japp chứa tệp thực thi hoặc loại tệp không được phép.",
    en: "The .japp contains an executable or a disallowed file type.",
  },
  ZIP_TOO_LARGE: {
    vi: "Gói .japp hoặc dữ liệu giải nén vượt quá giới hạn.",
    en: "The .japp or its inflated contents exceed the size limit.",
  },
  ZIP_ENTRY_TOO_LARGE: {
    vi: "Một tệp trong gói .japp vượt quá dung lượng cho phép.",
    en: "A file inside the .japp is larger than allowed.",
  },
  ZIP_TOO_MANY_FILES: {
    vi: "Gói .japp chứa quá nhiều tệp.",
    en: "The .japp contains too many files.",
  },
  ZIP_CHECKSUM: {
    vi: "Gói .japp bị hỏng (sai checksum). Hãy build lại rồi tải lên.",
    en: "The .japp is corrupted (checksum mismatch). Rebuild it and upload again.",
  },
  ZIP_COMPRESSION: {
    vi: "Gói .japp dùng kiểu nén không được hỗ trợ.",
    en: "The .japp uses an unsupported compression method.",
  },
  ZIP_EMPTY: {
    vi: "Gói .japp không có tệp nào.",
    en: "The .japp contains no files.",
  },
  ZIP64_UNSUPPORTED: {
    vi: "Gói .japp định dạng ZIP64 chưa được hỗ trợ.",
    en: "ZIP64 archives are not supported.",
  },
};

function describeError(error: unknown, lang: Lang) {
  const code =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "SERVICE_ERROR";
  const message = errorMessages[code];
  if (message) return message[lang];
  return lang === "vi"
    ? `Không thực hiện được yêu cầu (${code}). Vui lòng thử lại.`
    : `The request could not be completed (${code}). Please try again.`;
}

function duplicateVersionError(version: string, lang: Lang) {
  return lang === "vi"
    ? `Phiên bản ${version} đã tồn tại trong ứng dụng này. Chọn số phiên bản khác rồi tải lên lại.`
    : `Version ${version} already exists for this app. Pick a different version number and upload again.`;
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone[value] ?? statusTone.DRAFT}`}
    >
      {value}
    </span>
  );
}

export default function DeveloperCenter() {
  const [lang, setLang] = useState<Lang>("vi");
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [sidebar, setSidebar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [ide, setIde] = useState<IdeLink | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [copied, setCopied] = useState("");
  const revision = useRef(0);

  const t = (key: CopyKey) => copy[lang][key];

  useEffect(() => {
    const savedLang = localStorage.getItem("qchat.dev.lang");
    const savedTheme = localStorage.getItem("qchat.dev.theme");
    if (savedLang === "en" || savedLang === "vi") setLang(savedLang);
    setDark(savedTheme === "dark");
    void (async () => {
      try {
        const response = await fetch("/api/developer/session", {
          cache: "no-store",
        });
        if (response.ok) setUser((await response.json()) as User);
      } catch {
        // The login screen remains available.
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("qchat.dev.lang", lang);
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("qchat.dev.theme", dark ? "dark" : "light");
  }, [dark]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("x-qchat-csrf", "1");
    if (typeof init?.body === "string")
      headers.set("Content-Type", "application/json");
    const response = await fetch(`/api/developer${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (response.status === 401) {
      setUser(null);
      throw new Error("UNAUTHORIZED");
    }
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "SERVICE_ERROR");
    return data as T;
  }

  function flash(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 4000);
  }
  function failed(e: unknown) {
    setError(describeError(e, lang));
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setSigningIn(true);
    setError("");
    try {
      const response = await fetch("/api/developer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "SERVICE_ERROR");
      setUser(data as User);
      setPassword("");
      setSection("overview");
    } catch (e) {
      failed(e);
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/developer/session", { method: "DELETE" });
    } catch {
      setError(t("logoutError"));
    }
    setUser(null);
    setDetail(null);
    setSelected(null);
  }

  async function loadOverview() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<Dashboard>("/miniapps/developer/dashboard");
      if (current === revision.current) setDashboard(data);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function loadApps() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ items: AppSummary[] }>(
        `/miniapps/developer/apps?q=${encodeURIComponent(search)}&status=${encodeURIComponent(statusFilter)}`,
      );
      if (current === revision.current) setApps(data.items);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function loadDetail(appId: string) {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const [info, stats] = await Promise.all([
        api<AppDetail>(`/miniapps/developer/apps/${appId}`),
        api<Analytics>(`/miniapps/developer/apps/${appId}/analytics`),
      ]);
      if (current !== revision.current) return;
      setDetail(info);
      setAnalytics(stats);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function previewUrl(versionId: string, entry: string) {
    const data = await api<{ token: string }>(
      `/miniapps/review/versions/${versionId}/preview-token`,
    );
    const file = entry
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return `/api/developer/miniapps/review/versions/${versionId}/preview/${data.token}/${file}`;
  }

  async function loadIde() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<IdeLink>("/miniapps/developer/ide");
      if (current === revision.current) setIde(data);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function loadQueue() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<Queue>("/miniapps/review/queue");
      if (current === revision.current) setQueue(data);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  async function loadAudit() {
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<AuditRow[]>("/miniapps/developer/audit");
      if (current === revision.current) setAudit(data);
    } catch (e) {
      if (current === revision.current) failed(e);
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (section === "overview") void loadOverview();
    else if (section === "apps" && !selected) void loadApps();
    else if (section === "reviews") void loadQueue();
    else if (section === "ide") void loadIde();
    else if (section === "audit") void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, section, selected, search, statusFilter]);

  useEffect(() => {
    if (user && selected) void loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selected]);

  function navigate(next: Section) {
    setSection(next);
    setSidebar(false);
    setError("");
    setNotice("");
    if (next === "apps") setSelected(null);
  }

  function openApp(appId: string) {
    setSelected(appId);
    setTab("overview");
    setSection("apps");
    setNewSecret("");
  }

  async function refresh() {
    if (section === "overview") await loadOverview();
    else if (section === "apps" && selected) await loadDetail(selected);
    else if (section === "apps") await loadApps();
    else if (section === "reviews") await loadQueue();
    else if (section === "ide") await loadIde();
    else await loadAudit();
  }

  async function act(run: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      const result = await run();
      if (result instanceof Response && !result.ok) {
        const data = (await result.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "SERVICE_ERROR");
      }
      flash(message);
      await refresh();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  async function removeApp(appId: string, name?: string) {
    if (
      !window.confirm(name ? `${name}\n\n${t("deleteAppNote")}` : t("deleteAppNote"))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/developer/miniapps/developer/apps/${appId}`,
        { method: "DELETE", headers: { "x-qchat-csrf": "1" } },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "SERVICE_ERROR");
      setApps((items) => items.filter((item) => item.appId !== appId));
      setSelected(null);
      setDetail(null);
      setTab("overview");
      flash(t("deleteAppDone"));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }

  if (restoring)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
      </div>
    );

  if (!user)
    return (
      <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2 dark:bg-slate-950">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0c3b2f] p-12 text-white lg:flex">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl"
          />
          <div className="relative flex items-center gap-3 text-2xl font-extrabold">
            <span className="rounded-xl bg-emerald-400 p-2 text-[#0c3b2f]">
              <Boxes size={24} />
            </span>
            QChat
            <span className="self-end pb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-200/60">
              Developer
            </span>
          </div>
          <div className="relative max-w-md">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-300/70">
              Mini Apps
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-sm leading-7 text-emerald-50/65">
              {t("heroBody")}
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-emerald-100/60">
              <ShieldCheck size={17} /> {t("secure")}
            </div>
          </div>
          <p className="relative text-xs text-emerald-100/40">
            © {new Date().getFullYear()} QChat
          </p>
        </section>
        <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
              <LockKeyhole size={24} />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("loginTitle")}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t("loginSubtitle")}
            </p>
            <form onSubmit={login} className="mt-8 space-y-5">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("identifier")}
                <input
                  className={`${input} mt-2`}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t("password")}
                <input
                  className={`${input} mt-2`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  {error}
                </p>
              )}
              <button className={`${primary} w-full`} disabled={signingIn}>
                {signingIn ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <>
                    {t("signIn")} <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-slate-800">
              <button
                className="inline-flex items-center gap-1.5 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              >
                <Globe2 size={14} /> {lang === "vi" ? "English" : "Tiếng Việt"}
              </button>
              <button
                className="inline-flex items-center gap-1.5 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={14} /> : <Moon size={14} />}
                {dark ? "Light" : "Dark"}
              </button>
            </div>
          </div>
        </section>
      </main>
    );

  const navigation: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: t("overview"), icon: LayoutDashboard },
    { id: "apps", label: t("apps"), icon: Boxes },
    ...(user.reviewer
      ? [{ id: "reviews" as Section, label: t("reviews"), icon: ClipboardCheck }]
      : []),
    { id: "ide", label: t("ide"), icon: Download },
    { id: "audit", label: t("audit"), icon: ScrollText },
    { id: "docs", label: t("docs"), icon: BookOpen },
  ];

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {sidebar && (
          <button
            aria-label={lang === "vi" ? "Đóng điều hướng" : "Close navigation"}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0c3b2f] px-5 py-8 text-white transition-transform lg:translate-x-0 ${sidebar ? "translate-x-0" : "-translate-x-full"}`}
        >
          <a href="/developer" className="flex items-center gap-3 px-3 text-2xl font-extrabold">
            <span className="rounded-xl bg-emerald-400 p-2 text-[#0c3b2f]">
              <Boxes size={23} />
            </span>
            QChat
            <span className="self-end pb-1 text-[10px] font-medium uppercase tracking-widest text-emerald-200/60">
              Dev
            </span>
          </a>
          <p className="mb-4 mt-12 px-4 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/40">
            {t("workspace")}
          </p>
          <nav aria-label="Developer" className="space-y-2">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={section === id ? "page" : undefined}
                onClick={() => navigate(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition ${section === id ? "bg-emerald-400 text-[#0c3b2f] shadow-lg shadow-black/5" : "text-emerald-50/65 hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={19} />
                {label}
                {id === "apps" && dashboard && dashboard.pendingBuilds > 0 && (
                  <span className="ml-auto rounded-md bg-white/15 px-1.5 text-xs">
                    {dashboard.pendingBuilds}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <Sparkles className="mb-3 text-emerald-300" size={22} />
            <p className="text-sm font-semibold">Mini App SDK</p>
            <p className="mt-2 text-xs leading-5 text-emerald-50/50">
              {lang === "vi"
                ? "Dùng @mna/qchat để viết TSX và gọi API host an toàn."
                : "Use @mna/qchat to write TSX and call host APIs safely."}
            </p>
            <button
              onClick={() => navigate("docs")}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
            >
              {t("docsSdk")} <ChevronRight size={13} />
            </button>
          </div>
          <button
            onClick={() => void logout()}
            className="mt-5 flex items-center gap-3 px-4 py-3 text-sm text-emerald-50/65 hover:text-white"
          >
            <LogOut size={18} /> {t("signOut")}
          </button>
        </aside>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
            <div className="flex h-16 items-center gap-3 px-5 sm:px-8">
              <button
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
                onClick={() => setSidebar(true)}
                aria-label={lang === "vi" ? "Mở điều hướng" : "Open navigation"}
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{t("developerCenter")}</p>
                <p className="truncate text-xs text-slate-400">
                  {user.nickname} · @{user.qchatId}
                  {user.reviewer ? " · ADMIN" : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setLang(lang === "vi" ? "en" : "vi")}
                  title={t("language")}
                  aria-label={t("language")}
                  data-testid="toggle-language"
                >
                  <Globe2 size={18} />
                </button>
                <button
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setDark(!dark)}
                  title={t("theme")}
                  aria-label={t("theme")}
                  data-testid="toggle-theme"
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void refresh()}
                  title={t("refresh")}
                  aria-label={t("refresh")}
                >
                  <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </header>

          <main className="px-5 py-7 sm:px-8 lg:px-10">
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
              >
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError("")} aria-label="Dismiss">
                  <X size={16} />
                </button>
              </div>
            )}
            {notice && (
              <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 size={18} /> {notice}
              </div>
            )}

            {section === "overview" && (
              <Overview
                dashboard={dashboard}
                loading={busy}
                t={t}
                lang={lang}
                onCreate={() => {
                  setSection("apps");
                  setSelected(null);
                  setShowCreate(true);
                }}
                onOpen={openApp}
              />
            )}
            {section === "apps" &&
              (selected ? (
                <AppDetailView
                  detail={detail}
                  analytics={analytics}
                  loading={busy}
                  tab={tab}
                  setTab={setTab}
                  t={t}
                  lang={lang}
                  newSecret={newSecret}
                  setNewSecret={setNewSecret}
                  copied={copied}
                  setCopied={setCopied}
                  onBack={() => {
                    setSelected(null);
                    setDetail(null);
                    setTab("overview");
                  }}
                  onRefresh={() => void loadDetail(selected)}
                  onDelete={() => void removeApp(selected, detail?.app.name)}
                  act={act}
                  failed={failed}
                  flash={flash}
                />
              ) : (
                <AppsList
                  apps={apps}
                  loading={busy}
                  t={t}
                  lang={lang}
                  query={query}
                  setQuery={setQuery}
                  search={search}
                  setSearch={setSearch}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  showCreate={showCreate}
                  setShowCreate={setShowCreate}
                  onOpen={openApp}
                  onCreate={async (payload) => {
                    const created = await api<AppSummary>("/miniapps/developer/apps", {
                      method: "POST",
                      body: JSON.stringify(payload),
                    });
                    setShowCreate(false);
                    flash(created.appId);
                    openApp(created.appId);
                  }}
                  failed={failed}
                />
              ))}
            {section === "reviews" && (
              <ReviewQueue
                queue={queue}
                loading={busy}
                t={t}
                lang={lang}
                act={act}
                failed={failed}
                previewUrl={previewUrl}
              />
            )}
            {section === "ide" && (
              <IdeSection
                ide={ide}
                loading={busy}
                t={t}
                lang={lang}
                onRefresh={() => void loadIde()}
              />
            )}
            {section === "audit" && (
              <AuditLog rows={audit} loading={busy} t={t} lang={lang} />
            )}
            {section === "docs" && <Docs lang={lang} t={t} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Overview({
  dashboard,
  loading,
  t,
  lang,
  onCreate,
  onOpen,
}: {
  dashboard: Dashboard | null;
  loading: boolean;
  t: (key: CopyKey) => string;
  lang: Lang;
  onCreate: () => void;
  onOpen: (appId: string) => void;
}) {
  return (
    <>
      <PageHead
        title={t("overviewTitle")}
        subtitle={t("overviewSubtitle")}
        action={
          <button className={primary} onClick={onCreate}>
            <Plus size={17} /> {t("createApp")}
          </button>
        }
      />
      {loading && !dashboard ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Boxes} label={t("totalApps")} value={dashboard?.apps ?? 0} />
            <Stat
              icon={PackageCheck}
              label={t("published")}
              value={dashboard?.published ?? 0}
            />
            <Stat
              icon={ClipboardCheck}
              label={t("pendingBuilds")}
              value={dashboard?.pendingBuilds ?? 0}
            />
            <Stat icon={Activity} label={t("opens")} value={dashboard?.opens ?? 0} />
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className={card}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold">{t("recentActivity")}</h2>
                <ScrollText size={17} className="text-slate-400" />
              </div>
              {!dashboard?.recent.length ? (
                <Empty text={t("noData")} />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dashboard.recent.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {item.action === "PUBLISH" ? (
                          <PackageCheck size={16} />
                        ) : item.action === "ROLLBACK" ? (
                          <RotateCcw size={16} />
                        ) : (
                          <XCircle size={16} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.action} · v{item.version} · {when(item.createdAt, lang)}
                        </p>
                      </div>
                      <button
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        onClick={() => onOpen(item.appId)}
                      >
                        {t("open")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={card}>
              <h2 className="text-sm font-bold">{t("storage")}</h2>
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs dark:bg-slate-800">
                <FileArchive size={15} />
                {dashboard?.storage === "s3" ? "S3 / RustFS" : "Filesystem"}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{t("rejected")}</span>
                  <span className="font-bold">{dashboard?.rejected ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{t("opens")}</span>
                  <span className="font-bold">{dashboard?.opens ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-20 text-slate-400">
      <Loader2 className="animate-spin" size={26} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700">
      <Boxes size={24} className="mb-2 opacity-60" />
      {text}
    </div>
  );
}

function AppsList({
  apps,
  loading,
  t,
  lang,
  query,
  setQuery,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  showCreate,
  setShowCreate,
  onOpen,
  onCreate,
  failed,
}: {
  apps: AppSummary[];
  loading: boolean;
  t: (key: CopyKey) => string;
  lang: Lang;
  query: string;
  setQuery: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  showCreate: boolean;
  setShowCreate: (value: boolean) => void;
  onOpen: (appId: string) => void;
  onCreate: (payload: Record<string, string>) => Promise<void>;
  failed: (error: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "utilities",
    developerName: "",
    contactEmail: "",
    iconUrl: "",
    supportUrl: "",
    privacyUrl: "",
  });
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHead
        title={t("appsTitle")}
        subtitle={t("appsSubtitle")}
        action={
          <button className={primary} onClick={() => setShowCreate(true)}>
            <Plus size={17} /> {t("createApp")}
          </button>
        }
      />
      {showCreate && (
        <div className={`${card} mb-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold">{t("createApp")}</h2>
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setShowCreate(false)}
              aria-label={t("cancel")}
            >
              <X size={17} />
            </button>
          </div>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await onCreate(form);
              } catch (e) {
                failed(e);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("name")} *
              <input
                className={`${input} mt-1.5`}
                required
                minLength={2}
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("developerName")} *
              <input
                className={`${input} mt-1.5`}
                required
                minLength={2}
                maxLength={80}
                value={form.developerName}
                onChange={(e) => setForm({ ...form, developerName: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("contactEmail")} *
              <input
                className={`${input} mt-1.5`}
                type="email"
                required
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("category")} *
              <select
                className={`${input} mt-1.5`}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
              {t("description")}
              <textarea
                className={`${input} mt-1.5 min-h-20`}
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("iconUrl")}
              <input
                className={`${input} mt-1.5`}
                type="url"
                value={form.iconUrl}
                onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t("supportUrl")}
              <input
                className={`${input} mt-1.5`}
                type="url"
                value={form.supportUrl}
                onChange={(e) => setForm({ ...form, supportUrl: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
              {t("privacyUrl")}
              <input
                className={`${input} mt-1.5`}
                type="url"
                value={form.privacyUrl}
                onChange={(e) => setForm({ ...form, privacyUrl: e.target.value })}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className={primary} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t("create")}
              </button>
              <button
                type="button"
                className={secondary}
                onClick={() => setShowCreate(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className={`${input} pl-9`}
            placeholder={t("searchApps")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(query);
            }}
          />
        </div>
        <select
          className={`${input} w-auto`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("allStatuses")}</option>
          {["DRAFT", "UPLOADED", "REVIEWING", "APPROVED", "PUBLISHED", "REJECTED", "SUSPENDED"].map(
            (status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ),
          )}
        </select>
        <button className={secondary} onClick={() => setSearch(query)}>
          {t("search")}
        </button>
      </div>
      {loading && !apps.length ? (
        <Loading />
      ) : !apps.length ? (
        <Empty text={search ? t("noResults") : t("noApps")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <button
              key={app.appId}
              onClick={() => onOpen(app.appId)}
              className={`${card} text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                  {app.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Boxes size={20} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{app.name}</p>
                  <p className="truncate font-mono text-[11px] text-slate-400">{app.appId}</p>
                </div>
                <Badge value={app.status} />
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {app.description || "—"}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
                <span>
                  {t("currentVersion")}: {app.currentVersion ?? "—"}
                </span>
                <span>{when(app.updatedAt, lang)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AppDetailView({
  detail,
  analytics,
  loading,
  tab,
  setTab,
  t,
  lang,
  newSecret,
  setNewSecret,
  copied,
  setCopied,
  onBack,
  onRefresh,
  onDelete,
  act,
  failed,
  flash,
}: {
  detail: AppDetail | null;
  analytics: Analytics | null;
  loading: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  t: (key: CopyKey) => string;
  lang: Lang;
  newSecret: string;
  setNewSecret: (value: string) => void;
  copied: string;
  setCopied: (value: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  onDelete: () => void;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
  flash: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [copiedAppId, setCopiedAppId] = useState(false);
  useEffect(() => {
    setEditing(false);
    setCopiedAppId(false);
  }, [detail?.app.appId]);
  if (!detail)
    return (
      <>
        <button className={`${secondary} mb-4`} onClick={onBack}>
          <ArrowLeft size={16} /> {t("back")}
        </button>
        <Loading />
      </>
    );
  const app = detail.app;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("appOverview") },
    { id: "builds", label: t("builds") },
    { id: "releases", label: t("releases") },
    { id: "permissions", label: t("permissions") },
    { id: "analytics", label: t("analytics") },
    { id: "team", label: t("team") },
    { id: "keys", label: t("keys") },
  ];
  return (
    <>
      <button className={`${secondary} mb-4`} onClick={onBack}>
        <ArrowLeft size={16} /> {t("back")}
      </button>
      <div className={`${card} mb-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
            {app.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={app.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Boxes size={24} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{app.name}</h1>
              <Badge value={app.status} />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {app.role}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="font-mono text-xs text-slate-400">{app.appId}</p>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(app.appId);
                    setCopiedAppId(true);
                    window.setTimeout(() => setCopiedAppId(false), 2000);
                  } catch {
                    // Clipboard access can be denied; the ID stays selectable.
                  }
                }}
                aria-label={t("copy")}
                title={copiedAppId ? t("copied") : t("copy")}
              >
                {copiedAppId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {app.description || "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className={secondary}
              onClick={() => setEditing((value) => !value)}
              disabled={loading}
            >
              <Pencil size={15} />
              {t("editApp")}
            </button>
            <button className={secondary} onClick={onRefresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {t("refresh")}
            </button>
            {app.role === "OWNER" && (
              <button className={danger} onClick={onDelete} disabled={loading}>
                <Trash2 size={15} />
                {t("deleteApp")}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-3 dark:border-slate-800 dark:text-slate-400">
          <span>
            {t("currentVersion")}: <b className="text-slate-800 dark:text-slate-200">{app.currentVersion ?? "—"}</b>
          </span>
          <span>
            {t("category")}: <b className="text-slate-800 dark:text-slate-200">{app.category}</b>
          </span>
          <span>
            {t("developerName")}:{" "}
            <b className="text-slate-800 dark:text-slate-200">{app.developerName}</b>
          </span>
        </div>
      </div>
      {editing && (
        <EditAppForm
          app={app}
          t={t}
          failed={failed}
          onSaved={() => {
            flash(t("saved"));
            onRefresh();
          }}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${tab === item.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <AppOverview detail={detail} analytics={analytics} t={t} lang={lang} />}
      {tab === "builds" && (
        <Builds
          detail={detail}
          t={t}
          lang={lang}
          act={act}
          failed={failed}
          flash={flash}
          onRefresh={onRefresh}
        />
      )}
      {tab === "releases" && <Releases detail={detail} t={t} lang={lang} />}
      {tab === "permissions" && (
        <Permissions detail={detail} t={t} lang={lang} act={act} failed={failed} />
      )}
      {tab === "analytics" && <AnalyticsView analytics={analytics} t={t} />}
      {tab === "team" && (
        <Team detail={detail} t={t} lang={lang} act={act} failed={failed} />
      )}
      {tab === "keys" && (
        <Keys
          detail={detail}
          t={t}
          lang={lang}
          newSecret={newSecret}
          setNewSecret={setNewSecret}
          copied={copied}
          setCopied={setCopied}
          act={act}
          failed={failed}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

function EditAppForm({
  app,
  t,
  failed,
  onSaved,
  onClose,
}: {
  app: AppDetail["app"];
  t: (key: CopyKey) => string;
  failed: (error: unknown) => void;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: app.name,
    description: app.description,
    category: app.category,
    developerName: app.developerName,
    contactEmail: app.contactEmail,
    iconUrl: app.iconUrl,
    supportUrl: app.supportUrl,
    privacyUrl: app.privacyUrl,
  });
  const [saving, setSaving] = useState(false);

  return (
    <div className={`${card} mb-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold">{t("editApp")}</h2>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={onClose}
          aria-label={t("cancel")}
        >
          <X size={17} />
        </button>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            const response = await fetch(
              `/api/developer/miniapps/developer/apps/${app.appId}`,
              {
                method: "PATCH",
                headers: {
                  "x-qchat-csrf": "1",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: form.name.trim(),
                  description: form.description.trim(),
                  category: form.category,
                  developerName: form.developerName.trim(),
                  contactEmail: form.contactEmail.trim(),
                  iconUrl: form.iconUrl.trim(),
                  supportUrl: form.supportUrl.trim(),
                  privacyUrl: form.privacyUrl.trim(),
                }),
              },
            );
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            if (!response.ok) throw new Error(data.error ?? "SERVICE_ERROR");
            onSaved();
            onClose();
          } catch (e) {
            failed(e);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("name")} *
          <input
            className={`${input} mt-1.5`}
            required
            minLength={2}
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("developerName")} *
          <input
            className={`${input} mt-1.5`}
            required
            minLength={2}
            maxLength={80}
            value={form.developerName}
            onChange={(e) => setForm({ ...form, developerName: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("contactEmail")} *
          <input
            className={`${input} mt-1.5`}
            type="email"
            required
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("category")} *
          <select
            className={`${input} mt-1.5`}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
          {t("description")}
          <textarea
            className={`${input} mt-1.5 min-h-20`}
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("iconUrl")}
          <input
            className={`${input} mt-1.5`}
            type="url"
            value={form.iconUrl}
            onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("supportUrl")}
          <input
            className={`${input} mt-1.5`}
            type="url"
            value={form.supportUrl}
            onChange={(e) => setForm({ ...form, supportUrl: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
          {t("privacyUrl")}
          <input
            className={`${input} mt-1.5`}
            type="url"
            value={form.privacyUrl}
            onChange={(e) => setForm({ ...form, privacyUrl: e.target.value })}
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className={primary} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t("save")}
          </button>
          <button type="button" className={secondary} onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}

function AppOverview({
  detail,
  analytics,
  t,
  lang,
}: {
  detail: AppDetail;
  analytics: Analytics | null;
  t: (key: CopyKey) => string;
  lang: Lang;
}) {
  const latest = detail.versions[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={PackageCheck} label={t("currentVersion")} value={detail.app.currentVersion ?? "—"} />
      <Stat icon={Activity} label={t("opens")} value={analytics?.events.find((e) => e.event === "open")?.count ?? 0} />
      <Stat icon={FileArchive} label={t("builds")} value={detail.versions.length} />
      <Stat icon={ShieldCheck} label={t("permissions")} value={detail.app.requestedPermissions.length} />
      <div className={`${card} sm:col-span-2 xl:col-span-4`}>
        <h2 className="text-sm font-bold">{t("builds")}</h2>
        {!latest ? (
          <Empty text={t("noBuilds")} />
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">v{latest.version}</span>
            <Badge value={latest.status} />
            <span>{bytes(latest.size)}</span>
            <span>{latest.entry}</span>
            <span>{when(latest.createdAt, lang)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Builds({
  detail,
  t,
  lang,
  act,
  failed,
  flash,
  onRefresh,
}: {
  detail: AppDetail;
  t: (key: CopyKey) => string;
  lang: Lang;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
  flash: (message: string) => void;
  onRefresh: () => void;
}) {
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState("DEVELOPMENT");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = version.trim();
  const duplicate = trimmed
    ? detail.versions.find((build) => build.version === trimmed)
    : undefined;

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (duplicate) {
      setUploadError(duplicateVersionError(trimmed, lang));
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.set("version", trimmed);
      form.set("channel", channel);
      form.set("file", file);
      const response = await fetch(
        `/api/developer/miniapps/developer/apps/${detail.app.appId}/builds`,
        { method: "POST", headers: { "x-qchat-csrf": "1" }, body: form },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        const code = data.error ?? "SERVICE_ERROR";
        setUploadError(
          code === "VERSION_EXISTS"
            ? duplicateVersionError(trimmed, lang)
            : describeError(code, lang),
        );
        throw new Error(code);
      }
      flash(`${detail.app.appId} v${trimmed}`);
      setVersion("");
      setFile(null);
      setUploadError("");
      if (inputRef.current) inputRef.current.value = "";
      await onRefresh();
    } catch (e) {
      failed(e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className={`${card} mb-5`}>
        <div>
          <h2 className="text-sm font-bold">{t("uploadBuild")}</h2>
          <p className="mt-1 text-xs text-slate-400">{t("uploadHint")}</p>
        </div>
        <form onSubmit={upload} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("version")} *
            <input
              className={`${input} mt-1.5`}
              required
              placeholder="1.0.0"
              pattern="\d{1,4}\.\d{1,4}\.\d{1,4}(-[0-9A-Za-z.\-]{1,20})?"
              value={version}
              aria-invalid={duplicate ? true : undefined}
              aria-describedby={duplicate ? "upload-version-duplicate" : undefined}
              onChange={(e) => {
                setVersion(e.target.value);
                setUploadError("");
              }}
            />
            {duplicate && (
              <span
                id="upload-version-duplicate"
                className="mt-1 block text-[11px] font-medium text-red-600 dark:text-red-400"
              >
                {duplicateVersionError(trimmed, lang)}
              </span>
            )}
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("channel")}
            <select className={`${input} mt-1.5`} value={channel} onChange={(e) => setChannel(e.target.value)}>
              {["DEVELOPMENT", "PREVIEW", "PRODUCTION"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t("file")} *
            <input
              ref={inputRef}
              className={`${input} mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold dark:file:bg-slate-800`}
              type="file"
              accept=".japp,application/octet-stream"
              required
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setUploadError("");
              }}
            />
          </label>
          <button className={primary} disabled={uploading || Boolean(duplicate)}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {uploading ? t("uploading") : t("upload")}
          </button>
        </form>
        {uploadError && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{uploadError}</span>
          </p>
        )}
      </div>
      <div className={`${card} overflow-x-auto`}>
        {!detail.versions.length ? (
          <Empty text={t("noBuilds")} />
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-3">{t("version")}</th>
                <th className="pb-3">{t("status")}</th>
                <th className="pb-3">{t("channel")}</th>
                <th className="pb-3">{t("size")}</th>
                <th className="pb-3">{t("runtime")}</th>
                <th className="pb-3">{t("time")}</th>
                <th className="pb-3 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detail.versions.map((build) => (
                <tr key={build.id} className="align-top">
                  <td className="py-3">
                    <p className="font-bold">v{build.version}</p>
                    <p className="font-mono text-[10px] text-slate-400">{build.sha256.slice(0, 12)}…</p>
                  </td>
                  <td className="py-3">
                    <Badge value={build.status} />
                    {build.reviews?.[0]?.reason && (
                      <p className="mt-1 max-w-48 text-[11px] text-red-500">{build.reviews[0].reason}</p>
                    )}
                  </td>
                  <td className="py-3 text-xs text-slate-500">{build.channel}</td>
                  <td className="py-3 text-xs">{bytes(build.size)}</td>
                  <td className="py-3 text-xs">{build.minRuntimeVersion}</td>
                  <td className="py-3 text-xs text-slate-400">{when(build.createdAt, lang)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {(["UPLOADED", "REJECTED"].includes(build.status) ||
                        (build.status === "REVOKED" && !build.publishedAt)) && (
                        <button
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          onClick={() =>
                            void act(
                              () =>
                                fetch(
                                  `/api/developer/miniapps/developer/apps/${detail.app.appId}/versions/${build.id}/submit`,
                                  { method: "POST", headers: { "x-qchat-csrf": "1" } },
                                ),
                              "REVIEWING",
                            )
                          }
                        >
                          {t("submit")}
                        </button>
                      )}
                      {build.status === "APPROVED" && (
                        <button
                          className="rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                          onClick={() =>
                            void act(
                              () =>
                                fetch(
                                  `/api/developer/miniapps/developer/apps/${detail.app.appId}/versions/${build.id}/release`,
                                  { method: "POST", headers: { "x-qchat-csrf": "1" } },
                                ),
                              "PUBLISHED",
                            )
                          }
                        >
                          {t("release")}
                        </button>
                      )}
                      {build.status === "REVOKED" && build.publishedAt !== null && (
                        <button
                          className="rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                          onClick={() =>
                            void act(
                              () =>
                                fetch(
                                  `/api/developer/miniapps/developer/apps/${detail.app.appId}/versions/${build.id}/release`,
                                  { method: "POST", headers: { "x-qchat-csrf": "1" } },
                                ),
                              "PUBLISHED",
                            )
                          }
                        >
                          {t("republish")}
                        </button>
                      )}
                      {build.status === "PUBLISHED" &&
                        build.version !== detail.app.currentVersion && (
                          <button
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() =>
                              void act(
                                () =>
                                  fetch(
                                    `/api/developer/miniapps/developer/apps/${detail.app.appId}/rollback`,
                                    {
                                      method: "POST",
                                      headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                                      body: JSON.stringify({ version: build.version }),
                                    },
                                  ),
                                "PUBLISHED",
                              )
                            }
                          >
                            {t("rollback")}
                          </button>
                        )}
                      {!build.revokedAt && (
                        <button
                          className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                          onClick={() => {
                            const reason = window.prompt(t("revokeReason"));
                            if (!reason || reason.trim().length < 3) return;
                            void act(
                              () =>
                                fetch(
                                  `/api/developer/miniapps/developer/apps/${detail.app.appId}/revoke`,
                                  {
                                    method: "POST",
                                    headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                                    body: JSON.stringify({ version: build.version, reason: reason.trim() }),
                                  },
                                ),
                              "REVOKED",
                            );
                          }}
                        >
                          {t("revoke")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Releases({
  detail,
  t,
  lang,
}: {
  detail: AppDetail;
  t: (key: CopyKey) => string;
  lang: Lang;
}) {
  return (
    <div className={`${card} overflow-x-auto`}>
      {!detail.releases.length ? (
        <Empty text={t("noReleases")} />
      ) : (
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-3">{t("version")}</th>
              <th className="pb-3">{t("action")}</th>
              <th className="pb-3">{t("note")}</th>
              <th className="pb-3">{t("time")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {detail.releases.map((release) => (
              <tr key={release.id}>
                <td className="py-3 font-bold">v{release.versionLabel}</td>
                <td className="py-3">
                  <Badge value={release.action} />
                </td>
                <td className="py-3 text-xs text-slate-500">{release.note || "—"}</td>
                <td className="py-3 text-xs text-slate-400">{when(release.createdAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Permissions({
  detail,
  t,
  lang,
  act,
  failed,
}: {
  detail: AppDetail;
  t: (key: CopyKey) => string;
  lang: Lang;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
}) {
  const [permission, setPermission] = useState(detail.permissionCatalog[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const available = detail.permissionCatalog.filter(
    (item) => !detail.app.requestedPermissions.includes(item.id),
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h2 className="text-sm font-bold">{t("declared")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.app.requestedPermissions.length ? (
            detail.app.requestedPermissions.map((item) => (
              <span
                key={item}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              >
                {item}
              </span>
            ))
          ) : (
            <p className="text-xs text-slate-400">{t("noData")}</p>
          )}
        </div>
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">
          {t("permissionCatalog")}
        </h3>
        <ul className="mt-2 divide-y divide-slate-100 text-xs dark:divide-slate-800">
          {detail.permissionCatalog.map((item) => (
            <li key={item.id} className="py-2.5">
              <p className="font-mono font-semibold">{item.id}</p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">{item.description}</p>
              {item.sensitive && (
                <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {t("sensitive")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold">{t("requestPermission")}</h2>
        {available.length ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await act(
                  () =>
                    fetch(`/api/developer/miniapps/developer/apps/${detail.app.appId}/permissions`, {
                      method: "POST",
                      headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                      body: JSON.stringify({ permission, reason }),
                    }),
                  "PENDING",
                );
                setReason("");
              } catch (e) {
                failed(e);
              }
            }}
          >
            <select className={input} value={permission} onChange={(e) => setPermission(e.target.value)}>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
            <textarea
              className={`${input} min-h-20`}
              required
              minLength={10}
              maxLength={500}
              placeholder={t("reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button className={primary}>{t("requestPermission")}</button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-slate-400">{t("noData")}</p>
        )}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">
          {t("permissionRequests")}
        </h3>
        {!detail.permissions.length ? (
          <p className="mt-2 text-xs text-slate-400">{t("noPermissions")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {detail.permissions.map((request) => (
              <li key={request.id} className="py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{request.permission}</span>
                  <Badge value={request.status} />
                </div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{request.reason}</p>
                <p className="mt-1 text-[10px] text-slate-400">{when(request.createdAt, lang)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AnalyticsView({ analytics, t }: { analytics: Analytics | null; t: (key: CopyKey) => string }) {
  if (!analytics) return <Loading />;
  const total = analytics.events.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={card}>
        <h2 className="text-sm font-bold">{t("events")}</h2>
        {!analytics.events.length ? (
          <Empty text={t("noData")} />
        ) : (
          <ul className="mt-3 space-y-3">
            {analytics.events.map((event) => (
              <li key={event.event}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{event.event}</span>
                  <span className="text-slate-400">{event.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${total ? Math.max(2, (event.count / total) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold">{t("opensByVersion")}</h2>
        {!analytics.versions.length ? (
          <Empty text={t("noData")} />
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {analytics.versions.map((item) => (
              <li key={item.version} className="flex items-center justify-between py-2.5">
                <span className="font-mono font-semibold">v{item.version}</span>
                <span className="text-slate-400">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
          {t("errors")}
        </h3>
        {!analytics.errors.length ? (
          <p className="mt-2 text-xs text-slate-400">{t("noErrors")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5 font-mono text-[11px] text-red-500">
            {analytics.errors.map((item, index) => (
              <li key={`${item.createdAt}-${index}`}>
                {item.errorCode} · v{item.version}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Team({
  detail,
  t,
  lang,
  act,
  failed,
}: {
  detail: AppDetail;
  t: (key: CopyKey) => string;
  lang: Lang;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
}) {
  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [role, setRole] = useState("DEVELOPER");
  return (
    <div className={`${card} max-w-2xl`}>
      <h2 className="text-sm font-bold">{t("members")}</h2>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        <li className="flex items-center gap-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t("owner")}</p>
            <p className="text-xs text-slate-400">—</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            OWNER
          </span>
        </li>
        {detail.members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Users size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{member.user.nickname}</p>
              <p className="text-xs text-slate-400">@{member.user.qchatId}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {member.role}
            </span>
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
              onClick={() =>
                void act(
                  () =>
                    fetch(
                      `/api/developer/miniapps/developer/apps/${detail.app.appId}/members/${member.user.id}`,
                      { method: "DELETE", headers: { "x-qchat-csrf": "1" } },
                    ),
                  "REMOVED",
                )
              }
              aria-label={t("remove")}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await act(
              () =>
                fetch(`/api/developer/miniapps/developer/apps/${detail.app.appId}/members`, {
                  method: "POST",
                  headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                  body: JSON.stringify({ identifier: memberIdentifier, role }),
                }),
              "ADDED",
            );
            setMemberIdentifier("");
          } catch (e) {
            failed(e);
          }
        }}
      >
        <label className="min-w-48 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("memberIdentifier")}
          <input
            className={`${input} mt-1.5`}
            required
            minLength={3}
            value={memberIdentifier}
            onChange={(e) => setMemberIdentifier(e.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("role")}
          <select className={`${input} mt-1.5`} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="DEVELOPER">DEVELOPER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
        <button className={primary}>
          <Plus size={16} /> {t("addMember")}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-slate-400">
        {lang === "vi"
          ? "Chỉ chủ sở hữu có thể thêm hoặc xoá thành viên và tạo API key."
          : "Only the owner can add or remove members and create API keys."}
      </p>
    </div>
  );
}

function Keys({
  detail,
  t,
  lang,
  newSecret,
  setNewSecret,
  copied,
  setCopied,
  act,
  failed,
  onRefresh,
}: {
  detail: AppDetail;
  t: (key: CopyKey) => string;
  lang: Lang;
  newSecret: string;
  setNewSecret: (value: string) => void;
  copied: string;
  setCopied: (value: string) => void;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className={`${card} max-w-3xl`}>
      <h2 className="text-sm font-bold">{t("keys")}</h2>
      <p className="mt-1 text-xs text-slate-400">{t("keyHint")}</p>
      {newSecret && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/50">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t("secretOnce")}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{newSecret}</code>
            <button
              className={secondary}
              onClick={async () => {
                await navigator.clipboard.writeText(newSecret);
                setCopied(newSecret);
              }}
            >
              {copied === newSecret ? <Check size={14} /> : <Copy size={14} />}
              {copied === newSecret ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      )}
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {detail.keys.map((key) => (
          <li key={key.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <KeyRound size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{key.name}</p>
              <p className="font-mono text-[11px] text-slate-400">
                {key.prefix}… · {t("lastUsed")}: {key.lastUsedAt ? when(key.lastUsedAt, lang) : "—"}
              </p>
            </div>
            {key.revokedAt ? (
              <Badge value="REVOKED" />
            ) : (
              <button
                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                onClick={() =>
                  void act(
                    () =>
                      fetch(
                        `/api/developer/miniapps/developer/apps/${detail.app.appId}/keys/${key.id}`,
                        { method: "DELETE", headers: { "x-qchat-csrf": "1" } },
                      ),
                    "REVOKED",
                  )
                }
              >
                {t("revoke")}
              </button>
            )}
          </li>
        ))}
        {!detail.keys.length && <li className="py-3 text-xs text-slate-400">{t("noKeys")}</li>}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const response = await fetch(
              `/api/developer/miniapps/developer/apps/${detail.app.appId}/keys`,
              {
                method: "POST",
                headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              },
            );
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
              secret?: string;
            };
            if (!response.ok) throw new Error(data.error ?? "SERVICE_ERROR");
            setNewSecret(data.secret ?? "");
            setName("");
            await onRefresh();
          } catch (e) {
            failed(e);
          }
        }}
      >
        <label className="min-w-48 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t("keyName")}
          <input
            className={`${input} mt-1.5`}
            required
            minLength={2}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className={primary}>
          <KeyRound size={16} /> {t("createKey")}
        </button>
      </form>
    </div>
  );
}

function IdeSection({
  ide,
  loading,
  t,
  lang,
  onRefresh,
}: {
  ide: IdeLink | null;
  loading: boolean;
  t: (key: CopyKey) => string;
  lang: Lang;
  onRefresh: () => void;
}) {
  const vi = lang === "vi";
  const link =
    ide && ide.enabled && /^(https?:\/\/|\/)/i.test(ide.url) ? ide.url : "";
  return (
    <>
      <PageHead title={t("ideTitle")} subtitle={t("ideSubtitle")} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className={card}>
          {loading && !ide ? (
            <Loading />
          ) : (
            <>
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                  <Download size={26} />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {ide?.label || "QChat Mini App IDE"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {ide?.note || t("ideHint")}
                  </p>
                </div>
              </div>
              {link ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    className={primary}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("ideDownload")} <ArrowRight size={16} />
                  </a>
                  <span className="text-xs text-slate-400">{t("ideReady")}</span>
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  {t("ideUnavailable")}
                </p>
              )}
              <button className={`${secondary} mt-5`} onClick={onRefresh}>
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{" "}
                {t("refresh")}
              </button>
            </>
          )}
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Sparkles size={17} className="text-emerald-600" />{" "}
            {vi ? "Quy trình" : "Workflow"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t("ideHint")}
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              {vi
                ? "Tạo ứng dụng để nhận app ID (mp_…) và tải IDE về máy."
                : "Create an app to get an app ID (mp_…) and download the IDE."}
            </li>
            <li>
              {vi
                ? "Viết mã, khai báo quyền và chạy thử trong IDE."
                : "Write code, declare permissions and test it in the IDE."}
            </li>
            <li>
              {vi
                ? "Chạy qchat build để tạo .japp, tải lên tab Build rồi gửi duyệt."
                : "Run qchat build to produce a .japp, upload it in the Build tab and submit for review."}
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}

function ReviewQueue({
  queue,
  loading,
  t,
  lang,
  act,
  failed,
  previewUrl,
}: {
  queue: Queue | null;
  loading: boolean;
  t: (key: CopyKey) => string;
  lang: Lang;
  act: (run: () => Promise<unknown>, message: string) => Promise<void>;
  failed: (error: unknown) => void;
  previewUrl: (versionId: string, entry: string) => Promise<string>;
}) {
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{
    id: string;
    name: string;
    version: string;
    entry: string;
    url: string;
  } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  async function openPreview(version: Version & { miniApp: { name: string } }) {
    setPreview({
      id: version.id,
      name: version.miniApp.name,
      version: version.version,
      entry: version.entry,
      url: "",
    });
    setPreviewKey((key) => key + 1);
    try {
      const url = await previewUrl(version.id, version.entry);
      setPreview((current) =>
        current?.id === version.id ? { ...current, url } : current,
      );
    } catch (error) {
      setPreview(null);
      failed(error);
    }
  }

  async function reloadPreview() {
    if (!preview) return;
    try {
      const url = await previewUrl(preview.id, preview.entry);
      setPreview({ ...preview, url });
      setPreviewKey((key) => key + 1);
    } catch (error) {
      failed(error);
    }
  }

  useEffect(() => {
    if (!preview) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [preview]);
  if (loading && !queue) return <Loading />;
  return (
    <>
      <PageHead title={t("reviewsTitle")} subtitle={t("reviewsSubtitle")} />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 text-sm font-bold">{t("reviewBuild")}</h2>
          {!queue?.versions.length ? (
            <Empty text={t("queueEmpty")} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {queue.versions.map((build) => (
                <li key={build.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                      {build.miniApp.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={build.miniApp.iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Boxes size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {build.miniApp.name} <span className="font-mono text-xs text-slate-400">v{build.version}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {build.miniApp.appId} · {build.miniApp.developerName} · {bytes(build.size)}
                      </p>
                    </div>
                    <Badge value={build.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {build.requestedPermissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 break-all font-mono text-[10px] text-slate-400">sha256 {build.sha256}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      className={`${secondary} px-3 py-1.5 text-xs`}
                      onClick={() => void openPreview(build)}
                    >
                      <Eye size={14} /> {t("preview")}
                    </button>
                    <input
                      className={`${input} max-w-64 py-1.5 text-xs`}
                      placeholder={t("rejectReason")}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className={`${primary} px-3 py-1.5 text-xs`}
                      onClick={() =>
                        void act(
                          () =>
                            fetch(`/api/developer/miniapps/review/versions/${build.id}/decision`, {
                              method: "POST",
                              headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                              body: JSON.stringify({ approve: true, reason: "" }),
                            }),
                          "APPROVED",
                        )
                      }
                    >
                      <Check size={14} /> {t("approve")}
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      onClick={() => {
                        if (reason.trim().length < 3) return failed(new Error("REASON_REQUIRED"));
                        void act(
                          () =>
                            fetch(`/api/developer/miniapps/review/versions/${build.id}/decision`, {
                              method: "POST",
                              headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                              body: JSON.stringify({ approve: false, reason: reason.trim() }),
                            }),
                          "REJECTED",
                        );
                      }}
                    >
                      <XCircle size={14} /> {t("reject")}
                    </button>
                    <button
                      className={`${secondary} px-3 py-1.5 text-xs`}
                      onClick={() => {
                        const note = window.prompt(t("rejectReason"));
                        if (!note || note.trim().length < 3) return;
                        void act(
                          () =>
                            fetch(`/api/developer/miniapps/review/apps/${build.miniApp.appId}/suspend`, {
                              method: "POST",
                              headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                              body: JSON.stringify({ reason: note.trim() }),
                            }),
                          "SUSPENDED",
                        );
                      }}
                    >
                      {t("suspend")}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">{when(build.createdAt, lang)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={card}>
          <h2 className="mb-3 text-sm font-bold">{t("reviewPermission")}</h2>
          {!queue?.permissions.length ? (
            <p className="text-xs text-slate-400">{t("noPermissionRequests")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {queue.permissions.map((request) => (
                <li key={request.id} className="py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{request.permission}</span>
                    <Badge value={request.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {request.miniApp.name} · {request.miniApp.appId}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{request.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className={`${primary} px-3 py-1.5 text-xs`}
                      onClick={() =>
                        void act(
                          () =>
                            fetch(`/api/developer/miniapps/review/permissions/${request.id}`, {
                              method: "POST",
                              headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                              body: JSON.stringify({ approve: true }),
                            }),
                          "APPROVED",
                        )
                      }
                    >
                      <Check size={14} /> {t("approve")}
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      onClick={() =>
                        void act(
                          () =>
                            fetch(`/api/developer/miniapps/review/permissions/${request.id}`, {
                              method: "POST",
                              headers: { "x-qchat-csrf": "1", "Content-Type": "application/json" },
                              body: JSON.stringify({ approve: false }),
                            }),
                          "REJECTED",
                        )
                      }
                    >
                      <XCircle size={14} /> {t("reject")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.name} ${preview.version}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 px-3 py-2 text-white">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{preview.name}</p>
                <p className="truncate text-[11px] text-slate-400">
                  {t("previewTitle")} · v{preview.version}
                </p>
              </div>
              <button
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                onClick={() => void reloadPreview()}
                title={t("refresh")}
                aria-label={t("refresh")}
              >
                <RefreshCw size={16} />
              </button>
              {preview.url && (
                <a
                  className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  title={t("openInNewTab")}
                  aria-label={t("openInNewTab")}
                >
                  <ArrowRight size={16} />
                </a>
              )}
              <button
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
                onClick={() => setPreview(null)}
                title={t("close")}
                aria-label={t("close")}
              >
                <X size={16} />
              </button>
            </div>
            {preview.url ? (
              <iframe
                key={previewKey}
                title={`${preview.name} v${preview.version}`}
                src={preview.url}
                sandbox=""
                className="h-[min(72vh,640px)] w-full rounded-[1.6rem] border-0 bg-white"
              />
            ) : (
              <div className="flex h-[min(72vh,640px)] w-full items-center justify-center rounded-[1.6rem] bg-white">
                <Loader2 className="animate-spin text-emerald-600" size={26} />
              </div>
            )}
            <p className="px-3 pb-2 pt-2 text-center text-[10px] leading-4 text-slate-400">
              {t("previewNote")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function AuditLog({
  rows,
  loading,
  t,
  lang,
}: {
  rows: AuditRow[];
  loading: boolean;
  t: (key: CopyKey) => string;
  lang: Lang;
}) {
  return (
    <>
      <PageHead title={t("auditTitle")} subtitle={t("auditSubtitle")} />
      <div className={`${card} overflow-x-auto`}>
        {loading && !rows.length ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text={t("noData")} />
        ) : (
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="pb-3">{t("action")}</th>
                <th className="pb-3">{t("target")}</th>
                <th className="pb-3">{t("actor")}</th>
                <th className="pb-3">{t("time")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 font-mono text-xs font-semibold">{row.action}</td>
                  <td className="py-3 font-mono text-xs text-slate-500">{row.targetId}</td>
                  <td className="py-3 font-mono text-[11px] text-slate-400">
                    {row.actorId.slice(0, 8)}…
                  </td>
                  <td className="py-3 text-xs text-slate-400">{when(row.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Docs({ lang, t }: { lang: Lang; t: (key: CopyKey) => string }) {
  const vi = lang === "vi";
  return (
    <>
      <PageHead title={t("docsTitle")} subtitle={t("docsSubtitle")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Sparkles size={17} className="text-emerald-600" /> {t("docsQuickstart")}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>{vi ? "Tạo ứng dụng để nhận app ID (mp_…)." : "Create an app to get an app ID (mp_…)."}</li>
            <li>
              {vi
                ? "Tạo dự án bằng @mna/qchat (xem packages/miniapp-examples)."
                : "Scaffold a project with @mna/qchat (see packages/miniapp-examples)."}
            </li>
            <li>
              {vi
                ? "Khai báo quyền trong manifest.json; app ID do máy chủ gán."
                : "Declare permissions in manifest.json; the server assigns the app ID."}
            </li>
            <li>
              {vi
                ? "Chạy qchat build rồi tải tệp .japp ở tab Build."
                : "Run qchat build, then upload the .japp file in the Build tab."}
            </li>
            <li>
              {vi
                ? "Gửi duyệt, chờ quản trị viên duyệt và phát hành."
                : "Submit for review, wait for approval and release."}
            </li>
          </ol>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Code2 size={17} className="text-emerald-600" /> {t("docsManifest")}
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-emerald-100">{`{
  "schemaVersion": 2,
  "format": "qapp",
  "name": "Demo",
  "version": "1.0.0",
  "entry": "app.js",
  "sdkVersion": "1.0.0",
  "minRuntimeVersion": "1.0.0",
  "requestedPermissions": ["toast", "storage"]
}`}</pre>
          <p className="mt-2 text-xs text-slate-400">
            {vi
              ? "Manifest nằm ở gốc gói .japp. appId không được khai báo; máy chủ kiểm tra checksum của app.js."
              : "The manifest sits at the .japp root. Do not declare appId; the server verifies the app.js checksum."}
          </p>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Download size={17} className="text-emerald-600" /> {t("docsSdk")}
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-emerald-100">{`import { start, useState } from "@mna/qchat";
import { Button, Text, View } from "@mna/qchat/ui";

function App() {
  const [count, setCount] = useState(0);
  return (
    <View>
      <Text>Count: {count}</Text>
      <Button onPress={() => setCount(count + 1)}>+1</Button>
    </View>
  );
}

start(App);`}</pre>
          <p className="mt-2 text-xs text-slate-400">
            {vi
              ? "TSX được biên dịch thành JavaScript và chạy trong QuickJS; UI là widget Flutter thật."
              : "TSX is compiled to JavaScript and runs in QuickJS; the UI is real Flutter widgets."}
          </p>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <PackageCheck size={17} className="text-emerald-600" /> {t("docsPublish")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <b>UPLOADED</b> → {vi ? "đã lưu, chưa ai tải được." : "stored, not downloadable by users."}
            </li>
            <li>
              <b>REVIEWING</b> → {vi ? "chờ quản trị viên duyệt." : "waiting for an administrator."}
            </li>
            <li>
              <b>APPROVED</b> → {vi ? "có thể phát hành." : "ready to release."}
            </li>
            <li>
              <b>PUBLISHED</b> → {vi ? "người dùng tải được bản này." : "users can download this build."}
            </li>
            <li>
              <b>REVOKED</b> → {vi ? "thu hồi; ứng dụng bị tạm ngưng nếu đang là bản hiện tại." : "revoked; the app is suspended if it was current."}
            </li>
          </ul>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck size={17} className="text-emerald-600" /> {t("docsSecurity")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>
              {vi
                ? "Gói .japp được kiểm tra đường dẫn, zip bomb, loại tệp, CRC và checksum app.js."
                : "The .japp is checked for traversal, bombs, file types, CRC and the app.js checksum."}
            </li>
            <li>
              {vi
                ? "Mã chạy trong QuickJS trong bộ nhớ, không có DOM, không có WebView."
                : "Code runs in an in-memory QuickJS sandbox with no DOM and no WebView."}
            </li>
            <li>
              {vi
                ? "QChat không đưa access token vào sandbox; mọi quyền do host kiểm tra."
                : "QChat never exposes access tokens to the sandbox; the host enforces permissions."}
            </li>
            <li>
              {vi
                ? "Lưu trữ riêng từng ứng dụng, có hạn mức và xoá khi gỡ ứng dụng."
                : "Per-app storage with quotas, cleared when the app is removed."}
            </li>
          </ul>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <UploadCloud size={17} className="text-emerald-600" /> {t("docsUpload")}
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-emerald-100">{`curl -X POST \\
  https://chat.example.com/api/miniapps/developer/apps/mp_xxx/builds \\
  -H "X-QChat-Key: qk_..." \\
  -F version=1.0.1 \\
  -F channel=PRODUCTION \\
  -F file=@dist.japp`}</pre>
          <p className="mt-2 text-xs text-slate-400">
            {vi
              ? "API key chỉ dùng cho ứng dụng đã cấp, không truy cập được Developer Center."
              : "An API key is scoped to its app and cannot access the Developer Center."}
          </p>
        </section>
      </div>
    </>
  );
}

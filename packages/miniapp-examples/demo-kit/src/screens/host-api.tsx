import {
  chooseImage,
  fetchJson,
  getAppInfo,
  getStorage,
  getSystemInfo,
  getUserInfo,
  removeStorage,
  request,
  setStorage,
  share,
  useEffect,
  useState,
  type UserInfo,
} from "@mna/qchat";
import {
  closeMiniApp,
  navigateTo,
  openExternal,
  showToast,
} from "@mna/qchat/navigation";
import { Button, Dialog, Icon, Image, Row, Text, View } from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  KeyValue,
  Note,
  ScreenShell,
  Section,
} from "../components.js";
import { describeError, pushLog, runCall, shorten } from "../store.js";
import { colors, radius } from "../theme.js";

const PAYLOAD_KEY = "demo-kit.payload";

interface SavedPayload {
  at: number;
  tags: string[];
  count: number;
}

/** Tab 4: every host method the qapp bridge supports, one button each. */
export function HostApiScreen() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState("Chưa gọi API nào.");
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    pushLog("api", "mở tab Host API");
  }, []);

  const show = (value: unknown) => {
    setResult(shorten(JSON.stringify(value ?? null, null, 2), 1400));
  };

  const call = async (label: string, task: () => Promise<unknown>) => {
    const value = await runCall(label, task);
    if (value !== null) show(value);
  };

  const pickImage = async () => {
    const image = await runCall("chooseImage", () =>
      chooseImage({ maxWidth: 1000, quality: 0.7 }),
    );
    if (!image) return;
    setPreview(image.dataUrl);
    show({ ...image, dataUrl: shorten(image.dataUrl, 48) });
  };

  const storageRoundTrip = async () => {
    const payload: SavedPayload = {
      at: Date.now(),
      tags: ["demo", "storage"],
      count: 3,
    };
    pushLog("storage", `setStorage ${PAYLOAD_KEY}`);
    try {
      await setStorage(PAYLOAD_KEY, payload);
      const back = await getStorage<SavedPayload>(PAYLOAD_KEY);
      show({ ghi: payload, doc: back });
      const same = back?.count === payload.count;
      pushLog(
        "storage",
        same ? "đọc lại khớp" : "đọc lại khác giá trị đã ghi",
        same ? "success" : "warn",
      );
    } catch (error) {
      pushLog("storage", describeError(error), "error");
    }
  };

  const storageClear = async () => {
    await removeStorage(PAYLOAD_KEY);
    pushLog("storage", `removeStorage ${PAYLOAD_KEY}`, "warn");
    const back = await getStorage<SavedPayload>(PAYLOAD_KEY);
    show({ sau_khi_xoa: back });
  };

  return (
    <ScreenShell
      overlays={
        <Dialog
          visible={confirmClose}
          title="Đóng Mini App?"
          confirmText="Đóng"
          cancelText="Ở lại"
          onClose={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            pushLog("closeMiniApp", "đã gọi closeMiniApp", "warn");
            void closeMiniApp();
          }}
        >
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Nút đóng sẽ trả người dùng về QChat. Trong trình mô phỏng của IDE,
            lệnh này không có tác dụng.
          </Text>
        </Dialog>
      }
    >
      <Section
        title="Quyền đã khai báo"
        caption="manifest.json khai báo quyền; host hỏi người dùng ở lần gọi đầu tiên."
      >
        <Card>
          <Row style={{ gap: 8, alignItems: "center" }}>
            <Icon name="shieldCheck" size={18} color={colors.brand} />
            <Text style={{ fontSize: 12, color: colors.ink, flex: 1 }}>
              toast · storage · user.profile · media.choose · share · qchat.api
              · network (api.github.com)
            </Text>
          </Row>
        </Card>
      </Section>

      <Section title="App & thiết bị" caption="Không cần quyền.">
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="info"
            label="getAppInfo()"
            onPress={() => void call("getAppInfo", getAppInfo)}
          />
          <ActionButton
            icon="mobile"
            label="getSystemInfo()"
            onPress={() => void call("getSystemInfo", getSystemInfo)}
          />
          <ActionButton
            icon="refresh"
            label="getAppInfo() + getSystemInfo() cùng lúc"
            onPress={() =>
              void call("getAppInfo + getSystemInfo", async () => ({
                app: await getAppInfo(),
                system: await getSystemInfo(),
              }))
            }
          />
        </Card>
      </Section>

      <Section
        title="Người dùng (user.profile)"
        caption="getUserInfo() và request('/users/me')."
      >
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="me"
            label="getUserInfo()"
            onPress={() =>
              void (async () => {
                const value = await runCall("getUserInfo", getUserInfo);
                if (value) {
                  setUser(value);
                  show(value);
                }
              })()
            }
          />
          <ActionButton
            icon="contacts"
            label="request('/users/me')"
            onPress={() =>
              void call("request /users/me", () => request("/users/me"))
            }
          />
          <ActionButton
            icon="contacts"
            label="request('/friends')"
            onPress={() =>
              void call("request /friends", () => request("/friends"))
            }
          />
          <ActionButton
            icon="chats"
            label="request('/conversations') (qchat.api)"
            onPress={() =>
              void call("request /conversations", () =>
                request("/conversations"),
              )
            }
          />
          {user ? (
            <Row style={{ gap: 12, alignItems: "center", marginTop: 4 }}>
              <Image
                src={preview ?? "assets/logo.png"}
                width={44}
                height={44}
                fit="cover"
                borderRadius={22}
              />
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "bold" }}>
                  {user.nickname}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {user.qchatId} · {user.id}
                </Text>
              </View>
            </Row>
          ) : null}
        </Card>
      </Section>

      <Section
        title="Phản hồi & chia sẻ (toast, share)"
        caption="showToast ba icon và share()."
      >
        <Card style={{ gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="primary"
                label="Toast success"
                onPress={() =>
                  void call("showToast success", () =>
                    showToast("Thao tác thành công", { icon: "success" }),
                  )
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                variant="danger"
                label="Toast error"
                onPress={() =>
                  void call("showToast error", () =>
                    showToast("Không thực hiện được", { icon: "error" }),
                  )
                }
              />
            </View>
          </Row>
          <ActionButton
            label="showToast không icon + duration dài"
            onPress={() =>
              void call("showToast none", () =>
                showToast("Chỉ là thông báo", { duration: 4000 }),
              )
            }
          />
          <ActionButton
            icon="share"
            label="share()"
            onPress={() =>
              void call("share", () =>
                share({
                  title: "Demo Kit",
                  text: "Mini App demo của QChat",
                  url: "https://github.com",
                }),
              )
            }
          />
        </Card>
      </Section>

      <Section
        title="Ảnh (media.choose)"
        caption="chooseImage trả data URL; ảnh hiển thị lại bằng thành phần Image."
      >
        <Card style={{ gap: 10 }}>
          <ActionButton
            variant="primary"
            icon="camera"
            label="chooseImage({ maxWidth: 1000, quality: 0.7 })"
            onPress={() => void pickImage()}
          />
          <Row style={{ gap: 12, alignItems: "center" }}>
            <Image
              src={preview ?? "assets/logo.png"}
              width={88}
              height={88}
              fit="cover"
              borderRadius={16}
            />
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ fontSize: 13 }}>
                {preview ? "Ảnh vừa chọn" : "Chưa chọn ảnh (đang là logo)"}
              </Text>
              <Note>
                Data URL dài được rút gọn trong khung kết quả để dễ đọc.
              </Note>
            </View>
          </Row>
        </Card>
      </Section>

      <Section
        title="Lưu trữ (storage)"
        caption="64 KB mỗi giá trị, 512 KB mỗi app, 128 khoá."
      >
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="download"
            label="Ghi rồi đọc lại một object"
            onPress={() => void storageRoundTrip()}
          />
          <ActionButton
            icon="delete"
            label={`removeStorage(${PAYLOAD_KEY}) rồi đọc lại`}
            onPress={() => void storageClear()}
          />
        </Card>
      </Section>

      <Section
        title="Mạng (network)"
        caption="Bất kỳ host HTTPS nào cũng gọi được; host không gửi kèm token QChat."
      >
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="discover"
            label="fetch api.github.com/repos/nodejs/node"
            onPress={() =>
              void call("fetch github", () =>
                fetchJson<{ full_name: string; stargazers_count: number }>(
                  "https://api.github.com/repos/nodejs/node",
                ),
              )
            }
          />
          <ActionButton
            icon="lock"
            label="fetch http:// (phải bị chặn)"
            onPress={() =>
              void call("fetch http", () =>
                fetchJson("http://example.com/"),
              )
            }
          />
          <Note>
            Nút thứ hai cố tình dùng http://: host phải trả lỗi INVALID_ARGUMENT
            vì chỉ cho phép HTTPS, đó cũng là một kết quả đúng.
          </Note>
        </Card>
      </Section>

      <Section
        title="Điều hướng & vòng đời"
        caption="navigateTo mở route nội bộ, nút back của host pop route rồi phát sự kiện back."
      >
        <Card style={{ gap: 8 }}>
          <ActionButton
            icon="chevronRight"
            label="navigateTo('/detail/42')"
            onPress={() =>
              void call("navigateTo /detail/42", () => navigateTo("/detail/42"))
            }
          />
          <ActionButton
            icon="file"
            label="navigateTo('/detail/demo-kit/step-2')"
            onPress={() =>
              void call("navigateTo step-2", () =>
                navigateTo("/detail/demo-kit/step-2"),
              )
            }
          />
          <ActionButton
            icon="share"
            label="openExternal('https://github.com')"
            onPress={() =>
              void call("openExternal", () =>
                openExternal("https://github.com"),
              )
            }
          />
          <ActionButton
            variant="danger"
            icon="close"
            label="closeMiniApp()"
            onPress={() => setConfirmClose(true)}
          />
        </Card>
      </Section>

      <Section
        title="Kết quả gần nhất"
        right={
          <Button
            variant="text"
            onPress={() => {
              setResult("Đã xoá kết quả.");
              pushLog("api", "xoá khung kết quả");
            }}
          >
            Xoá
          </Button>
        }
        caption="JSON thật do host trả về, rút gọn còn 1400 ký tự."
      >
        <View
          style={{
            padding: 12,
            borderRadius: radius.sm,
            backgroundColor: "#0f172a",
          }}
        >
          <Text style={{ fontSize: 11, color: "#e2e8f0" }}>{result}</Text>
        </View>
        <Card style={{ gap: 6 }}>
          <KeyValue
            label="Quyền đang dùng"
            value="toast, storage, user.profile, media.choose, share, qchat.api, network"
          />
          <KeyValue
            label="Đóng app"
            value={confirmClose ? "đang xác nhận" : "chưa"}
          />
        </Card>
      </Section>
    </ScreenShell>
  );
}

import { useEffect, useMemo, useState, type VNodeChild } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import {
  Checkbox,
  Dialog,
  Divider,
  Icon,
  Row,
  Slider,
  Switch,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import {
  ActionButton,
  Card,
  KeyValue,
  Note,
  ScreenShell,
  Section,
} from "../components.js";
import { pushLog, runCall } from "../store.js";
import { colors } from "../theme.js";

function Field(props: { label: string; hint?: string; children?: VNodeChild }) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: "spaceBetween" }}>
        <Text style={{ fontSize: 13, fontWeight: "bold" }}>{props.label}</Text>
        {props.hint ? (
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {props.hint}
          </Text>
        ) : null}
      </Row>
      {props.children}
    </View>
  );
}

/** Tab 3: keyboard types, validation, submit with a timer and event logging. */
export function FormScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [receive, setReceive] = useState(true);
  const [rating, setRating] = useState(3);
  const [logEvents, setLogEvents] = useState(true);
  const [touched, setTouched] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    pushLog("form", "mount · form trống, validation chạy trong useMemo");
  }, []);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (name.trim().length < 2) list.push("Tên cần ít nhất 2 ký tự");
    if (email.length > 0 && !email.includes("@")) list.push("Email phải có @");
    if (phone.length > 0 && phone.replace(/\D/g, "").length < 9) {
      list.push("Số điện thoại cần ít nhất 9 chữ số");
    }
    if (age.length > 0) {
      const value = Number(age);
      if (!Number.isFinite(value) || value < 1 || value > 120) {
        list.push("Tuổi phải trong khoảng 1…120");
      }
    }
    if (password.length > 0 && password.length < 6) {
      list.push("Mật khẩu cần từ 6 ký tự");
    }
    if (!agree) list.push("Cần đồng ý điều khoản");
    return list;
  }, [name, email, phone, age, password, agree]);

  const valid = errors.length === 0;

  const mark = (field: string, value: string) => {
    if (logEvents) pushLog(field, value.length === 0 ? "(trống)" : value);
    if (!touched.includes(field)) setTouched([...touched, field]);
  };

  const submit = () => {
    if (!valid) {
      pushLog("form", `submit bị chặn · ${errors.length} lỗi`, "warn");
      void showToast(errors[0] ?? "Dữ liệu chưa hợp lệ", { icon: "error" });
      return;
    }
    setSubmitting(true);
    pushLog("form", "submit hợp lệ · giả lập gửi trong 1000ms");
    setTimeout(() => {
      setSubmitting(false);
      setDialog(true);
      pushLog("form", `đã gửi · ${name} · ${rating} sao`, "success");
    }, 1000);
  };

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setAge("");
    setPassword("");
    setNote("");
    setAgree(false);
    setRating(3);
    setTouched([]);
    pushLog("form", "reset toàn bộ trường", "warn");
  };

  return (
    <ScreenShell
      overlays={
        <Dialog
          visible={dialog}
          title="Đã gửi biểu mẫu"
          confirmText="Đóng"
          onClose={() => setDialog(false)}
          onConfirm={() => setDialog(false)}
        >
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Không có mạng thật trong demo này: host chỉ nhận tác vụ sau 1000ms
            của setTimeout.
          </Text>
        </Dialog>
      }
    >
      <Section
        title="Thông tin cơ bản"
        caption="Mỗi keyboardType mở một bàn phím khác nhau trên thiết bị."
        right={
          <Switch
            value={logEvents}
            onChange={(event) => setLogEvents(event.value)}
          />
        }
      >
        <Card style={{ gap: 14 }}>
          <Field label="Tên" hint={`${name.length}/40`}>
            <TextField
              value={name}
              placeholder="Nguyễn Văn A"
              maxLength={40}
              onChange={(event) => {
                setName(event.value);
                mark("tên", event.value);
              }}
              onFocus={() => void pushLog("tên", "focus")}
              onBlur={() => void pushLog("tên", "blur")}
            />
          </Field>
          <Field label="Email" hint="keyboardType email">
            <TextField
              value={email}
              placeholder="ban@example.com"
              keyboardType="email"
              onChange={(event) => {
                setEmail(event.value);
                mark("email", event.value);
              }}
            />
          </Field>
          <Field label="Số điện thoại" hint="keyboardType phone">
            <TextField
              value={phone}
              placeholder="09xx xxx xxx"
              keyboardType="phone"
              onChange={(event) => {
                setPhone(event.value);
                mark("điện thoại", event.value);
              }}
            />
          </Field>
          <Field label="Tuổi" hint="keyboardType number">
            <TextField
              value={age}
              placeholder="18"
              keyboardType="number"
              onChange={(event) => {
                setAge(event.value);
                mark("tuổi", event.value);
              }}
            />
          </Field>
          <Field label="Trang web" hint="keyboardType url">
            <TextField
              placeholder="https://qchat.dev"
              keyboardType="url"
              onChange={(event) => mark("url", event.value)}
            />
          </Field>
        </Card>
      </Section>

      <Section
        title="Bảo mật & tuỳ chọn"
        caption="secureTextEntry, multiline, maxLength, Checkbox, Switch, Slider."
      >
        <Card style={{ gap: 14 }}>
          <Field label="Mật khẩu" hint="secureTextEntry">
            <TextField
              value={password}
              placeholder="tối thiểu 6 ký tự"
              secureTextEntry
              maxLength={32}
              onChange={(event) => {
                setPassword(event.value);
                if (logEvents) {
                  pushLog("mật khẩu", `${event.value.length} ký tự`);
                }
              }}
            />
          </Field>
          <Field label="Ghi chú" hint={`${note.length}/80 · multiline`}>
            <TextField
              value={note}
              placeholder="Nhập nhiều dòng…"
              multiline
              maxLength={80}
              onChange={(event) => {
                setNote(event.value);
                if (note.length === 0 && event.value.length === 1) {
                  pushLog("ghi chú", "bắt đầu nhập");
                }
              }}
              onSubmit={(event) =>
                void pushLog("ghi chú", `submit: ${event.text}`)
              }
            />
          </Field>
          <Field label="Trường chỉ đọc" hint="editable = false">
            <TextField value="Không sửa được" editable={false} />
          </Field>
          <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
            <Text style={{ fontSize: 13, flex: 1 }}>
              Đồng ý điều khoản demo
            </Text>
            <Checkbox
              checked={agree}
              onChange={(event) => {
                setAgree(event.value);
                pushLog("điều khoản", `agree = ${event.value}`);
              }}
            />
          </Row>
          <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
            <Text style={{ fontSize: 13, flex: 1 }}>Nhận bản tin</Text>
            <Switch
              value={receive}
              onChange={(event) => setReceive(event.value)}
            />
          </Row>
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 13 }}>Mức hài lòng</Text>
              <Text style={{ fontSize: 13, color: colors.amber }}>
                {"★".repeat(rating)}
                {"☆".repeat(5 - rating)}
              </Text>
            </Row>
            <Slider
              value={rating}
              min={1}
              max={5}
              step={1}
              onChange={(event) => setRating(Math.round(event.value))}
            />
          </View>
        </Card>
      </Section>

      <Section
        title={`Trạng thái (${valid ? "hợp lệ" : `${errors.length} lỗi`})`}
        caption="Giá trị đọc trực tiếp từ state của màn hình này."
      >
        <Card style={{ gap: 8 }}>
          <KeyValue label="Tên" value={name || "—"} />
          <KeyValue label="Email" value={email || "—"} />
          <KeyValue label="Điện thoại" value={phone || "—"} />
          <KeyValue label="Tuổi" value={age || "—"} />
          <KeyValue
            label="Mật khẩu"
            value={password.length > 0 ? `${password.length} ký tự` : "—"}
          />
          <KeyValue label="Nhận bản tin" value={receive ? "có" : "không"} />
          <KeyValue
            label="Đã chạm"
            value={touched.length > 0 ? touched.join(", ") : "chưa"}
          />
          <Divider />
          {errors.length === 0 ? (
            <Note>Không có lỗi. Bấm Gửi để chạy tác vụ 1000ms.</Note>
          ) : (
            errors.map((error) => (
              <Row key={error} style={{ gap: 6, alignItems: "center" }}>
                <Icon name="info" size={14} color={colors.red} />
                <Text style={{ fontSize: 12, color: colors.red, flex: 1 }}>
                  {error}
                </Text>
              </Row>
            ))
          )}
        </Card>
      </Section>

      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="Đặt lại" onPress={reset} icon="refresh" />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            variant="primary"
            label={submitting ? "Đang gửi…" : "Gửi biểu mẫu"}
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Row>

      <ActionButton
        variant="text"
        label="Ghi thử một dòng log"
        onPress={() =>
          void runCall("log thử", async () => ({ at: Date.now(), ok: true }))
        }
      />
    </ScreenShell>
  );
}

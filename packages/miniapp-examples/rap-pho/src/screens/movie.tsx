import { showToast, useState } from "@mna/qchat";
import {
  BottomSheet,
  Button,
  Checkbox,
  Divider,
  GridView,
  Icon,
  NavBar,
  Pressable,
  Row,
  ScrollView,
  Stack,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  COMBO_PRICE,
  PAYMENTS,
  movieById,
  money,
  seatsFor,
  shortDay,
  showtimeDays,
  showtimesFor,
  toggleFavorite,
  useFavorites,
  book,
} from "../store.js";
import type { Seat, Showtime } from "../store.js";
import {
  colors,
  posterStyle,
  radius,
  seatStyle,
  seatTextStyle,
  toneAt,
} from "../theme.js";
import { Card, InfoRow, Label, Section, ageTone } from "../ui.js";

/** Một ô ngày trong dải ngày chiếu. */
function DayChip(props: {
  key?: string | number;
  label: string;
  date: string;
  active: boolean;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={`${props.label} ${props.date}`}
      testID={props.testID}
      style={{
        minWidth: 64,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: "center",
        gap: 2,
        backgroundColor: props.active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: props.active ? colors.brand : colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: props.active ? "#ffe3e7" : colors.muted,
        }}
      >
        {props.label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: props.active ? colors.white : colors.ink,
        }}
      >
        {props.date}
      </Text>
    </Pressable>
  );
}

function ShowtimeChip(props: {
  key?: string | number;
  show: Showtime;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={`${props.show.time} ${props.show.format}`}
      testID={`showtime-${props.show.id}`}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 11,
        alignItems: "center",
        gap: 2,
        backgroundColor: props.active ? "#2a1a22" : colors.surface,
        borderWidth: 1,
        borderColor: props.active ? colors.brand : colors.line,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "bold",
          color: props.active ? colors.brand : colors.ink,
        }}
      >
        {props.show.time}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>
        {`${props.show.format} · ${money(props.show.price)}`}
      </Text>
    </Pressable>
  );
}

function Legend(props: { color: string; label: string; vip?: boolean }) {
  return (
    <Row style={{ alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: props.color,
          borderWidth: 1,
          borderColor: props.vip ? colors.gold : colors.line,
        }}
      />
      <Text style={{ fontSize: 10, color: colors.muted }}>{props.label}</Text>
    </Row>
  );
}

/**
 * Trang chi tiết phim: poster lớn dưới header trong suốt, dải ngày, suất chiếu,
 * sơ đồ 72 ghế và sheet thanh toán. Đây là luồng đặt vé đầy đủ.
 */
export function MovieScreen(props: {
  movieId: string;
  onBack: () => void;
  onBooked: (code: string) => void;
}) {
  const movie = movieById(props.movieId);
  const days = showtimeDays();
  const favorites = useFavorites();
  const [dayKey, setDayKey] = useState(days[0]?.key ?? "");
  const [showtimeId, setShowtimeId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const [combo, setCombo] = useState(true);
  const [payment, setPayment] = useState(0);
  const [agree, setAgree] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  if (!movie) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavBar title="Không tìm thấy phim" showBack onBack={props.onBack} />
        <View style={{ padding: 24 }}>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Phim này không còn trong danh sách. Quay lại để chọn phim khác.
          </Text>
        </View>
      </View>
    );
  }

  const shows = showtimesFor(movie.id, dayKey);
  const show = shows.find((entry) => entry.id === showtimeId) ?? shows[0] ?? null;
  const seats = show ? seatsFor(show) : [];
  const chosen = seats.filter((seat) => picked.includes(seat.id));
  const ticketTotal = chosen.reduce((sum, seat) => sum + seat.price, 0);
  const total = ticketTotal + (combo ? COMBO_PRICE : 0);
  const favorite = favorites.includes(movie.id);
  const surface =
    scrollY > 420 ? "solid" : scrollY > 220 ? "blur" : "transparent";
  const onImage = surface === "transparent";

  const pickDay = (key: string) => {
    setDayKey(key);
    setShowtimeId("");
    setPicked([]);
  };

  const pickShow = (id: string) => {
    setShowtimeId(id);
    setPicked([]);
  };

  const toggleSeat = (seat: Seat) => {
    if (seat.taken) return;
    if (picked.includes(seat.id)) {
      setPicked(picked.filter((id) => id !== seat.id));
      return;
    }
    if (picked.length >= 8) {
      void showToast("Mỗi lần đặt tối đa 8 ghế", { icon: "none" });
      return;
    }
    setPicked([...picked, seat.id]);
  };

  const confirm = () => {
    if (!show || chosen.length === 0) return;
    const ticket = book({
      show,
      seats: chosen,
      combo,
      payment: PAYMENTS[payment] ?? PAYMENTS[0],
    });
    setSheet(false);
    setPicked([]);
    setAgree(false);
    void showToast(`Đã giữ ${chosen.length} ghế · ${ticket.code}`, {
      icon: "success",
    });
    props.onBooked(ticket.code);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack alignment="topLeft" style={{ flex: 1 }}>
        <ScrollView
          style={{ height: "100%" }}
          showsScrollIndicator={false}
          onScroll={(event) => setScrollY(event.y)}
        >
          <Stack style={{ height: 340, ...posterStyle(toneAt(movie.tone)) }}>
            <Text
              style={{
                position: "absolute",
                right: -18,
                top: 30,
                fontSize: 180,
                fontWeight: "bold",
                color: "#1fffffff",
              }}
            >
              {movie.title.charAt(0)}
            </Text>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 140,
                gradient: {
                  type: "linear",
                  angle: 90,
                  stops: [
                    { offset: 0, color: "#99000000" },
                    { offset: 1, color: "#00000000" },
                  ],
                },
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 260,
                gradient: {
                  type: "linear",
                  angle: 90,
                  stops: [
                    { offset: 0, color: "#000b0d13" },
                    { offset: 1, color: "#0b0d13" },
                  ],
                },
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 22,
                gap: 8,
              }}
            >
              <Row style={{ gap: 8 }}>
                {movie.formats.map((format) => (
                  <Tag
                    key={format}
                    tone={format === "IMAX" ? "warning" : "neutral"}
                    size="sm"
                  >
                    {format}
                  </Tag>
                ))}
                <Tag tone={ageTone(movie.age)} size="sm">
                  {movie.age}
                </Tag>
              </Row>
              <Text
                numberOfLines={2}
                style={{ fontSize: 30, fontWeight: "bold", color: colors.white }}
              >
                {movie.title}
              </Text>
              <Text style={{ fontSize: 13, color: "#d7dbe6" }}>
                {movie.tagline}
              </Text>
              <Row style={{ gap: 12, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: colors.gold }}>
                  {`★ ${movie.rating.toFixed(1)}`}
                </Text>
                <Text style={{ fontSize: 12, color: "#d7dbe6" }}>
                  {`${movie.minutes} phút`}
                </Text>
                <Text style={{ fontSize: 12, color: "#d7dbe6" }}>
                  {movie.language}
                </Text>
              </Row>
            </View>
          </Stack>

          <View style={{ padding: 16, gap: 20, paddingBottom: 130 }}>
            <Section
              title="Nội dung"
              right={
                <Pressable
                  onPress={() => {
                    const next = toggleFavorite(movie.id);
                    void showToast(
                      next ? "Đã thêm vào yêu thích" : "Đã bỏ khỏi yêu thích",
                      { icon: next ? "success" : "none" },
                    );
                  }}
                  accessibleLabel={
                    favorite ? "Bỏ phim khỏi yêu thích" : "Thêm phim vào yêu thích"
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: favorite ? "#4a2430" : colors.line,
                    backgroundColor: favorite ? "#2a1620" : colors.surface,
                  }}
                >
                  <Icon
                    name="heart"
                    size={14}
                    color={favorite ? colors.brand : colors.muted}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      color: favorite ? colors.brand : colors.muted,
                    }}
                  >
                    {favorite ? "Đã thích" : "Yêu thích"}
                  </Text>
                </Pressable>
              }
            >
              <Text style={{ fontSize: 13, lineHeight: 21, color: "#c9cedb" }}>
                {movie.synopsis}
              </Text>
              <Card style={{ gap: 8, marginTop: 4 }}>
                <InfoRow label="Đạo diễn" value={movie.director} />
                <InfoRow label="Diễn viên" value={movie.cast.join(", ")} />
                <InfoRow label="Ngôn ngữ" value={movie.language} />
                <InfoRow
                  label="Khởi chiếu"
                  value={
                    movie.status === "now" ? movie.opening : `${movie.opening} (sắp chiếu)`
                  }
                />
              </Card>
            </Section>

            {movie.status === "soon" || !show ? (
              <Card style={{ gap: 8 }}>
                <Label>Sắp chiếu</Label>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}>
                  {`Mở bán vé từ ${movie.opening}`}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  Đặt trước để nhận ghế đẹp và email nhắc lịch trước 24 giờ.
                </Text>
                <Button
                  onPress={() =>
                    void showToast("Rạp sẽ nhắc bạn khi mở bán vé", {
                      icon: "success",
                    })
                  }
                >
                  Nhận thông báo
                </Button>
              </Card>
            ) : (
              <>
                <Section title="Chọn suất chiếu" caption="Sáu ngày tới · giá đã gồm VAT">
                  <ScrollView
                    horizontal
                    showsScrollIndicator={false}
                    style={{ height: 64 }}
                  >
                    <Row style={{ gap: 8, paddingRight: 16 }}>
                      {days.map((day) => (
                        <DayChip
                          key={day.key}
                          label={day.label}
                          date={day.date}
                          active={day.key === dayKey}
                          testID={`day-${day.key}`}
                          onPress={() => pickDay(day.key)}
                        />
                      ))}
                    </Row>
                  </ScrollView>

                  <Row style={{ gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                    {shows.map((entry) => (
                      <ShowtimeChip
                        key={entry.id}
                        show={entry}
                        active={entry.id === show.id}
                        onPress={() => pickShow(entry.id)}
                      />
                    ))}
                  </Row>

                  <Row
                    style={{
                      justifyContent: "spaceBetween",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {`${show.hall} · ${show.format} · ${shortDay(show.dateKey)}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.gold }}>
                      {`${seats.filter((seat) => !seat.taken).length}/72 ghế trống`}
                    </Text>
                  </Row>
                </Section>

                <Section title="Chọn ghế" caption="Chạm vào ghế trống, tối đa 8 ghế">
                  <View style={{ alignItems: "center", gap: 6, paddingTop: 2 }}>
                    <View
                      style={{
                        width: "68%",
                        height: 4,
                        borderRadius: 2,
                        gradient: {
                          type: "linear",
                          angle: 90,
                          stops: [
                            { offset: 0, color: "#2f3a52" },
                            { offset: 0.5, color: "#8fa9ff" },
                            { offset: 1, color: "#2f3a52" },
                          ],
                        },
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 9,
                        letterSpacing: 4,
                        color: colors.muted,
                      }}
                    >
                      MÀN HÌNH
                    </Text>
                  </View>

                  <GridView<Seat>
                    data={seats}
                    numColumns={9}
                    initialCount={72}
                    style={{ gap: 6, aspectRatio: 1 }}
                    renderItem={(seat) => (
                      <Pressable
                        onPress={() => toggleSeat(seat)}
                        disabled={seat.taken}
                        accessibleLabel={`Ghế ${seat.id}${seat.vip ? " VIP" : ""}`}
                        testID={`seat-${seat.id}`}
                        style={seatStyle(
                          seat.taken
                            ? "taken"
                            : picked.includes(seat.id)
                              ? "picked"
                              : "free",
                          seat.vip,
                        )}
                      >
                        <Text
                          style={seatTextStyle(
                            seat.taken
                              ? "taken"
                              : picked.includes(seat.id)
                                ? "picked"
                                : "free",
                          )}
                        >
                          {seat.id}
                        </Text>
                      </Pressable>
                    )}
                  />

                  <Row style={{ gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                    <Legend color={colors.soft} label="Trống" />
                    <Legend color={colors.brand} label="Đang chọn" />
                    <Legend color="#0f131b" label="Đã bán" />
                    <Legend color={colors.soft} label="VIP" vip />
                  </Row>
                  <Text style={{ fontSize: 10, color: colors.muted }}>
                    Hàng E và F là ghế VIP · phụ thu 30.000đ/ghế. Ghế đã bán không
                    chọn được.
                  </Text>
                </Section>
              </>
            )}
          </View>
        </ScrollView>

        {movie.status === "now" && show ? (
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              boxShadow: {
                color: "#66000000",
                offsetX: 0,
                offsetY: 8,
                blurRadius: 22,
              },
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
                {picked.length === 0
                  ? "Chưa chọn ghế"
                  : `${picked.length} ghế · ${picked.join(", ")}`}
              </Text>
              <Text
                style={{ fontSize: 16, fontWeight: "bold", color: colors.brand }}
              >
                {money(total)}
              </Text>
            </View>
            <Pressable
              onPress={() => setSheet(true)}
              disabled={picked.length === 0}
              accessibleLabel="Thanh toán"
              testID="pay"
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: radius.pill,
                backgroundColor: colors.brand,
                opacity: picked.length === 0 ? 0.45 : 1,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: colors.white }}
              >
                Thanh toán
              </Text>
            </Pressable>
          </View>
        ) : null}

        <BottomSheet
          visible={sheet}
          height={640}
          onClose={() => setSheet(false)}
        >
          <View style={{ padding: 18, gap: 14 }}>
            <Row style={{ justifyContent: "spaceBetween", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}>
                Xác nhận đặt vé
              </Text>
              <Pressable onPress={() => setSheet(false)} accessibleLabel="Đóng">
                <Text style={{ fontSize: 13, color: colors.muted }}>Đóng</Text>
              </Pressable>
            </Row>

            {show ? (
              <Row style={{ gap: 12 }}>
                <Stack
                  style={{
                    width: 54,
                    height: 76,
                    borderRadius: 10,
                    overflow: "hidden",
                    ...posterStyle(toneAt(movie.tone)),
                  }}
                >
                  <Text
                    style={{
                      position: "absolute",
                      right: 2,
                      bottom: 0,
                      fontSize: 40,
                      fontWeight: "bold",
                      color: "#2effffff",
                    }}
                  >
                    {movie.title.charAt(0)}
                  </Text>
                </Stack>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}
                  >
                    {movie.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {`${shortDay(show.dateKey)} · ${show.time}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {`${show.hall} · ${show.format}`}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.gold }}>
                    {`Ghế ${picked.join(", ")}`}
                  </Text>
                </View>
              </Row>
            ) : null}

            <Divider />

            <Checkbox
              checked={combo}
              label={`Combo bắp + nước · ${money(COMBO_PRICE)}`}
              onChange={(event) => setCombo(event.value)}
            />

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Phương thức thanh toán
              </Text>
              {PAYMENTS.map((label, index) => {
                const active = payment === index;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setPayment(index)}
                    accessibleLabel={label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.line,
                      backgroundColor: active ? "#241820" : colors.surface,
                    }}
                  >
                    <Icon
                      name={
                        index === 0
                          ? "wallet"
                          : index === 1
                            ? "creditCard"
                            : "smartphone"
                      }
                      size={18}
                      color={active ? colors.brand : colors.muted}
                    />
                    <Text
                      style={{ flex: 1, fontSize: 13, color: colors.ink }}
                    >
                      {label}
                    </Text>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.line,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active ? (
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: colors.brand,
                          }}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Checkbox
              checked={agree}
              label="Tôi đồng ý với điều khoản đặt vé và chính sách hoàn huỷ"
              onChange={(event) => setAgree(event.value)}
              testID="agree"
            />

            <View style={{ gap: 5 }}>
              <Row style={{ justifyContent: "spaceBetween" }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {`Tiền vé (${picked.length} ghế)`}
                </Text>
                <Text style={{ fontSize: 13, color: colors.ink }}>
                  {money(ticketTotal)}
                </Text>
              </Row>
              {combo ? (
                <Row style={{ justifyContent: "spaceBetween" }}>
                  <Text style={{ fontSize: 13, color: colors.muted }}>Combo</Text>
                  <Text style={{ fontSize: 13, color: colors.ink }}>
                    {money(COMBO_PRICE)}
                  </Text>
                </Row>
              ) : null}
              <Row style={{ justifyContent: "spaceBetween", marginTop: 3 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "bold", color: colors.ink }}
                >
                  Tổng
                </Text>
                <Text
                  style={{ fontSize: 15, fontWeight: "bold", color: colors.brand }}
                >
                  {money(total)}
                </Text>
              </Row>
            </View>

            <Button
              onPress={confirm}
              disabled={!agree || picked.length === 0}
              testID="confirm-pay"
            >
              {`Thanh toán · ${money(total)}`}
            </Button>
          </View>
        </BottomSheet>

        <NavBar
          title={onImage ? "" : movie.title}
          showBack
          onBack={props.onBack}
          transparent={onImage}
          blur={surface === "blur"}
          style={{ color: onImage ? colors.white : colors.ink }}
        />
      </Stack>
    </View>
  );
}

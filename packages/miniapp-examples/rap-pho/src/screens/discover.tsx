import { showToast } from "@mna/qchat";
import { useState } from "@mna/qchat";
import {
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
import type { Style } from "@mna/qchat/ui";
import {
  COMING_SOON,
  NOW_SHOWING,
  movieById,
  movieTitle,
  shortDay,
  showtimeDays,
  showtimesFor,
  useFavorites,
  useTickets,
} from "../store.js";
import type { Movie, Showtime } from "../store.js";
import { colors, posterStyle, radius, toneAt } from "../theme.js";
import { Card, MovieRow, Poster, Section, ageTone } from "../ui.js";

const heroFade: Style = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 300,
  gradient: {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#000b0d13" },
      { offset: 1, color: "#0b0d13" },
    ],
  },
};

const topFade: Style = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  height: 150,
  gradient: {
    type: "linear",
    angle: 90,
    stops: [
      { offset: 0, color: "#99000000" },
      { offset: 1, color: "#00000000" },
    ],
  },
};

/** Nút chính trên poster: nền đỏ, chữ trắng, bo tròn hoàn toàn. */
function HeroButton(props: {
  label: string;
  primary: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.label}
      style={{
        flex: props.primary ? 1 : 0,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: props.primary ? colors.brand : "#33ffffff",
        borderWidth: 1,
        borderColor: props.primary ? colors.brand : "#4dffffff",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: colors.white,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** Một dòng "phim + giờ" trong khối suất chiếu tối nay. */
function TonightRow(props: {
  key?: string | number;
  movie: Movie;
  times: Showtime[];
  onOpen: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: "spaceBetween", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={props.onOpen}
          accessibleLabel={props.movie.title}
          style={{ flex: 1, gap: 2 }}
        >
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: "600", color: colors.ink }}
          >
            {props.movie.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>
            {`${props.movie.genres[0]} · ${props.movie.minutes} phút · ${props.movie.formats.join("/")}`}
          </Text>
        </Pressable>
        <Tag tone={ageTone(props.movie.age)} size="sm">
          {props.movie.age}
        </Tag>
      </Row>
      <Row style={{ gap: 8, flexWrap: "wrap" }}>
        {props.times.map((show) => (
          <Pressable
            key={show.id}
            onPress={props.onOpen}
            accessibleLabel={`${props.movie.title} ${show.time}`}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 9,
              backgroundColor: colors.soft,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}>
              {show.time}
            </Text>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

/**
 * Tab Khám phá: header trong suốt trên poster, chuyển sang kính mờ rồi nền đặc
 * khi cuộn. Đây là màn hình duy nhất có ba trạng thái header.
 */
export function DiscoverScreen(props: {
  onOpenMovie: (id: string) => void;
  onOpenTicket: (code: string) => void;
  onGoMovies: () => void;
}) {
  const [scrollY, setScrollY] = useState(0);
  const favorites = useFavorites();
  const tickets = useTickets();
  const featured = NOW_SHOWING[0];
  const upcoming = tickets.find((ticket) => ticket.status === "upcoming");
  const surface =
    scrollY > 540 ? "solid" : scrollY > 260 ? "blur" : "transparent";
  const onImage = surface === "transparent";

  const days = showtimeDays();
  const today = days[0]?.key ?? "";
  const tonight = NOW_SHOWING.slice(0, 3).map((movie) => {
    const all = showtimesFor(movie.id, today);
    const late = all.filter((show) => show.time >= "18:00");
    return { movie, times: (late.length > 0 ? late : all).slice(0, 3) };
  });

  const favoriteMovies = favorites
    .map((id) => movieById(id))
    .filter((movie): movie is Movie => movie !== null)
    .slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack alignment="topLeft" style={{ flex: 1 }}>
        <ScrollView
          style={{ height: "100%" }}
          showsScrollIndicator={false}
          onScroll={(event) => setScrollY(event.y)}
        >
          <Stack style={{ height: 420, ...posterStyle(toneAt(featured.tone)) }}>
            <Text
              style={{
                position: "absolute",
                right: -24,
                top: 24,
                fontSize: 210,
                fontWeight: "bold",
                color: "#1affffff",
              }}
            >
              {featured.title.charAt(0)}
            </Text>
            <View style={topFade} />
            <View style={heroFade} />
            <View
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 24,
                gap: 10,
              }}
            >
              <Row style={{ gap: 8 }}>
                <Tag tone="danger" size="sm">
                  SUẤT ĐẶC BIỆT
                </Tag>
                <Tag tone="warning" size="sm">
                  IMAX
                </Tag>
                <Tag tone="neutral" size="sm">
                  {featured.age}
                </Tag>
              </Row>
              <Text
                numberOfLines={2}
                style={{ fontSize: 34, fontWeight: "bold", color: colors.white }}
              >
                {featured.title}
              </Text>
              <Text style={{ fontSize: 13, color: "#d7dbe6" }}>
                {featured.tagline}
              </Text>
              <Row style={{ gap: 12, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: colors.gold }}>
                  {`★ ${featured.rating.toFixed(1)}`}
                </Text>
                <Text style={{ fontSize: 12, color: "#d7dbe6" }}>
                  {`${featured.minutes} phút`}
                </Text>
                <Text style={{ fontSize: 12, color: "#d7dbe6" }}>
                  {featured.genres.join(" · ")}
                </Text>
              </Row>
              <Row style={{ gap: 10, marginTop: 4 }}>
                <HeroButton
                  label="Đặt vé ngay"
                  primary
                  onPress={() => props.onOpenMovie(featured.id)}
                />
                <HeroButton
                  label="Chi tiết"
                  primary={false}
                  onPress={() => props.onOpenMovie(featured.id)}
                />
              </Row>
            </View>
          </Stack>

          <View style={{ padding: 16, gap: 20 }}>
            <Card
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#1f2a1f",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#2f4a34",
                }}
              >
                <Icon name="ticketPercent" size={18} color={colors.green} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}>
                  {`Hôm nay có ${NOW_SHOWING.length * 4} suất chiếu`}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Rạp Phố · 12 Nguyễn Huệ, Quận 1 · 6 phòng
                </Text>
              </View>
              <Tag tone="success" size="sm">
                Đang mở
              </Tag>
            </Card>

            {upcoming ? (
              <Pressable
                onPress={() => props.onOpenTicket(upcoming.code)}
                accessibleLabel={`Vé sắp tới ${upcoming.code}`}
                testID={`upcoming-${upcoming.code}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: "#3a2430",
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    gradient: {
                      type: "linear",
                      angle: 135,
                      stops: [
                        { offset: 0, color: colors.brand },
                        { offset: 1, color: colors.brandDark },
                      ],
                    },
                  }}
                >
                  <Icon name="qr" size={20} color={colors.white} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
                  >
                    {`Vé sắp tới · ${movieTitle(upcoming.movieId)}`}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {`${shortDay(upcoming.dateKey)} · ${upcoming.time} · Ghế ${upcoming.seats.join(", ")}`}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.muted} />
              </Pressable>
            ) : null}

            <Section
              title="Đang chiếu"
              caption="Chạm vào poster để chọn suất và ghế"
              right={
                <Pressable onPress={props.onGoMovies} accessibleLabel="Xem tất cả phim">
                  <Text style={{ fontSize: 12, color: colors.brand }}>
                    Tất cả
                  </Text>
                </Pressable>
              }
            >
              <ScrollView
                horizontal
                showsScrollIndicator={false}
                style={{ height: 190 }}
              >
                <Row style={{ gap: 12, paddingRight: 16 }}>
                  {NOW_SHOWING.slice(0, 8).map((movie) => (
                    <Poster
                      key={movie.id}
                      movie={movie}
                      onPress={() => props.onOpenMovie(movie.id)}
                      testID={`poster-${movie.id}`}
                    />
                  ))}
                </Row>
              </ScrollView>
            </Section>

            <Section
              title="Suất chiếu tối nay"
              caption="Chọn giờ để mở sơ đồ ghế"
            >
              <Card style={{ gap: 14 }}>
                {tonight.map((entry) => (
                  <TonightRow
                    key={entry.movie.id}
                    movie={entry.movie}
                    times={entry.times}
                    onOpen={() => props.onOpenMovie(entry.movie.id)}
                  />
                ))}
              </Card>
            </Section>

            {favoriteMovies.length > 0 ? (
              <Section title="Phim của bạn" caption="Danh sách yêu thích đã lưu">
                <ScrollView
                  horizontal
                  showsScrollIndicator={false}
                  style={{ height: 190 }}
                >
                  <Row style={{ gap: 12, paddingRight: 16 }}>
                    {favoriteMovies.map((movie) => (
                      <Poster
                        key={movie.id}
                        movie={movie}
                        onPress={() => props.onOpenMovie(movie.id)}
                        testID={`favorite-${movie.id}`}
                      />
                    ))}
                  </Row>
                </ScrollView>
              </Section>
            ) : null}

            <Section title="Sắp chiếu" caption="Mở bán vé trước hai tuần">
              <View style={{ gap: 10 }}>
                {COMING_SOON.slice(0, 3).map((movie) => (
                  <MovieRow
                    key={movie.id}
                    movie={movie}
                    onPress={() => props.onOpenMovie(movie.id)}
                  />
                ))}
              </View>
            </Section>

            <View
              style={{
                borderRadius: radius.lg,
                padding: 18,
                gap: 8,
                gradient: {
                  type: "linear",
                  angle: 135,
                  stops: [
                    { offset: 0, color: colors.brand },
                    { offset: 1, color: colors.brandDark },
                  ],
                },
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  letterSpacing: 1.2,
                  color: "#ffd7dd",
                }}
              >
                THỨ BA VUI VẺ
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.white }}>
                2 vé 1 giá
              </Text>
              <Text style={{ fontSize: 12, color: "#ffe3e7" }}>
                Áp dụng cho mọi suất 2D trước 18:00, không cần mã. Chọn hai ghế
                thường là hệ thống tự giảm ở bước thanh toán.
              </Text>
              <Pressable
                onPress={() =>
                  void showToast("Ưu đãi đã được thêm vào ví", {
                    icon: "success",
                  })
                }
                accessibleLabel="Nhận ưu đãi thứ ba"
                style={{
                  marginTop: 4,
                  alignSelf: "start",
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: radius.pill,
                  backgroundColor: colors.white,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: colors.brandDark }}
                >
                  Nhận ưu đãi
                </Text>
              </Pressable>
            </View>

            <View style={{ alignItems: "center", gap: 4, paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Rạp Phố · 12 Nguyễn Huệ, Quận 1 · Hotline 1900 6789
              </Text>
              <Text style={{ fontSize: 10, color: "#5c6478" }}>
                Giá vé đã gồm VAT · Phim chiếu từ 09:00 đến 23:30
              </Text>
            </View>
          </View>
        </ScrollView>

        <NavBar
          title="Rạp Phố"
          subtitle={onImage ? "Quận 1 · TP.HCM" : "6 phòng chiếu · Quận 1"}
          transparent={onImage}
          blur={surface === "blur"}
          style={{ color: onImage ? colors.white : colors.ink }}
        />
      </Stack>
    </View>
  );
}

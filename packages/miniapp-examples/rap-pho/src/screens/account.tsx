import { getUserInfo, share, showToast, useEffect, useState } from "@mna/qchat";import type { UserInfo } from "@mna/qchat";
import {
  Avatar,
  CustomPaint,
  Divider,
  Icon,
  NavBar,
  Pressable,
  Row,
  ScrollView,
  Switch,
  Tag,
  Text,
  View,
} from "@mna/qchat/ui";
import {
  BASE_POINTS,
  memberTier,
  money,
  movieById,
  ticketStats,
  updatePrefs,
  useFavorites,
  usePrefs,
  useTickets,
} from "../store.js";
import type { Movie } from "../store.js";
import { colors, radius } from "../theme.js";
import { Card, EmptyState, Poster, ScreenShell, Section } from "../ui.js";

const SPARK = [4, 6, 5, 8, 7, 11];
const SPARK_MONTHS = ["T5", "T6", "T7", "T8", "T9", "T10"];

function sparkPath(width: number, height: number): string {
  const step = width / (SPARK.length - 1);
  const max = 12;
  const points = SPARK.map((value, index) => {
    const x = Math.round(index * step);
    const y = Math.round(height - 8 - (value / max) * (height - 16));
    return `${x} ${y}`;
  });
  return `stroke:${colors.gold} strokeWidth:2 cap:round M ${points.join(" L ")}`;
}

/** Một dòng cài đặt có công tắc. */
function SwitchRow(props: {
  icon: string;
  title: string;
  note: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Row style={{ alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={16} color={colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, color: colors.ink }}>{props.title}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.note}</Text>
      </View>
      <Switch value={props.value} onChange={(event) => props.onChange(event.value)} />
    </Row>
  );
}

/** Một dòng mở trang khác. */
function LinkRow(props: {
  icon: string;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibleLabel={props.title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={props.icon} size={16} color={colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, color: colors.ink }}>{props.title}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{props.note}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.muted} />
    </Pressable>
  );
}

/**
 * Tab Tôi: hồ sơ, hạng thành viên, thống kê, chi tiêu 6 tháng, phim yêu thích,
 * cài đặt và lối vào trang điều khoản.
 */
export function AccountScreen(props: {
  onOpenMovie: (id: string) => void;
  onOpenLegal: () => void;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const tickets = useTickets();
  const prefs = usePrefs();
  const favorites = useFavorites();
  const stats = ticketStats(tickets);
  const tier = memberTier(stats.points);
  const displayName = user?.nickname ?? "Khán giả Rạp Phố";
  const favoriteMovies = favorites
    .map((id) => movieById(id))
    .filter((movie): movie is Movie => movie !== null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const info = await getUserInfo();
        if (alive) setUser(info);
      } catch {
        // A denied profile permission keeps the guest name.
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const doShare = async () => {
    try {
      const done = await share({
        title: "Rạp Phố",
        text: "Đặt vé xem phim, chọn ghế và nhận vé điện tử trong QChat.",
        url: "https://qchat.vn/miniapp/rap-pho",
      });
      void showToast(done ? "Đã chia sẻ Rạp Phố" : "Bạn đã đóng bảng chia sẻ", {
        icon: done ? "success" : "none",
      });
    } catch {
      void showToast("Không chia sẻ được", { icon: "error" });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Tôi"
        subtitle={`Hạng ${tier.name} · ${stats.points} điểm`}
        style={{ backgroundColor: colors.bg, color: colors.ink }}
      />
      <ScreenShell>
        <View
          style={{
            borderRadius: radius.lg,
            padding: 16,
            gap: 14,
            borderWidth: 1,
            borderColor: "#3a2430",
            gradient: {
              type: "linear",
              angle: 135,
              stops: [
                { offset: 0, color: "#2a1620" },
                { offset: 1, color: "#151a24" },
              ],
            },
          }}
        >
          <Row style={{ gap: 14, alignItems: "center" }}>
            <Avatar name={displayName} size={56} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 17, fontWeight: "bold", color: colors.ink }}>
                {displayName}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {user ? `@${user.qchatId}` : "Khách · đăng nhập QChat để tích điểm"}
              </Text>
              <Row style={{ gap: 6, alignItems: "center" }}>
                <Tag tone="warning" size="sm">
                  {tier.name}
                </Tag>
                <Text style={{ fontSize: 11, color: colors.gold }}>
                  {`${stats.points} điểm`}
                </Text>
              </Row>
            </View>
          </Row>

          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {tier.toNext > 0
                  ? `Còn ${tier.toNext} điểm để lên hạng ${tier.next}`
                  : "Bạn đã ở hạng cao nhất"}
              </Text>
              <Text style={{ fontSize: 11, color: colors.gold }}>
                {`${tier.percent}%`}
              </Text>
            </Row>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: "#241b22",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.max(4, tier.percent)}%`,
                  borderRadius: 3,
                  gradient: {
                    type: "linear",
                    angle: 90,
                    stops: [
                      { offset: 0, color: colors.brand },
                      { offset: 1, color: colors.gold },
                    ],
                  },
                }}
              />
            </View>
            <Text style={{ fontSize: 10, color: "#5c6478" }}>
              {`Mỗi 10.000đ chi tiêu nhận 1 điểm · ${BASE_POINTS} điểm thưởng đã cộng`}
            </Text>
          </View>
        </View>

        <Card style={{ flexDirection: "row", paddingVertical: 14 }}>
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}>
              {String(stats.watched)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Phim đã xem</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.ink }}>
              {String(stats.upcoming)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Vé sắp tới</Text>
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: colors.line }} />
          <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.brand }}>
              {String(favorites.length)}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>Phim yêu thích</Text>
          </View>
        </Card>

        <Section title="Chi tiêu 6 tháng" caption="Tổng 1.840.000đ · tháng 10 cao nhất">
          <Card style={{ gap: 8 }}>
            <CustomPaint
              width={300}
              height={72}
              draw={sparkPath(300, 72)}
              style={{ width: "100%" }}
            />
            <Row style={{ justifyContent: "spaceBetween" }}>
              {SPARK_MONTHS.map((month) => (
                <Text key={month} style={{ fontSize: 10, color: colors.muted }}>
                  {month}
                </Text>
              ))}
            </Row>
            <Divider />
            <Row style={{ justifyContent: "spaceBetween" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Trung bình 306.000đ/tháng
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "bold", color: colors.gold }}>
                {money(1840000)}
              </Text>
            </Row>
          </Card>
        </Section>

        <Section
          title="Phim yêu thích"
          caption={`${favorites.length} phim · chạm để xem lại`}
        >
          {favoriteMovies.length === 0 ? (
            <Card>
              <EmptyState
                title="Chưa có phim yêu thích"
                caption="Mở một phim và chạm Yêu thích để lưu vào đây."
              />
            </Card>
          ) : (
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
          )}
        </Section>

        <Section title="Cài đặt">
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            <SwitchRow
              icon="clock"
              title="Nhắc lịch trước giờ chiếu"
              note="Thông báo trước suất chiếu 2 giờ"
              value={prefs.remind}
              onChange={(value) => updatePrefs({ remind: value })}
            />
            <Divider inset={46} />
            <SwitchRow
              icon="location"
              title="Rạp gần tôi"
              note="Ưu tiên suất chiếu ở rạp gần nhất"
              value={prefs.nearby}
              onChange={(value) => updatePrefs({ nearby: value })}
            />
            <Divider inset={46} />
            <SwitchRow
              icon="gift"
              title="Ưu đãi và phim mới"
              note="Nhận thông báo khuyến mãi mỗi tuần"
              value={prefs.newsletter}
              onChange={(value) => updatePrefs({ newsletter: value })}
            />
          </Card>
        </Section>

        <Section title="Khác">
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            <LinkRow
              icon="shieldCheck"
              title="Điều khoản & quyền riêng tư"
              note="Cách Rạp Phố dùng dữ liệu của bạn"
              onPress={props.onOpenLegal}
            />
            <Divider inset={46} />
            <LinkRow
              icon="share"
              title="Chia sẻ Rạp Phố"
              note="Gửi Mini App cho bạn bè trong QChat"
              onPress={() => void doShare()}
            />
            <Divider inset={46} />
            <LinkRow
              icon="headset"
              title="Hỗ trợ"
              note="Hotline 1900 6789 · 08:00–22:00"
              onPress={() =>
                void showToast("Tổng đài mở từ 08:00 đến 22:00", {
                  icon: "none",
                })
              }
            />
            <Divider inset={46} />
            <LinkRow
              icon="info"
              title="Phiên bản"
              note="Rạp Phố 1.0.0 · QChat Mini App"
              onPress={() =>
                void showToast("Rạp Phố 1.0.0 · SDK 1.0.0", { icon: "none" })
              }
            />
          </Card>
        </Section>

        <View style={{ alignItems: "center", gap: 4, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>
            Rạp Phố · 12 Nguyễn Huệ, Quận 1, TP.HCM
          </Text>
          <Text style={{ fontSize: 10, color: "#5c6478" }}>
            Giấy phép kinh doanh 0312 345 678 · Đại diện: Lê Hoàng Anh
          </Text>
        </View>
      </ScreenShell>
    </View>
  );
}

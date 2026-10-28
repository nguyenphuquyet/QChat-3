import { useEffect, useState } from "@mna/qchat";
import {
  ListView,
  NavBar,
  Row,
  ScrollView,
  Text,
  TextField,
  View,
} from "@mna/qchat/ui";
import { GENRES, MOVIES } from "../store.js";
import type { Movie } from "../store.js";
import { colors, radius } from "../theme.js";
import { Chip, EmptyState, MovieRow } from "../ui.js";

const PAGE = 12;

type StatusFilter = "all" | "now" | "soon";

interface MoreRow {
  id: "__more__";
  remaining: number;
}

type RowItem = Movie | MoreRow;

/**
 * Tab Phim: header đặc có ba hàng dưới (ô tìm kiếm, thể loại, trạng thái) và
 * một `ListView` cửa sổ. Danh sách tự phân trang 12 phim mỗi lần chạm đáy;
 * dòng cuối cho biết còn bao nhiêu phim.
 */
export function MoviesScreen(props: { onOpenMovie: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, genre, status]);

  const needle = query.trim().toLowerCase();
  const filtered = MOVIES.filter((movie) => {
    const inGenre = genre === "all" || movie.genres.includes(genre);
    const inStatus = status === "all" || movie.status === status;
    const matches =
      needle.length === 0 ||
      movie.title.toLowerCase().includes(needle) ||
      movie.original.toLowerCase().includes(needle) ||
      movie.genres.some((item) => item.toLowerCase().includes(needle));
    return inGenre && inStatus && matches;
  });

  const visible = filtered.slice(0, page * PAGE);
  const rows: RowItem[] =
    filtered.length === 0
      ? []
      : [...visible, { id: "__more__", remaining: filtered.length - visible.length }];

  const statusLabel =
    status === "all" ? "Tất cả" : status === "now" ? "Đang chiếu" : "Sắp chiếu";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavBar
        title="Phim"
        subtitle={`${filtered.length} phim · ${statusLabel}`}
        style={{ backgroundColor: colors.bg, color: colors.ink }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
          <TextField
            value={query}
            placeholder="Tìm tên phim, thể loại…"
            onInput={setQuery}
            testID="search"
            style={{
              backgroundColor: colors.soft,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.line,
              color: colors.ink,
            }}
          />
          <ScrollView
            horizontal
            showsScrollIndicator={false}
            style={{ height: 34 }}
          >
            <Row style={{ gap: 8, paddingRight: 16 }}>
              <Chip
                label="Tất cả"
                active={genre === "all"}
                onPress={() => setGenre("all")}
              />
              {GENRES.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={genre === item}
                  onPress={() => setGenre(item)}
                />
              ))}
            </Row>
          </ScrollView>
          <Row
            style={{
              justifyContent: "spaceBetween",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Row style={{ gap: 8 }}>
              {(
                [
                  ["all", "Tất cả"],
                  ["now", "Đang chiếu"],
                  ["soon", "Sắp chiếu"],
                ] as Array<[StatusFilter, string]>
              ).map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  active={status === key}
                  onPress={() => setStatus(key)}
                />
              ))}
            </Row>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {`${visible.length}/${filtered.length}`}
            </Text>
          </Row>
        </View>
      </NavBar>

      <ListView<RowItem>
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 24,
        }}
        data={rows}
        initialCount={PAGE + 1}
        onEndReached={() => setPage((previous) => previous + 1)}
        empty={
          <EmptyState
            title="Không tìm thấy phim"
            caption="Thử từ khoá khác, hoặc bỏ bộ lọc thể loại và trạng thái."
          />
        }
        renderItem={(item) =>
          "title" in item ? (
            <View style={{ marginBottom: 10 }}>
              <MovieRow
                movie={item}
                onPress={() => props.onOpenMovie(item.id)}
              />
            </View>
          ) : (
            <View
              style={{
                alignItems: "center",
                gap: 4,
                paddingTop: 10,
                paddingBottom: 22,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {item.remaining > 0
                  ? `Còn ${item.remaining} phim · cuộn để tải thêm`
                  : `Đã hiển thị tất cả ${filtered.length} phim`}
              </Text>
              <Text style={{ fontSize: 10, color: "#5c6478" }}>
                Danh sách tải theo trang, 12 phim mỗi lần
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

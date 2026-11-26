import { createStorage, useEffect, useState } from "@mna/qchat";

/**
 * Rạp Phố — dữ liệu của một rạp chiếu phim giả lập.
 *
 * Không có ảnh poster: mỗi phim chỉ giữ một "tone" (cặp màu) để màn hình tự vẽ
 * gradient. Nhờ vậy app không cần asset nào mà vẫn có 30 poster khác nhau, và
 * toàn bộ dữ liệu vẫn là JSON thuần mà Mini App runtime chấp nhận.
 */

export type AgeRating = "P" | "K" | "T13" | "T16" | "T18";
export type MovieStatus = "now" | "soon";
export type Format = "2D" | "3D" | "IMAX";

export interface Movie {
  id: string;
  title: string;
  original: string;
  year: number;
  minutes: number;
  rating: number;
  age: AgeRating;
  genres: string[];
  tagline: string;
  synopsis: string;
  director: string;
  cast: string[];
  tone: number;
  status: MovieStatus;
  formats: Format[];
  language: string;
  /** Ngày khởi chiếu dạng `dd.mm`, dùng cho phim sắp chiếu. */
  opening: string;
}

type MovieRow = [
  id: string,
  title: string,
  original: string,
  year: number,
  minutes: number,
  rating: number,
  age: AgeRating,
  genres: string[],
  tagline: string,
  synopsis: string,
  director: string,
  cast: string[],
  tone: number,
  status: MovieStatus,
  formats: Format[],
  language: string,
  opening: string,
];

/**
 * Bảng phim. Thứ tự ở đây là thứ tự của tab "Phim", nên phim mới nhất đứng
 * trước và phim sắp chiếu nằm cuối.
 */
const ROWS: MovieRow[] = [
  ["dem-sai-gon", "Đêm Sài Gòn", "Saigon Nights", 2025, 118, 8.4, "T16", ["Hành động", "Tội phạm"], "Một đêm, ba băng nhóm, một chiếc cặp.", "Một tay chạy xe ôm bị cuốn vào phi vụ tráo hàng giữa ba băng nhóm trong đêm cuối tuần.", "Trần Minh Quân", ["Lâm Chấn Phong", "Ngọc Lan", "Bảo Anh"], 4, "now", ["2D", "IMAX"], "Phụ đề Việt", "05.10"],
  ["nguoi-giu-den-bien", "Người Giữ Đèn Biển", "The Lighthouse Keeper", 2025, 104, 8.1, "P", ["Chính kịch", "Gia đình"], "Ba thế hệ, một ngọn đèn.", "Người cha già ở Côn Đảo chờ đứa con trai trở về sau hai mươi năm xa cách.", "Lê Hoàng Anh", ["Trọng Hiếu", "Diễm My", "Bé Na"], 1, "now", ["2D"], "Phụ đề Việt", "05.10"],
  ["cuoc-goi-luc-nua-dem", "Cuộc Gọi Lúc Nửa Đêm", "The Midnight Call", 2025, 96, 7.6, "T18", ["Kinh dị", "Bí ẩn"], "Đừng nhấc máy.", "Mỗi đêm, tổng đài viên trực ca nhận một cuộc gọi từ chính căn nhà mình đang ở.", "Vũ Hạ Vy", ["Thanh Thảo", "Quốc Trường", "Hoàng Yến"], 5, "now", ["2D"], "Phụ đề Việt", "12.10"],
  ["mua-he-khong-tro-lai", "Mùa Hè Không Trở Lại", "Last Summer", 2025, 112, 8.7, "T13", ["Tình cảm", "Học đường"], "Mùa hè cuối cấp, lần đầu biết thương.", "Bốn người bạn thân dành ba tháng cuối cấp ba ở Đà Lạt và giữ một lời hẹn không ai dám nói ra.", "Nguyễn Thu Hà", ["Minh Khuê", "Anh Duy", "Tú Linh"], 2, "now", ["2D"], "Phụ đề Việt", "20.09"],
  ["thanh-pho-tren-may", "Thành Phố Trên Mây", "Sky City", 2025, 92, 8.2, "P", ["Hoạt hình", "Phiêu lưu"], "Một cô bé, một chiếc dù, cả bầu trời.", "Cô bé bán bóng bay theo chân một đám mây lạc vào thành phố trên không.", "Đỗ Khánh Linh", ["Bé Mai", "Hồng Nhung", "Trung Kiên"], 6, "now", ["2D", "3D"], "Lồng tiếng Việt", "01.10"],
  ["nguoi-thu-ba", "Người Thứ Ba", "The Third", 2025, 124, 7.9, "T16", ["Tâm lý", "Bí ẩn"], "Càng gần sự thật, càng lạnh.", "Một luật sư trẻ về quê nhận hồ sơ cũ và phát hiện chính mình có mặt trong biên bản vụ án.", "Phạm Quốc Bảo", ["Lê Hà", "Minh Trang", "Việt Hùng"], 8, "now", ["2D"], "Phụ đề Việt", "10.10"],
  ["sai-gon-1995", "Sài Gòn 1995", "Saigon 1995", 2025, 116, 8.5, "T13", ["Chính kịch", "Âm nhạc"], "Một băng nhạc, một thành phố đang đổi thay.", "Ba nhạc công trẻ mở phòng thu đầu tiên và ghi lại những đêm nhạc cuối cùng của một Sài Gòn cũ.", "Hoàng Mỹ Duyên", ["Quang Hào", "Ngọc Anh", "Tấn Phát"], 7, "now", ["2D"], "Phụ đề Việt", "05.10"],
  ["cuong-phong", "Cường Phong", "Gale", 2025, 108, 7.4, "T16", ["Hành động", "Thể thao"], "Gió đổi chiều, người đổi vận.", "Một võ sĩ lướt sóng tìm cách quay lại đường đua sau chấn thương và một lần bị xoá tên.", "Trần Bảo Long", ["Hữu Tài", "Ngọc Châu", "Sơn Tùng"], 10, "now", ["2D", "IMAX"], "Phụ đề Việt", "17.10"],
  ["bong-dem", "Bóng Đêm", "Nightfall", 2025, 120, 7.8, "T18", ["Tội phạm", "Giật gân"], "Thành phố ngủ, nghề nghiệp thức.", "Một nữ điều tra viên tội phạm mất con và lao vào đường dây mua bán trong bóng tối.", "Vũ Hạ Vy", ["Thanh Hằng", "Đức Anh", "Kim Ngân"], 11, "now", ["2D"], "Phụ đề Việt", "24.10"],
  ["chiec-la-thu-cuoi", "Chiếc Lá Thư Cuối", "The Last Letter", 2025, 98, 8.3, "P", ["Gia đình"], "Một lá thư, một mùa trăng.", "Bà ngoại viết thư cho từng người trong nhà rồi lặng lẽ chuẩn bị cho đêm Trung thu cuối cùng.", "Lê Hoàng Anh", ["Bạch Tuyết", "Diễm My", "Bảo Ngọc"], 3, "now", ["2D"], "Phụ đề Việt", "01.10"],
  ["hai-nguoi-linh", "Hai Người Lính", "Two Soldiers", 2025, 132, 8.6, "T16", ["Chiến tranh", "Chính kịch"], "Hai phía, một mệnh lệnh.", "Hai người lính từ hai phía gặp nhau trong một trạm cứu thương giữa chiến dịch mùa khô.", "Nguyễn Đức Huy", ["Trọng Hiếu", "Việt Hùng", "Thanh Vân"], 0, "now", ["2D", "IMAX"], "Phụ đề Việt", "05.10"],
  ["vet-muc-tren-tuong", "Vết Mực Trên Tường", "Ink on the Wall", 2025, 102, 8.0, "T13", ["Học đường", "Thanh xuân"], "Lớp 12A viết gì lên tường?", "Nhóm học sinh cuối cấp dùng bức tường lớp làm nơi giãi bày, cho đến khi nhà trường quyết định sơn lại.", "Nguyễn Thu Hà", ["Tú Linh", "Anh Duy", "Minh Khuê"], 9, "now", ["2D"], "Phụ đề Việt", "12.10"],
  ["hanh-tinh-cat", "Hành Tinh Cát", "Dune of the East", 2025, 141, 8.8, "T13", ["Khoa học viễn tưởng", "Phiêu lưu"], "Cát giữ ký ức của người đã khuất.", "Một nhà địa chất tìm thấy tín hiệu sống trong lòng sa mạc và phải chọn giữa sự thật và gia đình.", "Đỗ Khánh Linh", ["Hữu Tài", "Ngọc Lan", "Trung Kiên"], 1, "soon", ["2D", "3D", "IMAX"], "Phụ đề Việt", "14.11"],
  ["ke-an-danh", "Kẻ Ẩn Danh", "Anonymous", 2025, 115, 7.7, "T18", ["Hành động", "Giật gân"], "Không tên, không dấu vết.", "Một cựu đặc vụ bị xoá danh tính phải bảo vệ người duy nhất còn nhớ tên mình.", "Trần Bảo Long", ["Lâm Chấn Phong", "Thanh Hằng", "Đức Anh"], 4, "soon", ["2D", "IMAX"], "Phụ đề Việt", "21.11"],
  ["bo-ba-ky-quac", "Bộ Ba Kỳ Quặc", "The Odd Three", 2025, 95, 7.5, "P", ["Hài", "Gia đình"], "Ba người, một chuyến xe, không ai biết đường.", "Ba người xa lạ cùng thuê một chiếc xe để về quê ăn Tết và không ai chịu nhường tay lái.", "Phạm Quốc Bảo", ["Trấn Thành", "Kaity Nguyễn", "Quốc Trường"], 7, "soon", ["2D"], "Phụ đề Việt", "28.11"],
  ["nha-co-ba-co-hon", "Nhà Có Ba Cô Hồn", "Three Ghosts at Home", 2025, 101, 7.2, "T16", ["Kinh dị", "Hài"], "Nhà mới, bạn cũ.", "Một gia đình chuyển vào căn nhà cổ và phát hiện ba vị khách không mời đã sống ở đó từ lâu.", "Vũ Hạ Vy", ["Thanh Thảo", "Trấn Thành", "Hoàng Yến"], 2, "soon", ["2D"], "Phụ đề Việt", "31.10"],
  ["bien-khong-co-song", "Biển Không Có Sóng", "Still Sea", 2025, 109, 8.2, "T13", ["Chính kịch"], "Sóng lặng nhất là sóng dưới lòng.", "Một ngư dân trở về sau bão và phải học cách sống với người vợ đã thay đổi.", "Lê Hoàng Anh", ["Việt Hùng", "Thanh Vân", "Bảo Ngọc"], 6, "soon", ["2D"], "Phụ đề Việt", "07.11"],
  ["cuoc-dua-cuoi-cung", "Cuộc Đua Cuối Cùng", "Final Lap", 2025, 113, 7.6, "T16", ["Hành động", "Đua xe"], "Về đích hay về nhà?", "Một tay đua đường phố nhận lời chạy chuyến cuối để trả nợ cho xưởng của cha.", "Trần Bảo Long", ["Sơn Tùng", "Ngọc Châu", "Hữu Tài"], 10, "now", ["2D", "IMAX"], "Phụ đề Việt", "17.10"],
  ["nang-thang-muoi", "Nắng Tháng Mười", "October Sun", 2025, 97, 8.1, "P", ["Tình cảm"], "Nắng về muộn, thương về muộn.", "Một hoạ sĩ ở Hội An gặp lại người yêu cũ đúng mùa lụt và cả hai đều đã có gia đình.", "Hoàng Mỹ Duyên", ["Ngọc Anh", "Quang Hào", "Minh Trang"], 8, "now", ["2D"], "Phụ đề Việt", "10.10"],
  ["nguoi-moi-gioi", "Người Môi Giới", "The Broker", 2025, 126, 8.0, "T18", ["Tội phạm", "Chính kịch"], "Mọi thứ đều có giá.", "Một người môi giới bất động sản phát hiện mảnh đất mình vừa bán là nơi chôn giấu một vụ án.", "Nguyễn Đức Huy", ["Lê Hà", "Đức Anh", "Kim Ngân"], 11, "now", ["2D"], "Phụ đề Việt", "24.10"],
  ["am-nhac-duong-pho", "Âm Nhạc Đường Phố", "Street Notes", 2025, 94, 7.9, "T13", ["Âm nhạc", "Chính kịch"], "Mỗi góc phố là một sân khấu.", "Ba nhóm nhạc đường phố thi nhau giành một suất diễn tại lễ hội cuối năm.", "Nguyễn Thu Hà", ["Tấn Phát", "Ngọc Anh", "Bé Mai"], 0, "now", ["2D"], "Phụ đề Việt", "12.10"],
  ["con-trai-cua-bien", "Con Trai Của Biển", "Son of the Sea", 2025, 99, 8.4, "P", ["Phiêu lưu", "Gia đình"], "Đi xa để hiểu nhà.", "Cậu bé thành phố về đảo ở với ông ngoại một mùa hè và học cách lặn biển.", "Đỗ Khánh Linh", ["Bé Na", "Trọng Hiếu", "Hồng Nhung"], 3, "now", ["2D"], "Phụ đề Việt", "01.10"],
  ["mat-na-hoang-kim", "Mặt Nạ Hoàng Kim", "Golden Mask", 2025, 119, 7.8, "T16", ["Hành động", "Bí ẩn"], "Mặt nạ càng đẹp, mặt thật càng xa.", "Một nhà bảo tồn trẻ bị cuốn vào đường dây làm giả cổ vật có tổ chức.", "Phạm Quốc Bảo", ["Minh Trang", "Lâm Chấn Phong", "Việt Hùng"], 7, "soon", ["2D", "IMAX"], "Phụ đề Việt", "05.12"],
  ["thuong-nho-mot-nguoi", "Thương Nhớ Một Người", "Missing You", 2025, 105, 7.7, "T13", ["Tình cảm"], "Có người đi để mình nhớ.", "Một người viết thư tay cho người yêu ở nước ngoài suốt mười năm mà chưa từng gửi.", "Nguyễn Thu Hà", ["Ngọc Anh", "Quang Hào", "Tú Linh"], 2, "now", ["2D"], "Phụ đề Việt", "20.09"],
  ["ngay-tan-the-cua-chung-ta", "Ngày Tận Thế Của Chúng Ta", "Our Last Day", 2025, 128, 8.3, "T16", ["Khoa học viễn tưởng", "Chính kịch"], "Còn 24 giờ, em muốn đi đâu?", "Khi một vệ tinh báo sai về ngày tận thế, cả thành phố sống như thể ngày mai không tồn tại.", "Vũ Hạ Vy", ["Lê Hà", "Hữu Tài", "Thanh Thảo"], 5, "now", ["2D", "IMAX"], "Phụ đề Việt", "24.10"],
  ["tieng-dan-ben-song", "Tiếng Đàn Bên Sông", "River Song", 2025, 110, 8.5, "P", ["Chính kịch", "Âm nhạc"], "Một cây đàn, hai cuộc đời.", "Người nghệ sĩ đàn tranh già nhận cô học trò nghèo và dạy cô bài bản cuối cùng của mình.", "Lê Hoàng Anh", ["Bạch Tuyết", "Diễm My", "Bảo Ngọc"], 6, "now", ["2D"], "Phụ đề Việt", "10.10"],
  ["sat-thu-cuoi-tuan", "Sát Thủ Cuối Tuần", "Weekend Hitman", 2025, 103, 7.5, "T18", ["Hài", "Hành động"], "Nghề tay trái, phiền tay phải.", "Một nhân viên kế toán nhận việc ám sát vào cuối tuần và luôn về kịp bữa tối gia đình.", "Trần Minh Quân", ["Trấn Thành", "Kaity Nguyễn", "Đức Anh"], 4, "now", ["2D"], "Phụ đề Việt", "17.10"],
  ["vu-dieu-cua-buom", "Vũ Điệu Của Bướm", "Butterfly Dance", 2025, 106, 8.0, "T13", ["Tình cảm", "Âm nhạc"], "Cánh bướm cũng biết yêu.", "Một biên đạo múa trẻ mất thính lực và dựng vở diễn cuối cùng bằng cảm nhận rung động.", "Hoàng Mỹ Duyên", ["Tú Linh", "Anh Duy", "Kim Ngân"], 9, "soon", ["2D"], "Phụ đề Việt", "12.12"],
  ["nguoi-gac-rung", "Người Gác Rừng", "The Ranger", 2025, 111, 8.2, "P", ["Phiêu lưu", "Gia đình"], "Rừng còn, người còn.", "Một kiểm lâm trẻ cùng cậu con trai bám theo nhóm săn trộm xuyên qua khu rừng nguyên sinh.", "Nguyễn Đức Huy", ["Trọng Hiếu", "Bé Na", "Sơn Tùng"], 3, "now", ["2D"], "Phụ đề Việt", "05.10"],
  ["dem-truoc-giao-thua", "Đêm Trước Giao Thừa", "New Year's Eve", 2025, 100, 8.1, "T13", ["Gia đình", "Hài"], "Cả nhà về muộn, Tết vẫn chờ.", "Ba thế hệ trong một gia đình kẹt xe trên đường về quê ăn Tết và buộc phải nói chuyện với nhau.", "Phạm Quốc Bảo", ["Bạch Tuyết", "Trấn Thành", "Diễm My"], 7, "now", ["2D"], "Phụ đề Việt", "20.09"],
];

export const MOVIES: Movie[] = ROWS.map((row) => {
  const [id, title, original, year, minutes, rating, age, genres, tagline, synopsis, director, cast, tone, status, formats, language, opening] = row;
  return { id, title, original, year, minutes, rating, age, genres, tagline, synopsis, director, cast, tone, status, formats, language, opening };
});

/** Chip lọc ở tab Phim. Nhãn trùng đúng với `genres` của phim. */
export const GENRES: string[] = [
  "Hành động",
  "Tình cảm",
  "Kinh dị",
  "Hoạt hình",
  "Hài",
  "Chính kịch",
  "Khoa học viễn tưởng",
  "Tội phạm",
  "Gia đình",
];

export function movieById(id: string): Movie | null {
  return MOVIES.find((movie) => movie.id === id) ?? null;
}

export function movieTitle(id: string): string {
  return movieById(id)?.title ?? "Phim";
}

export const NOW_SHOWING: Movie[] = MOVIES.filter((movie) => movie.status === "now");
export const COMING_SOON: Movie[] = MOVIES.filter((movie) => movie.status === "soon");

/* ------------------------------------------------------------------ */
/* Suất chiếu                                                          */
/* ------------------------------------------------------------------ */

export interface Showtime {
  id: string;
  movieId: string;
  dateKey: string;
  time: string;
  format: Format;
  hall: string;
  /** Giá một ghế thường, đã gồm phụ phí định dạng và suất muộn. */
  price: number;
}

export interface Day {
  key: string;
  /** "Hôm nay", "Ngày mai" hoặc "T7". */
  label: string;
  weekday: string;
  /** `29/10`. */
  date: string;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const SLOT_TIMES = ["09:20", "11:45", "14:10", "16:35", "18:50", "20:15", "21:40", "23:05"];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
}

/** Sáu ngày mở bán vé, bắt đầu từ hôm nay. */
export function showtimeDays(): Day[] {
  const today = new Date();
  const days: Day[] = [];
  for (let index = 0; index < 6; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index);
    days.push({
      key: dateKeyOf(date),
      label: index === 0 ? "Hôm nay" : index === 1 ? "Ngày mai" : WEEKDAYS[date.getDay()],
      weekday: WEEKDAYS[date.getDay()],
      date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`,
    });
  }
  return days;
}

/** Băm chuỗi thành số dương, ổn định giữa các lần chạy (FNV-1a). */
export function codeHash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/**
 * Suất chiếu sinh từ `movieId + ngày`, nên mở lại app vẫn thấy đúng lịch cũ.
 * Phim sắp chiếu chưa có suất nào.
 */
export function showtimesFor(movieId: string, dayKey: string): Showtime[] {
  const movie = movieById(movieId);
  if (!movie || movie.status === "soon") return [];
  const seed = codeHash(`${movieId}|${dayKey}`);
  const day = dateFromKey(dayKey);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const count = 4 + (seed % 3);
  const start = seed % 4;
  const list: Showtime[] = [];
  for (let index = 0; index < count; index += 1) {
    const time = SLOT_TIMES[(start + index) % SLOT_TIMES.length];
    const format = movie.formats[(seed + index) % movie.formats.length];
    const late = time >= "21:00";
    const price =
      85000 +
      (weekend ? 10000 : 0) +
      (format === "IMAX" ? 50000 : format === "3D" ? 20000 : 0) +
      (late ? 10000 : 0);
    list.push({
      id: `${movieId}-${dayKey}-${time.replace(":", "")}`,
      movieId,
      dateKey: dayKey,
      time,
      format,
      hall: format === "IMAX" ? "Phòng IMAX" : format === "3D" ? "Phòng 3D" : `Phòng ${1 + ((seed + index) % 3)}`,
      price,
    });
  }
  return list.sort((left, right) => left.time.localeCompare(right.time));
}

/* ------------------------------------------------------------------ */
/* Ghế                                                                 */
/* ------------------------------------------------------------------ */

export const SEAT_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const SEAT_COLUMNS = 9;
const VIP_ROWS = ["E", "F"];

export interface Seat {
  id: string;
  row: string;
  column: number;
  vip: boolean;
  taken: boolean;
  price: number;
}

/**
 * 8 hàng × 9 ghế = 72 ghế. Hàng E và F là ghế VIP. Ghế đã bán được băm từ
 * `showtime.id` nên mỗi suất có sơ đồ khác nhau nhưng vẫn lặp lại được.
 */
export function seatsFor(show: Showtime): Seat[] {
  const seats: Seat[] = [];
  for (const row of SEAT_ROWS) {
    for (let column = 1; column <= SEAT_COLUMNS; column += 1) {
      const id = `${row}${column}`;
      const vip = VIP_ROWS.includes(row);
      seats.push({
        id,
        row,
        column,
        vip,
        taken: codeHash(`${show.id}|${id}`) % 100 < 32,
        price: show.price + (vip ? 30000 : 0),
      });
    }
  }
  return seats;
}

/* ------------------------------------------------------------------ */
/* Vé                                                                  */
/* ------------------------------------------------------------------ */

export type TicketStatus = "upcoming" | "used" | "cancelled";

export interface Ticket {
  code: string;
  movieId: string;
  dateKey: string;
  time: string;
  format: Format;
  hall: string;
  seats: string[];
  total: number;
  at: number;
  status: TicketStatus;
  combo: boolean;
  payment: string;
}

export const COMBO_PRICE = 79000;
export const PAYMENTS = ["Ví QChat", "Thẻ nội địa", "Ví điện tử"];
export const BASE_POINTS = 1240;

export interface Prefs {
  remind: boolean;
  nearby: boolean;
  newsletter: boolean;
}

let tickets: Ticket[] = seedTickets();
let favorites: string[] = ["mua-he-khong-tro-lai", "tieng-dan-ben-song"];
let prefs: Prefs = { remind: true, nearby: false, newsletter: true };
let hydrated = false;
let nextTicketId = 4790;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const storage = createStorage("rap-pho");

interface Snapshot {
  tickets: Ticket[];
  favorites: string[];
  prefs: Prefs;
  nextTicketId: number;
}

function persist(): void {
  void storage
    .set("state", {
      tickets,
      favorites,
      prefs,
      nextTicketId,
    } satisfies Snapshot)
    .catch(() => {
      // Storage is optional: a denied permission must not break the app.
    });
}

function seedTickets(): Ticket[] {
  const now = Date.now();
  const days = showtimeDays();
  const tomorrow = days[1]?.key ?? days[0]?.key ?? dateKeyOf(new Date());
  const before = dateKeyOf(new Date(now - 4 * 24 * 60 * 60 * 1000));
  return [
    {
      code: "RP4788",
      movieId: "dem-sai-gon",
      dateKey: tomorrow,
      time: "20:15",
      format: "2D",
      hall: "Phòng 2",
      seats: ["E4", "E5"],
      total: 309000,
      at: now - 2 * 24 * 60 * 60 * 1000,
      status: "upcoming",
      combo: true,
      payment: "Ví QChat",
    },
    {
      code: "RP4691",
      movieId: "mua-he-khong-tro-lai",
      dateKey: before,
      time: "18:50",
      format: "2D",
      hall: "Phòng 1",
      seats: ["F6"],
      total: 115000,
      at: now - 6 * 24 * 60 * 60 * 1000,
      status: "used",
      combo: false,
      payment: "Thẻ nội địa",
    },
  ];
}

/** Nạp state đã lưu một lần khi app khởi động. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const saved = await storage.get<Snapshot>("state");
    if (saved) {
      if (Array.isArray(saved.tickets)) tickets = saved.tickets;
      if (Array.isArray(saved.favorites)) favorites = saved.favorites;
      prefs = { ...prefs, ...(saved.prefs ?? {}) };
      nextTicketId = typeof saved.nextTicketId === "number" ? saved.nextTicketId : nextTicketId;
      emit();
    }
  } catch {
    // First run or a denied permission: the seeded state is still usable.
  }
}

export function useTickets(): Ticket[] {
  const [snapshot, setSnapshot] = useState<Ticket[]>(tickets);
  useEffect(() => subscribe(() => setSnapshot(tickets)), []);
  return snapshot;
}

export function useFavorites(): string[] {
  const [snapshot, setSnapshot] = useState<string[]>(favorites);
  useEffect(() => subscribe(() => setSnapshot(favorites)), []);
  return snapshot;
}

export function usePrefs(): Prefs {
  const [snapshot, setSnapshot] = useState<Prefs>(prefs);
  useEffect(() => subscribe(() => setSnapshot(prefs)), []);
  return snapshot;
}

export function isFavorite(movieId: string): boolean {
  return favorites.includes(movieId);
}

export function toggleFavorite(movieId: string): boolean {
  const next = !favorites.includes(movieId);
  favorites = next
    ? [...favorites, movieId]
    : favorites.filter((id) => id !== movieId);
  emit();
  persist();
  return next;
}

export function updatePrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  emit();
  persist();
}

export interface BookingInput {
  show: Showtime;
  seats: Seat[];
  combo: boolean;
  payment: string;
}

/** Chốt một đơn vé và trả về vé vừa tạo. */
export function book(input: BookingInput): Ticket {
  const total =
    input.seats.reduce((sum, seat) => sum + seat.price, 0) +
    (input.combo ? COMBO_PRICE : 0);
  const ticket: Ticket = {
    code: `RP${nextTicketId}`,
    movieId: input.show.movieId,
    dateKey: input.show.dateKey,
    time: input.show.time,
    format: input.show.format,
    hall: input.show.hall,
    seats: input.seats.map((seat) => seat.id).sort(),
    total,
    at: Date.now(),
    status: "upcoming",
    combo: input.combo,
    payment: input.payment,
  };
  nextTicketId += 1;
  tickets = [ticket, ...tickets];
  emit();
  persist();
  return ticket;
}

export function cancelTicket(code: string): void {
  tickets = tickets.map((ticket) =>
    ticket.code === code && ticket.status === "upcoming"
      ? { ...ticket, status: "cancelled" }
      : ticket,
  );
  emit();
  persist();
}

export interface TicketStats {
  watched: number;
  upcoming: number;
  spent: number;
  points: number;
}

export function ticketStats(list: Ticket[] = tickets): TicketStats {
  const active = list.filter((ticket) => ticket.status !== "cancelled");
  const spent = active.reduce((sum, ticket) => sum + ticket.total, 0);
  return {
    watched: active.filter((ticket) => ticket.status === "used").length,
    upcoming: active.filter((ticket) => ticket.status === "upcoming").length,
    spent,
    points: BASE_POINTS + Math.floor(spent / 10000),
  };
}

export function memberTier(points: number): {
  name: string;
  next: string;
  percent: number;
  toNext: number;
} {
  if (points < 1000) {
    return {
      name: "Bạc",
      next: "Vàng",
      percent: Math.round((points / 1000) * 100),
      toNext: 1000 - points,
    };
  }
  if (points < 3000) {
    return {
      name: "Vàng",
      next: "Kim cương",
      percent: Math.round(((points - 1000) / 2000) * 100),
      toNext: 3000 - points,
    };
  }
  return { name: "Kim cương", next: "Kim cương", percent: 100, toNext: 0 };
}

/* ------------------------------------------------------------------ */
/* Định dạng                                                           */
/* ------------------------------------------------------------------ */

let moneyFormat: Intl.NumberFormat | null = null;

/** `Intl` đến từ `@mna/qchat/env/auto`, được cài một lần ở `main.tsx`. */
export function money(value: number): string {
  if (!moneyFormat) {
    moneyFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
  }
  return `${moneyFormat.format(value)}đ`;
}

export function clock(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `Hôm nay · 20:15` hoặc `29/10 · 20:15`. */
export function dayLabel(at: number): string {
  const date = new Date(at);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? `Hôm nay · ${clock(at)}`
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${clock(at)}`;
}

/** `T7, 29/10` cho một `dateKey`. */
export function shortDay(key: string): string {
  const date = dateFromKey(key);
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

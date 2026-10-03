/** Vietnamese copy for the classic studio. Song titles, composers and note names stay as they are. */
import { addRule } from "./game/i18n";
import { vi } from "./game/vi";

const studio: Record<string, string> = {
  "YOUR PIANO STUDIO": "PHÒNG PIANO CỦA BẠN",
  "Practice library": "Thư viện luyện tập",
  "THE COLLECTION": "BỘ SƯU TẬP",
  "Browse & search": "Duyệt và tìm kiếm",
  "Search music": "Tìm nhạc",
  "Requested songs · import required": "Bài được yêu cầu · cần nhập tệp",
  "Ready to play": "Sẵn sàng để chơi",
  "＋ Import file": "＋ Nhập tệp",
  "IMPORT HELP": "TRỢ GIÚP NHẬP TỆP",
  "For the full two-hand sound, import your own MusicXML or MIDI arrangement.":
    "Để có âm thanh hai tay đầy đủ, hãy nhập bản phối MusicXML hoặc MIDI của riêng bạn.",
  "Open online piano ↗": "Mở piano trực tuyến ↗",
  "Find licensed sheet music ↗": "Tìm bản nhạc có bản quyền ↗",
  "A little practice, every day.": "Luyện tập một chút mỗi ngày.",
  "SLOW DOWN. FIND YOUR FLOW.": "CHẬM LẠI. TÌM NHỊP CỦA BẠN.",
  "Make time for music.": "Dành thời gian cho âm nhạc.",
  "A quiet space for music. Settle in and play.":
    "Một góc yên tĩnh cho âm nhạc. Ngồi xuống và chơi nào.",
  Theme: "Giao diện",
  System: "Theo hệ thống",
  Light: "Sáng",
  Dark: "Tối",
  "↑   Import file": "↑   Nhập tệp",
  "↑   Import file": "↑   Nhập tệp",
  "LIGHT THE RIVER": "THẮP SÁNG DÒNG SÔNG",
  "A little music. A brighter river.":
    "Một chút âm nhạc. Một dòng sông sáng hơn.",
  Listen: "Nghe",
  Learn: "Học",
  Perform: "Biểu diễn",
  Destination: "Điểm đến",
  Phrase: "Đoạn nhạc",
  "Learn phrase": "Học đoạn nhạc",
  "Stop challenge": "Dừng thử thách",
  "PC guide": "Hướng dẫn bàn phím",
  Scenery: "Phong cảnh",
  Cinematic: "Điện ảnh",
  Calm: "Nhẹ nhàng",
  Off: "Tắt",
  "Explore a destination and listen using Play on the piano. Choose Learn when you’re ready.":
    "Khám phá một điểm đến và nghe bằng nút Phát trên đàn. Chọn Học khi bạn đã sẵn sàng.",
  "Choose a phrase and start. Each completed phrase lights a lantern.":
    "Chọn một đoạn nhạc và bắt đầu. Mỗi đoạn hoàn thành sẽ thắp sáng một chiếc đèn lồng.",
  "Another bend in the river.": "Thêm một khúc quanh của dòng sông.",
  "Retry phrase": "Thử lại đoạn nhạc",
  "Next phrase →": "Đoạn tiếp theo →",
  "Sound & piano settings": "Cài đặt âm thanh và piano",
  "Piano options ▾": "Tùy chọn piano ▾",
  "Note labels": "Nhãn nốt",
  Effect: "Hiệu ứng",
  "3D fireworks · rainbow bloom": "Pháo hoa 3D · hoa cầu vồng",
  "3D fireworks · willow trails": "Pháo hoa 3D · vệt liễu rủ",
  "3D fireworks · spiral": "Pháo hoa 3D · xoáy ốc",
  "3D concert · mixed": "Hòa nhạc 3D · tổng hợp",
  "3D aqua rings": "Vòng nước 3D",
  "3D pearl orbs": "Cầu ngọc trai 3D",
  "Flow particles": "Hạt chuyển động",
  "3D crystal bursts": "Tinh thể nổ 3D",
  "Water ripples": "Gợn nước",
  "Aurora ribbons": "Dải cực quang",
  Bubbles: "Bong bóng",
  Sparkles: "Lấp lánh",
  "Soft glow": "Ánh sáng dịu",
  None: "Không",
  "Falling notes": "Nốt rơi",
  "Full 88 keys": "Đủ 88 phím",
  "Hand volume": "Âm lượng từng tay",
  "Only identified hands are adjusted. Unassigned notes keep their original strength.":
    "Chỉ các nốt đã xác định tay mới được điều chỉnh. Nốt chưa gán giữ nguyên độ mạnh ban đầu.",
  "Left hand": "Tay trái",
  "Right hand": "Tay phải",
  "Melody forward": "Nổi bật giai điệu",
  "Original dynamics": "Cường độ gốc",
  "Strength changes apply to new notes.":
    "Thay đổi độ mạnh áp dụng cho các nốt mới.",
  Sound: "Âm thanh",
  "Grand piano": "Đại dương cầm",
  "Classical piano": "Piano cổ điển",
  "Bright piano": "Piano sáng",
  "Electric piano": "Piano điện",
  "Classical guitar": "Guitar cổ điển",
  "Steel-string guitar": "Guitar dây thép",
  Harp: "Đàn hạc",
  "Church organ": "Đàn organ nhà thờ",
  Violin: "Vĩ cầm",
  Flute: "Sáo",
  "Electronic · Saw lead": "Điện tử · Saw lead",
  "Electronic · Square lead": "Điện tử · Square lead",
  "Electronic · Crystal synth": "Điện tử · Synth pha lê",
  "Electronic · Warm pad": "Điện tử · Pad ấm",
  "Electronic · Synth bass": "Điện tử · Bass synth",
  "Original MIDI instruments": "Nhạc cụ MIDI gốc",
  "Load sound": "Tải âm thanh",
  "Original MIDI voices load on Play": "Giọng MIDI gốc sẽ tải khi phát",
  "STUDIO PIANO": "PIANO PHÒNG THU",
  "MIDI ENSEMBLE": "DÀN NHẠC MIDI",
  READY: "SẴN SÀNG",
  Practice: "Luyện tập",
  "Listen · both hands": "Nghe · hai tay",
  "Play right hand": "Chơi tay phải",
  "Play left hand": "Chơi tay trái",
  Metronome: "Máy đếm nhịp",
  Play: "Phát",
  Speed: "Tốc độ",
  "⟳ Loop": "⟳ Lặp",
  "Set A": "Đặt A",
  "Set B": "Đặt B",
  Volume: "Âm lượng",
  "49 KEYS · C2 — C6": "49 PHÍM · C2 — C6",
  "88 KEYS · A0 — C8": "88 PHÍM · A0 — C8",
  "Designed for a little time at the keys.":
    "Dành cho những phút ngắn bên phím đàn.",
  POLYPHONIC: "ĐA ÂM",
  "← Lower": "← Thấp hơn",
  "Higher →": "Cao hơn →",
  "Hold keys to play · use arrows to move":
    "Giữ phím để chơi · dùng phím mũi tên để di chuyển",
  "Play on your computer keyboard": "Chơi bằng bàn phím máy tính",
  Layout: "Bố cục",
  "8-finger home row": "Hàng phím cơ sở 8 ngón",
  "Classic chromatic": "Bán cung cổ điển",
  "Hold sustain": "Giữ pedal",
  "Toggle sustain": "Bật/tắt pedal",
  "Play / pause": "Phát / tạm dừng",
  Rows: "Số hàng",
  "2 rows": "2 hàng",
  "3 rows": "3 hàng",
  "4 rows": "4 hàng",
  Octave: "Quãng tám",
  "NEXT KEYS": "PHÍM TIẾP THEO",
  "Sustain off": "Pedal tắt",
  "Release all · Esc": "Nhả tất cả · Esc",
  "Home fingers: A S D F · J K L ; = C D E F · G A B C. W E T I O = sharps. Hold Space with a thumb to sustain; release it to lift the pedal. Escape releases all manual notes. Bars show score key-down durations; pedal extends your manual sound only. Use the Play button for score playback.":
    "Ngón đặt sẵn: A S D F · J K L ; = C D E F · G A B C. W E T I O = nốt thăng. Giữ Space bằng ngón cái để giữ pedal; thả ra để nhả pedal. Escape nhả mọi nốt đang chơi tay. Thanh hiển thị độ dài giữ phím trong bản nhạc; pedal chỉ kéo dài âm bạn tự chơi. Dùng nút Phát để nghe bản nhạc.",
  "Ready when you are": "Sẵn sàng khi bạn muốn",
  "Computer keys: follow the guide · use Play for the score":
    "Phím máy tính: làm theo hướng dẫn · dùng Phát để nghe bản nhạc",
  "MUSIC STAND": "GIÁ NHẠC",
  notes: "nốt",
  "Sheet music": "Bản nhạc",
  "Piano roll": "Cuộn piano",
  "Hand practice needs a score with both hands fully identified. No pitch-based guessing is used.":
    "Luyện từng tay cần bản nhạc đã xác định đầy đủ cả hai tay. Chúng tôi không đoán theo cao độ.",
  "Edition & credits ↗": "Ấn bản và ghi công ↗",
  "↓ PDF sheet": "↓ Bản nhạc PDF",
  "↓ Download MIDI": "↓ Tải MIDI",
  "Built for the joy of playing.": "Tạo ra vì niềm vui được chơi nhạc.",
  "MusicXML & MIDI · Local imports · No account needed":
    "MusicXML và MIDI · Nhập từ máy · Không cần tài khoản",
  "Bring your own music.": "Mang âm nhạc của bạn đến.",
  "Choose a MusicXML or MIDI file to see it, slow it down, and play it with both hands.":
    "Chọn tệp MusicXML hoặc MIDI để xem, làm chậm và chơi bằng cả hai tay.",
  "Choose a file": "Chọn tệp",
  ".musicxml, .xml, .mid, .midi · up to 5 MB":
    ".musicxml, .xml, .mid, .midi · tối đa 5 MB",
  "PDFs and photos are visual sheets, not playable note data. Convert them to uncompressed MusicXML in notation software first. Imported scores are kept only until you reload.":
    "PDF và ảnh chỉ là bản nhạc dạng hình, không có dữ liệu nốt để phát. Hãy chuyển sang MusicXML không nén bằng phần mềm soạn nhạc trước. Bản nhạc đã nhập chỉ được giữ đến khi bạn tải lại trang.",
  "Back to practice": "Quay lại luyện tập",
  "Title or composer…": "Tên bài hoặc nhà soạn nhạc…",
  "Matching music": "Nhạc phù hợp",
  "Choose a MIDI or MusicXML file from your device":
    "Chọn tệp MIDI hoặc MusicXML từ thiết bị",
  "Light the River learning journey": "Hành trình học Thắp sáng dòng sông",
  "Studio mode": "Chế độ phòng thu",
  "Hand dynamics": "Cường độ từng tay",
  "Left hand strength": "Độ mạnh tay trái",
  "Right hand strength": "Độ mạnh tay phải",
  "Use the MIDI file’s pitched instruments; manual keys use Sound":
    "Dùng nhạc cụ có cao độ của tệp MIDI; phím tự chơi dùng mục Âm thanh",
  "Playback controls": "Điều khiển phát",
  "Playback position": "Vị trí phát",
  Restart: "Phát lại từ đầu",
  "Blue falling notes: bar length shows key hold duration; notes reach the keys when played":
    "Nốt xanh rơi xuống: độ dài thanh là thời gian giữ phím; nốt chạm phím khi được chơi",
  "Show lower piano notes": "Hiện các nốt trầm",
  "Show higher piano notes": "Hiện các nốt cao",
  "Computer keyboard guide": "Hướng dẫn bàn phím máy tính",
  "Upcoming computer key sequence": "Chuỗi phím máy tính sắp tới",
  "Press these keys together": "Nhấn các phím này cùng lúc",
  "Piano roll showing all simultaneous notes":
    "Cuộn piano hiển thị mọi nốt đồng thời",
  "Wait for the next keys; release them to continue. Timing is not scored. Range C4–C5. Change PC octave if needed, or use the piano keys.":
    "Chờ phím tiếp theo; nhả phím để tiếp tục. Không chấm điểm nhịp. Quãng C4–C5. Đổi quãng tám của bàn phím nếu cần, hoặc dùng phím đàn.",
  "Perform phrase": "Biểu diễn đoạn nhạc",
  "Follow the falling notes. Your melody is muted; identified accompaniment plays automatically. Range C4–C5. Change PC octave if needed, or use the piano keys.":
    "Chơi theo các nốt rơi. Giai điệu của bạn được tắt tiếng; phần đệm đã xác định tự phát. Quãng C4–C5. Đổi quãng tám của bàn phím nếu cần, hoặc dùng phím đàn.",
  "Preparing your piano…": "Đang chuẩn bị đàn của bạn…",
  "Loading sound…": "Đang tải âm thanh…",
  "Loading instrument samples…": "Đang tải mẫu âm nhạc cụ…",
  "LOADING GRAND…": "ĐANG TẢI ĐẠI DƯƠNG CẦM…",
  "Challenge stopped. Retry whenever you’re ready.":
    "Đã dừng thử thách. Hãy thử lại khi bạn sẵn sàng.",
  "Sound ready": "Âm thanh đã sẵn sàng",
  "Sound mode changed. Press Play to continue.":
    "Đã đổi chế độ âm thanh. Nhấn Phát để tiếp tục.",
  "Practice mode ready. Press Play to start from this position.":
    "Chế độ luyện tập đã sẵn sàng. Nhấn Phát để bắt đầu từ vị trí này.",
  "Audio could not start. Try pressing Play again.":
    "Không bật được âm thanh. Hãy nhấn Phát lại.",
  "A must be before B. Seek earlier and try again.":
    "Điểm A phải ở trước điểm B. Hãy tua về sớm hơn và thử lại.",
  "B must be after A. Seek later and try again.":
    "Điểm B phải ở sau điểm A. Hãy tua về muộn hơn và thử lại.",
  "Unable to read this score.": "Không đọc được bản nhạc này.",
  "Not bundled. Import your permitted MIDI/MusicXML to play in this browser session.":
    "Không đi kèm sẵn. Hãy nhập tệp MIDI/MusicXML mà bạn được phép dùng để chơi trong phiên này.",
  "Piano MIDI source. Purchase availability depends on region; import your file to play and generate sheet music.":
    "Nguồn MIDI piano. Khả năng mua tùy theo khu vực; hãy nhập tệp của bạn để chơi và tạo bản nhạc.",
  "Paid MIDI backing track. Import your file and enable Original MIDI instruments for its arrangement.":
    "Bản nền MIDI trả phí. Hãy nhập tệp và bật Nhạc cụ MIDI gốc để nghe đúng bản phối.",
  "Paid piano MIDI with melody, plus an accompaniment version. Store lists US licensing; check availability in your region.":
    "MIDI piano trả phí có giai điệu, kèm bản đệm. Cửa hàng ghi giấy phép tại Mỹ; hãy kiểm tra tại khu vực của bạn.",
  "Paid piano MIDI with backing instruments. Store lists US licensing; check availability in your region.":
    "MIDI piano trả phí kèm nhạc cụ đệm. Cửa hàng ghi giấy phép tại Mỹ; hãy kiểm tra tại khu vực của bạn.",
  "Paid full-band MIDI backing track, not a solo-piano arrangement.":
    "Bản nền MIDI trả phí cho cả ban nhạc, không phải bản phối piano solo.",
  "Licensed MIDI at Synthesia ↗": "MIDI có bản quyền tại Synthesia ↗",
  "Licensed MIDI at Hit Trax ↗": "MIDI có bản quyền tại Hit Trax ↗",
  "MIDI at Synthesia ↗": "MIDI tại Synthesia ↗",
  "MIDI at Hit Trax ↗": "MIDI tại Hit Trax ↗",
  "GRAND PIANO": "ĐẠI DƯƠNG CẦM",
  PLAYING: "ĐANG PHÁT",
  "Metronome on. Press Play to continue.":
    "Đã bật máy đếm nhịp. Nhấn Phát để tiếp tục.",
  "Generated transcription · approximate 4/4 bars and sixteenth-note rhythm, with a visual treble/bass split. Playback keeps the original MIDI timing and sound. Not the original edition.":
    "Bản chép tự động · ô nhịp 4/4 gần đúng và nhịp nốt móc kép, chia khóa Sol/khóa Fa theo hình ảnh. Khi phát vẫn giữ nhịp và âm thanh MIDI gốc. Không phải ấn bản gốc.",
  "Traditional melody, one complete 16-bar verse in 9/8. Generated sheet is an approximate 4/4 guide; source has original notation.":
    "Giai điệu dân gian, trọn một đoạn 16 ô nhịp ở nhịp 9/8. Bản nhạc tạo tự động chỉ là hướng dẫn 4/4 gần đúng; nguồn có ký âm gốc.",
  "← Previous": "← Trước",
  "Next →": "Sau →",
  "↓ This page · MusicXML": "↓ Trang này · MusicXML",
  "Piano reduction": "Rút gọn cho piano",
  "Korean traditional": "Dân gian Hàn Quốc",
  "Wikipedia score contributors · Stillnote melody transcription · CC BY-SA 4.0":
    "Những người đóng góp bản nhạc Wikipedia · Stillnote chép giai điệu · CC BY-SA 4.0",
};
// The game's own wording wins where both pages use the same English word.
for (const [k, v] of Object.entries(studio)) vi[k] ??= v;

const note = "[A-G]♯?\\d";
addRule((s) => {
  let m: RegExpExecArray | null;
  if ((m = new RegExp(`^Play (${note})$`).exec(s))) return `Chơi ${m[1]}`;
  if ((m = /^Computer (\S+): (.+)$/.exec(s)))
    return `Bàn phím ${m[1]}: ${m[2]}`;
  if ((m = /^(\S+) unassigned$/.exec(s))) return `${m[1]} chưa gán`;
  if ((m = /^(\d+) ready to play · (\d+) require a file import$/.exec(s)))
    return `${m[1]} bài sẵn sàng · ${m[2]} bài cần nhập tệp`;
  if ((m = /^(\d+) MIDI selections\. /.exec(s)))
    return `${m[1]} bản MIDI. Tìm Giáng sinh, Hàn Quốc, nhạc pop hoặc quốc ca. Có bản nhạc gốc khi sẵn có; ký âm được tạo từ MIDI.`;
  if ((m = /^(\d+) · (\d+) sec · (\d+) notes$/.exec(s)))
    return `${m[1]} · ${m[2]} giây · ${m[3]} nốt`;
  if (
    (m =
      /^(\d+) \/ (\d+) lanterns lit · progress stored on this device when available$/.exec(
        s,
      ))
  )
    return `${m[1]} / ${m[2]} đèn lồng đã sáng · tiến trình được lưu trên thiết bị khi có thể`;
  if ((m = /^Import file · (.+)$/.exec(s))) return `Nhập tệp · ${m[1]}`;
  if ((m = /^Page (\d+) \/ (\d+)$/.exec(s))) return `Trang ${m[1]} / ${m[2]}`;
  if ((m = /^(\d+:\d+) · MIDI performance$/.exec(s)))
    return `${m[1]} · Bản biểu diễn MIDI`;
  if ((m = /^Base (C\d)$/.exec(s))) return `Gốc ${m[1]}`;
  if ((m = /^Reading (.+)…$/.exec(s))) return `Đang đọc ${m[1]}…`;
  if ((m = /^(.+) · Original exercise · (\d+:\d+)$/.exec(s)))
    return `${m[1]} · Bài tập gốc · ${m[2]}`;
  return undefined;
});

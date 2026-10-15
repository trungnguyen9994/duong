> Tài liệu lịch sử của bản V3. Bàn giao hiện tại: [MARIADB_LOCAL.md](MARIADB_LOCAL.md).

# Bàn giao bản local

Bản ứng dụng có luồng soạn một lần để chơi Web và tải PPTX tương tác. Đây là bản để giáo viên kiểm thử, chưa nghiệm thu thực tế tại lớp.

## Chức năng đã triển khai

- Thư viện IndexedDB: tạo, mở, đổi tên trong trình soạn, nhân bản, xóa có xác nhận; tự lưu khi biên tập.
- Sao lưu/nhập JSON: có giới hạn 30 MB, kiểm tra cấu trúc và ID; giữ nguyên câu hỏi/đáp án, tạo ID trò chơi mới để tránh ghi đè. Có thể khôi phục bản đang soạn dở.
- Builder: 4 chặng, đổi tên/sắp xếp; thêm/sửa/xóa/chuyển/sắp xếp câu; 4 phương án, đáp án, gợi ý, giải thích, ảnh PNG/JPEG tối đa 3 MB.
- Rà soát: kiểm tra thiếu nội dung, ID trùng, tham chiếu sai và tài nguyên ngoài; chặn chơi/xuất khi chưa hợp lệ, nhảy tới câu/chặng cần sửa.
- Web Player: 4 đội, chọn đội trước lần thử đầu; luân phiên đội sau câu, điểm 10/5, phản hồi/gợi ý/thử lại, timer có thể tắt, âm hiệu có thể tắt, trình chiếu toàn màn hình, tổng kết đồng hạng, chơi lại. Phiên được lưu trong cùng tab và chỉ tiếp tục khi nội dung không thay đổi.
- PPTX: 16:9, 44 slide với bộ 12 câu; chữ và nút là đối tượng PowerPoint, đáp án đúng/sai/thử lại/tiếp tục có liên kết nội bộ, tài nguyên ảnh nhúng, cảnh báo vượt 25 MB. Giáo viên xác nhận nội dung trước xuất.
- Bộ 12 câu mẫu và 8 câu dự phòng, nội dung tự biên soạn theo mục tiêu tìm thừa số chưa biết. Bộ sách đích do người dùng xác nhận: Cánh Diều.
- Trang chủ bám ảnh tham khảo: bảng gỗ trên phong cảnh phiêu lưu, hai nhân vật, ba nút tạo từ mẫu/chơi nhanh/xuất bài mẫu và điều hướng có chức năng.
- Màn chơi: nền theo từng chặng, bảng câu hỏi giấy/gỗ, bảng điểm màu, tiến độ chìa khóa, nhân vật động viên theo đáp án; đồng hồ vòng tròn đếm phút/giây, cảnh báo 10 giây, tạm dừng/tiếp tục.
- Trình soạn có các bước câu hỏi/nền và nhân vật/chơi thử. Có thẻ chọn nền, ảnh nền riêng cho chặng, lời chào tùy chỉnh và xem nhanh câu hỏi.
- Đã tạo và đóng gói 4 nền cùng 2 nhân vật PNG. Giọng đọc dùng speechSynthesis, phụ thuộc giọng tiếng Việt trên máy; khi không có giọng, hiển thị lời thoại và thông báo. PPTX nhúng phong cảnh; mẫu 12 câu kiểm thử với nền/nhân vật khoảng 13 MB.

## Học liệu cần giáo viên duyệt

1. Xác nhận tên bài, tập/trang sách Cánh Diều và vị trí trò chơi trong tiết học. Bộ mẫu tập trung ôn tập thừa số với các phép tính trong bảng nhân; chưa khẳng định tương ứng toàn bộ một bài sách cụ thể.
2. Duyệt 12 câu và 8 câu dự phòng, đáp án, gợi ý, mức độ và thời lượng. Có thể sửa trực tiếp trong Builder.
3. Đã có Bé Sao thám hiểm, nhân vật đồng hành trang chủ, Bé Sao dạng ngôi sao, Rồng Số dạng vector và 4 nền tạo mới theo ảnh tham khảo. Giáo viên có thể duyệt các hình hiện có hoặc thay nền PNG/JPEG riêng trong trình soạn.
4. Nếu muốn nhạc/thuyết minh riêng, chuẩn bị tệp có quyền sử dụng. Hiện Web dùng âm hiệu tổng hợp; PPTX không xuất âm thanh.

## Trạng thái các mốc trong kế hoạch

| Mốc                     | Trạng thái                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| M1 Nội dung và thiết kế | Có dữ liệu và giao diện; chờ duyệt nội dung Cánh Diều, nhân vật/nền                           |
| M2 Builder              | Luồng chức năng đã triển khai và kiểm thử trình duyệt                                         |
| M3 Web Player           | Chơi hết 12 câu đã qua kiểm thử tự động; chờ giáo viên thực nghiệm                            |
| M4 PowerPoint           | Đã kiểm tra file, ảnh nhúng và toàn bộ đích liên kết; chờ kiểm thử PowerPoint Desktop độc lập |
| M5 Bàn giao/phát hành   | Có mã và hướng dẫn local; chưa có thực nghiệm lớp, video demo hay deploy                      |

Không cần backend, tài khoản hoặc kho đám mây trong bản local. PWA offline Web, nhiều người qua Internet, lịch sử phiên bản và mẫu chủ đề khác chưa triển khai.

## Kiểm tra PowerPoint độc lập

Kiểm tra hiện tại: 19 bài kiểm thử dữ liệu/logic/PPTX và 6 kịch bản Edge đã qua. Bao gồm đếm ngược/tạm dừng/hết giờ/thử lại, trang chủ và ba nút chính, nền và lời thoại, bảo toàn ảnh nền khi sửa câu, nhúng nền PPTX, dữ liệu cũ và màn hình hẹp. Build TypeScript/Vite thành công; giao diện desktop/mobile được quan sát qua ảnh kiểm thử. Ảnh xem trước được lưu trong `docs/previews`.

Thực hiện trên máy Windows có PowerPoint của trường. Công cụ điều khiển ứng dụng trong phiên triển khai không khởi tạo được, nên chưa thể xác nhận kiểm thử PowerPoint Desktop.

- [ ] Mở PPTX không hiện thông báo Repair.
- [ ] Nhấn F5; bấm Bắt đầu → hướng dẫn → bản đồ → chặng đầu.
- [ ] Kiểm tra tất cả A/B/C/D của từng câu: một phương án đúng, ba sai.
- [ ] Sai → Thử lại quay về chính câu; đúng → Tiếp tục đến đúng câu/chặng; câu cuối tới tổng kết.
- [ ] Thử Bản đồ và Chơi lại; giáo viên chủ động điều tiết vì PPTX không khóa tiến độ.
- [ ] Chép file sang máy khác, ngắt mạng; kiểm tra chữ, ảnh và nút vẫn hoạt động.
- [ ] Sửa được chữ câu hỏi/đáp án trong PowerPoint.
- [ ] Kiểm tra dấu tiếng Việt, ký hiệu toán và độ rõ trên màn chiếu; kiểm tra câu/đáp án dài đã nhập.
- [ ] Thực nghiệm một tiết học 4 đội, ghi lại thời lượng, lỗi và phản hồi giáo viên.

## Ma trận nghiệm thu SRS

| Mã      | Bằng chứng hiện có                                         | Còn cần                           |
| ------- | ---------------------------------------------------------- | --------------------------------- |
| TC01    | Edge: tạo mẫu, sửa, lưu, tải lại, mở                       | Giáo viên thử tạo bài mới         |
| TC02    | Schema và UI chặn dữ liệu thiếu/sai                        | —                                 |
| TC03    | Unit và Edge: điểm 10/5, không chấm hai lần                | —                                 |
| TC04    | Edge chơi đủ 12 câu tới tổng kết                           | —                                 |
| TC05    | Kiểm tra cấu trúc đủ 44 slide                              | Quan sát bố cục PowerPoint        |
| TC06–08 | Graph và XML kiểm tra mọi đích đáp án/thử lại/chuyển chặng | Bấm nút trong PowerPoint          |
| TC09    | File không có liên kết media ngoài, ảnh được nhúng         | Mở offline trên máy khác          |
| TC10    | XML có text và shape PowerPoint gốc                        | Chỉnh chữ trong PowerPoint        |
| TC11    | Giao diện Web tiếng Việt đã quan sát                       | Font và tràn chữ trong PowerPoint |
| TC12    | Unit và Edge nhập lại JSON giữ câu/chặng/đáp án            | Thử PPTX sau nhập trên máy trường |
| TC13    | UI chặn sai định dạng, schema giới hạn ảnh và JSON         | Giáo viên thử ảnh thực tế         |
| TC14    | Kiểm tra mọi cạnh dự kiến trong XML .rels                  | Click các cạnh trên PowerPoint    |

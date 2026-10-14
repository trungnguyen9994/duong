# Hành trình chinh phục Toán học lớp 3

Ứng dụng local cho giáo viên soạn trò chơi Toán lớp 3, chơi trên Web và xuất PowerPoint tương tác từ cùng dữ liệu.

## Chạy local

Yêu cầu Node.js 22 và npm.

```powershell
cd E:\project\duong
npm install
npm run dev
```

Mở http://127.0.0.1:5173. Dùng Ctrl+C để dừng. Cổng được cố định để thư viện IndexedDB luôn ở cùng địa chỉ; nếu cổng đang dùng, dừng phiên Vite cũ trước khi chạy lại.

## Kiểm tra bản build

```powershell
npm run build
npm run preview
```

## Sử dụng

Trang chủ có ba nút lớn theo phong cách phiêu lưu: **Tạo trò chơi bằng mẫu có sẵn** mở thẻ mẫu; **Chơi trực tuyến** chơi nhanh bài mẫu; **Tải PowerPoint** mở bước rà soát/xuất của bài mẫu. Với bài đã soạn, mở trong thư viện rồi chơi/xuất từ Builder.

1. Chọn **Dùng mẫu này** để mở bộ 12 câu ôn tập tìm thừa số chưa biết, hoặc **Tạo trò chơi** để soạn mới.
2. Sửa tên trò chơi, tên/thứ tự 4 chặng, câu hỏi, 4 đáp án, gợi ý và giải thích. Thêm ảnh PNG/JPEG dưới 3 MB nếu cần. Có 8 câu dự phòng để thêm vào chặng đang mở.
   Mở bước **Nền & nhân vật** để chọn một trong bốn phong cảnh, tải ảnh nền ngang riêng cho từng chặng, chọn Bé Sao/Rồng Số và sửa lời chào. Bước **Soạn câu hỏi** có **Xem nhanh** và đánh dấu phương án đúng bằng thẻ màu xanh.
3. Đợi thông báo **Đã lưu trên máy này**. Chọn **Sao lưu JSON** để giữ bản độc lập; bản nháp chưa hoàn thiện cũng có thể nhập lại.
4. **Xem trước** chạy thử 4 đội. Đúng lần đầu +10, đúng sau gợi ý +5; mỗi câu chấm một lần. Giáo viên có thể chọn đội trước lần trả lời đầu; hệ thống chuyển đội luân phiên sau mỗi câu. Hết giờ là lời nhắc, giáo viên điều tiết lượt. Phiên chơi có thể tiếp tục trong cùng tab khi nội dung chưa thay đổi.
   Đồng hồ hiển thị phút/giây và vòng thời gian, đổi màu khi còn 10 giây; có nút tạm dừng/tiếp tục. Nhân vật có lời thoại theo từng tình huống. Bấm **Nghe Bé Sao** để bật đọc; cần trình duyệt/máy có giọng tiếng Việt. Không có giọng thì ứng dụng vẫn hiển thị lời thoại đầy đủ.
5. Chọn **Kiểm tra & xuất**. Sửa lỗi nếu có. Sau khi tự rà soát học liệu, đánh dấu xác nhận để tải PPTX.
6. Mở PPTX bằng PowerPoint Desktop, nhấn F5 và dùng các nút trên slide. PowerPoint dùng bảng điểm và thời gian thủ công; không có macro hay âm thanh Web.

Thư viện lưu trên trình duyệt và địa chỉ truy cập hiện tại. Không tự đồng bộ giữa máy, trình duyệt hoặc cổng khác. Xóa dữ liệu trình duyệt sẽ xóa thư viện; dùng JSON để khôi phục.

## Kiểm tra

```powershell
npm test
npm run build
npm run test:e2e
```

Kiểm thử trình duyệt dùng Microsoft Edge đã cài. Nếu chưa có Edge, đổi `channel` trong `playwright.config.ts` sang trình duyệt Playwright tương ứng và cài runtime cần thiết.

Kiểm thử tự động bao gồm dữ liệu, điểm, luồng slide, cấu trúc PPTX, lưu/mở lại, JSON, chơi hết 12 câu, tải PPTX và ảnh nhúng. Vẫn cần kiểm tra độc lập bằng PowerPoint trên máy nhà trường và thực nghiệm lớp.

## Học liệu

Bộ câu hỏi là nội dung biên soạn mới để kiểm tra ứng dụng, định hướng Toán 3 Cánh Diều theo lựa chọn của giáo viên. Chưa xác nhận bài/trang sách hoặc thẩm định sư phạm. Giáo viên duyệt trước khi dạy; không sao chép hình sách vào ứng dụng.

Danh sách học liệu, hình ảnh và kiểm tra bàn giao còn lại: [docs/BAN_GIAO_LOCAL.md](docs/BAN_GIAO_LOCAL.md).

Hình ảnh AI đã đóng gói tại `public/art`; danh sách file và prompt dùng công cụ image_gen tích hợp: [docs/ARTWORK.md](docs/ARTWORK.md). Nền và nhân vật được tải từ ứng dụng local; không gọi AI khi học sinh chơi. PowerPoint nhúng nền có sẵn hoặc nền tùy chỉnh, không xuất giọng đọc tự động hay đồng hồ Web.

Tài liệu yêu cầu được lưu trong thư mục `libary`.

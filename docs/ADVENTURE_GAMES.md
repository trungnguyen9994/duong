# Mẫu trò chơi từ PowerPoint tham khảo

Ba mẫu mới giữ cơ chế riêng của file người dùng cung cấp:

- `forest_rescue`: tối đa 4 con vật (hổ, voi, gấu, hươu), chọn tự do; câu hỏi trả lời miệng, hiện đáp án và giải cứu con vật khỏi lồng. Web chấm điểm bằng thao tác giáo viên; PowerPoint có nút hiện đáp án, mở lồng và đường chuyển động con vật.
- `boat_rescue`: tối đa 5 thuyền, chọn tự do, 3 phương án mỗi câu; trả lời đúng đưa thuyền về bờ, sai thử lại. PowerPoint dùng trigger và đường chuyển động thuyền.
- `football`: 1–12 câu, 4 phương án; đúng bóng vào cầu môn, sai bóng ra ngoài rồi thử lại. PowerPoint có motion path theo kết quả và nút sang câu tiếp theo.

Web lưu điểm và tiến trình trong phiên chơi; PowerPoint do giáo viên điều khiển, dùng Custom Show có quay lại bảng cho Rừng xanh và Thuyền. Cần chạy F5 trong PowerPoint Desktop để kiểm tra tương tác. Không có macro.

Hình trích từ các file người dùng cung cấp trong Downloads. Hình Rừng xanh được đọc từ stream Pictures của file .ppt OLE. File gốc không bị sửa. Mẫu thuyền ghi tác giả Phan Thị Linh; tên tác giả giữ trong notes các slide xuất. Không nhập slide quảng cáo, thông tin liên hệ hoặc ảnh chân dung vào trò chơi.

Migration `005_adventure_games.sql` thêm danh mục, không reset dữ liệu. `setup-mariadb.mjs` áp dụng khi setup máy mới. Mẫu dữ liệu kiểm tra: `node --import tsx scripts/export-frog-demo.ts forest_rescue` (thay bằng `boat_rescue` hoặc `football`). Các biến môi trường `FROG_TEST_EMAIL` và `FROG_TEST_PASSWORD` cho phép kiểm tra qua API/worker thay vì render trực tiếp.

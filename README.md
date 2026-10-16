# EduGame Studio V4.1

Nền tảng tạo trò chơi dạy học đa môn bằng React, TypeScript, MariaDB và backend/worker Node.js. Bản local phục vụ kiểm thử/nghiệm thu; học liệu minh họa chưa được duyệt để dạy chính thức.

## Chạy local

Yêu cầu Node.js 22+, Docker Desktop đang chạy. Làm tại thư mục gốc; không chạy trong bản sao `duong/`.

```powershell
cd E:\project\duong
npm ci
npm run local:start
npm run local:env
npm run dev:all
```

- Giao diện: [127.0.0.1:5173](http://127.0.0.1:5173)
- API: [127.0.0.1:8787/api/health](http://127.0.0.1:8787/api/health)
- Database: [phpMyAdmin – supabase_db_duong](http://localhost:8081/index.php?route=/database/structure&db=supabase_db_duong)
- Hộp thư xác minh/đặt lại mật khẩu: [127.0.0.1:8025](http://127.0.0.1:8025)

MariaDB tại `127.0.0.1:3306`, database `supabase_db_duong`. `local:start` dùng MariaDB Laradock đang có hoặc tạo container riêng, khởi động Mailpit và tạo cấu trúc. Cấu hình máy chủ trong `.env`, cấu hình trình duyệt trong `.env.local`; cả hai được Git bỏ qua. Ảnh/PPTX riêng tư lưu tại `data/storage/`. Không đưa thông tin DB hoặc secret ký file vào biến `VITE_*`.

## Sử dụng

1. Đăng ký email và xác minh trong hộp thư local. Mặc định tài khoản trở thành Teacher hoạt động.
2. Chọn mẫu từ `/library` hoặc tạo bản nháp ở `/dashboard`.
3. Hoàn thành wizard: Bắt đầu → Câu hỏi → Tùy chỉnh → Hoàn tất. Bản nháp được phép thiếu nội dung; bản đã lưu tự lưu tiếp khi chỉnh sửa.
4. Ảnh được tải vào vùng tạm, kiểm tra/chuẩn hóa bằng worker rồi mới sử dụng. Kho mặc định chỉ có ảnh được Admin duyệt nguồn và giấy phép.
5. Chơi thử hoặc tạo job PowerPoint. File riêng tư, tải qua URL ngắn hạn và tải lại trong lịch sử xuất trong bảy ngày.
6. Gửi duyệt nếu muốn chia sẻ công khai. Sửa bài hoặc thu hồi chia sẻ làm liên kết cũ mất hiệu lực.

Kho bài cũ giữ tại `/legacy`. Bước Thông tin có sao lưu IndexedDB và nhập JSON cũ; ảnh nhúng đi qua luồng upload của tài khoản hiện tại. JSON mới chỉ tham chiếu ID ảnh; ảnh tài khoản khác cần được thay thế.

## Ba mẫu

| Mẫu             | Web                                                      | PPTX                                                      |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Hành trình      | Bốn chặng, điểm 10/5, hệ số chặng, lượt cá nhân hoặc tổ, timer       | Nhánh đúng/sai/thử lại/chuyển chặng; điểm và giờ thủ công |
| Mảnh ghép       | Lưới 4/6/9, chọn ô tự do, đúng mới mở, đoán sớm tùy chọn | Mở từ trái sang phải, trên xuống dưới                     |
| Vòng quay ô chữ | Tám ô điểm, lượt cá nhân hoặc tổ, tiếng Việt, nhật ký                | Mở chữ theo kịch bản; quay và ghi điểm thủ công           |

Giới hạn: PNG/JPEG/WebP tĩnh, 5 MB/ảnh, 24 megapixel; mặc định 200 MB/tài khoản, hai upload đồng thời, 20 xuất/ngày UTC, một export đang xử lý; PPTX tối đa 60 slide và 50 MB. Quota tính cả ảnh thumbnail, file xuất và phần giữ cho export đang chạy.

## Kiểm tra

```powershell
npm run check:server
npm test
npm run build
npm run test:local
npm run test:e2e
```

Hai lệnh cuối cần MariaDB, Mailpit, API và worker đang chạy. Test tạo tài khoản tạm và dọn sau khi xong. E2E local dùng Edge; CI dùng Chromium. Unit chỉ thu thập `src/tests/**/*.test.ts` tại dự án gốc. Hai file E2E V3 còn giữ làm tài liệu hồi quy của `/legacy`, không nằm trong suite V4.1 mặc định do hành trình trang chủ đã đổi.

Chi tiết vận hành, nghiệm thu và đầu vào còn thiếu: [docs/MARIADB_LOCAL.md](docs/MARIADB_LOCAL.md).

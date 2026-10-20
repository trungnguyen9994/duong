# SMTP cho bản live

Tệp riêng `deploy/.env.smtp.production` chứa thông tin SMTP đang dùng, gồm cả mật khẩu ứng dụng Gmail. Tệp được xuất từ `.env` local bằng `node scripts/export-smtp-private.mjs` và bị Git bỏ qua theo quy tắc `.env.*`. Lệnh xuất không ghi đè tệp đã tồn tại.

Đây là thông tin bí mật dạng văn bản thuần. Không commit, không gửi qua chat, không chép vào `public/`, `dist/`, hoặc cấu hình frontend. Chỉ chuyển qua kênh bảo mật và lưu ngoài thư mục web công khai.

## Nạp cấu hình

1. Tạo `.env` backend từ `deploy/production.env.example`, điền cấu hình MariaDB và các secret riêng cho production.
2. Chép đúng 6 biến trong tệp SMTP riêng vào `.env` backend, hoặc nhập chúng vào phần Environment Variables / Secrets của hosting. Không dùng tiền tố `VITE_` cho SMTP.
3. Đặt `FRONTEND_URL` và `API_PUBLIC_URL` thành URL HTTPS thực tế để liên kết xác minh không trỏ về máy local.
4. Build frontend với `VITE_API_URL` trỏ về API live và bỏ `VITE_LOCAL_MAIL_URL`. Không mang `.env.local` của máy phát triển lên live.
5. Khởi động lại backend sau khi thay đổi biến môi trường, rồi đăng ký thử và xác nhận thư nhận được.

Nếu giữ tệp SMTP tách riêng trên máy chủ Node.js 22+, có thể nạp trước khi chạy API từ thư mục dự án:

```sh
node --env-file=deploy/.env.smtp.production scripts/start-production.mjs api
```

Backend vẫn cần cấu hình DB và các secret trong `.env` hoặc môi trường hosting. Biến môi trường sẵn có được ưu tiên hơn tệp; kiểm tra hosting không giữ SMTP cũ. Trên Linux, giới hạn quyền đọc tệp SMTP bằng `chmod 600 deploy/.env.smtp.production`.

Mật khẩu trong tệp là mật khẩu ứng dụng Gmail, không phải mật khẩu đăng nhập Gmail. Nếu tệp bị lộ, thu hồi mật khẩu ứng dụng và cấp lại. Việc ghi tệp này chưa triển khai ứng dụng lên live.

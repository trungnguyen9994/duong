# Bàn giao MariaDB local – 15/10/2026

## Chạy và quản lý

Làm tại `E:\project\duong` (không sửa bản sao `duong/`). Node 22+, Docker Desktop.

```powershell
npm ci
npm run local:start
npm run dev:all
```

- Giao diện: http://127.0.0.1:5173/
- API: http://127.0.0.1:8787/api/health (trả `database: mariadb`).
- phpMyAdmin hiện có: http://localhost:8081/index.php?route=/database/structure&db=supabase_db_duong
- MariaDB: `127.0.0.1:3306`, database `supabase_db_duong`, user ứng dụng `edugame_app`.
- Mailpit độc lập: http://127.0.0.1:8025/, SMTP `127.0.0.1:55425`.
- Ảnh, thumbnail, file upload tạm và PPTX: `data/storage/` (ngoài public, được Git bỏ qua).
- `.env`: tài khoản DB, secret ký URL, SMTP, cấu hình backend. `.env.local`: API URL và hộp thư local; không chứa secret.

`local:start` dùng container Laradock `laradock-mariadb-1` khi có. Máy mới tạo `edugame-mariadb` với volume `edugame_mariadb`. Chỉ tạo schema trong database riêng, không thay đổi database Laradock khác. `local:env` áp dụng migrations idempotent, không reset hoặc xóa dữ liệu. Bộ SQL nằm trong `database/migrations/`.

## Tài khoản

Đăng ký trên web, xác minh email qua Mailpit. Mật khẩu dùng bcrypt; token phiên, xác minh và đặt lại mật khẩu chỉ lưu SHA-256 trong MariaDB. Phiên dùng cookie HttpOnly, SameSite=Lax, hết hạn sau bảy ngày; production bật Secure. Token email dùng một lần, hết hạn sau một giờ. Đặt lại mật khẩu thu hồi phiên cũ. Auth có giới hạn tần suất theo IP/route.

Không có Admin hoặc mật khẩu mặc định. Sau khi đăng ký và xác minh:

```powershell
npm run admin:bootstrap -- email-cua-ban@example.com
```

Lệnh chỉ chạy phía server, cấp Super Admin và ghi audit. Đăng ký công khai luôn tạo Teacher; không nhận role/quota từ trình duyệt. Cấu hình duyệt tài khoản tiếp tục dùng được.

## Kiến trúc sau chuyển đổi

- Backend dùng `mysql2` với truy vấn tham số; trình duyệt chỉ gọi HTTP API, không kết nối thẳng DB. Không còn Supabase Auth/Storage/PostgREST trong luồng chạy.
- Kiểm tra email xác minh, trạng thái, owner và quyền tại API và các giao dịch đặc quyền. MariaDB không có PostgreSQL RLS; quyền đọc chéo được chặn tại API. Tài khoản DB chỉ có SELECT/INSERT/UPDATE/DELETE trong database ứng dụng, không có DDL hoặc quyền quản trị server.
- `server/database.ts`: kết nối, chuẩn hóa JSON/date/boolean, query builder nội bộ. Không có endpoint nhận tên bảng hoặc SQL tùy ý từ trình duyệt.
- `server/operations.ts`: giao dịch lưu bài/tham chiếu ảnh, revision, quota, job, duyệt chia sẻ và quản trị. Phiên bản template đã phát hành được bảo vệ bằng trigger bất biến.
- MariaDB hiện tại 10.3 không hỗ trợ SKIP LOCKED; worker nhận job trong giao dịch ngắn với hàng khóa riêng. Lease token, heartbeat, timeout và tối đa ba lần thử vẫn được giữ.
- Upload đi qua URL ký giới hạn năm phút, kiểm tra và chuẩn hóa PNG/JPEG/WebP bằng Sharp trong worker. Không mở thư mục file bằng static middleware. URL đọc/tải file có hạn; không trả binary lớn trong JSON.
- Ba mẫu, wizard, media crop/alt text, nhập dữ liệu cũ, chơi cá nhân/tổ, chia sẻ và xuất PPTX tiếp tục dùng API hiện có.

## Dữ liệu cũ

Lần chuyển này nguồn có 0 tài khoản, 0 bài, 0 ảnh, 0 job; giữ các danh mục môn/mẫu. PostgreSQL và volume nguồn được giữ nguyên, bản dump ở `backups/before-mariadb/postgres.sql`, cấu hình cũ ở cùng thư mục. Không tự chuyển phiên đăng nhập hoặc token email cũ.

`scripts/import-supabase.mjs` là công cụ chuyển một lần: chỉ chạy khi nguồn Supabase còn hoạt động và database đích chưa có dữ liệu người dùng. Băm bcrypt được giữ, ID/quan hệ được giữ, file sao chép về kho local. Không chạy lại sau khi đã dùng MariaDB. SDK Supabase chỉ còn phục vụ công cụ này; cấu hình/migrations và script Supabase cũ giữ làm tài liệu lịch sử.

## Sao lưu và khôi phục

```powershell
npm run local:backup
npm run local:restore-check -- backups/mariadb-ten-ban-sao-luu
npm run local:backup-check
```

Backup chứa snapshot JSON của 16 bảng cùng file riêng tư và manifest SHA-256. Đây là dữ liệu nhạy cảm, không commit hoặc chia sẻ công khai. Dừng API/worker ghi dữ liệu trong cửa sổ bảo trì trước khi tạo bản sao dùng để phục hồi thật, để snapshot DB và file nhất quán. Giữ `.env`/cấu hình vận hành trong kho bí mật riêng; không đưa secret vào bản backup chia sẻ.

`restore-check` tạo database tên ngẫu nhiên `edugame_restore_*`, nạp lại toàn bộ bảng và sao chép file sang thư mục kiểm tra; đối chiếu số dòng/checksum rồi dọn database/thư mục cách ly. Không ghi đè database đang chạy. Khi khôi phục thật, dùng schema sạch trong database mới, nạp `database.json` bằng cùng phép ánh xạ ở công cụ restore, chép storage rồi chuyển cấu hình sau khi kiểm tra; không nhập JSON qua phpMyAdmin như SQL.

## Kiểm tra

```powershell
npm run check:server
npm test
npm run build
npm run test:local
npm run test:e2e
npm run local:backup-check
```

Tích hợp dùng tài khoản tạm và dọn sau khi chạy; kiểm tra mail xác minh/reset dùng một lần, cookie, owner, quyền, revision, upload/private media, export/idempotency, duyệt/thu hồi chia sẻ và đình chỉ. E2E dùng Edge local, Chromium trên CI, gồm đăng nhập thật qua UI, lưu bài, upload/crop, mô tả ảnh, chơi và tải PPTX. CI khởi động MariaDB/Mailpit thay Supabase.

## Triển khai sau local

Backend và worker cần máy Node có kết nối MariaDB và ổ đĩa bền vững cho `STORAGE_ROOT`. Cấu hình Vercel/Supabase cũ không áp dụng cho backend lưu file local; nếu dùng Vercel cho frontend, đặt `VITE_API_URL` tới backend riêng. Cần SMTP thật, HTTPS, quản lý secret, chính sách backup và lưu file bền vững trước production. Nghiệm thu PowerPoint offline tại trường, nội dung mẫu và nguồn/quyền bộ ảnh vẫn cần hoàn tất như lộ trình sản phẩm.

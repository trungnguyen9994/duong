# Bảo vệ API và upload

## Cơ chế trong ứng dụng

- Giới hạn IP: 300 yêu cầu/phút; auth: 30 lần/10 phút/IP/đường dẫn; đăng nhập, đăng ký, reset: 20 lần/15 phút/định danh. Limiter có giới hạn 10.000 khóa, không tăng bộ nhớ vô hạn.
- Giới hạn ghi: 80 lần/phút/tài khoản. Nhận file: 30 lần/phút/IP. Upload và cắt ảnh: tối đa 200 tác vụ/ngày/tài khoản, bên cạnh quota và giới hạn đồng thời sẵn có.
- Vé upload HMAC hết hạn sau 5 phút, gắn với chủ sở hữu, tác vụ đang chờ, đường dẫn, MIME và đúng số byte đã khai báo. Kiểm tra vé trước khi nhận file. Không ghi đè file đã upload.
- Chỉ nhận PNG/JPEG/WebP tĩnh, tối đa 5 MB và 24 MP; kiểm tra chữ ký và metadata tại API, kiểm tra lại tại worker rồi giải mã/chuẩn hóa WebP, loại metadata gốc. Không phát file gốc trong uploads qua endpoint đọc.
- Cạnh ảnh tối đa 12000 px, tỷ lệ không quá 20:1. Giới hạn ảnh trung gian khi zoom/cắt là 32 MP để tránh phình bộ nhớ.
- Chặn đường dẫn vượt thư mục, ký tự điều khiển và NTFS alternate data streams. Không trả lỗi SQL, đường dẫn hệ thống, thông báo SMTP cho trình duyệt.
- Header chống sniffing, framing, rò referrer; sandbox trên endpoint đọc file. Tài khoản không active không được tạo phiên đăng nhập mới.

## Khi triển khai thật

Limiter hiện ở bộ nhớ một tiến trình: restart reset, nhiều replica không chia sẻ bộ đếm. Cần giới hạn dùng chung tại reverse proxy/WAF/Redis khi chạy nhiều instance. Giới hạn ngày/quota được lưu trong MariaDB.

`TRUST_PROXY_HOPS` mặc định 0. Chỉ đặt số hop proxy thực sự kiểm soát, không bật trust proxy tùy tiện và không public cổng API để bỏ qua proxy. Proxy phải thay thế header chuyển tiếp do client gửi. Sai cấu hình cho phép giả IP hoặc gom người dùng vào cùng giới hạn.

HSTS bật khi `NODE_ENV=production`; chỉ phục vụ HTTPS. Thêm header bảo vệ frontend tại Nginx/CDN, giới hạn request body, kết nối, timeout/slow upload và băng thông tải file; không public MariaDB/SMTP thử nghiệm.

Worker cần container không đặc quyền, giới hạn CPU/RAM/PID, tự restart. Giới hạn 24 MP không thay thế cách ly bộ giải mã. Cập nhật Node, sharp/libvips, quét dependency định kỳ. WAF và quét malware chuyên dụng chưa tích hợp.

Sao lưu DB + storage và kiểm tra khôi phục trước cập nhật. Giữ secret ngoài mã nguồn, đổi mật khẩu admin và giám sát lỗi 401/403/429/5xx. Không log query string chứa token tại `/api/files/*`.

Vé upload cũ thiếu binding sẽ bị từ chối; chọn lại ảnh để nhận vé mới. Ảnh đã xử lý và mật khẩu hiện có không bị thay đổi.

Tham khảo: [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Express Security](https://expressjs.com/en/advanced/best-practice-security.html).

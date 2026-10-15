> Tài liệu kiến trúc Supabase trước khi chuyển database. Hướng dẫn đang áp dụng: [MARIADB_LOCAL.md](MARIADB_LOCAL.md). Không dùng các lệnh Supabase bên dưới cho bản hiện tại.

# Bàn giao kỹ thuật V4.1 local

## Kiến trúc

- `src/domain/studio-spec.ts`: GameSpec số `1`, ba dạng nội dung, validator nháp và điều kiện chơi/xuất. Định dạng cũ `"1.0"` giữ riêng.
- `src/domain/template-registry.ts`: phiên bản → validator, mô tả editor, renderer/adapter ID và capability manifest. Renderer trong `src/studio/templates.ts`, adapter trong `server/pptx.ts`. Không thực thi JavaScript từ database.
- `src/studio/`: routing, Auth, dashboard, wizard, media, ngân hàng câu hỏi, ba player và quản trị. Roboto local; Tailwind utilities không bật preflight để giữ giao diện cũ.
- `server/api.ts`: kiểm tra JWT bằng `auth.getUser`, email xác minh, tài khoản hoạt động, owner và quyền.
- `server/worker.ts`: claim PostgreSQL `SKIP LOCKED`, lease token, heartbeat, tối đa ba lần thử với lỗi tạm thời; phục hồi khi tiến trình dừng. Sharp một luồng, cache ảnh nền để giảm RAM.
- `supabase/migrations/`: identity, catalog, games, questions, media, queue, quota, share/moderation và audit. Teacher chỉ đọc qua RLS; ghi tin cậy qua API. RPC đặc quyền chỉ cấp cho `service_role`.

`games.spec` là nguồn chính. Lưu game và tham chiếu ảnh trong một giao dịch; revision cũ trả 409. Đổi template sau khi nhập nội dung giữ bản cũ và tạo bản mới. Câu hỏi ngân hàng được sao chép thành snapshot khi đưa vào bài.

## Tài khoản và quản trị

Không có tài khoản/mật khẩu quản trị cố định. Sau khi đăng ký và xác minh:

```powershell
npm run admin:bootstrap -- email-cua-ban@example.com
```

Super Admin cấp quyền Admin từng nhóm, sửa quota/trạng thái và bật duyệt tài khoản mới. Admin `accounts` chỉ quản lý trạng thái Teacher, không cấp role/quota hoặc tác động quản trị viên khác. Admin sửa môn, ẩn/mở template cho bài mới, duyệt công bố, xem audit và đưa bản sao ảnh của mình vào kho mặc định sau khi nhập nguồn/giấy phép. Không tự công khai ảnh của giáo viên khác.

## Media và job

Signed upload vào bucket private `uploads`; API không nhận binary lớn. Worker kiểm tra MIME/chữ ký/decode/pixel/frame; loại metadata, tạo WebP và thumbnail. Quota tính ảnh, thumbnail, file xuất và dung lượng giữ cho job đang chạy dưới khóa tài khoản.

Media Studio có cắt ảnh theo tỉ lệ 16:9, 4:5 hoặc 1:1; cover/contain, vị trí, zoom và độ mờ. Bấm **Lưu thành ảnh mới và sử dụng** để worker tạo bản sao và thay tham chiếu trong bài, giữ nguyên ảnh gốc. Kết quả cắt được dùng cả Web/PPTX. Alt text ảnh cá nhân được lưu với revision; không cho sửa metadata ảnh của tài khoản khác.

Ảnh được game/ngân hàng/job sử dụng bị chặn xóa. Xóa mềm chưa giải phóng quota trước khi cleanup xóa binary. URL ảnh được làm mới khi chơi. Liên kết chia sẻ được kiểm tra lại định kỳ; thu hồi không thể xóa nội dung người xem đã tải trước đó.

```powershell
npm run local:cleanup
```

Cleanup xử lý ảnh xóa/thất bại quá một ngày và file xuất quá bảy ngày; chạy lặp an toàn. Export từ snapshot, kiểm tra mọi ảnh khi nhận job và khi xử lý. Chữ/nút là đối tượng chỉnh sửa được; ảnh được nhúng.

## Sao lưu và khôi phục

Ngừng ghi dữ liệu trong cửa sổ bảo trì rồi chạy:

```powershell
npm run local:backup
npm run local:restore-check -- backups/ten-thu-muc
```

Backup gồm custom PostgreSQL dump toàn DB, file hai bucket và manifest SHA-256. `backups/` được Git bỏ qua. Restore-check chỉ tạo DB/bucket tạm, đối chiếu checksum rồi dọn; không ghi đè dữ liệu đang dùng. Vai trò nội bộ `supabase_admin` dùng để phục hồi hàm hệ thống, không phải tài khoản ứng dụng.

```powershell
npx tsx server/check-backup.ts
```

Đã diễn tập local thành công với một ảnh kiểm thử: phục hồi DB tạm, upload/download ảnh trong bucket riêng, checksum trùng khớp. Dữ liệu lớp học thật vẫn cần backup trong cửa sổ bảo trì và diễn tập trên môi trường tương đương đích.

## CI và staging

Workflow `.github/workflows/ci.yml` dựng Supabase sạch rồi chạy TypeScript, unit, build, RLS/API và E2E. Đã thêm workflow; chưa có kết quả chạy GitHub cho thay đổi này.

`vercel.json` và `api/index.ts` chuẩn bị frontend/Node API. Cần các biến riêng: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và secret ngẫu nhiên `INTERNAL_WORKER_SECRET`. `VITE_API_URL` có thể bỏ trống khi cùng origin. Không ghi secret vào Git.

Cloud worker nhận một job qua `POST /api/internal/worker`, cleanup qua `POST /api/internal/cleanup`; đều yêu cầu `Authorization: Bearer <INTERNAL_WORKER_SECRET>`. Khi có staging, cấu hình scheduler Supabase gọi worker định kỳ và cleanup hàng ngày, secret để trong Vault. Lease cho phép gọi nhiều lần. Chưa triển khai Vercel; cần đo RAM/thời gian thực tế trên gói vận hành.

## Điều kiện phát hành còn lại

Kết quả local ngày 15/10/2026: build và TypeScript backend qua; 29 unit test, 4 E2E qua, bao gồm upload/crop/alt text và tải PPTX thật. Kiểm thử API qua với hai Teacher, Admin theo quyền, chống tự nâng quyền, revision, file giả, quota, công bố/thu hồi và tài khoản đình chỉ. Email xác minh và đặt lại mật khẩu đã thử qua hộp thư local. Cấu hình `email_sent = 1000` chỉ phục vụ hộp thư thử nghiệm; cần đặt hạn mức phù hợp cùng CAPTCHA khi lên cloud.

Đây là bản local để nghiệm thu, chưa xác nhận hoàn thành mọi điều kiện phát hành của kế hoạch 11 tuần.

- Cần mở PPTX offline trên PowerPoint máy trường để kiểm tra font, liên kết, ảnh, vùng chiếu và thao tác thực tế. Unit/structural test không thay thế bước này.
- Cần ba bài mẫu được giáo viên duyệt: Hành trình theo Cánh Diều, Mảnh ghép TN&XH sáu ô, Vòng quay Tiếng Việt. Demo chỉ minh họa tính năng.
- Cần 30 ảnh có nguồn/quyền được duyệt: 10 nền, 10 nhân vật, 5 vật phẩm, 5 ảnh bí mật. Kho mặc định không gán giấy phép giả hoặc tự công khai ảnh cá nhân.
- Chưa có Supabase cloud, email thật, CAPTCHA, scheduler cloud, tài khoản triển khai hay UAT tại lớp.
- Cần duyệt trực quan chín nhóm màn hình trên thiết bị đích, đặc biệt Media Studio và màn chiếu.

Giữ nguyên bản sao `duong/` và tài liệu người dùng thay đổi. Không có tích hợp sinh ảnh AI, prompt, credit hay OAuth Google/Microsoft trong sản phẩm mới.

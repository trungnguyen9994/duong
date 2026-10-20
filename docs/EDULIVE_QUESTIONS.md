# Kho Toán lớp 1, 2, 3 · Kết nối tri thức với cuộc sống · Tập 2

## Bổ sung lớp 1 và lớp 2

| Lớp       | Tiết mở đã đọc | Slide | Câu đã nhập | Tiết có câu được nhập |  Tiết bị khóa |
| --------- | -------------: | ----: | ----------: | --------------------: | ------------: |
| 1         |             15 |   244 |           7 |                     2 |            36 |
| 2         |             23 |   333 |          16 |                    10 |            63 |
| 3 (đã có) |             23 |   358 |          25 |                    10 | Chưa thống kê |

Nguồn lớp 1: https://edulive.net/bai-giang-toan-lop-1-sach-ket-noi-tri-thuc-voi-cuoc-song-tap-2

Nguồn lớp 2: https://edulive.net/bai-giang-toan-lop-2-sach-ket-noi-tri-thuc-voi-cuoc-song-tap-2

Tổng hiện tại: 48 câu Edulive thuộc ba lớp, cộng 120 câu Cánh Diều cũ = 168 câu trong kho mặc định. Chọn **Bộ sách → Kết nối tri thức với cuộc sống**, rồi chọn **Lớp** và **Bài học**. Đổi bộ sách hoặc lớp sẽ xóa bộ lọc bài học cũ và trở về trang 1.

Hai lớp mới giữ nguyên đề, lựa chọn, thứ tự và đáp án gốc. Phần chữ của câu cần hình để đếm cà chua, so sánh độ dài/chiều cao, đọc đồng hồ, đếm khối hình hoặc hoàn thành dãy số không có trong đề được hoãn nhập. Không bịa thêm ngữ cảnh hay lựa chọn để thay hình. Câu có nhiều đáp án hoặc lựa chọn trùng cũng được hoãn.

Lớp 2 còn có đề “Đây là con vật gì?” nhưng lựa chọn là số/phép so sánh (slide 54191, 54196) và đề hai ô cộng có thể hoán đổi số nên tạo hơn một đáp án đúng (slide 55205, 55214 dòng 5). Những câu này nằm trong danh sách chờ duyệt, không sửa ngầm.

Các tệp `src/data/edulive-kntt-grade1-volume2.ts` và `src/data/edulive-kntt-grade2-volume2.ts` chứa dữ liệu cùng danh sách tiết bị khóa, lỗi tải và các câu hoãn nhập. `scripts/edulive-review.mjs` ghi lại kiểm tra ngữ cảnh/chất lượng nguồn. Kho lớp 3 và ID cũ không bị sinh lại khi nhập lớp 1, 2.

Nhập lại từng lớp (đối số mặc định là 3 để tương thích các lệnh cũ):

```powershell
node scripts/inspect-edulive.mjs 1
node scripts/import-edulive-questions.mjs 1
node scripts/inspect-edulive.mjs 2
node scripts/import-edulive-questions.mjs 2
pnpm exec prettier --write src/data/edulive-kntt-grade1-volume2.ts src/data/edulive-kntt-grade2-volume2.ts
pnpm exec vitest run src/tests/default-questions.test.ts
```

## Chi tiết đợt nhập lớp 3 ban đầu

Nguồn: https://edulive.net/bai-giang-toan-lop-3-sach-ket-noi-tri-thuc-voi-cuoc-song-tap-2

Đã đọc 23 tiết học mở (358 slide), nhập 25 câu trắc nghiệm một đáp án từ 10 tiết học. Đây là một phần khóa học, không phải toàn bộ kho Edulive. Kho Cánh Diều cũ vẫn giữ nguyên 120 câu và ID cũ.

Nội dung trong `src/data/edulive-kntt-grade3-volume2.ts` giữ nguyên chuỗi đề bài, bốn lựa chọn theo thứ tự trong dữ liệu nguồn và đáp án được xác minh bằng sự kiện chấm điểm của slide. Mỗi câu ghi bộ sách, tập, tên tiết học, URL nguồn, ID tài liệu, ID slide và dòng dữ liệu. Không tự biên soạn lựa chọn nhiễu, gợi ý hay lời giải. Các trường gợi ý/lời giải để trống vì nguồn trắc nghiệm không cung cấp.

## Phần chưa nhập

- Tiết học bị khóa trong mục lục: cần phiên truy cập hợp lệ hoặc tệp do người dùng xuất/cung cấp.
- Điền số, nối, đúng/sai, bài giải và câu nhiều đáp án: kho hiện chỉ hỗ trợ đúng bốn lựa chọn với một đáp án.
- Slide 44078: đề yêu cầu dùng thẻ số trong hình, chưa đủ ngữ cảnh nếu chỉ nhập chữ.
- Slide 58255: hai lựa chọn được đánh dấu đúng, không thể ép thành một đáp án.
- Slide 47956, dòng 3: nguồn ghi `9365 : 3 = 3121`, nhưng phép chia dư 2 và không có lựa chọn đầy đủ. Được giữ trong danh sách chờ duyệt, không sửa ngầm.

Danh sách chi tiết các slide chưa tương thích nằm ở `eduliveImport.deferred` trong file dữ liệu.

## Nhập lại

```powershell
node scripts/inspect-edulive.mjs
node scripts/import-edulive-questions.mjs
pnpm exec prettier --write src/data/edulive-kntt-grade3-volume2.ts
pnpm exec vitest run src/tests/default-questions.test.ts
```

Lệnh đọc chỉ theo các liên kết bài học công khai, không dò ID hay vượt giới hạn truy cập. Bản kiểm tra trung gian nằm tại `data/edulive-inspection.json` (được Git bỏ qua). Bộ chuyển đổi không thực thi các biểu thức JavaScript của nguồn; chỉ đọc JSON và đối chiếu quy tắc chấm điểm. ID câu được tạo từ ID tài liệu, ID slide và số dòng để ổn định khi nhập lại.

API dùng kho mặc định từ mã nguồn nên không cần seed MariaDB. Web/API đang chạy chế độ watch sẽ nạp dữ liệu sau khi thay đổi. Cần đăng nhập và kết nối MariaDB bình thường để truy cập trang ngân hàng câu hỏi; các kiểm tra dữ liệu/build không thay thế xác nhận đăng nhập trên môi trường thực tế.

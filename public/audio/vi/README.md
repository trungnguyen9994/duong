# Giọng Việt cho trò chơi

Nguồn: Vbee Studio, giọng **HN - Việt Bách**, tốc độ **1x**, MP3.
Bộ lời thoại do tác giả dự án cho phép tạo trên tài khoản Vbee ngày 21/10/2026.
Không lưu tài khoản, mật khẩu hoặc API key vào frontend.

Các file phát trực tiếp từ `public/audio/vi/`, được Vite copy vào `dist/audio/vi/`
khi build. Không cần gọi Vbee trong lúc chơi. Phạm vi là lời dẫn/phản hồi chung,
không đọc nguyên văn câu hỏi, tên học sinh, gợi ý hay điểm số thay đổi.
Nội dung câu chuẩn nằm trong `src/domain/narration-cues.ts`.

- intro.mp3: bắt đầu chặng
- correct.mp3: trả lời đúng
- retry.mp3: thử lại
- select.mp3: chọn ô/câu hỏi
- question.mp3: đọc câu hỏi và chọn đáp án
- answer.mp3: xem lời giải
- summary.mp3: kết thúc
- turn.mp3: lượt quay
- lose.mp3: chuyển lượt
- letter.mp3: chọn chữ

Nút Nghe lại phát trực tiếp theo thao tác bấm để đáp ứng chính sách autoplay.
Tạm dừng, tắt âm, chuyển lời thoại hoặc thoát trò chơi sẽ dừng file đang phát.
Nếu file không tải được thì dùng giọng trình duyệt hiện có; giọng Việt được
ưu tiên trước tiếng Anh. Quyền sử dụng/phân phối tuân theo gói Vbee của chủ
sản phẩm; không đặt license nguồn mở cho bản thu của dịch vụ.

export const vietnameseCues = {
  intro: "Sẵn sàng khám phá chặng tiếp theo nhé!",
  correct: "Chính xác! Con làm tốt lắm!",
  retry: "Mình cùng suy nghĩ và thử lại nhé!",
  select: "Hãy chọn một ô để khám phá câu hỏi nhé!",
  question: "Cùng đọc câu hỏi và chọn đáp án nhé!",
  answer: "Cùng xem đáp án và lời giải nhé!",
  summary: "Chúc mừng cả lớp đã hoàn thành trò chơi!",
  turn: "Đến lượt quay rồi! Cùng thử vận may nhé!",
  lose: "Chuyển lượt rồi! Cùng cổ vũ bạn tiếp theo nhé!",
  letter: "Hãy chọn một chữ cái nhé!",
} as const;
export type VietnameseCue = keyof typeof vietnameseCues;
export function cueForNarration(text: string): VietnameseCue | null {
  const t = text.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!t) return null;
  if (/hoàn thành|chúc mừng/.test(t)) return "summary";
  if (/chưa đúng|không có|chuyển lượt|mất lượt/.test(t)) return "lose";
  if (/chính xác|làm tốt|ghi bàn/.test(t)) return "correct";
  if (/thử lại|suy nghĩ/.test(t)) return "retry";
  if (/đáp án và lời giải/.test(t)) return "answer";
  if (/chữ cái|chọn chữ khác/.test(t)) return "letter";
  if (/lượt quay|quay được|đoán/.test(t)) return "turn";
  if (/sẵn sàng/.test(t)) return "intro";
  if (/hãy chọn/.test(t)) return "select";
  return "question";
}

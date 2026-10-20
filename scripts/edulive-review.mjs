// Editorial checks against the original public slides. Never silently rewrite
// source prompts or fabricate choices to make an exercise fit the bank.
export const illustrationSlides = new Set([
  // Grade 1: counting pictures, missing number lines, visual height/length comparisons.
  47502,
  47536, 47538, 47540, 56542, 56543, 56544, 42168, 42237, 54037, 54038,
  // Grade 2: clocks, diagram lengths and solid-shape illustrations.
  43527, 43529, 43537, 59858, 59864, 59868, 59869,
]);

export function reviewIssue(grade, slideId, row) {
  if (illustrationSlides.has(slideId))
    return "Cần hình minh họa gốc để hiểu đầy đủ đề bài.";
  if (grade === 2 && [54191, 54196].includes(slideId))
    return "Đề gốc ghi ‘Đây là con vật gì?’ nhưng lựa chọn là phép so sánh hoặc số; cần duyệt lại nguồn, không sửa ngầm.";
  if (grade === 2 && (slideId === 55205 || (slideId === 55214 && row === 5)))
    return "Đề gốc có hai ô cộng không quy định hàng; hoán đổi hai số ở các lựa chọn vẫn cho cùng kết quả, chưa đủ điều kiện một đáp án đúng.";
  if (grade === 3 && slideId === 47956 && row === 3)
    return "Nguồn ghi 9365 : 3 = 3121; phép chia có dư 2 và không có đáp án đầy đủ trong bốn lựa chọn.";
}

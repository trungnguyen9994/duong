import { createGame, type GameSpec } from "./game-spec";

export function sampleGame(): GameSpec {
  const game = createGame();
  game.id = "sample-math3-v1";
  game.title = "Giải cứu vương quốc Toán học";
  game.curriculum = "canh-dieu";
  game.description =
    "Bé Sao cùng bốn đội ôn tập tìm thừa số chưa biết. Bộ câu hỏi biên soạn mới, định hướng Toán 3 Cánh Diều; giáo viên cần rà soát theo bài đang dạy.";
  const items: [string, string[], number, string][] = [
    [
      "Trong phép tính 6 × 4 = 24, số nào là tích?",
      ["6", "4", "24", "10"],
      2,
      "Kết quả của phép nhân gọi là tích.",
    ],
    [
      "Trong phép tính 3 × 7 = 21, hai thừa số là gì?",
      ["3 và 21", "7 và 21", "3 và 7", "21 và 1"],
      2,
      "Hai số được nhân với nhau gọi là hai thừa số.",
    ],
    ["Tìm x: x × 4 = 32", ["6", "7", "8", "9"], 2, "Lấy 32 chia cho 4: x = 8."],
    ["Tìm x: 3 × x = 27", ["6", "7", "8", "9"], 3, "Lấy 27 chia cho 3: x = 9."],
    ["Tìm x: x × 5 = 35", ["5", "6", "7", "8"], 2, "Lấy 35 chia cho 5: x = 7."],
    ["Tìm x: 6 × x = 42", ["6", "7", "8", "9"], 1, "Lấy 42 chia cho 6: x = 7."],
    [
      "Có 24 viên bi chia đều vào 4 túi. Mỗi túi có bao nhiêu viên bi?",
      ["4", "5", "6", "8"],
      2,
      "Số bi mỗi túi = 24 : 4 = 6.",
    ],
    [
      "Mỗi hộp có 5 chiếc bút. Có tất cả 30 chiếc bút. Có bao nhiêu hộp?",
      ["5", "6", "7", "8"],
      1,
      "Số hộp = 30 : 5 = 6.",
    ],
    [
      "Tìm số còn thiếu: 8 × □ = 48",
      ["4", "5", "6", "7"],
      2,
      "Lấy 48 chia cho 8: số còn thiếu là 6.",
    ],
    [
      "Bốn hàng ghế có số ghế bằng nhau, tổng cộng 36 ghế. Mỗi hàng có bao nhiêu ghế?",
      ["6", "7", "8", "9"],
      3,
      "Số ghế mỗi hàng = 36 : 4 = 9.",
    ],
    ["Tìm x: x × 7 = 56", ["6", "7", "8", "9"], 2, "Lấy 56 chia cho 7: x = 8."],
    [
      "Muốn tìm thừa số chưa biết, em làm thế nào?",
      [
        "Lấy tích cộng thừa số đã biết",
        "Lấy tích trừ thừa số đã biết",
        "Lấy tích nhân thừa số đã biết",
        "Lấy tích chia thừa số đã biết",
      ],
      3,
      "Muốn tìm thừa số chưa biết, lấy tích chia cho thừa số đã biết.",
    ],
  ];
  game.questions = items.map(([prompt, texts, correct, explanation], i) => ({
    id: `sample-q-${i + 1}`,
    type: "single-choice",
    prompt,
    choices: texts.map((text, j) => ({ id: ["A", "B", "C", "D"][j], text })),
    correctChoiceId: ["A", "B", "C", "D"][correct],
    hint:
      i < 2
        ? "Nhớ tên gọi các thành phần trong phép nhân."
        : "Muốn tìm thừa số chưa biết, lấy tích chia cho thừa số đã biết.",
    explanation,
  }));
  let offset = 0;
  game.stages.forEach((stage, i) => {
    stage.questionIds = game.questions
      .slice(offset, offset + [2, 4, 4, 2][i])
      .map((q) => q.id);
    offset += [2, 4, 4, 2][i];
  });
  return game;
}

export function reserveQuestions() {
  const items: [string, string[], number, string][] = [
    ["Tìm số còn thiếu: □ × 2 = 18", ["6", "7", "8", "9"], 3, "18 : 2 = 9."],
    ["Tìm số còn thiếu: 4 × □ = 28", ["5", "6", "7", "8"], 2, "28 : 4 = 7."],
    ["Tìm số còn thiếu: □ × 9 = 54", ["4", "5", "6", "7"], 2, "54 : 9 = 6."],
    ["Tìm số còn thiếu: 5 × □ = 40", ["6", "7", "8", "9"], 2, "40 : 5 = 8."],
    [
      "Có 21 bông hoa cắm đều vào 3 lọ. Mỗi lọ có bao nhiêu bông?",
      ["5", "6", "7", "8"],
      2,
      "21 : 3 = 7 (bông hoa).",
    ],
    [
      "Mỗi bạn nhận 4 nhãn vở. Có 32 nhãn vở được phát hết. Có bao nhiêu bạn?",
      ["6", "7", "8", "9"],
      2,
      "32 : 4 = 8 (bạn).",
    ],
    ["Số nào nhân với 6 thì bằng 54?", ["6", "7", "8", "9"], 3, "54 : 6 = 9."],
    [
      "Để kiểm tra số 7 là thừa số còn thiếu trong □ × 8 = 56, em chọn phép tính nào?",
      ["7 + 8 = 15", "7 × 8 = 56", "56 + 8 = 64", "56 − 8 = 48"],
      1,
      "Thay số 7 vào ô trống: 7 × 8 = 56.",
    ],
  ];
  return items.map(([prompt, texts, correct, explanation], i) => ({
    id: `reserve-${i + 1}`,
    type: "single-choice" as const,
    prompt,
    choices: texts.map((text, j) => ({ id: ["A", "B", "C", "D"][j], text })),
    correctChoiceId: ["A", "B", "C", "D"][correct],
    hint: "Muốn tìm thừa số chưa biết, lấy tích chia cho thừa số đã biết.",
    explanation,
  }));
}

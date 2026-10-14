import type { GameSpec, Question } from "../../domain/game-spec";
import { backgroundStyle } from "../../domain/appearance";

export function QuestionPreview({
  spec,
  question,
  index,
}: {
  spec: GameSpec;
  question: Question;
  index: number;
}) {
  return (
    <details className="question-preview">
      <summary>👀 Xem nhanh câu hỏi trên màn chơi</summary>
      <div
        style={backgroundStyle(spec, index)}
        className="question-preview-scene"
      >
        <div className="mini-parchment">
          {question.prompt || "Viết câu hỏi của bạn ở ô bên dưới"}
        </div>
        <div className="preview-answers">
          {question.choices.map((c, i) => (
            <div key={c.id} className={`preview-answer answer-${i}`}>
              <b>{["A", "B", "C", "D"][i]}</b>
              <span>{c.text || "Nội dung đáp án"}</span>
              {question.correctChoiceId === c.id && (
                <span title="Đáp án đúng (chỉ giáo viên thấy)">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

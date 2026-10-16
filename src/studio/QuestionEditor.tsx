import { useEffect, useRef } from "react";
import type { Mcq } from "../domain/studio-spec";
export function QuestionEditor({
  questions,
  active,
  onActive,
  max,
  onUpdate,
  onAdd,
  onRemove,
  onDuplicate,
}: {
  questions: Mcq[];
  active: string;
  onActive: (id: string) => void;
  max: number;
  onUpdate: (i: number, patch: Partial<Mcq>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onDuplicate: (i: number) => void;
}) {
  const previous = useRef(questions.map((q) => q.id));
  useEffect(() => {
    const added = questions.find((q) => !previous.current.includes(q.id));
    if (added) onActive(added.id);
    previous.current = questions.map((q) => q.id);
  }, [questions, onActive]);
  const selected = questions.some((q) => q.id === active)
    ? active
    : questions[0]?.id;
  return (
    <div className="simple-question-editor">
      <p className="simple-field-help">
        Nhập câu hỏi và 4 lựa chọn, rồi đánh dấu đáp án đúng. Gợi ý và giải
        thích có thể bổ sung sau.
      </p>
      {!questions.length && (
        <div className="simple-question-empty">
          <strong>Chưa có câu hỏi nào</strong>
          <p>Bắt đầu bằng một câu hỏi ngắn, phù hợp với bài học.</p>
        </div>
      )}
      {questions.map((q, i) => {
        const complete =
          !!q.prompt.trim() && q.choices.every((c) => !!c.trim());
        return (
          <section className="simple-question-card" key={q.id}>
            <button
              type="button"
              className="simple-question-heading"
              aria-expanded={selected === q.id}
              aria-controls={`edit-${q.id}`}
              onClick={() => onActive(q.id)}
            >
              <span className="simple-question-index">{i + 1}</span>
              <span>
                <strong>
                  {q.prompt.trim() || `Câu ${i + 1}: Nhập câu hỏi`}
                </strong>
                <small>
                  {complete
                    ? "Đã đủ nội dung"
                    : "Cần nhập câu hỏi và các đáp án"}
                </small>
              </span>
              <span
                className={complete ? "simple-complete" : "simple-incomplete"}
              >
                {complete ? "✓" : "…"}
              </span>
            </button>
            {selected === q.id && (
              <div className="simple-question-body" id={`edit-${q.id}`}>
                <label>
                  Đề bài
                  <textarea
                    aria-label="Đề bài"
                    maxLength={400}
                    value={q.prompt}
                    placeholder="Ví dụ: 3 × 4 bằng bao nhiêu?"
                    onChange={(e) => onUpdate(i, { prompt: e.target.value })}
                  />
                </label>
                <p className="simple-field-help">
                  Chọn chấm tròn ở đáp án đúng.
                </p>
                <div className="simple-choice-list">
                  {q.choices.map((choice, j) => (
                    <div
                      className={`simple-choice${q.correct === j ? " is-correct" : ""}`}
                      key={j}
                    >
                      <label
                        className="simple-correct-control"
                        title={`Chọn ${"ABCD"[j]} là đáp án đúng`}
                      >
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correct === j}
                          onChange={() => onUpdate(i, { correct: j })}
                          aria-label={`Chọn ${"ABCD"[j]} là đáp án đúng`}
                        />
                        <span>{"ABCD"[j]}</span>
                      </label>
                      <input
                        aria-label={`Đáp án ${"ABCD"[j]}`}
                        maxLength={180}
                        value={choice}
                        placeholder={`Nhập đáp án ${"ABCD"[j]}`}
                        onChange={(e) => {
                          const choices = [...q.choices];
                          choices[j] = e.target.value;
                          onUpdate(i, { choices });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <details className="simple-optional">
                  <summary>
                    Thêm gợi ý và giải thích <span>Không bắt buộc</span>
                  </summary>
                  <label>
                    Gợi ý
                    <input
                      maxLength={300}
                      value={q.hint}
                      onChange={(e) => onUpdate(i, { hint: e.target.value })}
                      placeholder="Giúp học sinh suy nghĩ thêm khi trả lời sai"
                    />
                  </label>
                  <label>
                    Giải thích
                    <input
                      maxLength={500}
                      value={q.explanation}
                      onChange={(e) =>
                        onUpdate(i, { explanation: e.target.value })
                      }
                      placeholder="Lời giải thích sau đáp án đúng"
                    />
                  </label>
                </details>
                <div className="simple-question-actions">
                  <button
                    type="button"
                    disabled={questions.length >= max}
                    onClick={() => onDuplicate(i)}
                  >
                    Nhân bản câu
                  </button>
                  <button
                    type="button"
                    className="simple-delete"
                    onClick={() => {
                      if (
                        (!q.prompt.trim() &&
                          !q.choices.some((c) => c.trim())) ||
                        window.confirm(`Xóa câu ${i + 1}?`)
                      )
                        onRemove(i);
                    }}
                  >
                    Xóa câu
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
      <button
        type="button"
        className="eg-button simple-add-question"
        disabled={questions.length >= max}
        onClick={onAdd}
      >
        ＋ {questions.length ? "Thêm câu hỏi" : "Thêm câu hỏi đầu tiên"}
      </button>
      <p className="simple-field-help">
        {questions.length}/{max} câu hỏi
      </p>
    </div>
  );
}

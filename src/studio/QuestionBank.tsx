import { useEffect, useState } from "react";
import type { Mcq } from "../domain/studio-spec";
import { api } from "./client";
type Row = { id: string; body: Mcq; revision: number };
export function QuestionBank({ select }: { select?: (q: Mcq) => void }) {
  const [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void api<Row[]>("/questions")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  function change(patch: Partial<Mcq>) {
    if (editing)
      setEditing({ ...editing, body: { ...editing.body, ...patch } });
  }
  async function save() {
    if (!editing) return;
    try {
      await api(`/questions/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          body: editing.body,
          revision: editing.revision,
        }),
      });
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section>
      <div className="eg-title">
        <h1>Ngân hàng câu hỏi</h1>
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            setEditing({
              id,
              revision: 0,
              body: {
                id,
                prompt: "",
                choices: ["", "", "", ""],
                correct: 0,
                hint: "",
                explanation: "",
              },
            });
          }}
        >
          ＋ Thêm câu hỏi
        </button>
      </div>
      <p>
        Khi thêm vào trò chơi, câu hỏi được sao chép thành snapshot. Sửa ngân
        hàng không làm đổi bài đã tạo.
      </p>
      {error && <p role="alert">{error}</p>}
      {editing && (
        <div className="eg-card">
          <label>
            Đề bài
            <textarea
              value={editing.body.prompt}
              maxLength={400}
              onChange={(e) => change({ prompt: e.target.value })}
            />
          </label>
          {editing.body.choices.map((c, i) => (
            <label key={i}>
              {"ABCD"[i]}
              <input
                value={c}
                maxLength={180}
                onChange={(e) => {
                  const choices = [...editing.body.choices];
                  choices[i] = e.target.value;
                  change({ choices });
                }}
              />
              <input
                type="radio"
                name="correct-bank"
                checked={editing.body.correct === i}
                onChange={() => change({ correct: i })}
              />
              Đáp án đúng
            </label>
          ))}
          <label>
            Gợi ý
            <input
              value={editing.body.hint}
              maxLength={300}
              onChange={(e) => change({ hint: e.target.value })}
            />
          </label>
          <label>
            Giải thích
            <input
              value={editing.body.explanation}
              maxLength={500}
              onChange={(e) => change({ explanation: e.target.value })}
            />
          </label>
          <button onClick={() => void save()}>Lưu câu hỏi</button>
          <button onClick={() => setEditing(null)}>Hủy</button>
        </div>
      )}
      {loading ? (
        <p role="status">Đang tải…</p>
      ) : rows.length ? (
        <div className="eg-grid">
          {rows.map((row) => (
            <article className="eg-card" key={row.id}>
              <h3>{row.body.prompt || "Câu hỏi chưa hoàn thiện"}</h3>
              <p>
                {row.body.choices
                  .map((c, i) => `${"ABCD"[i]}. ${c}`)
                  .join(" · ")}
              </p>
              <div className="eg-actions">
                {select && (
                  <button
                    onClick={() =>
                      select({
                        ...structuredClone(row.body),
                        id: crypto.randomUUID(),
                        sourceQuestionId: row.id,
                      })
                    }
                  >
                    Thêm bản sao vào bài
                  </button>
                )}
                <button onClick={() => setEditing(structuredClone(row))}>
                  Sửa
                </button>
                <button
                  onClick={() =>
                    void api(`/questions/${row.id}?revision=${row.revision}`, {
                      method: "DELETE",
                    })
                      .then(load)
                      .catch((e) => setError(e.message))
                  }
                >
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="eg-empty">Chưa có câu hỏi trong ngân hàng.</div>
      )}
    </section>
  );
}

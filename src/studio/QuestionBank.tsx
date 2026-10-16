import "./question-bank.css";
import { useEffect, useState } from "react";
import type { Mcq } from "../domain/studio-spec";
import { api } from "./client";
import type { BankQuestion as Row } from "../data/default-questions";
export function QuestionBank({ select }: { select?: (q: Mcq) => void }) {
  const [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [scope, setScope] = useState("default"),
    [lesson, setLesson] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
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
  const lessons = [
    ...new Set(rows.filter((r) => r.isDefault).map((r) => r.lesson!)),
  ];
  const visible = rows.filter(
    (r) =>
      (scope === "default" ? r.isDefault : !r.isDefault) &&
      (!lesson || r.lesson === lesson) &&
      `${r.body.prompt} ${r.lesson || ""}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * 12, currentPage * 12);
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
      <div
        className="eg-actions"
        style={{ flexWrap: "wrap", marginBottom: 16 }}
      >
        <label>
          Kho câu hỏi
          <select
            aria-label="Kho câu hỏi"
            value={scope}
            onChange={(e) => {
              setPage(1);
              setScope(e.target.value);
              setLesson("");
            }}
          >
            <option value="default">Mặc định · Toán 3 · Cánh Diều</option>
            <option value="mine">Câu hỏi của tôi</option>
          </select>
        </label>
        {scope === "default" && (
          <label>
            Bài học
            <select
              aria-label="Bài học"
              value={lesson}
              onChange={(e) => {
                setPage(1);
                setLesson(e.target.value);
              }}
            >
              <option value="">Tất cả bài học</option>
              {lessons.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Tìm câu hỏi
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Nhập nội dung hoặc tên bài…"
          />
        </label>
      </div>
      {!loading && (
        <p role="status">
          {visible.length} câu hỏi{lesson ? ` · ${lesson}` : ""}
          {visible.length > 0 &&
            ` · Hiển thị ${(currentPage - 1) * 12 + 1}–${Math.min(currentPage * 12, visible.length)}`}
        </p>
      )}
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
      ) : visible.length ? (
        <div className="eg-grid">
          {pageRows.map((row) => (
            <article className="eg-card question-bank-card" key={row.id}>
              {row.isDefault && (
                <small>Toán 3 · Cánh Diều · {row.lesson}</small>
              )}
              <h3>{row.body.prompt || "Câu hỏi chưa hoàn thiện"}</h3>
              <p>
                {row.body.choices
                  .map((c, i) => `${"ABCD"[i]}. ${c}`)
                  .join(" · ")}
              </p>
              <details>
                <summary>Xem đáp án và lời giải</summary>
                <p>
                  Đáp án: {"ABCD"[row.body.correct]}.{" "}
                  {row.body.choices[row.body.correct]}
                </p>
                <p>{row.body.explanation}</p>
                <p>Gợi ý: {row.body.hint}</p>
              </details>
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
                <button
                  onClick={() => {
                    if (row.isDefault) {
                      const id = crypto.randomUUID();
                      setEditing({
                        id,
                        revision: 0,
                        body: {
                          ...structuredClone(row.body),
                          id,
                          sourceQuestionId: row.id,
                        },
                      });
                    } else setEditing(structuredClone(row));
                  }}
                >
                  {row.isDefault ? "Tạo bản riêng" : "Sửa"}
                </button>
                {!row.isDefault && (
                  <button
                    onClick={() =>
                      void api(
                        `/questions/${row.id}?revision=${row.revision}`,
                        {
                          method: "DELETE",
                        },
                      )
                        .then(load)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Xóa
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="eg-empty">
          Không có câu hỏi phù hợp. Thử đổi bài học hoặc từ khóa.
        </div>
      )}
      {!loading && pageCount > 1 && (
        <nav aria-label="Phân trang câu hỏi" className="question-pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Trang trước
          </button>
          <div className="question-pagination-position">
            <label>
              <span>Trang</span>
              <select
                aria-label="Trang câu hỏi"
                value={currentPage}
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {Array.from({ length: pageCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <span>/ {pageCount}</span>
          </div>
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Trang sau →
          </button>
        </nav>
      )}
    </section>
  );
}

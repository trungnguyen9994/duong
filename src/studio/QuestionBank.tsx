import "./question-bank.css";
import { useEffect, useState } from "react";
import type { Mcq } from "../domain/studio-spec";
import { api } from "./client";
import type { BankQuestion as Row } from "../data/default-questions";
import { eduliveBanks } from "../data/edulive-banks";
export function QuestionBank({ select }: { select?: (q: Mcq) => void }) {
  const [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [scope, setScope] = useState("default"),
    [textbook, setTextbook] = useState(""),
    [grade, setGrade] = useState(""),
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
    ...new Set(
      rows
        .filter(
          (r) =>
            r.isDefault &&
            (!textbook || r.textbook === textbook) &&
            (!grade || r.grade === Number(grade)),
        )
        .map((r) => r.lesson!),
    ),
  ];
  const textbooks = [
    ...new Set(
      rows.filter((r) => r.isDefault && r.textbook).map((r) => r.textbook!),
    ),
  ];
  const grades = [
    ...new Set(
      rows
        .filter(
          (r) =>
            r.isDefault && r.grade && (!textbook || r.textbook === textbook),
        )
        .map((r) => r.grade!),
    ),
  ].sort((a, b) => a - b);
  const selectedBanks = eduliveBanks.filter(
    (bank) => !grade || bank.grade === Number(grade),
  );
  const importedCount = selectedBanks.reduce(
    (sum, bank) => sum + bank.importedQuestions,
    0,
  );
  const importedLessons = selectedBanks.reduce(
    (sum, bank) => sum + bank.importedLessons,
    0,
  );
  const visible = rows.filter(
    (r) =>
      (scope === "default" ? r.isDefault : !r.isDefault) &&
      (!textbook || scope !== "default" || r.textbook === textbook) &&
      (!grade || scope !== "default" || r.grade === Number(grade)) &&
      (!lesson || r.lesson === lesson) &&
      `${r.body.prompt} ${r.lesson || ""} ${r.textbook || ""}`
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
              setTextbook("");
              setGrade("");
              setLesson("");
            }}
          >
            <option value="default">Kho câu hỏi có sẵn</option>
            <option value="mine">Câu hỏi của tôi</option>
          </select>
        </label>
        {scope === "default" && (
          <label>
            Bộ sách
            <select
              aria-label="Bộ sách"
              value={textbook}
              onChange={(e) => {
                setPage(1);
                setTextbook(e.target.value);
                setGrade("");
                setLesson("");
              }}
            >
              <option value="">Tất cả bộ sách</option>
              {textbooks.map((book) => (
                <option key={book}>{book}</option>
              ))}
            </select>
          </label>
        )}
        {scope === "default" && (
          <label>
            Lớp
            <select
              aria-label="Lớp"
              value={grade}
              onChange={(e) => {
                setPage(1);
                setGrade(e.target.value);
                setLesson("");
              }}
            >
              <option value="">Tất cả lớp</option>
              {grades.map((value) => (
                <option key={value} value={value}>
                  Lớp {value}
                </option>
              ))}
            </select>
          </label>
        )}
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
      {scope === "default" && textbook === "Kết nối tri thức với cuộc sống" && (
        <p>
          Đã nhập {importedCount} câu trắc nghiệm nguyên bản từ{" "}
          {importedLessons} tiết học mở trên Edulive · Toán{" "}
          {grade || "lớp 1, 2, 3"} · Tập 2. Các bài bị khóa, bài cần hình minh
          họa và dạng bài khác chưa có trong kho.
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
                <small>
                  {row.subject} {row.grade} · {row.textbook}
                  {row.volume ? ` · Tập ${row.volume}` : ""} · {row.lesson}
                </small>
              )}
              {row.source && (
                <p>
                  <a href={row.source.url} target="_blank" rel="noreferrer">
                    Nguồn {row.source.provider} · Slide {row.source.slide}
                  </a>
                  {row.source.original && " · Nguyên bản"}
                </p>
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
                {row.body.explanation && <p>{row.body.explanation}</p>}
                {row.body.hint && <p>Gợi ý: {row.body.hint}</p>}
                {row.source && !row.body.explanation && (
                  <p>Nguồn chưa cung cấp lời giải cho câu hỏi này.</p>
                )}
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

import { useEffect, useRef, useState } from "react";
import {
  createGame,
  draftSpecSchema,
  errorsFor,
  newQuestion,
  uid,
  type GameSpec,
  type Question,
} from "./domain/game-spec";
import { reserveQuestions, sampleGame } from "./domain/sample";
import {
  deleteDraft,
  download,
  listDrafts,
  safeName,
  saveDraft,
  type Draft,
} from "./features/library/storage";
import { Player } from "./features/player/Player";
import { Modal } from "./components/Modal";
import { StageDesigner } from "./features/builder/StageDesigner";
import { QuestionPreview } from "./features/builder/QuestionPreview";
import { usedAssetIds, backgroundStyle } from "./domain/appearance";
import { HomeHero } from "./components/HomeHero";

export function App() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"library" | "builder" | "player">("library");
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"questions" | "appearance">(
    "questions",
  );
  const importRef = useRef<HTMLInputElement>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const revision = useRef(0);
  const imageRevision = useRef(0);
  useEffect(() => {
    let alive = true;
    listDrafts()
      .then((items) => {
        if (alive) setDrafts(items);
      })
      .catch((e) => {
        if (alive) setNotice(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  function queueSave(game: GameSpec) {
    const rev = ++revision.current;
    setSaveStatus("Đang lưu…");
    const task = saveQueue.current.catch(() => {}).then(() => saveDraft(game));
    saveQueue.current = task;
    task
      .then(() => {
        if (revision.current === rev) setSaveStatus("Đã lưu trên máy này");
      })
      .catch((e) => {
        setSaveStatus("Lưu thất bại — hãy sao lưu JSON");
        setNotice(e.message);
      });
    return task;
  }
  useEffect(() => {
    if (!spec) return;
    setSaveStatus("Có thay đổi chưa lưu");
    const timer = setTimeout(() => {
      void queueSave(spec);
    }, 400);
    return () => clearTimeout(timer);
  }, [spec]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (spec && saveStatus !== "Đã lưu trên máy này") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [spec, saveStatus]);
  function update(next: GameSpec) {
    setSpec(next);
    setApproved(false);
  }
  function open(game: GameSpec) {
    setSpec(structuredClone(game));
    setStageIndex(0);
    setQuestionId(game.stages[0].questionIds[0] || null);
    setMode("builder");
    setReview(false);
    setApproved(false);
    setNotice("");
    setEditorTab("questions");
  }
  async function goLibrary() {
    try {
      if (spec) await queueSave(spec);
      setDrafts(await listDrafts());
      setMode("library");
      setSpec(null);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function useHomeSample(action: "play" | "export") {
    const game = sampleGame();
    game.id = uid();
    open(game);
    if (action === "play") {
      setPreview(false);
      setMode("player");
    } else {
      setReview(true);
      setExportOpen(true);
    }
  }
  async function startNewGame() {
    try {
      if (spec) await queueSave(spec);
      open(createGame());
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function homeSection(id: string) {
    if (mode !== "library") await goLibrary();
    requestAnimationFrame(() =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30_000_000)
        throw new Error("JSON quá lớn. Giới hạn 30 MB.");
      const result = draftSpecSchema.safeParse(JSON.parse(await file.text()));
      if (!result.success)
        throw new Error(
          `JSON không hợp lệ: ${result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 6)
            .join("; ")}`,
        );
      const game = {
        ...result.data,
        id: uid(),
        title: `${result.data.title.slice(0, 108)} (bản nhập)`,
      };
      await queueSave(game);
      open(game);
      setNotice("Đã nhập thành bản riêng; giữ nguyên ID câu hỏi và đáp án.");
    } catch (e) {
      setNotice((e as Error).message);
    }
    if (importRef.current) importRef.current.value = "";
  }
  function backup() {
    if (spec)
      download(
        new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }),
        `${safeName(spec.title)}.json`,
      );
  }
  const errors = spec ? errorsFor(spec) : [];
  function play(isPreview: boolean) {
    if (errors.length) {
      setReview(true);
      setNotice("Hãy sửa các lỗi trước khi chơi.");
      return;
    }
    setPreview(isPreview);
    setMode("player");
  }
  function editQuestion(patch: Partial<Question>) {
    if (!spec || !questionId) return;
    update({
      ...spec,
      questions: spec.questions.map((q) =>
        q.id === questionId ? { ...q, ...patch } : q,
      ),
    });
  }
  function addQuestion() {
    if (!spec) return;
    const q = newQuestion();
    update({
      ...spec,
      questions: [...spec.questions, q],
      stages: spec.stages.map((s, i) =>
        i === stageIndex ? { ...s, questionIds: [...s.questionIds, q.id] } : s,
      ),
    });
    setQuestionId(q.id);
  }
  function addReserve(question: Question) {
    if (!spec) return;
    const q = { ...structuredClone(question), id: uid() };
    update({
      ...spec,
      questions: [...spec.questions, q],
      stages: spec.stages.map((s, i) =>
        i === stageIndex ? { ...s, questionIds: [...s.questionIds, q.id] } : s,
      ),
    });
    setQuestionId(q.id);
    setReserveOpen(false);
  }
  function moveQuestion(id: string, direction: number) {
    if (!spec) return;
    const ids = [...spec.stages[stageIndex].questionIds];
    const from = ids.indexOf(id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    update({
      ...spec,
      stages: spec.stages.map((s, i) =>
        i === stageIndex ? { ...s, questionIds: ids } : s,
      ),
    });
  }
  async function addImage(file?: File, backgroundStageId?: string) {
    if (!file || !spec || (!questionId && !backgroundStageId)) return;
    const gameId = spec.id,
      targetId = backgroundStageId || questionId!,
      token = ++imageRevision.current;
    try {
      if (!["image/png", "image/jpeg"].includes(file.type))
        throw new Error("Chỉ hỗ trợ ảnh PNG hoặc JPEG.");
      if (file.size > 3_000_000)
        throw new Error("Ảnh vượt 3 MB. Hãy giảm kích thước trước khi tải.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không đọc được ảnh"));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Tệp ảnh bị lỗi"));
        image.src = dataUrl;
      });
      const asset = {
        id: uid(),
        mime: file.type as "image/png" | "image/jpeg",
        dataUrl,
      };
      setSpec((current) => {
        if (
          !current ||
          current.id !== gameId ||
          token !== imageRevision.current ||
          !(backgroundStageId
            ? current.stages.some((s) => s.id === targetId)
            : current.questions.some((q) => q.id === targetId))
        )
          return current;
        const questions = current.questions.map((q) =>
          !backgroundStageId && q.id === targetId
            ? { ...q, imageAssetId: asset.id }
            : q,
        );
        const stages = current.stages.map((s) =>
          backgroundStageId && s.id === targetId
            ? { ...s, backgroundAssetId: asset.id }
            : s,
        );
        const used = usedAssetIds({ ...current, questions, stages });
        return {
          ...current,
          questions,
          stages,
          assets: [...current.assets.filter((a) => used.has(a.id)), asset],
        };
      });
      setApproved(false);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function exportPptx() {
    if (!spec || !approved || busy) return;
    setBusy(true);
    setNotice("Đang dựng PowerPoint…");
    try {
      const { buildPptx } =
        await import("./features/export-pptx/export-service");
      const blob = await buildPptx(spec);
      download(blob, `${safeName(spec.title)}.pptx`);
      setNotice(
        blob.size > 25_000_000
          ? "Đã tạo PowerPoint, tệp vượt mục tiêu 25 MB. Hãy giảm kích thước ảnh."
          : "Đã tạo PowerPoint. Hãy mở trong chế độ trình chiếu để kiểm tra các nút.",
      );
      setExportOpen(false);
    } catch (e) {
      setNotice(`Xuất thất bại: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  const q = spec?.questions.find((q) => q.id === questionId);
  const stage = spec?.stages[stageIndex];
  if (mode === "player" && spec)
    return (
      <Player spec={spec} preview={preview} onExit={() => setMode("builder")} />
    );
  return (
    <>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            void goLibrary();
          }}
        >
          <span className="game-logo">
            <span>Game</span>
            <span>Toán</span>
            <b>3</b>
            <sup>✦</sup>
          </span>
        </button>
        <nav className="home-navigation" aria-label="Điều hướng chính">
          <button
            className={mode === "library" ? "current" : ""}
            onClick={() => {
              void homeSection("home");
            }}
          >
            Trang chủ
          </button>
          <button
            onClick={() => {
              void homeSection("templates");
            }}
          >
            Mẫu trò chơi
          </button>
          <button
            onClick={() => {
              void homeSection("library");
            }}
          >
            Thư viện
          </button>
          <button
            aria-label="Tạo trò chơi"
            className={mode === "builder" ? "current" : ""}
            onClick={() => {
              void startNewGame();
            }}
          >
            Tạo trò chơi
          </button>
          <button onClick={() => setHelpOpen(true)}>Hướng dẫn</button>
        </nav>
        <span className="teacher-badge">
          👩‍🏫{" "}
          <span>
            Giáo viên<small>Lưu trên máy này</small>
          </span>
        </span>
      </header>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void importJson(e.target.files?.[0]);
        }}
      />
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            className="ghost"
            aria-label="Đóng thông báo"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {mode === "library" ? (
        <main className="library-page" id="home">
          <HomeHero
            onCreate={() => {
              void homeSection("templates");
            }}
            onPlay={() => useHomeSample("play")}
            onExport={() => useHomeSample("export")}
          />
          <div className="section-title" id="library">
            <div>
              <h2>Thư viện trò chơi</h2>
              <p>
                Lưu cục bộ trong trình duyệt. Xuất JSON để sao lưu và chuyển
                sang máy khác.
              </p>
            </div>
            <div className="actions">
              <button
                className="secondary"
                onClick={() => importRef.current?.click()}
              >
                Nhập JSON
              </button>
              <span>{drafts.length} bản nháp</span>
            </div>
          </div>
          {loading ? (
            <p>Đang mở thư viện…</p>
          ) : (
            <div className="game-grid">
              <article className="game-card sample" id="templates">
                <span className="card-label">MẪU KHỞI ĐẦU</span>
                <div className="card-art">✦ × ◇</div>
                <h2>Giải cứu vương quốc Toán học</h2>
                <p>Tìm thừa số chưa biết · 12 câu · 4 chặng</p>
                <small>Nội dung mẫu cần giáo viên rà soát.</small>
                <button
                  onClick={() => {
                    const game = sampleGame();
                    game.id = uid();
                    open(game);
                  }}
                >
                  Dùng mẫu này →
                </button>
              </article>
              {[...drafts]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((draft) => (
                  <article className="game-card" key={draft.spec.id}>
                    <span className="card-label">BẢN NHÁP CỦA BẠN</span>
                    <div className="card-art">♧ △ ◇ ♜</div>
                    <h2>{draft.spec.title}</h2>
                    <p>
                      {draft.spec.questions.length} câu ·{" "}
                      {draft.spec.stages.length} chặng
                    </p>
                    <small>
                      Cập nhật{" "}
                      {new Date(draft.updatedAt).toLocaleString("vi-VN")}
                    </small>
                    <button onClick={() => open(draft.spec)}>
                      Mở trình soạn →
                    </button>
                    <div className="card-tools">
                      <button
                        className="ghost"
                        onClick={async () => {
                          try {
                            const copy = {
                              ...structuredClone(draft.spec),
                              id: uid(),
                              title: `${draft.spec.title.slice(0, 108)} (bản sao)`,
                            };
                            await queueSave(copy);
                            setDrafts(await listDrafts());
                          } catch (e) {
                            setNotice((e as Error).message);
                          }
                        }}
                      >
                        Nhân bản
                      </button>
                      <button
                        className="ghost danger"
                        onClick={async () => {
                          if (
                            window.confirm(
                              `Xóa bản nháp “${draft.spec.title}”? Hãy sao lưu JSON nếu cần giữ lại.`,
                            )
                          ) {
                            try {
                              await deleteDraft(draft.spec.id);
                              setDrafts(await listDrafts());
                            } catch (e) {
                              setNotice((e as Error).message);
                            }
                          }
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </main>
      ) : (
        spec &&
        stage && (
          <main className="builder-page">
            <div className="builder-top">
              <div>
                <button
                  className="ghost"
                  onClick={() => {
                    void goLibrary();
                  }}
                >
                  ← Thư viện
                </button>
                <h1>Thiết kế hành trình</h1>
                <span className="save-status" role="status">
                  {saveStatus}
                </span>
              </div>
              <div className="actions">
                <button className="secondary" onClick={backup}>
                  Sao lưu JSON
                </button>
                <button className="secondary" onClick={() => play(true)}>
                  Xem trước
                </button>
                <button
                  onClick={() => {
                    setReview(true);
                    setExportOpen(true);
                    setApproved(false);
                  }}
                >
                  Kiểm tra & xuất
                </button>
              </div>
            </div>
            <section className="settings">
              <label>
                Tên trò chơi
                <input
                  value={spec.title}
                  maxLength={120}
                  onChange={(e) => update({ ...spec, title: e.target.value })}
                />
              </label>
              <label>
                Lời mở đầu
                <textarea
                  rows={2}
                  value={spec.description}
                  maxLength={600}
                  onChange={(e) =>
                    update({ ...spec, description: e.target.value })
                  }
                />
              </label>
              <label>
                Thời gian / câu
                <select
                  value={spec.config.timerSeconds}
                  onChange={(e) =>
                    update({
                      ...spec,
                      config: {
                        ...spec.config,
                        timerSeconds: Number(e.target.value),
                      },
                    })
                  }
                >
                  {[0, 30, 45, 60, 90, 120, 180, 300].map((n) => (
                    <option key={n} value={n}>
                      {n ? `${n} giây` : "Tắt đồng hồ"}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <nav className="builder-tabs" aria-label="Các bước thiết kế">
              <button
                className={editorTab === "questions" ? "active" : ""}
                aria-pressed={editorTab === "questions"}
                onClick={() => setEditorTab("questions")}
              >
                <span>1</span>✏️ Soạn câu hỏi
              </button>
              <button
                className={editorTab === "appearance" ? "active" : ""}
                aria-pressed={editorTab === "appearance"}
                onClick={() => setEditorTab("appearance")}
              >
                <span>2</span>🎨 Nền & nhân vật
              </button>
              <button onClick={() => play(true)}>
                <span>3</span>🎮 Chơi thử
              </button>
            </nav>
            {editorTab === "appearance" ? (
              <StageDesigner
                spec={spec}
                index={stageIndex}
                onSelect={(i) => {
                  setStageIndex(i);
                  setQuestionId(spec.stages[i].questionIds[0] || null);
                }}
                onChange={update}
                onUpload={(id, file) => {
                  void addImage(file, id);
                }}
              />
            ) : (
              <div className="editor-grid">
                <aside className="stages-panel">
                  <h2>Bản đồ 4 chặng</h2>
                  {spec.stages.map((s, i) => (
                    <div
                      key={s.id}
                      className={`stage-item ${stageIndex === i ? "selected" : ""}`}
                    >
                      <button
                        className="stage-select"
                        onClick={() => {
                          setStageIndex(i);
                          setQuestionId(s.questionIds[0] || null);
                        }}
                      >
                        <span
                          className="stage-mini-cover"
                          style={backgroundStyle(spec, i)}
                        >
                          {["🌳", "🏞️", "💎", "🏰"][i]}
                        </span>
                        <span>
                          Chặng {i + 1}
                          <strong>{s.title}</strong>
                          <small>{s.questionIds.length} câu hỏi</small>
                        </span>
                      </button>
                      <div className="stage-tools">
                        <button
                          className="ghost"
                          disabled={i === 0}
                          aria-label={`Chuyển chặng ${i + 1} lên`}
                          onClick={() => {
                            const stages = [...spec.stages];
                            [stages[i - 1], stages[i]] = [
                              stages[i],
                              stages[i - 1],
                            ];
                            update({ ...spec, stages });
                            setStageIndex(i - 1);
                            setQuestionId(s.questionIds[0] || null);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="ghost"
                          disabled={i === 3}
                          aria-label={`Chuyển chặng ${i + 1} xuống`}
                          onClick={() => {
                            const stages = [...spec.stages];
                            [stages[i + 1], stages[i]] = [
                              stages[i],
                              stages[i + 1],
                            ];
                            update({ ...spec, stages });
                            setStageIndex(i + 1);
                            setQuestionId(s.questionIds[0] || null);
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="muted">
                    Mỗi chặng cần ít nhất một câu. Chấm điểm Web: 10 / 5.
                  </p>
                </aside>
                <section className="questions-panel">
                  <label>
                    Tên chặng
                    <input
                      value={stage.title}
                      maxLength={70}
                      onChange={(e) =>
                        update({
                          ...spec,
                          stages: spec.stages.map((s, i) =>
                            i === stageIndex
                              ? { ...s, title: e.target.value }
                              : s,
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="panel-title">
                    <h2>Câu hỏi ({stage.questionIds.length})</h2>
                    <button className="small" onClick={addQuestion}>
                      ＋ Thêm
                    </button>
                  </div>
                  {stage.questionIds.length === 0 && (
                    <p className="empty">
                      Thêm câu hỏi đầu tiên cho chặng này.
                    </p>
                  )}
                  {stage.questionIds.map((id, i) => {
                    const item = spec.questions.find((q) => q.id === id)!;
                    return (
                      <div
                        key={id}
                        className={`question-item ${questionId === id ? "selected" : ""}`}
                      >
                        <button
                          className="question-select"
                          onClick={() => setQuestionId(id)}
                        >
                          <span className="number">{i + 1}</span>
                          <span>
                            {item.prompt || "Câu hỏi chưa có nội dung"}
                          </span>
                        </button>
                        <div className="question-tools">
                          <button
                            className="ghost"
                            aria-label={`Chuyển câu ${i + 1} lên`}
                            disabled={i === 0}
                            onClick={() => moveQuestion(id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            className="ghost"
                            aria-label={`Chuyển câu ${i + 1} xuống`}
                            disabled={i === stage.questionIds.length - 1}
                            onClick={() => moveQuestion(id, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </section>
                <section className="form-panel">
                  {q ? (
                    <>
                      <div className="panel-title">
                        <h2>Biên tập câu hỏi</h2>
                        <button
                          className="ghost danger"
                          onClick={() => {
                            if (!window.confirm("Xóa câu hỏi này?")) return;
                            const questions = spec.questions.filter(
                              (item) => item.id !== q.id,
                            );
                            update({
                              ...spec,
                              questions,
                              assets: spec.assets.filter((a) =>
                                usedAssetIds({ ...spec, questions }).has(a.id),
                              ),
                              stages: spec.stages.map((s) => ({
                                ...s,
                                questionIds: s.questionIds.filter(
                                  (id) => id !== q.id,
                                ),
                              })),
                            });
                            setQuestionId(
                              stage.questionIds.find((id) => id !== q.id) ||
                                null,
                            );
                          }}
                        >
                          Xóa câu
                        </button>
                      </div>
                      <QuestionPreview
                        spec={spec}
                        question={q}
                        index={stageIndex}
                      />
                      <label>
                        Đề bài
                        <textarea
                          rows={3}
                          value={q.prompt}
                          maxLength={400}
                          onChange={(e) =>
                            editQuestion({ prompt: e.target.value })
                          }
                        />
                      </label>
                      <fieldset>
                        <legend>4 phương án · Chọn đáp án đúng</legend>
                        {q.choices.map((choice, i) => (
                          <div className="answer-row" key={choice.id}>
                            <input
                              type="radio"
                              name="correct-answer"
                              aria-label={`Đáp án ${["A", "B", "C", "D"][i]} đúng`}
                              checked={q.correctChoiceId === choice.id}
                              onChange={() =>
                                editQuestion({ correctChoiceId: choice.id })
                              }
                            />
                            <label className="answer-label">
                              {["A", "B", "C", "D"][i]}
                              <input
                                value={choice.text}
                                maxLength={180}
                                aria-label={`Nội dung đáp án ${["A", "B", "C", "D"][i]}`}
                                onChange={(e) =>
                                  editQuestion({
                                    choices: q.choices.map((c) =>
                                      c.id === choice.id
                                        ? { ...c, text: e.target.value }
                                        : c,
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </fieldset>
                      <label>
                        Gợi ý khi trả lời sai
                        <textarea
                          rows={2}
                          value={q.hint}
                          maxLength={300}
                          onChange={(e) =>
                            editQuestion({ hint: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Lời giải thích
                        <textarea
                          rows={2}
                          value={q.explanation || ""}
                          maxLength={500}
                          onChange={(e) =>
                            editQuestion({ explanation: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Chuyển câu sang chặng
                        <select
                          value={stageIndex}
                          onChange={(e) => {
                            const destination = Number(e.target.value);
                            update({
                              ...spec,
                              stages: spec.stages.map((s, i) => ({
                                ...s,
                                questionIds:
                                  i === destination
                                    ? [...s.questionIds, q.id]
                                    : s.questionIds.filter((id) => id !== q.id),
                              })),
                            });
                            setStageIndex(destination);
                          }}
                        >
                          {spec.stages.map((s, i) => (
                            <option key={s.id} value={i}>
                              {i + 1}. {s.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Ảnh minh họa · PNG/JPEG ≤ 3 MB
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          onChange={(e) => {
                            void addImage(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {q.imageAssetId && (
                        <div className="image-preview">
                          <img
                            src={
                              spec.assets.find((a) => a.id === q.imageAssetId)
                                ?.dataUrl
                            }
                            alt="Ảnh đã chọn"
                          />
                          <button
                            className="ghost"
                            onClick={() => {
                              const questions = spec.questions.map((item) =>
                                item.id === q.id
                                  ? { ...item, imageAssetId: undefined }
                                  : item,
                              );
                              update({
                                ...spec,
                                questions,
                                assets: spec.assets.filter((a) =>
                                  usedAssetIds({ ...spec, questions }).has(
                                    a.id,
                                  ),
                                ),
                              });
                            }}
                          >
                            Gỡ ảnh
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty">
                      <span>✎</span>
                      <h2>Chọn hoặc thêm câu hỏi</h2>
                      <p>Soạn đề bài, bốn phương án và gợi ý cho học sinh.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
            {review && (
              <section
                className={`review-panel ${errors.length ? "has-errors" : ""}`}
              >
                <h2>
                  {errors.length
                    ? `${errors.length} mục cần sửa`
                    : "✓ Kịch bản hợp lệ"}
                </h2>
                {errors.length ? (
                  <ul>
                    {errors.map((error, i) => (
                      <li key={i}>
                        <button
                          className="ghost"
                          onClick={() => {
                            const key = error.path[0];
                            const index = Number(error.path[1]);
                            if (key === "questions" && spec.questions[index]) {
                              const id = spec.questions[index].id;
                              const stage = spec.stages.findIndex((s) =>
                                s.questionIds.includes(id),
                              );
                              setStageIndex(Math.max(0, stage));
                              setQuestionId(id);
                            } else if (key === "stages" && spec.stages[index]) {
                              setStageIndex(index);
                              setQuestionId(
                                spec.stages[index].questionIds[0] || null,
                              );
                            }
                            document
                              .querySelector(".editor-grid")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {error.path[0] === "questions"
                            ? `Câu ${Number(error.path[1]) + 1}`
                            : error.path[0] === "stages"
                              ? `Chặng ${Number(error.path[1]) + 1}`
                              : "Kịch bản"}
                          : {error.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {spec.questions.length} câu · 4 chặng · Sẵn sàng xem trước
                    và xuất.
                  </p>
                )}
              </section>
            )}
          </main>
        )
      )}
      {exportOpen && spec && (
        <Modal
          titleId="export-title"
          onClose={() => {
            if (!busy) setExportOpen(false);
          }}
        >
          <div className="panel-title">
            <h2 id="export-title">Chọn cách tổ chức trò chơi</h2>
            <button
              className="ghost"
              aria-label="Đóng"
              disabled={busy}
              onClick={() => setExportOpen(false)}
            >
              ×
            </button>
          </div>
          {errors.length ? (
            <>
              <p className="error-text">
                Còn {errors.length} lỗi. Hãy sửa trong mục kiểm tra bên dưới
                trình soạn.
              </p>
              <button onClick={() => setExportOpen(false)}>Quay lại sửa</button>
            </>
          ) : (
            <>
              <p>
                Web tự tính điểm và đếm giờ. PowerPoint có nút đáp án, gợi ý,
                thử lại và chuyển chặng; giáo viên quản lý điểm và thời gian thủ
                công.
              </p>
              <p>
                File 16:9, khoảng {8 + spec.questions.length * 3} slide. Chữ có
                thể chỉnh sửa và ảnh được nhúng để dùng offline.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                Tôi đã rà soát câu hỏi, đáp án và quyền sử dụng hình ảnh.
              </label>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setExportOpen(false);
                    play(false);
                  }}
                >
                  Chơi Web
                </button>
                <button
                  disabled={!approved || busy}
                  onClick={() => {
                    void exportPptx();
                  }}
                >
                  {busy ? "Đang xuất…" : "Tải PowerPoint"}
                </button>
              </div>
              <small>
                Kiểm tra trên PowerPoint Desktop của trường trước giờ dạy. Không
                có macro; âm thanh Web không được xuất.
              </small>
            </>
          )}
        </Modal>
      )}
      {mode === "builder" && (
        <div className="reserve-action">
          <button className="secondary" onClick={() => setReserveOpen(true)}>
            ＋ Chọn từ 8 câu dự phòng
          </button>
          <small>
            Nội dung ôn tập tự biên soạn, định hướng Cánh Diều — cần giáo viên
            duyệt.
          </small>
        </div>
      )}
      {reserveOpen && (
        <Modal titleId="reserve-title" onClose={() => setReserveOpen(false)}>
          <div className="panel-title">
            <h2 id="reserve-title">8 câu hỏi dự phòng</h2>
            <button
              className="ghost"
              aria-label="Đóng câu dự phòng"
              onClick={() => setReserveOpen(false)}
            >
              ×
            </button>
          </div>
          <p>
            Chọn một câu để thêm vào chặng đang mở. Bạn có thể sửa lại câu và
            đáp án.
          </p>
          {reserveQuestions().map((q) => (
            <button
              key={q.id}
              className="reserve-choice secondary"
              onClick={() => addReserve(q)}
            >
              {q.prompt}
            </button>
          ))}
        </Modal>
      )}
      {helpOpen && (
        <Modal titleId="help-title" onClose={() => setHelpOpen(false)}>
          <h2 id="help-title">Cùng tạo một tiết học thật vui!</h2>
          <ol className="help-steps">
            <li>
              <b>Chọn mẫu hoặc tạo mới.</b> Trò chơi có 4 chặng; bạn đặt tên và
              sửa nội dung theo tiết học.
            </li>
            <li>
              <b>Soạn câu hỏi.</b> Điền 4 phương án, chọn đáp án đúng và viết
              gợi ý. Dùng “Xem nhanh” để kiểm tra.
            </li>
            <li>
              <b>Chọn nền và nhân vật.</b> Mở “Nền & nhân vật”, chọn phong cảnh
              hoặc tải ảnh ngang của bạn.
            </li>
            <li>
              <b>Chơi thử.</b> Có đồng hồ, bảng điểm 4 đội và nhân vật dẫn
              chuyện. Giọng đọc phụ thuộc giọng tiếng Việt có trên máy.
            </li>
            <li>
              <b>Xuất PowerPoint.</b> Rà soát học liệu, xác nhận rồi tải file.
              Điểm và thời gian trong PowerPoint do giáo viên quản lý.
            </li>
          </ol>
          <p>Nhớ sao lưu JSON để giữ bài của bạn và mang sang máy khác.</p>
          <button onClick={() => setHelpOpen(false)}>Mình hiểu rồi</button>
        </Modal>
      )}
      <footer>
        Hành trình Toán học lớp 3 · Dữ liệu lưu trên trình duyệt này · Nhớ sao
        lưu JSON
      </footer>
    </>
  );
}

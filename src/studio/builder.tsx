import { defaultGameTheme } from "./game-theme";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createStudioGame,
  playableErrors,
  questionsOf,
  studioSpecSchema,
  templateRegistry,
  templateTypes,
  type Mcq,
  type StudioSpec,
  type TemplateType,
} from "../domain/studio-spec";
import { api } from "./client";
import { Media, type Asset, type GameRow } from "./StudioApp";
import { download, listDrafts, type Draft } from "../features/library/storage";
import { migrateLegacy } from "../domain/studio-migration";
import { JourneyPlayer } from "./JourneyPlayer";
import { PicturePlayer } from "./PicturePlayer";
import { WheelPlayer } from "./WheelPlayer";
import { uploadAsset } from "./uploads";
import { QuestionBank } from "./QuestionBank";
import { GamePlayer } from "./GamePlayer";
import { PlayerOverlay } from "./PlayerOverlay";
import { useCatalog } from "./useCatalog";
import { BuilderPreview } from "./BuilderPreview";
import { QuestionEditor } from "./QuestionEditor";
import "./simple-builder.css";

const steps = ["Bắt đầu", "Câu hỏi", "Tùy chỉnh", "Hoàn tất"];
const stepHelp = [
  "Chọn mẫu và đặt tên bài. Các mục khác đã có sẵn để bạn bắt đầu nhanh.",
  "Soạn từng câu và chọn đáp án đúng. Với Hành trình, mỗi chặng cần ít nhất một câu. Bạn có thể thêm hoặc xóa chặng.",
  "Chọn cách chơi và người tham gia. Có thể giữ nguyên các thiết lập còn lại.",
  "Kiểm tra bài, chơi thử rồi sử dụng trên Web hoặc xuất PowerPoint.",
];
const newQuestion = (): Mcq => ({
  id: crypto.randomUUID(),
  prompt: "",
  choices: ["", "", "", ""],
  correct: 0,
  hint: "",
  explanation: "",
});
export function Builder() {
  const { subjects, enabledTemplates } = useCatalog();
  const { id } = useParams(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [spec, setSpec] = useState<StudioSpec | null>(null),
    [revision, setRevision] = useState(0),
    [step, setStep] = useState(0),
    [stage, setStage] = useState(0),
    [activeQuestion, setActiveQuestion] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [mediaTarget, setMediaTarget] = useState("backgroundId"),
    [selected, setSelected] = useState<Asset | null>(null);
  const saving = useRef(false),
    savedHash = useRef(""),
    latest = useRef(spec);
  latest.current = spec;
  const [playing, setPlaying] = useState(false),
    [exporting, setExporting] = useState(false);
  const [legacyDrafts, setLegacyDrafts] = useState<Draft[]>([]);
  const [crop, setCrop] = useState({
      fit: "cover" as "cover" | "contain",
      x: 50,
      y: 50,
      zoom: 1,
      opacity: 1,
      aspect: "16:9" as "16:9" | "4:5" | "1:1",
    }),
    [cropBusy, setCropBusy] = useState(false),
    [mediaRevision, setMediaRevision] = useState(0);
  function assignAsset(s: StudioSpec, assetId: string) {
    if (mediaTarget === "imageId" && s.kind === "picture_reveal")
      s.content.imageId = assetId;
    else if (mediaTarget.startsWith("stage:") && s.kind === "journey")
      s.content.stages[Number(mediaTarget.split(":")[1])].backgroundId =
        assetId;
    else if (mediaTarget.startsWith("question:")) {
      const q = questionsOf(s).find((q) => q.id === mediaTarget.slice(9));
      if (q) q.imageId = assetId;
    } else if (mediaTarget === "backgroundId" || mediaTarget === "characterId")
      s.media[mediaTarget] = assetId;
  }
  async function saveCrop() {
    if (!selected) return;
    setCropBusy(true);
    setMessage("Đang cắt và lưu bản sao ảnh…");
    try {
      const job = await api<{ id: string }>(`/assets/${selected.id}/crop`, {
        method: "POST",
        body: JSON.stringify({ key: crypto.randomUUID(), crop }),
      });
      for (let i = 0; i < 80; i++) {
        const state = await api<{
          status: string;
          error?: string;
          result?: { assetId: string };
        }>(`/jobs/${job.id}`);
        if (state.status === "failed") throw new Error(state.error);
        if (state.status === "completed") {
          const id = state.result!.assetId;
          setSpec((current) => {
            if (!current) return current;
            const next = structuredClone(current);
            assignAsset(next, id);
            if (
              mediaTarget === "backgroundId" ||
              mediaTarget.startsWith("stage:")
            )
              Object.assign(next.media, {
                fit: "cover",
                x: 50,
                y: 50,
                zoom: 1,
                opacity: 1,
              });
            return next;
          });
          setSelected(
            (await api<Asset[]>("/assets")).find((a) => a.id === id) || null,
          );
          setCrop({ ...crop, x: 50, y: 50, zoom: 1, opacity: 1 });
          setMediaRevision((v) => v + 1);
          setMessage(
            "Đã tạo ảnh mới và dùng trong bài. Ảnh gốc được giữ nguyên.",
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      throw new Error("Ảnh còn xử lý. Kiểm tra lại trong thư viện ảnh.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setCropBusy(false);
    }
  }
  useEffect(() => {
    setSpec(null);
    setRevision(0);
    setMessage("");
    setConflict(false);
    if (id === "new") {
      const requested = params.get("template") as TemplateType;
      const s = createStudioGame(
        templateTypes.includes(requested) ? requested : "journey",
      );
      if (params.get("subject")) s.metadata.subjectId = params.get("subject")!;
      if ([1, 2, 3, 4, 5].includes(Number(params.get("grade"))))
        s.metadata.grade = Number(params.get("grade"));
      setSpec(s);
    } else
      void api<GameRow>(`/games/${id}`)
        .then((row) => {
          const parsed = studioSpecSchema.parse(row.spec);
          savedHash.current = JSON.stringify(parsed);
          setSpec(parsed);
          setRevision(row.revision);
        })
        .catch((e) => setMessage(e.message));
  }, [id]);
  async function save(copy = false) {
    if (!spec || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    const snapshot = copy
      ? {
          ...spec,
          id: crypto.randomUUID(),
          metadata: {
            ...spec.metadata,
            title: `${spec.metadata.title} (bản sao)`.slice(0, 120),
          },
        }
      : spec;
    try {
      const row = await api<GameRow>(`/games/${snapshot.id}`, {
        method: "PUT",
        body: JSON.stringify({ spec: snapshot, revision: copy ? 0 : revision }),
      });
      savedHash.current = JSON.stringify(snapshot);
      setRevision(row.revision);
      setConflict(false);
      setMessage("Đã lưu bản nháp.");
      if (copy || row.id !== id)
        navigate(`/builder/${row.id}`, { replace: true });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được.");
      if ((e as { status: number }).status === 409) setConflict(true);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  // Save incomplete drafts after edits. Never retry a revision conflict automatically.
  useEffect(() => {
    if (
      !spec ||
      !revision ||
      conflict ||
      savedHash.current === JSON.stringify(spec)
    )
      return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [spec, revision, conflict]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saving.current) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function edit(change: (draft: StudioSpec) => void) {
    if (!spec) return;
    const next = structuredClone(spec);
    change(next);
    setSpec(next);
  }
  async function changeTemplate(type: TemplateType) {
    if (!spec || spec.kind === type) return;
    if (
      revision > 0 ||
      spec.metadata.title !== "Trò chơi mới" ||
      spec.metadata.description.trim() ||
      spec.media.backgroundId ||
      spec.media.characterId ||
      questionsOf(spec).length ||
      (spec.kind === "word_wheel" && spec.content.phrase)
    ) {
      if (saving.current) return;
      saving.current = true;
      setBusy(true);
      try {
        const row = await api<GameRow>(`/games/${spec.id}`, {
          method: "PUT",
          body: JSON.stringify({ spec, revision }),
        });
        setRevision(row.revision);
        const next = createStudioGame(type);
        next.metadata = { ...spec.metadata };
        const created = await api<GameRow>(`/games/${next.id}`, {
          method: "PUT",
          body: JSON.stringify({ spec: next, revision: 0 }),
        });
        navigate(`/builder/${created.id}`);
        setMessage("Đã giữ nguyên bản cũ và tạo bản nháp với mẫu mới.");
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        saving.current = false;
        setBusy(false);
      }
    } else {
      const next = createStudioGame(type);
      next.id = revision ? crypto.randomUUID() : spec.id;
      next.metadata = { ...spec.metadata };
      setRevision(0);
      setSpec(next);
    }
  }
  function updateQuestion(index: number, patch: Partial<Mcq>) {
    edit((s) => {
      const q =
        s.kind === "journey"
          ? s.content.stages[stage].questions
          : s.kind === "picture_reveal"
            ? s.content.questions
            : [];
      q[index] = { ...q[index], ...patch };
    });
  }
  async function importJson(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      if (raw.schemaVersion === "1.0") {
        const converted = await migrateLegacy(raw, async (dataUrl) => {
          if (!/^data:image\/(png|jpeg);base64,/.test(dataUrl))
            throw new Error("Ảnh nhúng không hợp lệ.");
          const response = await fetch(dataUrl),
            blob = await response.blob();
          return uploadAsset(
            new File([blob], "anh-bai-cu", { type: blob.type }),
            setMessage,
          );
        });
        setSpec(converted);
        setRevision(0);
        setMessage(
          "Đã chuyển cấu trúc bài cũ. Bấm Lưu nháp để lưu vào tài khoản.",
        );
      } else {
        const imported = studioSpecSchema.parse(raw);
        imported.id = crypto.randomUUID();
        setSpec(imported);
        setRevision(0);
        setMessage(
          "Đã đọc JSON. Máy chủ sẽ kiểm tra quyền ảnh khi lưu; ảnh tài khoản khác cần được thay thế.",
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  if (!spec) return <div role="status">{message || "Đang mở bản nháp…"}</div>;
  if (playing)
    return (
      <PlayerOverlay onExit={() => setPlaying(false)}>
        <GamePlayer
          spec={spec}
          onExit={() => setPlaying(false)}
          record={revision > 0}
        />
      </PlayerOverlay>
    );
  const currentQuestions =
    spec.kind === "journey"
      ? spec.content.stages[stage].questions
      : spec.kind === "picture_reveal"
        ? spec.content.questions
        : [];
  const errors = playableErrors(spec);
  async function exportGame() {
    if (!spec) return;
    setExporting(true);
    setMessage("");
    try {
      const job = await api<{ id: string }>("/exports", {
        method: "POST",
        body: JSON.stringify({ spec, key: crypto.randomUUID() }),
      });
      for (let i = 0; i < 80; i++) {
        const status = await api<{ status: string; error?: string }>(
          `/jobs/${job.id}`,
        );
        if (status.status === "failed") throw new Error(status.error);
        if (status.status === "completed") {
          const file = await api<{ signedUrl: string }>(
            `/exports/${job.id}/download`,
          );
          window.location.assign(file.signedUrl);
          setMessage(
            "File đã sẵn sàng. Cần mở và kiểm tra offline trên PowerPoint trước khi dạy.",
          );
          return;
        }
        setMessage("Worker đang tạo PowerPoint…");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setMessage("Job vẫn đang xử lý. Theo dõi trong Lịch sử xuất.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="eg-title">
        <h1>{spec.metadata.title || "Trò chơi mới"}</h1>
        <div className="eg-actions">
          <button disabled={busy} onClick={() => void save()}>
            Lưu nháp
          </button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(spec, null, 2)], {
                  type: "application/json",
                }),
                "edugame-backup.json",
              )
            }
          >
            Sao lưu JSON
          </button>
          <button
            disabled={!revision || busy}
            onClick={() =>
              void api(`/games/${spec.id}`, {
                method: "DELETE",
                body: JSON.stringify({ revision }),
              })
                .then(() => navigate("/dashboard"))
                .catch((e) => setMessage(e.message))
            }
          >
            Lưu trữ bài
          </button>
        </div>
      </div>
      <p role="status">{busy ? "Đang lưu…" : message}</p>
      {conflict && (
        <div className="eg-card" role="alert">
          <p>Bản local được giữ trong trình chỉnh sửa này. Chọn cách xử lý:</p>
          <button onClick={() => void save(true)}>
            Lưu local thành bản sao
          </button>
          <button onClick={() => window.location.reload()}>
            Tải bản mới từ máy chủ
          </button>
        </div>
      )}
      <div className="eg-wizard eg-builder-workbench">
        <nav aria-label="Các bước thiết kế">
          {steps.map((name, i) => (
            <button
              key={name}
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <b>{i + 1}</b> {name}
            </button>
          ))}
        </nav>
        <section className="eg-card eg-step">
          <fieldset className="eg-edit-fields" disabled={busy || cropBusy}>
            <h2>
              {step + 1}. {steps[step]}
            </h2>
            <p className="simple-step-help">{stepHelp[step]}</p>
            {step === 0 && (
              <div className="eg-template-options">
                {templateTypes.map((type) => (
                  <button
                    className="eg-card eg-template-option"
                    key={type}
                    disabled={busy || !enabledTemplates.includes(type)}
                    aria-pressed={spec.kind === type}
                    onClick={() => void changeTemplate(type)}
                  >
                    <img
                      className="eg-asset"
                      src={templateRegistry[type].image}
                      alt=""
                    />
                    <span className="eg-template-option-copy">
                      <strong>{templateRegistry[type].name}</strong>
                      <small>
                        {templateRegistry[type].released
                          ? "Phiên bản 1 · Web và PowerPoint"
                          : "Sắp ra mắt"}
                      </small>
                      <span className="eg-template-option-state">
                        {spec.kind === type
                          ? "✓ Đang chọn"
                          : enabledTemplates.includes(type)
                            ? "Chọn mẫu →"
                            : "Chưa khả dụng"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 0 && (
              <>
                <label>
                  Tên trò chơi
                  <input
                    maxLength={120}
                    placeholder="Ví dụ: Ôn tập bảng nhân 3"
                    onFocus={(e) => {
                      if (e.target.value === "Trò chơi mới") e.target.select();
                    }}
                    value={spec.metadata.title}
                    onChange={(e) =>
                      edit((s) => {
                        s.metadata.title = e.target.value;
                      })
                    }
                  />
                </label>
                <details className="simple-optional">
                  <summary>
                    Thêm mô tả <span>Không bắt buộc</span>
                  </summary>
                  <label>
                    Mô tả
                    <textarea
                      maxLength={600}
                      value={spec.metadata.description}
                      onChange={(e) =>
                        edit((s) => {
                          s.metadata.description = e.target.value;
                        })
                      }
                    />
                  </label>
                </details>
                <div className="eg-grid">
                  <label>
                    Môn học
                    <select
                      value={spec.metadata.subjectId}
                      onChange={(e) =>
                        edit((s) => {
                          s.metadata.subjectId = e.target.value;
                        })
                      }
                    >
                      {Object.entries(subjects).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Khối
                    <select
                      value={spec.metadata.grade}
                      onChange={(e) =>
                        edit((s) => {
                          s.metadata.grade = Number(e.target.value);
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <details className="simple-optional">
                  <summary>Nhập bài có sẵn / chuyển bài cũ</summary>
                  <label>
                    Nhập JSON mới / bài cũ
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void importJson(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    onClick={() =>
                      void listDrafts()
                        .then((rows) => {
                          download(
                            new Blob([JSON.stringify(rows, null, 2)], {
                              type: "application/json",
                            }),
                            "kho-bai-cu-backup.json",
                          );
                          setMessage(
                            `Đã sao lưu ${rows.length} bài cũ. Dữ liệu gốc vẫn được giữ.`,
                          );
                        })
                        .catch((e) => setMessage(e.message))
                    }
                  >
                    Sao lưu kho bài cũ trong trình duyệt
                  </button>
                  <button
                    onClick={() =>
                      void listDrafts()
                        .then((rows) => {
                          setLegacyDrafts(rows);
                          if (!rows.length)
                            setMessage(
                              "Không có bài cũ trong trình duyệt này.",
                            );
                        })
                        .catch((e) => setMessage(e.message))
                    }
                  >
                    Nhập từ kho bài cũ
                  </button>
                  {legacyDrafts.length > 0 && (
                    <div className="eg-card">
                      <p>
                        Nên sao lưu trước khi chuyển. Bản gốc trong trình duyệt
                        luôn được giữ nguyên.
                      </p>
                      {legacyDrafts.map((draft) => (
                        <div className="eg-title" key={draft.spec.id}>
                          <span>{draft.spec.title}</span>
                          <button
                            onClick={() =>
                              void importJson(
                                new File(
                                  [JSON.stringify(draft.spec)],
                                  "bai-cu.json",
                                  { type: "application/json" },
                                ),
                              )
                            }
                          >
                            Tạo bản sao vào tài khoản
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </>
            )}
            {step === 1 && (
              <>
                {spec.kind === "journey" && (
                  <>
                    <div className="eg-tabs">
                      {spec.content.stages.map((s, i) => (
                        <button
                          key={s.id}
                          aria-pressed={stage === i}
                          onClick={() => setStage(i)}
                        >
                          Chặng {i + 1}
                        </button>
                      ))}
                    </div>
                    <div
                      className="eg-actions"
                      style={{ margin: "12px 0", flexWrap: "wrap" }}
                    >
                      <button
                        disabled={spec.content.stages.length >= 12}
                        onClick={() => {
                          const next = spec.content.stages.length;
                          edit((s) => {
                            if (s.kind === "journey")
                              s.content.stages.push({
                                id: crypto.randomUUID(),
                                title: "Chặng mới",
                                multiplier: 1,
                                questions: [],
                              });
                          });
                          setStage(next);
                        }}
                      >
                        ＋ Thêm chặng
                      </button>
                      <button
                        disabled={spec.content.stages.length <= 1}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Xóa chặng này và các câu hỏi trong chặng?",
                            )
                          )
                            return;
                          const next = Math.max(0, stage - 1);
                          edit((s) => {
                            if (s.kind === "journey")
                              s.content.stages.splice(stage, 1);
                          });
                          setStage(next);
                          setMediaTarget("backgroundId");
                          setActiveQuestion("");
                        }}
                      >
                        Xóa chặng hiện tại
                      </button>
                      <small>
                        {spec.content.stages.length}/12 chặng · Tối thiểu 1
                        chặng
                      </small>
                    </div>
                    <details className="simple-optional">
                      <summary>Đổi tên chặng</summary>
                      <label>
                        Tên chặng
                        <input
                          value={spec.content.stages[stage].title}
                          onChange={(e) =>
                            edit((s) => {
                              if (s.kind === "journey")
                                s.content.stages[stage].title = e.target.value;
                            })
                          }
                        />
                      </label>
                    </details>
                  </>
                )}
                {spec.kind === "picture_reveal" && (
                  <>
                    <label>
                      Số ô
                      <select
                        value={spec.content.size}
                        onChange={(e) =>
                          edit((s) => {
                            if (s.kind === "picture_reveal")
                              s.content.size = Number(e.target.value) as
                                4 | 6 | 9;
                          })
                        }
                      >
                        {[4, 6, 9].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Đáp án tranh
                      <input
                        value={spec.content.answer}
                        onChange={(e) =>
                          edit((s) => {
                            if (s.kind === "picture_reveal")
                              s.content.answer = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={spec.content.earlyGuess}
                        onChange={(e) =>
                          edit((s) => {
                            if (s.kind === "picture_reveal")
                              s.content.earlyGuess = e.target.checked;
                          })
                        }
                      />
                      Cho phép đoán sớm
                    </label>
                  </>
                )}
                {spec.kind === "word_wheel" ? (
                  <>
                    <label>
                      Cụm từ bí mật
                      <input
                        maxLength={80}
                        value={spec.content.phrase}
                        onChange={(e) =>
                          edit((s) => {
                            if (s.kind === "word_wheel")
                              s.content.phrase = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Gợi ý
                      <textarea
                        value={spec.content.clue}
                        onChange={(e) =>
                          edit((s) => {
                            if (s.kind === "word_wheel")
                              s.content.clue = e.target.value;
                          })
                        }
                      />
                    </label>
                    <p>
                      Vòng quay: 10 · 20 · 30 · 40 · 10 · 20 · 30 · Mất lượt.
                    </p>
                  </>
                ) : (
                  <>
                    <QuestionEditor
                      active={activeQuestion}
                      onActive={setActiveQuestion}
                      questions={currentQuestions}
                      max={
                        spec.kind === "journey"
                          ? 12
                          : spec.kind === "picture_reveal"
                            ? spec.content.size
                            : 0
                      }
                      onUpdate={updateQuestion}
                      onAdd={() =>
                        edit((s) => {
                          (s.kind === "journey"
                            ? s.content.stages[stage].questions
                            : s.kind === "picture_reveal"
                              ? s.content.questions
                              : []
                          ).push(newQuestion());
                        })
                      }
                      onRemove={(i) =>
                        edit((s) => {
                          (s.kind === "journey"
                            ? s.content.stages[stage].questions
                            : s.kind === "picture_reveal"
                              ? s.content.questions
                              : []
                          ).splice(i, 1);
                        })
                      }
                      onDuplicate={(i) =>
                        edit((s) => {
                          const qs =
                            s.kind === "journey"
                              ? s.content.stages[stage].questions
                              : s.kind === "picture_reveal"
                                ? s.content.questions
                                : [];
                          if (
                            qs.length <
                            (s.kind === "journey"
                              ? 12
                              : s.kind === "picture_reveal"
                                ? s.content.size
                                : 0)
                          )
                            qs.splice(i + 1, 0, {
                              ...structuredClone(qs[i]),
                              id: crypto.randomUUID(),
                            });
                        })
                      }
                    />
                    {spec.kind === "journey" &&
                      stage <
                        (spec.kind === "journey"
                          ? spec.content.stages.length - 1
                          : 0) &&
                      currentQuestions.length > 0 && (
                        <button
                          className="simple-next-stage"
                          onClick={() => setStage(stage + 1)}
                        >
                          Soạn chặng {stage + 2} →
                        </button>
                      )}
                  </>
                )}
              </>
            )}
            {step === 1 && spec.kind !== "word_wheel" && (
              <details>
                <summary>Thêm từ ngân hàng câu hỏi</summary>
                <QuestionBank
                  select={(q) =>
                    edit((s) => {
                      const qs =
                        s.kind === "journey"
                          ? s.content.stages[stage].questions
                          : s.kind === "picture_reveal"
                            ? s.content.questions
                            : [];
                      if (
                        qs.length <
                        (s.kind === "journey"
                          ? 12
                          : s.kind === "picture_reveal"
                            ? s.content.size
                            : 0)
                      )
                        qs.push(q);
                    })
                  }
                />
              </details>
            )}
            {step === 2 && (
              <>
                <label>
                  Hình thức chơi
                  <select
                    value={spec.settings.playMode || "teams"}
                    onChange={(e) =>
                      edit((s) => {
                        s.settings.playMode = e.target.value as
                          "individual" | "teams";
                      })
                    }
                  >
                    <option value="individual">
                      Cá nhân – gọi từng học sinh
                    </option>
                    <option value="teams">Theo tổ / đội</option>
                  </select>
                </label>
                <p>
                  {spec.settings.playMode === "individual"
                    ? "Nhập danh sách lớp (tối đa 50 học sinh). Khi chơi, giáo viên chọn tên để gọi trả lời; điểm được ghi riêng cho từng em."
                    : "Nhập tên các tổ hoặc đội. Khi chơi có thể chọn tổ trả lời; điểm được ghi riêng cho mỗi tổ."}
                </p>
                <label>
                  {spec.settings.playMode === "individual"
                    ? "Tên học sinh (mỗi dòng một em)"
                    : "Tên tổ / đội (mỗi dòng một tổ)"}
                  <textarea
                    value={spec.settings.teams.join("\n")}
                    onChange={(e) =>
                      edit((s) => {
                        s.settings.teams = e.target.value
                          .split("\n")
                          .slice(0, 50);
                      })
                    }
                  />
                </label>
                <details className="simple-optional">
                  <summary>Font chữ và màu sắc</summary>
                  <p>
                    Áp dụng cho tiêu đề, câu hỏi và đáp án. Chọn màu chữ tương
                    phản với nền để học sinh dễ đọc.
                  </p>
                  <div className="game-theme-fields">
                    <label>
                      Font chữ
                      <select
                        aria-label="Font chữ trò chơi"
                        value={spec.appearance?.font || defaultGameTheme.font}
                        onChange={(e) =>
                          edit((s) => {
                            s.appearance = {
                              ...(s.appearance || defaultGameTheme),
                              font: e.target
                                .value as typeof defaultGameTheme.font,
                            };
                          })
                        }
                      >
                        {["Roboto", "Arial", "Tahoma", "Georgia"].map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    {(
                      [
                        ["text", "Màu chữ"],
                        ["question", "Nền khối câu hỏi"],
                        ["answer", "Nền khối đáp án"],
                        ["heading", "Nền khối tiêu đề"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="color"
                          aria-label={label}
                          value={(spec.appearance || defaultGameTheme)[key]}
                          onChange={(e) =>
                            edit((s) => {
                              s.appearance = {
                                ...(s.appearance || defaultGameTheme),
                                [key]: e.target.value,
                              };
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      edit((s) => {
                        delete s.appearance;
                      })
                    }
                  >
                    Khôi phục giao diện mặc định
                  </button>
                </details>
                <p className="simple-default-rules">
                  Đang dùng:{" "}
                  {spec.settings.timerSeconds
                    ? `${spec.settings.timerSeconds} giây/câu`
                    : "không giới hạn giờ"}{" "}
                  · Đúng lần đầu {spec.settings.pointsFirst} điểm · Sau gợi ý{" "}
                  {spec.settings.pointsRetry} điểm
                </p>
                <details className="simple-optional">
                  <summary>Điều chỉnh thời gian, điểm và âm thanh</summary>
                  {(
                    [
                      ["timerSeconds", "Thời gian mỗi câu (0 = tắt)", 300],
                      ["pointsFirst", "Điểm đúng lần đầu", 100],
                      ["pointsRetry", "Điểm sau gợi ý", 100],
                    ] as const
                  ).map(([key, label, max]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={spec.settings[key]}
                        onChange={(e) =>
                          edit((s) => {
                            s.settings[key] = Math.min(
                              max,
                              Math.max(0, Number(e.target.value)),
                            );
                          })
                        }
                      />
                    </label>
                  ))}
                  {spec.kind === "journey" &&
                    spec.content.stages.map((st, i) => (
                      <label key={st.id}>
                        Hệ số chặng {i + 1}
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={st.multiplier}
                          onChange={(e) =>
                            edit((s) => {
                              if (s.kind === "journey")
                                s.content.stages[i].multiplier = Math.min(
                                  10,
                                  Math.max(1, Number(e.target.value)),
                                );
                            })
                          }
                        />
                      </label>
                    ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={spec.settings.muted}
                      onChange={(e) =>
                        edit((s) => {
                          s.settings.muted = e.target.checked;
                        })
                      }
                    />
                    Tắt âm mặc định
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={spec.settings.reducedMotion}
                      onChange={(e) =>
                        edit((s) => {
                          s.settings.reducedMotion = e.target.checked;
                        })
                      }
                    />
                    Giảm chuyển động
                  </label>
                </details>
              </>
            )}
            {step === 2 && (
              <details className="simple-optional">
                <summary>
                  Hình ảnh và nhân vật <span>Không bắt buộc</span>
                </summary>
                <p className="simple-field-help">
                  Bài đã có sẵn nền và nhân vật. Mở mục này khi muốn dùng ảnh
                  riêng.
                </p>
                <label>
                  Vị trí sử dụng
                  <select
                    value={mediaTarget}
                    onChange={(e) =>
                      setMediaTarget(e.target.value as typeof mediaTarget)
                    }
                  >
                    <option value="backgroundId">Hình nền</option>
                    <option value="characterId">Nhân vật</option>
                    {spec.kind === "picture_reveal" && (
                      <option value="imageId">Ảnh bí mật</option>
                    )}
                    {spec.kind === "journey" &&
                      spec.content.stages.map((s, i) => (
                        <option key={s.id} value={`stage:${i}`}>
                          Nền chặng {i + 1}: {s.title}
                        </option>
                      ))}
                    {questionsOf(spec).map((q, i) => (
                      <option key={q.id} value={`question:${q.id}`}>
                        Ảnh câu {i + 1}: {q.prompt.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </label>
                <Media
                  key={mediaRevision}
                  select={(asset) => {
                    edit((s) => {
                      assignAsset(s, asset.id);
                      s.media.alt = asset.alt_text || "";
                    });
                    setCrop({
                      fit: "contain",
                      x: 50,
                      y: 50,
                      zoom: 1,
                      opacity: 1,
                      aspect:
                        mediaTarget === "characterId"
                          ? "4:5"
                          : mediaTarget.startsWith("question:")
                            ? "1:1"
                            : "16:9",
                    });
                    setSelected(asset);
                  }}
                />
                {selected && <p>Đã chọn: {selected.name}</p>}
                <label>
                  Cách đặt ảnh
                  <select
                    value={crop.fit}
                    onChange={(e) =>
                      setCrop({
                        ...crop,
                        fit: e.target.value as "cover" | "contain",
                      })
                    }
                  >
                    <option value="cover">Phủ kín (crop)</option>
                    <option value="contain">Vừa khung</option>
                  </select>
                </label>
                {(
                  [
                    ["x", "Vị trí ngang", 0, 100, 0.1],
                    ["y", "Vị trí dọc", 0, 100, 0.1],
                    ["zoom", "Phóng to", 1, 3, 0.01],
                    ["opacity", "Độ rõ", 0, 1, 0.01],
                  ] as const
                ).map(([key, label, min, max, inc]) => (
                  <label key={key}>
                    {label}: {crop[key]}
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={inc}
                      value={crop[key]}
                      onChange={(e) =>
                        setCrop({ ...crop, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
                <label>
                  Mô tả ảnh (alt text)
                  <input
                    maxLength={300}
                    value={spec.media.alt}
                    onChange={(e) =>
                      edit((s) => {
                        s.media.alt = e.target.value;
                      })
                    }
                  />
                </label>
                {selected?.url && (
                  <div
                    className="eg-crop"
                    style={{ aspectRatio: crop.aspect.replace(":", "/") }}
                  >
                    <img
                      src={selected.url}
                      alt={spec.media.alt}
                      style={{
                        objectFit: crop.fit,
                        objectPosition: `${crop.x}% ${crop.y}%`,
                        transform: `scale(${crop.zoom})`,
                        transformOrigin: `${crop.x}% ${crop.y}%`,
                        opacity: crop.opacity,
                      }}
                    />
                  </div>
                )}
                <label>
                  Tỉ lệ cắt
                  <select
                    value={crop.aspect}
                    onChange={(e) =>
                      setCrop({
                        ...crop,
                        aspect: e.target.value as typeof crop.aspect,
                      })
                    }
                  >
                    <option>16:9</option>
                    <option>4:5</option>
                    <option>1:1</option>
                  </select>
                </label>
                <button
                  disabled={!selected || cropBusy}
                  onClick={() => void saveCrop()}
                >
                  Lưu thành ảnh mới và sử dụng
                </button>
                <button
                  disabled={!selected?.owner_id}
                  onClick={() => {
                    if (!selected) return;
                    void api<Asset>(`/assets/${selected.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        altText: spec.media.alt,
                        revision: selected.revision || 1,
                      }),
                    })
                      .then((row) => {
                        setSelected({ ...selected, ...row });
                        setMediaRevision((v) => v + 1);
                        setMessage("Đã lưu mô tả ảnh.");
                      })
                      .catch((e) => setMessage(e.message));
                  }}
                >
                  Lưu mô tả ảnh cá nhân
                </button>
              </details>
            )}
            {step === 3 && (
              <>
                <h3>Kiểm tra trước khi dùng trên lớp</h3>
                {errors.length ? (
                  <ul>
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Đã đủ cấu trúc nội dung. Giáo viên cần kiểm duyệt nội dung
                    trước khi dạy.
                  </p>
                )}
                <p className="eg-card">
                  PowerPoint: {templateRegistry[spec.kind].pptx}
                </p>
                <div className="eg-actions">
                  <button
                    disabled={
                      !!errors.length ||
                      !revision ||
                      busy ||
                      savedHash.current !== JSON.stringify(spec)
                    }
                    onClick={() =>
                      void api<GameRow>(`/games/${spec.id}/submit`, {
                        method: "POST",
                        body: JSON.stringify({ revision }),
                      })
                        .then((row) => {
                          setRevision(row.revision);
                          setMessage(
                            "Đã gửi duyệt công bố. Bài chỉ công khai sau khi Admin duyệt.",
                          );
                        })
                        .catch((e) => setMessage(e.message))
                    }
                  >
                    Gửi duyệt công bố
                  </button>
                  <button
                    disabled={!revision || busy}
                    onClick={() =>
                      void api(`/games/${spec.id}/revoke`, {
                        method: "POST",
                        body: JSON.stringify({ revision }),
                      })
                        .then(() => {
                          setRevision(revision + 1);
                          setMessage("Đã thu hồi chia sẻ.");
                        })
                        .catch((e) => setMessage(e.message))
                    }
                  >
                    Thu hồi chia sẻ
                  </button>
                  <button
                    disabled={!revision}
                    onClick={() =>
                      void api<{ id: string }[]>(`/games/${spec.id}/share`)
                        .then((rows) =>
                          setMessage(
                            rows.length
                              ? `${window.location.origin}/play/${rows[0].id}`
                              : "Bài chưa được công bố hoặc liên kết đã thu hồi.",
                          ),
                        )
                        .catch((e) => setMessage(e.message))
                    }
                  >
                    Xem liên kết chia sẻ
                  </button>
                </div>
                <p>
                  {spec.kind === "journey"
                    ? "PowerPoint dùng nút liên kết để chọn đáp án. Điểm và đồng hồ do giáo viên điều khiển."
                    : spec.kind === "picture_reveal"
                      ? "PowerPoint mở ô cố định từ trái sang phải, trên xuống dưới. Giáo viên điều hành đoán tranh và ghi điểm."
                      : "PowerPoint mở chữ theo kịch bản, giáo viên quay và ghi điểm thủ công."}
                </p>
                <div className="eg-actions builder-export-actions">
                  <button
                    disabled={
                      errors.length > 0 || !templateRegistry[spec.kind].released
                    }
                    onClick={() => setPlaying(true)}
                  >
                    Chơi thử
                  </button>
                  <button
                    disabled={
                      errors.length > 0 ||
                      !templateRegistry[spec.kind].released ||
                      exporting
                    }
                    onClick={() => void exportGame()}
                  >
                    {exporting ? "Đang xuất…" : "Xuất PowerPoint"}
                  </button>
                </div>
              </>
            )}
            <footer className="eg-title">
              <button disabled={step === 0} onClick={() => setStep(step - 1)}>
                ← Quay lại
              </button>
              {step < 3 && (
                <button className="eg-button" onClick={() => setStep(step + 1)}>
                  {`Tiếp theo: ${steps[step + 1]} →`}
                </button>
              )}
            </footer>
          </fieldset>
        </section>
        <BuilderPreview
          questionId={activeQuestion}
          onQuestionChange={setActiveQuestion}
          spec={spec}
          stage={stage}
          canPlay={
            !busy && errors.length === 0 && templateRegistry[spec.kind].released
          }
          onPlay={() => setPlaying(true)}
        />
      </div>
    </>
  );
}

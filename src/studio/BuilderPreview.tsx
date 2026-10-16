import { gameThemeStyle } from "./game-theme";
import { useEffect, useState } from "react";
import {
  assetIds,
  templateRegistry,
  type StudioSpec,
} from "../domain/studio-spec";
import { api } from "./client";
import type { Asset } from "./StudioApp";
import { SceneBackground } from "./SceneBackground";
import "./builder-preview.css";

export function BuilderPreview({
  spec,
  questionId,
  onQuestionChange,
  stage,
  onPlay,
  canPlay,
}: {
  spec: StudioSpec;
  questionId: string;
  onQuestionChange: (id: string) => void;
  stage: number;
  onPlay: () => void;
  canPlay: boolean;
}) {
  const [assets, setAssets] = useState<Asset[]>([]),
    [error, setError] = useState("");
  const key = assetIds(spec).sort().join(",");
  useEffect(() => {
    let active = true;
    if (!key) {
      setAssets([]);
      setError("");
      return;
    }
    const load = () =>
      void api<Asset[]>("/assets")
        .then((rows) => {
          if (active) {
            setAssets(rows);
            setError("");
          }
        })
        .catch(() => {
          if (active)
            setError("Chưa tải được ảnh. Bản xem trước đang dùng nền mẫu.");
        });
    load();
    const timer = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key]);
  const currentStage =
    spec.kind === "journey"
      ? spec.content.stages[
          Math.min(
            stage,
            spec.kind === "journey" ? spec.content.stages.length - 1 : 0,
          )
        ]
      : null;
  const questions =
    currentStage?.questions ||
    (spec.kind === "picture_reveal" ? spec.content.questions : []);
  const index = Math.max(
      0,
      questions.findIndex((q) => q.id === questionId),
    ),
    question = questions[index];
  const find = (id?: string) => assets.find((asset) => asset.id === id);
  const background = find(
    currentStage?.backgroundId || spec.media.backgroundId,
  );
  const character = find(spec.media.characterId);
  const phrase =
    spec.kind === "word_wheel" ? spec.content.phrase || "TỪ KHÓA" : "";
  return (
    <aside className="builder-preview" aria-label="Xem trước trực tiếp">
      <header>
        <div>
          <span className="builder-preview-live" />
          Xem trước trực tiếp
        </div>
        <span>16:9</span>
      </header>
      <p className="builder-preview-title">
        {spec.metadata.title || "Trò chơi mới"}
      </p>
      <div className="builder-preview-controls">
        <span>{templateRegistry[spec.kind].name}</span>
        {questions.length > 1 && (
          <label>
            Câu
            <select
              aria-label="Câu hỏi xem trước"
              value={index}
              onChange={(e) =>
                onQuestionChange(questions[Number(e.target.value)].id)
              }
            >
              {questions.map((q, i) => (
                <option key={q.id} value={i}>
                  Câu {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="builder-preview-canvas">
        <div
          className={`builder-preview-stage preview-${spec.kind}`}
          style={{
            ...gameThemeStyle(spec),
            backgroundImage: `url('/art/${spec.kind === "word_wheel" ? "castle" : "forest"}.png')`,
          }}
        >
          <SceneBackground spec={spec} url={background?.url} />
          <div className="preview-timer">
            ⏱{" "}
            {spec.settings.timerSeconds
              ? `${spec.settings.timerSeconds}s`
              : "Không giới hạn"}
          </div>
          <div className="preview-scores">
            {spec.settings.teams.slice(0, 4).map((name, i) => (
              <div key={i}>
                <span>{name || `Người chơi ${i + 1}`}</span>
                <b>0</b>
              </div>
            ))}
            {spec.settings.teams.length > 4 && (
              <small>+{spec.settings.teams.length - 4} người chơi</small>
            )}
          </div>
          <div className="preview-center">
            <div className="preview-stage-heading">
              {currentStage
                ? `Chặng ${Math.min(stage, spec.kind === "journey" ? spec.content.stages.length - 1 : 0) + 1}: ${currentStage.title || "Tên chặng"}`
                : spec.metadata.title || templateRegistry[spec.kind].name}
            </div>
            {spec.kind === "word_wheel" ? (
              <>
                <div className="preview-word">
                  {Array.from(phrase).map((letter, i) => (
                    <span key={i} className={letter === " " ? "space" : ""}>
                      {letter}
                    </span>
                  ))}
                </div>
                <div className="preview-clue">
                  {spec.content.clue ||
                    "Gợi ý cho cụm từ sẽ xuất hiện tại đây."}
                </div>
                <div className="preview-wheel" aria-hidden="true">
                  <span>10</span>
                  <span>20</span>
                  <span>30</span>
                  <b>★</b>
                </div>
              </>
            ) : spec.kind === "picture_reveal" ? (
              <>
                <div
                  className="preview-picture"
                  style={{
                    gridTemplateColumns: `repeat(${spec.content.size === 9 ? 3 : 2},1fr)`,
                    backgroundImage: `url('${find(spec.content.imageId)?.url || "/art/forest.png"}')`,
                  }}
                >
                  {Array.from({ length: spec.content.size }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <div className="preview-clue">
                  {question?.prompt || "Thêm câu hỏi để mở từng mảnh ghép."}
                </div>
              </>
            ) : (
              <>
                <div className="preview-question">
                  {question?.prompt || "Câu hỏi của bạn sẽ xuất hiện tại đây"}
                  {question?.imageId && find(question.imageId)?.url && (
                    <img src={find(question.imageId)?.url} alt="" />
                  )}
                </div>
                <div className="preview-answers">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i}>
                      {"ABCD"[i]}. {question?.choices[i] || `Đáp án ${i + 1}`}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="preview-character">
            <div>Cùng khám phá nhé!</div>
            <img
              src={
                character?.url ||
                (spec.kind === "picture_reveal"
                  ? "/art/explorer-girl.png"
                  : "/art/explorer.png")
              }
              alt=""
            />
          </div>
        </div>
      </div>
      {error && (
        <p className="builder-preview-error" role="status">
          {error}
        </p>
      )}
      <p className="builder-preview-note">
        Cập nhật theo bản đang chỉnh, kể cả khi chưa lưu. Nội dung dài có thể
        được rút gọn trong khung nhỏ.
      </p>
      <button className="eg-button" onClick={onPlay} disabled={!canPlay}>
        Chơi thử toàn màn hình
      </button>
      {!canPlay && (
        <p className="builder-preview-hint">
          Hoàn thiện nội dung để bật chơi thử. Bạn vẫn có thể xem bố cục và lưu
          nháp.
        </p>
      )}
    </aside>
  );
}

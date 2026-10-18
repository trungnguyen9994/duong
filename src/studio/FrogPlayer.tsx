import { useState } from "react";
import type { StudioSpec } from "../domain/studio-spec";
import { initialFrog, selectFrog, markFrog } from "../domain/frog-rules";
import { gameThemeStyle } from "./game-theme";
import { PlayerRoster } from "./PlayerRoster";
import { useAssets } from "./useAssets";
import { usePlayRecord } from "./usePlayRecord";
import { useCountdown } from "../features/player/useCountdown";
import { SceneBackground } from "./SceneBackground";
import type { Asset } from "./StudioApp";
import {
  NarrationFeedback,
  useVietnameseNarration,
} from "./useVietnameseNarration";
import "./frog.css";
export function FrogPlayer({
  spec,
  onExit,
  initialAssets,
  record = false,
}: {
  spec: StudioSpec;
  onExit: () => void;
  initialAssets?: Asset[];
  record?: boolean;
}) {
  const [state, setState] = useState(() => initialFrog(spec));
  const [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(spec.settings.muted),
    [round, setRound] = useState(0);
  const assets = useAssets(initialAssets);
  const seconds = useCountdown(
    spec.settings.timerSeconds,
    `${spec.id}:${round}:${state.active}`,
    state.phase === "question",
    paused,
  );
  const narration = useVietnameseNarration(
    state.phase === "pond"
      ? "Hãy chọn một chú ếch để khám phá câu hỏi nhé!"
      : "",
    muted,
    paused,
  );
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  if (spec.kind !== "clever_frog") return null;
  const q = state.active === null ? null : spec.content.questions[state.active];
  const character =
    assets.find((a) => a.id === spec.media.characterId)?.url ||
    "/art/frog/image20.png";
  return (
    <section
      className={`eg-theater eg-frog-theater${spec.settings.reducedMotion || paused ? " frog-still" : ""}`}
      style={gameThemeStyle(spec)}
    >
      <SceneBackground
        spec={spec}
        url={assets.find((a) => a.id === spec.media.backgroundId)?.url}
      />
      <div className="eg-play-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <button aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          {muted ? "Bật âm" : "Tắt âm"}
        </button>
        <span role="timer">
          {spec.settings.timerSeconds ? `${seconds}s` : "Không giới hạn giờ"}
        </span>
      </div>
      <PlayerRoster
        spec={spec}
        active={state.team}
        scores={state.scores}
        disabled={paused || state.phase !== "pond"}
        onSelect={(team) => setState((s) => ({ ...s, team }))}
      />
      <main className="frog-main">
        <h1>{spec.metadata.title}</h1>
        <p className="frog-progress">
          Đã hoàn thành {state.completed.length}/{spec.content.questions.length}{" "}
          chú ếch
        </p>
        {state.phase === "pond" ? (
          <>
            <p className="frog-instructions">
              Chọn một chú ếch. Trả lời miệng rồi cùng kiểm tra đáp án!
            </p>
            <div className="frog-pond">
              {spec.content.questions.map((frog, i) => (
                <button
                  key={frog.id}
                  className={`frog-choice${state.completed.includes(i) ? " frog-done" : ""}`}
                  disabled={paused || state.completed.includes(i)}
                  onClick={() => setState((s) => selectFrog(spec, s, i))}
                  aria-label={`${frog.label || `Ếch ${i + 1}`}${state.completed.includes(i) ? " đã hoàn thành" : ""}`}
                >
                  <img
                    src={`/art/frog/image${[7, 8, 9, 10, 11, 12, 13, 14, 5, 6][i % 10]}.png`}
                    alt=""
                  />
                  <strong>{frog.label || `Ếch ${i + 1}`}</strong>
                  {state.completed.includes(i) && <span>✓ Đã hoàn thành</span>}
                </button>
              ))}
            </div>
          </>
        ) : state.phase === "summary" ? (
          <div className="frog-question">
            <h2>Chúc mừng cả lớp!</h2>
            <p>Các chú ếch đã hoàn thành thử thách.</p>
            <button
              onClick={() => {
                setState(initialFrog(spec));
                setRound((r) => r + 1);
              }}
            >
              Chơi lại
            </button>
          </div>
        ) : (
          q && (
            <div className="frog-question">
              <h2>{q.label || `Ếch ${state.active! + 1}`}</h2>
              <p className="frog-prompt">{q.prompt}</p>
              {q.imageId && assets.find((a) => a.id === q.imageId)?.url && (
                <img
                  className="frog-question-image"
                  src={assets.find((a) => a.id === q.imageId)!.url}
                  alt="Hình minh họa câu hỏi"
                />
              )}
              {state.phase === "answer" ? (
                <>
                  <div className="frog-answer" role="status">
                    <strong>Đáp án: {q.choices[q.correct]}</strong>
                    {q.explanation && <p>{q.explanation}</p>}
                  </div>
                  <div className="eg-actions">
                    <button
                      disabled={paused}
                      onClick={() => setState((s) => markFrog(spec, s, true))}
                    >
                      Trả lời đúng · +
                      {state.attempts
                        ? spec.settings.pointsRetry
                        : spec.settings.pointsFirst}{" "}
                      điểm
                    </button>
                    <button
                      disabled={paused}
                      onClick={() => setState((s) => markFrog(spec, s, false))}
                    >
                      Chưa đúng · Bỏ qua
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>Học sinh trả lời miệng; giáo viên bấm để kiểm tra.</p>
                  {q.hint && (
                    <details
                      onToggle={(e) => {
                        if (e.currentTarget.open)
                          setState((s) => ({
                            ...s,
                            attempts: Math.max(1, s.attempts),
                          }));
                      }}
                    >
                      <summary>Gợi ý</summary>
                      <p>{q.hint}</p>
                    </details>
                  )}
                  <button
                    disabled={paused}
                    onClick={() => setState((s) => ({ ...s, phase: "answer" }))}
                  >
                    Hiện đáp án
                  </button>
                </>
              )}
              <button
                disabled={paused}
                onClick={() =>
                  setState((s) => ({ ...s, active: null, phase: "pond" }))
                }
              >
                Quay về ao
              </button>
              <img
                className="frog-host"
                src={character}
                alt="Ếch xanh dẫn chuyện"
              />
            </div>
          )
        )}
        <NarrationFeedback
          notice={narration.notice}
          onReplay={narration.replay}
          disabled={paused || muted}
          visible={!muted}
        />
      </main>
    </section>
  );
}

import { useState } from "react";
import type { StudioSpec } from "../domain/studio-spec";
import { adventureConfig, isAdventure } from "../domain/adventure-config";
import {
  initialAdventure,
  chooseAdventure,
  answerAdventure,
  nextAdventure,
} from "../domain/adventure-rules";
import { useAssets } from "./useAssets";
import type { Asset } from "./StudioApp";
import { useCountdown } from "../features/player/useCountdown";
import { usePlayRecord } from "./usePlayRecord";
import { PlayerRoster } from "./PlayerRoster";
import { SceneBackground } from "./SceneBackground";
import { gameThemeStyle } from "./game-theme";
import "./adventure.css";
import {
  useVietnameseNarration,
  NarrationFeedback,
} from "./useVietnameseNarration";
export function AdventurePlayer({
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
  const [state, setState] = useState(() => initialAdventure(spec)),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(spec.settings.muted),
    [round, setRound] = useState(0);
  const assets = useAssets(initialAssets),
    seconds = useCountdown(
      spec.settings.timerSeconds,
      `${spec.id}:${round}:${state.active}`,
      state.phase === "question",
      paused,
    );
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  const narrationText =
    state.phase === "correct"
      ? "Chính xác! Con làm tốt lắm!"
      : state.phase === "wrong"
        ? "Cùng suy nghĩ và thử lại nhé!"
        : state.phase === "summary"
          ? "Chúc mừng cả lớp đã hoàn thành trò chơi!"
          : state.phase === "board"
            ? "Hãy chọn một ô để khám phá câu hỏi nhé!"
            : "Cùng đọc câu hỏi và chọn đáp án nhé!";
  const narration = useVietnameseNarration(narrationText, muted, paused);
  if (!isAdventure(spec.kind) || !("questions" in spec.content)) return null;
  const config = adventureConfig[spec.kind],
    q = state.active === null ? null : spec.content.questions[state.active],
    kind = spec.kind;
  return (
    <section
      className={`adventure-player adventure-${kind}${spec.settings.reducedMotion || paused ? " adventure-still" : ""}`}
      style={{
        ...gameThemeStyle(spec),
        backgroundImage: config.background
          ? `url('${config.background}')`
          : undefined,
      }}
    >
      <SceneBackground
        spec={spec}
        url={assets.find((a) => a.id === spec.media.backgroundId)?.url}
      />
      <div className="adventure-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button onClick={() => setPaused((p) => !p)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <span role="timer">
          {spec.settings.timerSeconds ? `${seconds}s` : "Không giới hạn giờ"}
        </span>
      </div>
      <PlayerRoster
        spec={spec}
        active={state.team}
        scores={state.scores}
        disabled={
          paused ||
          state.attempts > 0 ||
          !["board", "question"].includes(state.phase)
        }
        onSelect={(team) => setState((s) => ({ ...s, team }))}
      />
      <main className="adventure-main">
        <button aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          {muted ? "Bật âm" : "Tắt âm"}
        </button>
        <NarrationFeedback
          notice={narration.notice}
          onReplay={narration.replay}
          disabled={paused || muted}
          visible={!muted}
        />
        <h1>{spec.metadata.title}</h1>
        <p className="adventure-progress">
          {kind === "football" ? "Số bàn thắng" : "Đã giải cứu"}:{" "}
          {state.completed.length}/{spec.content.questions.length}
        </p>
        {state.phase === "summary" ? (
          <div className="adventure-card">
            <h2>
              {kind === "football" ? "Cả lớp ghi bàn!" : "Giải cứu thành công!"}
            </h2>
            <p>Cùng tổng kết điểm và khen ngợi cả lớp.</p>
            <button
              onClick={() => {
                setState(initialAdventure(spec));
                setRound((r) => r + 1);
              }}
            >
              Chơi lại
            </button>
          </div>
        ) : state.phase === "board" ? (
          <>
            <p className="adventure-instructions">{config.instructions}</p>
            <div className="adventure-board">
              {spec.content.questions.map((item, i) => (
                <button
                  className={`adventure-object${state.completed.includes(i) ? " rescued" : ""}`}
                  key={item.id}
                  disabled={paused || state.completed.includes(i)}
                  onClick={() => setState((s) => chooseAdventure(spec, s, i))}
                >
                  <img src={config.objects[i % config.objects.length]} alt="" />
                  {kind === "forest_rescue" && !state.completed.includes(i) && (
                    <img
                      className="adventure-cage"
                      src="/art/forest-rescue/image17.png"
                      alt="Lồng cần mở"
                    />
                  )}
                  <strong>{item.label || `Thử thách ${i + 1}`}</strong>
                  {state.completed.includes(i) && <span>✓ An toàn</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          q && (
            <div className={`adventure-card phase-${state.phase}`}>
              <h2>{q.label || `Câu ${state.active! + 1}`}</h2>
              <p className="adventure-prompt">{q.prompt}</p>
              {q.imageId && assets.find((a) => a.id === q.imageId)?.url && (
                <img
                  className="adventure-question-image"
                  src={assets.find((a) => a.id === q.imageId)!.url}
                  alt="Hình minh họa câu hỏi"
                />
              )}
              <div className="adventure-action-scene" aria-hidden="true">
                <img
                  className="adventure-actor"
                  src={
                    kind === "football"
                      ? "/art/football/image3.png"
                      : config.objects[state.active! % config.objects.length]
                  }
                  alt=""
                />
                {kind === "football" && (
                  <img
                    className="adventure-keeper"
                    src={
                      assets.find((a) => a.id === spec.media.characterId)
                        ?.url || "/art/football/image4.png"
                    }
                    alt=""
                  />
                )}
                {kind === "forest_rescue" && state.phase !== "correct" && (
                  <img
                    className="adventure-cage"
                    src="/art/forest-rescue/image17.png"
                    alt=""
                  />
                )}
                {kind === "boat_rescue" && (
                  <span className="adventure-shore">BỜ AN TOÀN</span>
                )}
              </div>
              {state.phase === "question" &&
                (config.oral ? (
                  <button
                    disabled={paused}
                    onClick={() => setState((s) => ({ ...s, phase: "answer" }))}
                  >
                    Hiện đáp án
                  </button>
                ) : (
                  <div className="adventure-choices">
                    {q.choices.slice(0, config.choices).map((choice, i) => (
                      <button
                        key={i}
                        disabled={paused}
                        onClick={() =>
                          setState((s) => answerAdventure(spec, s, i))
                        }
                      >
                        {"ABCD"[i]}. {choice}
                      </button>
                    ))}
                  </div>
                ))}
              {state.phase === "answer" && (
                <>
                  <p className="adventure-answer">
                    Đáp án: {q.choices[q.correct]}
                  </p>
                  <button
                    disabled={paused}
                    onClick={() =>
                      setState((s) => answerAdventure(spec, s, true))
                    }
                  >
                    Trả lời đúng · Mở lồng
                  </button>
                  <button
                    disabled={paused}
                    onClick={() =>
                      setState((s) => answerAdventure(spec, s, false))
                    }
                  >
                    Chưa đúng
                  </button>
                </>
              )}
              {state.phase === "wrong" && (
                <div role="status">
                  <h3>
                    {kind === "football" ? "Bóng ra ngoài!" : "Thử lại nhé!"}
                  </h3>
                  <p>{q.hint || "Cùng suy nghĩ thêm nhé."}</p>
                  <button
                    disabled={paused}
                    onClick={() =>
                      setState((s) => ({ ...s, phase: "question" }))
                    }
                  >
                    Thử lại
                  </button>
                </div>
              )}
              {state.phase === "correct" && (
                <div role="status">
                  <h3>
                    {kind === "football"
                      ? "Vào! Ghi bàn!"
                      : kind === "boat_rescue"
                        ? "Thuyền đã vào bờ an toàn!"
                        : "Con vật đã được tự do!"}
                  </h3>
                  <p>{q.explanation}</p>
                  <button
                    disabled={paused}
                    onClick={() => setState((s) => nextAdventure(spec, s))}
                  >
                    {kind === "football"
                      ? "Câu tiếp theo"
                      : "Quay lại bảng giải cứu"}
                  </button>
                </div>
              )}
              {kind !== "football" && state.phase !== "correct" && (
                <button
                  disabled={paused}
                  onClick={() =>
                    setState((s) => ({ ...s, active: null, phase: "board" }))
                  }
                >
                  Quay lại bảng
                </button>
              )}
            </div>
          )
        )}
      </main>
    </section>
  );
}

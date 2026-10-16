import { gameThemeStyle } from "./game-theme";
import {
  useVietnameseNarration,
  NarrationFeedback,
} from "./useVietnameseNarration";
import { PlayerRoster } from "./PlayerRoster";
import { useEffect, useState } from "react";
import {
  answerJourney,
  initialJourney,
  nextJourney,
} from "../domain/studio-rules";
import { questionsOf, type StudioSpec } from "../domain/studio-spec";
import { useAssets } from "./useAssets";
import type { Asset } from "./StudioApp";
import { useCountdown } from "../features/player/useCountdown";
import { SceneBackground } from "./SceneBackground";
import { usePlayRecord } from "./usePlayRecord";

export function JourneyPlayer({
  spec,
  onExit,
  record = false,
  initialAssets,
}: {
  spec: StudioSpec;
  onExit: () => void;
  record?: boolean;
  initialAssets?: Asset[];
}) {
  const [state, setState] = useState(() => initialJourney(spec)),
    [muted, setMuted] = useState(spec.settings.muted),
    [paused, setPaused] = useState(false);
  const assets = useAssets(initialAssets);
  const remaining = useCountdown(
    spec.settings.timerSeconds,
    `${spec.id}:${state.index}`,
    state.phase === "question",
    paused,
  );
  const q = questionsOf(spec)[state.index];
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  const narrationText =
    state.phase === "intro"
      ? "Sẵn sàng khám phá chặng tiếp theo nhé!"
      : state.phase === "correct"
        ? "Chính xác! Làm tốt lắm!"
        : state.phase === "wrong"
          ? `Thử lại nhé! ${q?.hint || "Cùng suy nghĩ thêm nào."}`
          : "";
  const narration = useVietnameseNarration(narrationText, muted, paused);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!paused && state.phase === "question" && /^[1-4]$/.test(event.key))
        setState((s) => answerJourney(spec, s, Number(event.key) - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [spec, state.phase, paused]);
  if (spec.kind !== "journey") return null;
  let count = 0;
  const stageIndex = spec.content.stages.findIndex((s) => {
    count += s.questions.length;
    return state.index < count;
  });
  const stage = spec.content.stages[Math.max(0, stageIndex) % 4];
  const bg = assets.find(
    (a) => a.id === (stage.backgroundId || spec.media.backgroundId),
  )?.url;
  const char =
    assets.find((a) => a.id === spec.media.characterId)?.url ||
    "/art/explorer.png";
  return (
    <section
      className="eg-theater"
      aria-label="Chơi Hành trình"
      style={{
        ...gameThemeStyle(spec),
        backgroundImage: `linear-gradient(#06335133,#06335133),url('${["/art/forest.png", "/art/mountain.png", "/art/cave.png", "/art/castle.png"][Math.max(0, stageIndex)]}')`,
      }}
    >
      <SceneBackground spec={spec} url={bg} />
      <div className="eg-play-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button
          aria-pressed={!muted}
          onClick={() => {
            setMuted(!muted);
            window.speechSynthesis?.cancel();
          }}
        >
          {muted ? "Bật âm" : "Tắt âm"}
        </button>
        <button aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <span
          className="eg-timer"
          role="timer"
          aria-label={`Còn ${remaining} giây`}
        >
          ⏱{" "}
          {spec.settings.timerSeconds
            ? `${Math.floor(remaining / 60)
                .toString()
                .padStart(
                  2,
                  "0",
                )}:${(remaining % 60).toString().padStart(2, "0")}`
            : "Không giới hạn"}
        </span>
      </div>
      <PlayerRoster
        spec={spec}
        active={state.team}
        scores={state.scores}
        disabled={
          paused ||
          state.attempts > 0 ||
          !["intro", "question"].includes(state.phase)
        }
        onSelect={(team) => setState((s) => ({ ...s, team }))}
      />
      <div className="eg-play-panel">
        <h1>
          {state.phase === "summary"
            ? "Chúc mừng cả lớp!"
            : `Chặng ${Math.max(0, stageIndex) + 1}: ${stage.title}`}
        </h1>
        {state.phase === "intro" ? (
          <>
            <p>Cùng sẵn sàng nhé!</p>
            <button
              className="eg-button"
              onClick={() => setState({ ...state, phase: "question" })}
            >
              Bắt đầu chặng
            </button>
          </>
        ) : state.phase === "summary" ? (
          <>
            <p>Cả lớp đã hoàn thành hành trình tri thức.</p>
            <button
              onClick={() => {
                setState(initialJourney(spec));
              }}
            >
              Chơi lại
            </button>
          </>
        ) : (
          <>
            <div className="eg-question">
              <p>{q?.prompt}</p>
              {q?.imageId && (
                <img
                  className="eg-asset"
                  src={assets.find((a) => a.id === q.imageId)?.url}
                  alt={
                    assets.find((a) => a.id === q.imageId)?.alt_text ||
                    "Hình minh họa câu hỏi"
                  }
                />
              )}
            </div>
            <div className="eg-answers">
              {q?.choices.map((c, i) => (
                <button
                  key={i}
                  disabled={state.phase !== "question" || paused}
                  onClick={() => setState(answerJourney(spec, state, i))}
                >
                  {"ABCD"[i]}. {c}
                </button>
              ))}
            </div>
            {state.phase === "wrong" && (
              <div className="eg-feedback" role="status">
                <p>Thử lại nhé! {q?.hint}</p>
                <button
                  onClick={() => setState({ ...state, phase: "question" })}
                >
                  Chọn lại
                </button>
              </div>
            )}
            {state.phase === "correct" && (
              <div className="eg-feedback" role="status">
                <p>Chính xác! {q?.explanation}</p>
                <button
                  className="eg-button"
                  onClick={() => setState(nextJourney(spec, state))}
                >
                  Tiếp theo →
                </button>
              </div>
            )}
            {!remaining && spec.settings.timerSeconds > 0 && (
              <p className="eg-feedback" role="status">
                Hết giờ suy nghĩ! Giáo viên có thể gọi trả lời hoặc thảo luận
                thêm.
              </p>
            )}
          </>
        )}
      </div>
      <aside className="eg-guide">
        <p>
          {state.phase === "correct"
            ? "Giỏi lắm! Cùng đi tiếp nào!"
            : state.phase === "wrong"
              ? "Đừng lo, mình thử lại nhé!"
              : "Cùng nhau khám phá nào!"}
        </p>
        <img
          src={char}
          alt={
            assets.find((a) => a.id === spec.media.characterId)?.alt_text ||
            spec.media.alt ||
            "Bạn đồng hành"
          }
        />
        <NarrationFeedback
          notice={narration.notice}
          onReplay={narration.replay}
          disabled={muted || paused || !narration.ready}
          visible={!!narrationText}
        />
      </aside>
    </section>
  );
}

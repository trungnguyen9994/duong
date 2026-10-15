import { PlayerRoster } from "./PlayerRoster";
import { useEffect, useState } from "react";
import type { StudioSpec } from "../domain/studio-spec";
import {
  answerTile,
  guessPicture,
  initialPicture,
  selectTile,
} from "../domain/studio-rules";
import { useCountdown } from "../features/player/useCountdown";
import { useAssets } from "./useAssets";
import type { Asset } from "./StudioApp";
import { SceneBackground } from "./SceneBackground";
import { usePlayRecord } from "./usePlayRecord";
export function PicturePlayer({
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
  const [state, setState] = useState(() => initialPicture(spec)),
    [guess, setGuess] = useState(""),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(spec.settings.muted);
  const assets = useAssets(initialAssets);
  const [round, setRound] = useState(0);
  const seconds = useCountdown(
    spec.settings.timerSeconds,
    `${spec.id}:${round}:${state.active}`,
    state.phase === "question",
    paused,
  );
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  useEffect(() => {
    if (muted || !("speechSynthesis" in window)) return;
    const text =
      state.phase === "correct"
        ? "Chính xác! Cùng mở mảnh ghép nhé!"
        : state.phase === "wrong"
          ? "Mình cùng suy nghĩ và thử lại nhé!"
          : "";
    if (text) {
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = "vi-VN";
      window.speechSynthesis.speak(speech);
    }
    return () => window.speechSynthesis.cancel();
  }, [state.phase, muted]);
  if (spec.kind !== "picture_reveal") return null;
  const q = state.active !== null ? spec.content.questions[state.active] : null,
    image = assets.find((a) => a.id === spec.content.imageId)?.url;
  return (
    <section
      className="eg-theater eg-picture-theater"
      style={{
        backgroundImage: "url('/art/forest.png')",
      }}
    >
      <SceneBackground
        spec={spec}
        url={assets.find((a) => a.id === spec.media.backgroundId)?.url}
      />
      <div className="eg-play-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button onClick={() => setMuted(!muted)}>
          {muted ? "Bật âm" : "Tắt âm"}
        </button>
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <span className="eg-timer" role="timer">
          ⏱ {seconds}s
        </span>
      </div>
      <PlayerRoster spec={spec} active={state.team} scores={state.scores} disabled={paused || state.attempts > 0 || !["board", "question"].includes(state.phase)} onSelect={(team) => setState(s => ({...s, team}))} />
      <main className="eg-play-panel">
        <h1>{spec.metadata.title}</h1>
        {state.phase === "summary" ? (
          <div className="eg-feedback">
            <h2>Chính xác! {spec.content.answer}</h2>
            {image && (
              <img
                className="eg-asset"
                src={image}
                alt={
                  assets.find((a) => a.id === spec.content.imageId)?.alt_text ||
                  spec.content.answer
                }
              />
            )}
            <button
              onClick={() => {
                setState(initialPicture(spec));
                setRound(round + 1);
              }}
            >
              Chơi lại
            </button>
          </div>
        ) : state.phase === "board" ? (
          <>
            <div
              className="eg-picture-board"
              style={{
                gridTemplateColumns: `repeat(${spec.content.size === 9 ? 3 : 2},1fr)`,
                backgroundImage: `url('${image || ""}')`,
              }}
            >
              {Array.from({ length: spec.content.size }, (_, i) => (
                <button
                  key={i}
                  disabled={state.opened.includes(i)}
                  className={state.opened.includes(i) ? "opened" : ""}
                  aria-label={
                    state.opened.includes(i)
                      ? `Ô ${i + 1} đã mở`
                      : `Mở ô ${i + 1}`
                  }
                  onClick={() => setState(selectTile(spec, state, i))}
                >
                  {state.opened.includes(i) ? "" : i + 1}
                </button>
              ))}
            </div>
            {(spec.content.earlyGuess ||
              state.opened.length === spec.content.size) && (
              <form
                className="eg-feedback"
                onSubmit={(e) => {
                  e.preventDefault();
                  setState(guessPicture(spec, state, guess));
                  setGuess("");
                }}
              >
                <label>
                  Đoán bức tranh
                  <input
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    maxLength={150}
                  />
                </label>
                <button>Đoán tranh</button>
              </form>
            )}
            {state.guessMessage && (
              <p className="eg-feedback" role="status">
                {state.guessMessage}
              </p>
            )}
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
                  onClick={() => setState(answerTile(spec, state, i))}
                >
                  {"ABCD"[i]}. {c}
                </button>
              ))}
            </div>
            {state.phase === "wrong" && (
              <div className="eg-feedback">
                <p>Thử lại nhé! {q?.hint}</p>
                <button
                  onClick={() => setState({ ...state, phase: "question" })}
                >
                  Thử lại
                </button>
              </div>
            )}
            {state.phase === "correct" && (
              <div className="eg-feedback">
                <p>Đúng rồi! {q?.explanation}</p>
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      active: null,
                      phase: "board",
                      team: (state.team + 1) % state.scores.length,
                    })
                  }
                >
                  Mở mảnh ghép
                </button>
              </div>
            )}
            {seconds === 0 && spec.settings.timerSeconds > 0 && (
              <p className="eg-feedback" role="status">
                Hết giờ suy nghĩ. Giáo viên điều hành lượt trả lời.
              </p>
            )}
          </>
        )}
      </main>
      <aside className="eg-guide">
        <p>Cùng tìm ra bí mật sau những mảnh ghép nhé!</p>
        <img
          src={
            assets.find((a) => a.id === spec.media.characterId)?.url ||
            "/art/explorer-girl.png"
          }
          alt={
            assets.find((a) => a.id === spec.media.characterId)?.alt_text ||
            "Bạn đồng hành"
          }
        />
      </aside>
    </section>
  );
}

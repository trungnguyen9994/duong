import { useEffect, useRef, useState } from "react";
import type { StudioSpec } from "../domain/studio-spec";
import { travelStops } from "../domain/doremon-travel";
import {
  initialAdventure,
  chooseAdventure,
  answerAdventure,
  nextAdventure,
} from "../domain/adventure-rules";
import { PlayerRoster } from "./PlayerRoster";
import { useCountdown } from "../features/player/useCountdown";
import { usePlayRecord } from "./usePlayRecord";
import { useAssets } from "./useAssets";
import { SceneBackground } from "./SceneBackground";
import { gameThemeStyle } from "./game-theme";
import type { Asset } from "./StudioApp";
import "./doremon.css";

export function DoremonPlayer({
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
  const [state, setState] = useState(() => initialAdventure(spec));
  const [started, setStarted] = useState(false),
    [muted, setMuted] = useState(spec.settings.muted),
    [paused, setPaused] = useState(false),
    [audioBlocked, setAudioBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const assets = useAssets(initialAssets);
  const seconds = useCountdown(
    spec.settings.timerSeconds,
    `${spec.id}:${state.active}:${started}`,
    started && state.phase === "question",
    paused,
  );
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  function playSound(file: string) {
    audio.current?.pause();
    if (muted || paused) return;
    const sound = new Audio(`/art/doremon/${file}`);
    audio.current = sound;
    void sound
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  }
  useEffect(() => {
    if (muted || paused) audio.current?.pause();
  }, [muted, paused]);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  if (spec.kind !== "doremon_travel") return null;
  const index = state.active ?? 0,
    q = spec.content.questions[index],
    stop = travelStops[index];
  function answer(choice: number) {
    const next = answerAdventure(spec, state, choice);
    setState(next);
    playSound(
      next.phase === "correct"
        ? "audio2.wav"
        : state.attempts % 2
          ? "audio4.wav"
          : "audio3.wav",
    );
  }
  return (
    <section
      className={`doremon-player${spec.settings.reducedMotion || paused ? " doremon-still" : ""}`}
      style={gameThemeStyle(spec)}
    >
      <SceneBackground
        spec={spec}
        url={assets.find((a) => a.id === spec.media.backgroundId)?.url}
      />
      <div className="doremon-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <button onClick={() => setMuted(!muted)} aria-pressed={!muted}>
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
        disabled={paused || state.phase !== "board"}
        onSelect={(team) => setState((s) => ({ ...s, team }))}
      />
      <main className="doremon-main">
        <h1>{spec.metadata.title}</h1>
        {!started ? (
          <div className="doremon-cover">
            <img
              src={
                assets.find((a) => a.id === spec.media.characterId)?.url ||
                "/art/doremon/image21.gif"
              }
              alt="Doremon chào đón các bạn"
            />
            <h2>Cùng khám phá Đà Nẵng!</h2>
            <p>
              Bốn điểm đến, bốn thử thách. Chọn A hoặc B để tiếp tục chuyến du
              lịch.
            </p>
            <button
              disabled={paused}
              onClick={() => {
                setStarted(true);
                playSound("audio1.wav");
              }}
            >
              Bắt đầu chuyến đi
            </button>
            <small>Mẫu tham khảo: Huyen Trang</small>
          </div>
        ) : state.phase === "board" ? (
          <>
            <p>Chọn điểm đến · Đã khám phá {state.completed.length}/4</p>
            <div className="doremon-stops">
              {spec.content.questions.map((item, i) => (
                <button
                  key={item.id}
                  disabled={paused || state.completed.includes(i)}
                  onClick={() => setState((s) => chooseAdventure(spec, s, i))}
                >
                  <img src={`/art/doremon/${travelStops[i].image}`} alt="" />
                  <strong>{item.label || travelStops[i].name}</strong>
                  <span>
                    {state.completed.includes(i) ? "✓ Đã khám phá" : "Khám phá"}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : state.phase === "summary" ? (
          <div className="doremon-card">
            <h2>Chúc mừng cả lớp!</h2>
            <p>Chúng mình đã khám phá đủ bốn điểm đến.</p>
            <button
              onClick={() => {
                setState(initialAdventure(spec));
                setStarted(false);
              }}
            >
              Chơi lại
            </button>
          </div>
        ) : (
          q && (
            <div className="doremon-card">
              <h2>{q.label || stop.name}</h2>
              <img
                className="doremon-destination"
                src={
                  assets.find((a) => a.id === q.imageId)?.url ||
                  `/art/doremon/${stop.image}`
                }
                alt={q.label || stop.name}
              />
              <p className="doremon-prompt">{q.prompt}</p>
              {state.phase === "question" ? (
                <>
                  <div className="doremon-answers">
                    {q.choices.slice(0, 2).map((choice, i) => (
                      <button
                        disabled={paused}
                        key={i}
                        onClick={() => answer(i)}
                      >
                        {String.fromCharCode(65 + i)}. {choice}
                      </button>
                    ))}
                  </div>
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
                </>
              ) : (
                <div role="status" className={`doremon-result ${state.phase}`}>
                  <img
                    src={`/art/doremon/${state.phase === "correct" ? "image21.gif" : "image4.png"}`}
                    alt=""
                  />
                  <h3>
                    {state.phase === "correct"
                      ? "Chính xác!"
                      : "Chưa đúng, thử lại nhé!"}
                  </h3>
                  {state.phase === "correct" && <p>{q.explanation}</p>}
                  <button
                    disabled={paused}
                    onClick={() =>
                      setState((s) =>
                        state.phase === "correct"
                          ? nextAdventure(spec, s)
                          : { ...s, phase: "question" },
                      )
                    }
                  >
                    {state.phase === "correct"
                      ? "Tiếp tục chuyến đi"
                      : "Thử lại"}
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {audioBlocked && (
          <button
            disabled={muted || paused}
            onClick={() =>
              playSound(
                state.phase === "correct"
                  ? "audio2.wav"
                  : state.phase === "wrong"
                    ? "audio3.wav"
                    : "audio1.wav",
              )
            }
          >
            Phát lại âm thanh
          </button>
        )}
      </main>
    </section>
  );
}

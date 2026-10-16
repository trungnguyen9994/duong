import { gameThemeStyle } from "./game-theme";
import {
  useVietnameseNarration,
  NarrationFeedback,
} from "./useVietnameseNarration";
import { PlayerRoster } from "./PlayerRoster";
import { useEffect, useRef, useState } from "react";
import {
  initialWheel,
  spinWheel,
  guessLetter,
  solveWheel,
} from "../domain/studio-rules";
import { letterKey, type StudioSpec } from "../domain/studio-spec";
import { useCountdown } from "../features/player/useCountdown";
import { useAssets } from "./useAssets";
import type { Asset } from "./StudioApp";
import { SceneBackground } from "./SceneBackground";
import { usePlayRecord } from "./usePlayRecord";
const letters = Array.from("AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY");
export function WheelPlayer({
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
  const [state, setState] = useState(() => initialWheel(spec)),
    [guess, setGuess] = useState(""),
    [spinning, setSpinning] = useState(false),
    [rotation, setRotation] = useState(0),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(spec.settings.muted),
    [reduced, setReduced] = useState(
      spec.settings.reducedMotion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const assets = useAssets(initialAssets);
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const busyRef = useRef(false);
  useEffect(
    () => () => {
      animationRef.current?.cancel();
    },
    [],
  );
  const narrationText = state.message;
  const narration = useVietnameseNarration(narrationText, muted, paused);
  const [round, setRound] = useState(0);
  const seconds = useCountdown(
    spec.settings.timerSeconds,
    `${round}:${state.log.length}`,
    state.phase === "letter",
    paused,
  );
  usePlayRecord(spec.id, state.phase === "summary", state.scores, record);
  if (spec.kind !== "word_wheel") return null;
  async function spin() {
    if (busyRef.current || spinning || state.phase !== "spin" || paused) return;
    busyRef.current = true;
    setSpinning(true);
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    const index = buffer[0] % 8;
    const target = 360 * 4 + (360 - (index * 45 + 22.5));
    const nextRotation = Math.ceil(rotation / 360) * 360 + target;
    setRotation(nextRotation);
    if (!reduced && wheelRef.current) {
      const animation = wheelRef.current.animate(
        [
          { transform: `rotate(${rotation}deg)` },
          { transform: `rotate(${nextRotation}deg)` },
        ],
        { duration: 3200, easing: "cubic-bezier(.12,.7,.12,1)" },
      );
      animationRef.current = animation;
      try {
        await animation.finished;
      } catch {
        busyRef.current = false;
        return;
      }
      animationRef.current = null;
    }
    setState((s) => spinWheel(spec, s, index));
    setSpinning(false);
    busyRef.current = false;
  }
  return (
    <section
      className="eg-theater eg-wheel-theater"
      style={{
        ...gameThemeStyle(spec),
        backgroundImage: "url('/art/castle.png')",
      }}
    >
      <SceneBackground
        spec={spec}
        url={assets.find((a) => a.id === spec.media.backgroundId)?.url}
      />
      <div className="eg-play-toolbar">
        <button onClick={onExit}>← Thoát</button>
        <button aria-pressed={!muted} onClick={() => setMuted(!muted)}>
          {muted ? "Bật âm" : "Tắt âm"}
        </button>
        <button
          disabled={spinning}
          aria-pressed={reduced}
          onClick={() => setReduced(!reduced)}
        >
          Giảm chuyển động
        </button>
        <button disabled={spinning} onClick={() => setPaused(!paused)}>
          {paused ? "Tiếp tục" : "Tạm dừng"}
        </button>
        <span className="eg-timer" role="timer">
          ⏱ {seconds}s
        </span>
      </div>
      <PlayerRoster
        spec={spec}
        active={state.team}
        scores={state.scores}
        disabled={paused || spinning || state.phase !== "spin"}
        onSelect={(team) =>
          setState((s) => ({
            ...s,
            team,
            message: `Đến lượt quay của ${spec.settings.teams[team]}!`,
          }))
        }
      />
      <main className="eg-play-panel">
        <h1>{spec.metadata.title}</h1>
        <div className="eg-word-board" aria-label="Bảng chữ">
          {Array.from(spec.content.phrase.normalize("NFC")).map((c, i) => (
            <span key={i} className={!/\p{L}/u.test(c) ? "space" : ""}>
              {state.phase === "summary" ||
              state.guessed.includes(letterKey(c)) ||
              !/\p{L}/u.test(c)
                ? c
                : ""}
            </span>
          ))}
        </div>
        <p className="eg-feedback eg-clue">Gợi ý: {spec.content.clue}</p>
        <div className="eg-wheel-row">
          <div
            className={`eg-wheel-wrap${spinning ? " is-spinning" : ""}`}
            aria-busy={spinning}
          >
            <b className="eg-pointer" aria-hidden="true" />
            <div
              className="eg-wheel"
              ref={wheelRef}
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <svg
                className="eg-wheel-labels"
                viewBox="0 0 200 200"
                role="img"
                aria-label="Vòng quay gồm các ô 10, 20, 30, 40, 10, 20, 30 và mất lượt"
              >
                {spec.content.segments.map((value, i) => {
                  const angle = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
                  const x = 100 + Math.cos(angle) * 66,
                    y = 100 + Math.sin(angle) * 66;
                  return (
                    <text
                      key={i}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={value === "lose_turn" ? 12 : 19}
                    >
                      {value === "lose_turn" ? (
                        <>
                          <tspan x={x} dy="-6">
                            Mất
                          </tspan>
                          <tspan x={x} dy="14">
                            lượt
                          </tspan>
                        </>
                      ) : (
                        value
                      )}
                    </text>
                  );
                })}
              </svg>
            </div>
            <span className="eg-wheel-hub" aria-hidden="true">
              ★
            </span>
          </div>
          <button
            className="eg-button"
            disabled={spinning || paused || state.phase !== "spin"}
            onClick={() => void spin()}
          >
            {spinning ? "Đang quay…" : "Quay vòng"}
          </button>
        </div>
        <p className="eg-feedback" role="status">
          {state.message}
        </p>
        {state.phase !== "summary" ? (
          <>
            <div className="eg-letter-keys">
              {letters.map((c) => (
                <button
                  key={c}
                  disabled={
                    state.phase !== "letter" ||
                    state.guessed.includes(c) ||
                    spinning ||
                    paused
                  }
                  onClick={() => setState(guessLetter(spec, state, c))}
                >
                  {c}
                </button>
              ))}
            </div>
            <form
              className="eg-feedback"
              onSubmit={(e) => {
                e.preventDefault();
                if (!spinning && !paused)
                  setState(solveWheel(spec, state, guess));
                setGuess("");
              }}
            >
              <label>
                Giải cụm từ
                <input
                  maxLength={80}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                />
              </label>
              <button disabled={spinning || paused}>Giải cụm từ (+50)</button>
            </form>
          </>
        ) : (
          <button
            onClick={() => {
              setState(initialWheel(spec));
              setRound(round + 1);
              setRotation(0);
            }}
          >
            Chơi lại
          </button>
        )}
        <details className="eg-feedback">
          <summary>Nhật ký lượt chơi</summary>
          <ol>
            {state.log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
      </main>
      <aside className="eg-guide">
        <p>Giữ nguyên dấu khi giải cả cụm từ nhé!</p>
        <img
          src={
            assets.find((a) => a.id === spec.media.characterId)?.url ||
            "/art/explorer.png"
          }
          alt={
            assets.find((a) => a.id === spec.media.characterId)?.alt_text ||
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

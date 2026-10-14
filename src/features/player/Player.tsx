import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { orderedQuestions, type GameSpec } from "../../domain/game-spec";
import { backgroundStyle, scenes, stageTheme } from "../../domain/appearance";
import {
  answer,
  initialSession,
  nextQuestion,
  type Session,
} from "../../domain/rules";
import { Countdown } from "../../components/Countdown";
import { CharacterGuide } from "./CharacterGuide";
import { useCountdown } from "./useCountdown";

const defaultNames = ["Đội Sao", "Đội Mây", "Đội Nắng", "Đội Trăng"];
type PlayerState = {
  session: Session;
  gameKey: string;
  names: string[];
  set: (session: Session) => void;
  configure: (key: string) => void;
  rename: (names: string[]) => void;
};
const useSession = create<PlayerState>()(
  persist(
    (set, get) => ({
      session: initialSession(),
      gameKey: "",
      names: defaultNames,
      set: (session) => set({ session }),
      configure: (key) => {
        if (get().gameKey !== key)
          set({ gameKey: key, session: initialSession(), names: defaultNames });
      },
      rename: (names) => set({ names }),
    }),
    {
      name: "math3-player-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function Player({
  spec,
  onExit,
  preview = false,
}: {
  spec: GameSpec;
  onExit: () => void;
  preview?: boolean;
}) {
  const {
    session,
    set,
    names,
    rename: setNames,
    configure,
    gameKey: storedKey,
  } = useSession();
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const questions = orderedQuestions(spec);
  const current = questions[session.index];
  const gameKey = JSON.stringify({
    ...spec,
    assets: spec.assets.map((a) => ({
      id: a.id,
      mime: a.mime,
      size: a.dataUrl.length,
    })),
  });
  const canResume =
    storedKey === gameKey && (session.index > 0 || session.status !== "intro");
  useEffect(() => {
    configure(gameKey);
  }, [gameKey, configure]);
  useEffect(() => {
    setPaused(false);
  }, [session.index, session.attempts]);
  const seconds = useCountdown(
    spec.config.timerSeconds,
    `${session.index}-${session.attempts}`,
    started && session.status === "question",
    paused,
  );
  const character = spec.config.character || "explorer";
  const stageIndex = started ? (current?.stageIndex ?? 3) : 0;
  const teamName = names[session.team].trim() || `Đội ${session.team + 1}`;
  const completed =
    session.status === "summary"
      ? questions.length
      : session.index + (session.status === "correct" ? 1 : 0);
  let dialogue =
    spec.config.welcomeText ||
    "Xin chào! Cùng mình tìm những mảnh chìa khóa và giải cứu vương quốc Toán học nhé!";
  if (started) {
    if (session.status === "summary")
      dialogue =
        "Hoan hô! Cả lớp đã mở được tất cả cánh cổng. Các nhà thám hiểm thật tuyệt vời!";
    else if (session.status === "intro")
      dialogue =
        current.stage.introText ||
        `Chào mừng đến ${current.stage.title}! Có ${current.stage.questionIds.length} thử thách đang chờ. Cả đội cùng giúp nhau nhé!`;
    else if (session.status === "wrong")
      dialogue = `Không sao đâu, mình cùng nghĩ lại nhé! ${current.question.hint}`;
    else if (session.status === "correct")
      dialogue = `Tuyệt vời, ${teamName}! ${current.question.explanation || "Em đã tìm được thêm một mảnh chìa khóa."}`;
    else if (spec.config.timerSeconds > 0 && seconds === 0)
      dialogue =
        "Đồng hồ đã hết giờ! Cả đội cùng trao đổi với thầy cô rồi trả lời nhé. Đừng lo, mình vẫn ở đây!";
    else
      dialogue = `${teamName} ơi, đến lượt mình rồi! Đọc kỹ câu hỏi và chọn một đáp án nhé.`;
  }
  function choose(id: string) {
    const correct = id === current.question.correctChoiceId;
    set(answer(session, correct, id));
    if (sound) {
      try {
        const ctx = new AudioContext(),
          oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = correct ? 660 : 220;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
        oscillator.onended = () => {
          void ctx.close();
        };
      } catch {
        setSound(false);
      }
    }
  }
  return (
    <main
      className={`play-world scene-${stageTheme(spec, stageIndex)}`}
      style={backgroundStyle(spec, stageIndex)}
    >
      <div className="toolbar world-toolbar">
        <button className="ghost" onClick={onExit}>
          ← Về trình soạn
        </button>
        <span>{preview ? "CHƠI THỬ" : "HÀNH TRÌNH TOÁN HỌC"}</span>
        <div className="actions">
          <button
            className="ghost"
            onClick={() => setSound(!sound)}
            aria-pressed={sound}
          >
            {sound ? "♫ Âm thanh bật" : "♫ Âm thanh tắt"}
          </button>
          <button
            className="ghost"
            onClick={() => {
              document.documentElement.requestFullscreen?.().catch(() => {});
            }}
          >
            ⛶ Toàn màn hình
          </button>
        </div>
      </div>
      {!started ? (
        <div className="welcome-layout">
          <section className="welcome-panel parchment">
            <span className="eyebrow">
              4 CHẶNG · 12 THỬ THÁCH · MỘT HÀNH TRÌNH
            </span>
            <h1>{spec.title}</h1>
            <p className="welcome-rule">
              Cùng đồng đội chọn đáp án, thu thập chìa khóa và mở cổng lâu đài!
            </p>
            <div className="welcome-steps">
              <span>👀 Đọc câu hỏi</span>
              <span>💡 Cùng suy nghĩ</span>
              <span>⭐ Chọn đáp án</span>
            </div>
            <div className="team-inputs">
              {names.map((name, i) => (
                <label key={i}>
                  <span>
                    {["⭐", "☁️", "☀️", "🌙"][i]} Đội {i + 1}
                  </span>
                  <input
                    value={name}
                    maxLength={30}
                    onChange={(e) =>
                      setNames(
                        names.map((n, j) => (i === j ? e.target.value : n)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="points-guide">
              <span>
                ⭐ Đúng ngay: <b>10 điểm</b>
              </span>
              <span>
                💡 Sau gợi ý: <b>5 điểm</b>
              </span>
            </div>
            <div className="actions centered">
              {canResume && (
                <button className="secondary" onClick={() => setStarted(true)}>
                  Tiếp tục phiên trước
                </button>
              )}
              <button
                className="adventure-button"
                onClick={() => {
                  set(initialSession());
                  setStarted(true);
                }}
              >
                Bắt đầu hành trình →
              </button>
            </div>
          </section>
          <CharacterGuide
            text={dialogue}
            character={character}
            narrationEnabled={spec.config.narrationEnabled !== false}
          />
        </div>
      ) : (
        <>
          <div className="journey world-path">
            {spec.stages.map((stage, i) => (
              <div
                key={stage.id}
                className={`${i === stageIndex ? "current" : ""} ${i < stageIndex || session.status === "summary" ? "completed" : ""}`}
              >
                <span>
                  {i < stageIndex || session.status === "summary"
                    ? "✓"
                    : scenes[stageTheme(spec, i)].icon}
                </span>
                <strong>{stage.title}</strong>
              </div>
            ))}
          </div>
          <div className="adventure-layout">
            <aside className="left-rail">
              {spec.config.timerSeconds > 0 &&
                ["question", "wrong", "correct"].includes(session.status) && (
                  <Countdown
                    seconds={seconds}
                    total={spec.config.timerSeconds}
                    paused={paused || session.status !== "question"}
                    controllable={session.status === "question"}
                    onPause={() => {
                      if (session.status === "question") setPaused(!paused);
                    }}
                  />
                )}
              <section className="scoreboard-panel">
                <h2>🏆 Bảng điểm</h2>
                <div className="scoreboard">
                  {names.map((name, i) => (
                    <button
                      key={i}
                      className={`team team-${i} ${session.team === i && session.status !== "summary" ? "active" : ""}`}
                      disabled={
                        session.attempts > 0 || session.status === "summary"
                      }
                      onClick={() => set({ ...session, team: i })}
                    >
                      <span className="team-symbol">
                        {["⭐", "☁️", "☀️", "🌙"][i]}
                      </span>
                      <span>{name.trim() || `Đội ${i + 1}`}</span>
                      <strong>{session.scores[i]}</strong>
                    </button>
                  ))}
                </div>
              </section>
              <div className="key-progress">
                <span>🗝️ Mảnh chìa khóa</span>
                <strong>
                  {completed} / {questions.length}
                </strong>
                <progress
                  value={completed}
                  max={questions.length}
                  aria-label="Số câu đã hoàn thành"
                />
              </div>
            </aside>
            <div className="game-arena">
              <div className="wooden-sign">
                {session.status === "summary"
                  ? "Hành trình hoàn thành!"
                  : `Chặng ${stageIndex + 1}: ${current.stage.title}`}
              </div>
              {session.status === "summary" ? (
                <section className="summary-panel parchment">
                  <div className="trophy">🏆</div>
                  <h1>Vương quốc đã được giải cứu!</h1>
                  <p>Cả lớp đều là những nhà thám hiểm tuyệt vời!</p>
                  <div className="ranking">
                    {session.scores
                      .map((score, i) => ({ score, i }))
                      .sort((a, b) => b.score - a.score)
                      .map(({ score, i }) => (
                        <div key={i}>
                          <span>
                            {["⭐", "☁️", "☀️", "🌙"][i]} Hạng{" "}
                            {1 + session.scores.filter((s) => s > score).length}{" "}
                            · {names[i].trim() || `Đội ${i + 1}`}
                          </span>
                          <strong>{score} điểm</strong>
                        </div>
                      ))}
                  </div>
                  <button
                    className="adventure-button"
                    onClick={() => {
                      set(initialSession());
                      setStarted(false);
                    }}
                  >
                    Chơi lại
                  </button>
                </section>
              ) : session.status === "intro" ? (
                <section className="stage-intro parchment">
                  <span className="stage-emblem">
                    {scenes[stageTheme(spec, stageIndex)].icon}
                  </span>
                  <h1>{current.stage.title}</h1>
                  <p>
                    {current.stage.questionIds.length} mảnh chìa khóa đang chờ
                    em khám phá!
                  </p>
                  <div className="intro-stars">✦ ✦ ✦</div>
                  <button
                    className="adventure-button"
                    onClick={() => set({ ...session, status: "question" })}
                  >
                    Bắt đầu chặng →
                  </button>
                </section>
              ) : (
                <section className="question-card adventure-question">
                  <div className="question-meta">
                    <span>
                      Thử thách {session.index + 1} / {questions.length}
                    </span>
                    <span>
                      {["⭐", "☁️", "☀️", "🌙"][session.team]} Lượt của{" "}
                      {teamName}
                    </span>
                  </div>
                  <div className="question-scroll parchment">
                    <h1>{current.question.prompt}</h1>
                    {current.question.imageAssetId && (
                      <img
                        className="question-image"
                        src={
                          spec.assets.find(
                            (a) => a.id === current.question.imageAssetId,
                          )?.dataUrl
                        }
                        alt="Hình minh họa câu hỏi"
                      />
                    )}
                  </div>
                  <div className="choices">
                    {current.question.choices.map((choice, i) => (
                      <button
                        key={choice.id}
                        disabled={session.status !== "question"}
                        className={`choice answer-${i} ${session.choice === choice.id ? session.status : ""}`}
                        onClick={() => choose(choice.id)}
                      >
                        <span>{["A", "B", "C", "D"][i]}</span>
                        <strong>{choice.text}</strong>
                        {session.choice === choice.id && (
                          <em>{session.status === "correct" ? "✓" : "↻"}</em>
                        )}
                      </button>
                    ))}
                  </div>
                  {session.status === "wrong" && (
                    <div className="feedback wrong" role="status">
                      <h2>↻ Chưa đúng, em thử lại nhé!</h2>
                      <p>{current.question.hint}</p>
                      <button
                        className="adventure-button"
                        onClick={() => {
                          setPaused(false);
                          set({ ...session, status: "question", choice: null });
                        }}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                  {session.status === "correct" && (
                    <div className="feedback correct" role="status">
                      <h2>
                        ✓ Chính xác! +{session.attempts === 1 ? 10 : 5} điểm
                      </h2>
                      <p>{current.question.explanation}</p>
                      <button
                        className="adventure-button"
                        onClick={() =>
                          set(
                            nextQuestion(
                              session,
                              questions.map((q) => q.stageIndex),
                            ),
                          )
                        }
                      >
                        {session.index === questions.length - 1
                          ? "Xem tổng kết"
                          : "Tiếp tục →"}
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
            <CharacterGuide
              text={dialogue}
              character={character}
              happy={
                session.status === "correct" || session.status === "summary"
              }
              narrationEnabled={spec.config.narrationEnabled !== false}
            />
          </div>
        </>
      )}
    </main>
  );
}

export function Countdown({
  seconds,
  total,
  paused,
  onPause,
  controllable = true,
}: {
  seconds: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  controllable?: boolean;
}) {
  const ratio = Math.max(0, Math.min(1, seconds / total));
  const time = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <div
      className={`countdown ${seconds <= 10 ? "low" : ""} ${seconds === 0 ? "expired" : ""}`}
    >
      <div
        className="countdown-face"
        role="timer"
        aria-label={`Đồng hồ đếm ngược: ${seconds} giây`}
        aria-live="off"
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="timer-track" cx="50" cy="50" r="42" />
          <circle
            className="timer-ring"
            cx="50"
            cy="50"
            r="42"
            pathLength="100"
            strokeDasharray={`${ratio * 100} 100`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div>
          <span>⏱</span>
          <strong>{time}</strong>
          <small>
            {seconds === 0 ? "Hết giờ" : paused ? "Tạm dừng" : "Còn lại"}
          </small>
        </div>
      </div>
      <button
        className="timer-control"
        onClick={onPause}
        disabled={seconds === 0 || !controllable}
        aria-label={paused ? "Tiếp tục đồng hồ" : "Tạm dừng đồng hồ"}
      >
        {paused ? "▶" : "Ⅱ"}
      </button>
    </div>
  );
}

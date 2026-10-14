import { useEffect, useRef, useState } from "react";

export function useCountdown(
  total: number,
  questionKey: string,
  active: boolean,
  paused: boolean,
) {
  const [seconds, setSeconds] = useState(total);
  const remaining = useRef(total * 1000);
  const previousKey = useRef("");
  useEffect(() => {
    if (!active) return;
    if (previousKey.current !== questionKey) {
      previousKey.current = questionKey;
      remaining.current = total * 1000;
      setSeconds(total);
    }
    if (paused || total === 0) return;
    const deadline = Date.now() + remaining.current;
    const tick = () => {
      remaining.current = Math.max(0, deadline - Date.now());
      setSeconds(Math.ceil(remaining.current / 1000));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => {
      remaining.current = Math.max(0, deadline - Date.now());
      clearInterval(interval);
    };
  }, [total, questionKey, active, paused]);
  return seconds;
}

import { useEffect, useRef } from "react";
import { api } from "./client";
export function usePlayRecord(
  gameId: string,
  complete: boolean,
  scores: number[],
  enabled: boolean,
) {
  const id = useRef(crypto.randomUUID()),
    wasComplete = useRef(false);
  useEffect(() => {
    if (complete && !wasComplete.current && enabled)
      void api("/sessions", {
        method: "POST",
        body: JSON.stringify({ id: id.current, gameId, result: { scores } }),
      }).catch(() => {});
    if (!complete && wasComplete.current) id.current = crypto.randomUUID();
    wasComplete.current = complete;
  }, [complete, enabled, gameId, scores]);
}

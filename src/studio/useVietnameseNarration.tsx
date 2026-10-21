import { useEffect, useRef, useState } from "react";
import { cueForNarration } from "../domain/narration-cues";
export function vietnameseVoice(voices: SpeechSynthesisVoice[]) {
  const available = voices.filter((voice) =>
    /^vi(?:-|$)/i.test(voice.lang.replaceAll("_", "-")),
  );
  return (
    available.find(
      (voice) => voice.localService && voice.lang.toLowerCase() === "vi-vn",
    ) ||
    available.find((voice) => voice.localService) ||
    available[0]
  );
}

export function narrationVoice(voices: SpeechSynthesisVoice[]) {
  return (
    vietnameseVoice(voices) ||
    voices.find(
      (v) => /^en(?:-|$)/i.test(v.lang.replaceAll("_", "-")) && v.localService,
    ) ||
    voices.find((v) => /^en(?:-|$)/i.test(v.lang.replaceAll("_", "-")))
  );
}

export function useVietnameseNarration(
  text: string,
  muted: boolean,
  paused: boolean,
) {
  const [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false);
  const replayNow = useRef<(() => void) | null>(null);
  useEffect(() => {
    let disposed = false,
      spoken = false,
      fallback = false;
    let audio: HTMLAudioElement | null = null,
      blobUrl: string | null = null;
    const controller = new AbortController();
    const synth = window.speechSynthesis;
    synth?.cancel();
    setNotice("");
    setReady(false);
    function browserSpeak() {
      if (disposed) return;
      if (!synth || !("SpeechSynthesisUtterance" in window)) {
        setNotice(
          "Chưa tải được âm thanh. Bạn vẫn có thể xem lời thoại trên màn hình.",
        );
        return;
      }
      const voice = narrationVoice(synth.getVoices());
      setReady(!!voice);
      if (!voice) {
        setNotice(
          "Chưa tải được giọng đọc tiếng Việt hoặc tiếng Anh. Nhấn Nghe lại lời thoại sau khi giọng đọc sẵn sàng.",
        );
        return;
      }
      if (spoken || muted || paused || !text.trim()) return;
      setNotice("");
      spoken = true;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(
        text.normalize("NFC").replace(/\s+/g, " ").trim(),
      );
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.85;
      u.pitch = 1;
      u.volume = 1;
      u.onerror = (e) => {
        if (!disposed && !["canceled", "interrupted"].includes(e.error))
          setNotice(
            e.error === "not-allowed"
              ? "Nhấn Nghe lại lời thoại để bắt đầu phát âm thanh."
              : "Chưa phát được giọng đọc. Nhấn Nghe lại lời thoại để thử lại.",
          );
      };
      synth.speak(u);
    }
    function playAudio() {
      if (disposed || muted || paused || !audio) return;
      synth?.cancel();
      audio.currentTime = 0;
      void audio
        .play()
        .then(() => {
          if (!disposed) setNotice("");
        })
        .catch((e) => {
          if (disposed || e.name === "AbortError") return;
          setNotice("Nhấn Nghe lại lời thoại để bắt đầu phát âm thanh.");
        });
    }
    replayNow.current = () => {
      if (audio) playAudio();
      else if (fallback) {
        spoken = false;
        browserSpeak();
      }
    };
    const voicesChanged = () => {
      if (fallback) browserSpeak();
    };
    synth?.addEventListener("voiceschanged", voicesChanged);
    const cue = cueForNarration(text);
    if (!muted && !paused && cue) {
      void fetch(import.meta.env.BASE_URL + "audio/vi/" + cue + ".mp3", {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (
            !response.ok ||
            !/audio\//i.test(response.headers.get("content-type") || "")
          )
            throw Error("Audio unavailable");
          const blob = await response.blob();
          if (disposed) return;
          blobUrl = URL.createObjectURL(blob);
          audio = new Audio(blobUrl);
          audio.preload = "auto";
          setReady(true);
          playAudio();
        })
        .catch(() => {
          if (!disposed) {
            fallback = true;
            browserSpeak();
          }
        });
    } else if (!muted && !paused && text.trim()) {
      fallback = true;
      browserSpeak();
    }
    return () => {
      disposed = true;
      replayNow.current = null;
      controller.abort();
      synth?.removeEventListener("voiceschanged", voicesChanged);
      synth?.cancel();
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [text, muted, paused]);
  return { notice, ready, replay: () => replayNow.current?.() };
}

export function NarrationFeedback({
  notice,
  onReplay,
  disabled,
  visible,
}: {
  notice: string;
  onReplay: () => void;
  disabled: boolean;
  visible: boolean;
}) {
  return (
    <div className="eg-narration-feedback">
      {notice && <small role="status">{notice}</small>}
      {visible && (
        <button type="button" disabled={disabled} onClick={onReplay}>
          Nghe lại lời thoại
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

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

export function useVietnameseNarration(
  text: string,
  muted: boolean,
  paused: boolean,
) {
  const [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [repeat, setRepeat] = useState(0);
  useEffect(() => {
    setNotice("");
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setReady(false);
      if (!muted && text)
        setNotice(
          "Trình duyệt chưa hỗ trợ giọng đọc. Bạn vẫn có thể xem lời thoại trên màn hình.",
        );
      return;
    }
    const synth = window.speechSynthesis;
    let disposed = false,
      spoken = false;
    synth.cancel();
    const speak = () => {
      if (disposed) return;
      const voice = vietnameseVoice(synth.getVoices());
      setReady(!!voice);
      if (muted || paused || !text.trim()) return;
      if (!voice) {
        setNotice(
          "Máy chưa có giọng đọc tiếng Việt. Lời thoại vẫn hiển thị; hãy bổ sung giọng tiếng Việt trong cài đặt giọng nói của thiết bị.",
        );
        return;
      }
      if (spoken) return;
      spoken = true;
      setNotice("");
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(
        text.normalize("NFC").replace(/\s+/g, " ").trim(),
      );
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onerror = (event) => {
        if (disposed || ["canceled", "interrupted"].includes(event.error))
          return;
        setNotice(
          event.error === "not-allowed"
            ? "Trình duyệt chưa cho phép phát giọng đọc. Nhấn Nghe lại lời thoại để bắt đầu."
            : "Chưa phát được giọng tiếng Việt. Bạn có thể nhấn Nghe lại lời thoại hoặc xem nội dung trên màn hình.",
        );
      };
      synth.speak(utterance);
    };
    speak();
    synth.addEventListener("voiceschanged", speak);
    return () => {
      disposed = true;
      synth.removeEventListener("voiceschanged", speak);
      synth.cancel();
    };
  }, [text, muted, paused, repeat]);
  return { notice, ready, replay: () => setRepeat((value) => value + 1) };
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

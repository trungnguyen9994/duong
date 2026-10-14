import { useEffect, useState } from "react";
import { Mascot, type Character } from "../../components/Mascot";

export function CharacterGuide({
  text,
  character = "explorer",
  happy = false,
  narrationEnabled = true,
}: {
  text: string;
  character?: Character;
  happy?: boolean;
  narrationEnabled?: boolean;
}) {
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const name = character === "dragon" ? "Rồng Số" : "Bé Sao";
  useEffect(() => {
    if (!voiceOn || !narrationEnabled || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    let disposed = false;
    const speak = () => {
      if (disposed) return;
      const voice = synth
        .getVoices()
        .find((v) => v.lang.toLowerCase().startsWith("vi"));
      if (!voice) {
        setVoiceNotice("Máy chưa có giọng tiếng Việt. Em xem lời thoại nhé!");
        return;
      }
      setVoiceNotice("");
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = "vi-VN";
      utterance.rate = 0.9;
      utterance.onstart = () => {
        if (!disposed) setSpeaking(true);
      };
      utterance.onend = () => {
        if (!disposed) setSpeaking(false);
      };
      utterance.onerror = () => {
        if (!disposed) {
          setSpeaking(false);
          setVoiceNotice(
            "Chưa đọc được lời thoại. Em xem nội dung trên màn hình nhé!",
          );
        }
      };
      synth.speak(utterance);
    };
    speak();
    synth.addEventListener("voiceschanged", speak);
    return () => {
      disposed = true;
      synth.removeEventListener("voiceschanged", speak);
      synth.cancel();
      setSpeaking(false);
    };
  }, [text, voiceOn, narrationEnabled]);
  return (
    <aside className={`character-guide ${happy ? "cheering" : ""}`}>
      <div className="speech-bubble">
        <span className="character-name">
          {name} {happy ? "★" : "✦"}
        </span>
        <p key={text}>{text}</p>
        {narrationEnabled && (
          <button
            className="voice-toggle"
            aria-pressed={voiceOn}
            onClick={() => {
              if (!("speechSynthesis" in window)) {
                setVoiceNotice(
                  "Trình duyệt chưa hỗ trợ đọc. Em xem lời thoại nhé!",
                );
                return;
              }
              setVoiceOn(!voiceOn);
            }}
          >
            {voiceOn ? "🔇 Tắt giọng kể" : `🔊 Nghe ${name}`}
          </button>
        )}
        {voiceNotice && <small role="status">{voiceNotice}</small>}
      </div>
      <Mascot character={character} speaking={speaking} happy={happy} />
    </aside>
  );
}

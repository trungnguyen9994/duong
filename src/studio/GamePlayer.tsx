import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { JourneyPlayer } from "./JourneyPlayer";
import { PicturePlayer } from "./PicturePlayer";
import { WheelPlayer } from "./WheelPlayer";
import { api } from "./client";
import { createStudioGame, type StudioSpec } from "../domain/studio-spec";
import { migrateLegacy } from "../domain/studio-migration";
import { sampleGame } from "../domain/sample";
import type { Asset } from "./StudioApp";
import { webTemplates } from "./templates";
import { getTemplate } from "../domain/template-registry";
export function GamePlayer({
  spec,
  onExit,
  assets,
  record = false,
}: {
  spec: StudioSpec;
  onExit: () => void;
  assets?: Asset[];
  record?: boolean;
}) {
  const manifest = getTemplate(spec.template.type, spec.template.version),
    Renderer = webTemplates[manifest.webRenderer as keyof typeof webTemplates];
  return (
    <Renderer
      spec={spec}
      onExit={onExit}
      initialAssets={assets}
      record={record}
    />
  );
}
export function SharedPlayer() {
  const { token } = useParams(),
    [data, setData] = useState<{ spec: StudioSpec; assets: Asset[] } | null>(
      null,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      void api<{ spec: StudioSpec; assets: Asset[] }>(`/public/shares/${token}`)
        .then((rows) => {
          if (active) {
            setData(rows);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  return error ? (
    <main className="eg-help">
      <p role="alert">{error}</p>
      <Link to="/library">Về thư viện</Link>
    </main>
  ) : data ? (
    <GamePlayer
      spec={data.spec}
      assets={data.assets}
      onExit={() => window.location.assign("/library")}
    />
  ) : (
    <p role="status">Đang mở trò chơi…</p>
  );
}
export function DemoPlayer() {
  const { type } = useParams(),
    [spec, setSpec] = useState<StudioSpec | null>(null);
  const imageId = "00000000-0000-4000-8000-000000000001";
  useEffect(() => {
    if (type === "journey") {
      void migrateLegacy(sampleGame(), async () => imageId).then(game => {
        game.settings.playMode = "individual";
        game.settings.teams = ["Minh Anh", "Gia Bảo", "Ngọc Hà", "Đức Minh"];
        setSpec(game);
      });
      return;
    }
    const s = createStudioGame(
      type === "word_wheel" ? "word_wheel" : "picture_reveal",
    );
    s.settings.teams = ["Minh Anh", "Gia Bảo", "Ngọc Hà", "Đức Minh"];
    if (s.kind === "word_wheel") {
      s.metadata.title = "Vòng quay Tiếng Việt";
      s.metadata.subjectId = "vietnamese";
      s.content.phrase = "CÁNH DIỀU";
      s.content.clue = "Đồ chơi bay trong gió, gắn với tuổi thơ.";
    }
    if (s.kind === "picture_reveal") {
      s.metadata.title = "Khám phá thiên nhiên";
      s.metadata.subjectId = "science";
      s.content.imageId = imageId;
      s.content.answer = "Rừng cây";
      s.content.questions = [
        ["Cây cần gì để sống?", "Nước"],
        ["Bộ phận nào của cây hút nước?", "Rễ"],
        ["Đâu là nơi sống của cá?", "Nước"],
        ["Chúng ta nên làm gì để bảo vệ rừng?", "Trồng cây"],
        ["Điều gì giúp sân trường sạch đẹp?", "Bỏ rác đúng nơi"],
        ["Con vật nào thường sống trong rừng?", "Hươu"],
      ].map(([prompt, answer]) => ({
        id: crypto.randomUUID(),
        prompt,
        choices: [answer, "Bánh kẹo", "Nhựa", "Sắt"],
        correct: 0,
        hint: "Cùng quan sát thiên nhiên nhé.",
        explanation: "",
      }));
    }
    setSpec(s);
  }, [type]);
  return (
    <div className="eg-demo-player">
      <p className="eg-demo-notice">
        Học liệu minh họa chưa được giáo viên duyệt. Chỉ dùng để trải nghiệm
        tính năng.
      </p>
      {spec && (
        <GamePlayer
          spec={spec}
          assets={[
            {
              id: imageId,
              owner_id: null,
              name: "Rừng cây minh họa",
              status: "ready",
              url: "/art/forest.png",
            },
          ]}
          onExit={() => window.location.assign("/library")}
        />
      )}
    </div>
  );
}

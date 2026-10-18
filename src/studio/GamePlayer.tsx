import { useEffect, useState } from "react";
import { useRef } from "react";
import { useAuth } from "./auth";
import { DEMO_FOREST_IMAGE } from "../domain/demo-assets";
import { isAdventure, adventureConfig } from "../domain/adventure-config";
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
  demo = false,
}: {
  spec: StudioSpec;
  onExit: () => void;
  assets?: Asset[];
  record?: boolean;
  demo?: boolean;
}) {
  const { session, loading } = useAuth();
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  async function exportPreview() {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setExporting(true);
    setExportError("");
    try {
      const job = await api<{ id: string }>("/exports", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ spec, demo, key: crypto.randomUUID() }),
      });
      for (let i = 0; i < 120; i++) {
        const status = await api<{ status: string; error?: string }>(
          `/jobs/${job.id}`,
          { signal: controller.signal },
        );
        if (status.status === "failed")
          throw Error(status.error || "Xuất PowerPoint thất bại.");
        if (status.status === "completed") {
          const file = await api<{ signedUrl: string }>(
            `/exports/${job.id}/download`,
            { signal: controller.signal },
          );
          window.location.assign(file.signedUrl);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            controller.signal.removeEventListener("abort", abort);
            resolve();
          }, 1000);
          function abort() {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          }
          controller.signal.addEventListener("abort", abort, { once: true });
        });
      }
      throw Error("File vẫn đang xử lý. Bạn có thể tải ở Lịch sử xuất.");
    } catch (e) {
      if (!controller.signal.aborted) setExportError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setExporting(false);
        running.current = null;
      }
    }
  }
  const manifest = getTemplate(spec.template.type, spec.template.version),
    Renderer = webTemplates[manifest.webRenderer as keyof typeof webTemplates];
  return (
    <>
      <Renderer
        spec={spec}
        onExit={onExit}
        initialAssets={assets}
        record={record}
      />
      <div
        className="eg-preview-export"
        aria-label="Xuất trò chơi đang chơi thử"
      >
        {session ? (
          <button
            disabled={loading || exporting}
            onClick={() => void exportPreview()}
          >
            {exporting ? "Đang xuất PowerPoint…" : "Xuất PowerPoint"}
          </button>
        ) : (
          <Link
            to="/login"
            onClick={() =>
              localStorage.setItem(
                "edugame-return",
                window.location.pathname + window.location.search,
              )
            }
          >
            Đăng nhập để xuất PowerPoint
          </Link>
        )}
        {exportError && <p role="alert">{exportError}</p>}
      </div>
    </>
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
  const imageId = DEMO_FOREST_IMAGE;
  useEffect(() => {
    if (type === "journey") {
      void migrateLegacy(sampleGame(), async () => imageId).then((game) => {
        game.settings.playMode = "individual";
        game.settings.teams = ["Minh Anh", "Gia Bảo", "Ngọc Hà", "Đức Minh"];
        setSpec(game);
      });
      return;
    }
    const s = createStudioGame(
      type && isAdventure(type)
        ? type
        : type === "clever_frog"
          ? "clever_frog"
          : type === "word_wheel"
            ? "word_wheel"
            : "picture_reveal",
    );
    s.settings.teams = ["Minh Anh", "Gia Bảo", "Ngọc Hà", "Đức Minh"];
    if (
      s.kind === "forest_rescue" ||
      s.kind === "boat_rescue" ||
      s.kind === "football"
    ) {
      s.content.questions.forEach((q, i) => {
        q.prompt = `${i + 2} × 3 bằng bao nhiêu?`;
        q.choices = [
          String((i + 2) * 3),
          String((i + 2) * 3 + 1),
          String((i + 2) * 3 - 1),
          String((i + 2) * 3 + 2),
        ];
        if (s.kind === "boat_rescue") q.choices[3] = "";
        q.hint = "Đếm thêm 3 mỗi lần nhé.";
        q.explanation = `Lấy ${i + 2} ba lần được ${(i + 2) * 3}.`;
      });
    }
    if (s.kind === "clever_frog") {
      s.content.questions.forEach((q, i) => {
        q.prompt = `${i + 1} × 3 bằng bao nhiêu?`;
        q.choices[0] = String((i + 1) * 3);
        q.explanation = `Lấy ${i + 1} ba lần được ${(i + 1) * 3}.`;
      });
    }
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
          demo
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

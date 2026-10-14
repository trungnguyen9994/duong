import {
  backgroundStyle,
  scenes,
  sceneThemes,
  stageTheme,
  type SceneTheme,
} from "../../domain/appearance";
import type { GameSpec } from "../../domain/game-spec";
import { Mascot } from "../../components/Mascot";

export function StageDesigner({
  spec,
  index,
  onSelect,
  onChange,
  onUpload,
}: {
  spec: GameSpec;
  index: number;
  onSelect: (index: number) => void;
  onChange: (spec: GameSpec) => void;
  onUpload: (id: string, file: File) => void;
}) {
  const stage = spec.stages[index];
  const change = (patch: Partial<typeof stage>) =>
    onChange({
      ...spec,
      stages: spec.stages.map((s) =>
        s.id === stage.id ? { ...s, ...patch } : s,
      ),
    });
  function chooseTheme(theme: SceneTheme) {
    change({ backgroundTheme: theme, backgroundAssetId: undefined });
  }
  return (
    <section className="stage-designer">
      <div className="designer-heading">
        <div>
          <span className="eyebrow">BƯỚC 2 · DỰNG THẾ GIỚI PHIÊU LƯU</span>
          <h2>Mỗi chặng, một vùng đất mới</h2>
          <p>
            Chọn phong cảnh, người bạn đồng hành và lời chào. Câu hỏi luôn nằm
            trên bảng sáng để dễ đọc.
          </p>
        </div>
        <span className="designer-badge">🎨 Không cần thiết kế từ đầu</span>
      </div>
      <div className="stage-gallery">
        {spec.stages.map((s, i) => (
          <button
            key={s.id}
            className={`stage-card ${index === i ? "selected" : ""}`}
            onClick={() => onSelect(i)}
            aria-pressed={index === i}
          >
            <div className="stage-thumbnail" style={backgroundStyle(spec, i)}>
              <span>{scenes[stageTheme(spec, i)].icon}</span>
            </div>
            <small>CHẶNG {i + 1}</small>
            <strong>{s.title}</strong>
            <span>
              {s.questionIds.length} câu hỏi ·{" "}
              {s.backgroundAssetId
                ? "Ảnh của bạn"
                : scenes[stageTheme(spec, i)].name}
            </span>
          </button>
        ))}
      </div>
      <div className="designer-columns">
        <div className="background-picker">
          <h3>🖼️ Chọn nền cho {stage.title}</h3>
          <div className="theme-options">
            {sceneThemes.map((theme) => (
              <button
                key={theme}
                className={`theme-option ${!stage.backgroundAssetId && stageTheme(spec, index) === theme ? "selected" : ""}`}
                aria-pressed={
                  !stage.backgroundAssetId && stageTheme(spec, index) === theme
                }
                onClick={() => chooseTheme(theme)}
              >
                <div
                  style={backgroundStyle(
                    {
                      ...spec,
                      stages: spec.stages.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              backgroundTheme: theme,
                              backgroundAssetId: undefined,
                            }
                          : s,
                      ),
                    },
                    index,
                  )}
                />
                <span>
                  {scenes[theme].icon} {scenes[theme].name}
                </span>
              </button>
            ))}
          </div>
          <label className="upload-tile">
            📤 Dùng ảnh nền của bạn
            <input
              type="file"
              accept="image/png,image/jpeg"
              aria-label="Tải ảnh nền cho chặng"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(stage.id, file);
                e.target.value = "";
              }}
            />
            <small>PNG/JPEG, tối đa 3 MB · Nên dùng ảnh ngang 16:9</small>
          </label>
          {stage.backgroundAssetId && (
            <button
              className="ghost"
              onClick={() => change({ backgroundAssetId: undefined })}
            >
              ↶ Quay về nền có sẵn
            </button>
          )}
          <label>
            Lời chào của nhân vật ở chặng này
            <textarea
              rows={3}
              maxLength={300}
              value={stage.introText || ""}
              placeholder={`Chào mừng đến ${stage.title}! Cùng khám phá nhé!`}
              onChange={(e) => change({ introText: e.target.value })}
            />
          </label>
        </div>
        <div className="appearance-preview">
          <h3>👀 Học sinh sẽ nhìn thấy</h3>
          <div className="mini-game" style={backgroundStyle(spec, index)}>
            <div className="mini-sign">{stage.title}</div>
            <div className="mini-parchment">
              {spec.questions.find((q) => q.id === stage.questionIds[0])
                ?.prompt || "Câu hỏi của em sẽ hiện ở đây"}
            </div>
            <div className="mini-answers">
              <span>A</span>
              <span>B</span>
              <span>C</span>
              <span>D</span>
            </div>
            <Mascot character={spec.config.character || "explorer"} />
          </div>
          <p>
            Nền và nhân vật được dùng khi chơi Web. Ảnh nền cũng được nhúng khi
            xuất PowerPoint.
          </p>
        </div>
      </div>
      <section className="character-settings">
        <div>
          <h3>💬 Người bạn dẫn chuyện</h3>
          <p>
            Nhân vật chào lớp, động viên và đưa gợi ý. Có thể bật đọc lời thoại
            khi chơi.
          </p>
        </div>
        <div className="character-options">
          {(["explorer", "star", "dragon"] as const).map((character) => (
            <button
              key={character}
              className={
                spec.config.character === character ||
                (!spec.config.character && character === "explorer")
                  ? "selected"
                  : ""
              }
              aria-pressed={(spec.config.character || "explorer") === character}
              onClick={() =>
                onChange({ ...spec, config: { ...spec.config, character } })
              }
            >
              <Mascot character={character} />
              <span>
                {character === "explorer"
                  ? "Bé Sao thám hiểm"
                  : character === "star"
                    ? "Bé Sao lung linh"
                    : "Rồng Số vui vẻ"}
              </span>
            </button>
          ))}
        </div>
        <label>
          Lời chào đầu trò chơi
          <textarea
            rows={2}
            maxLength={300}
            value={spec.config.welcomeText || ""}
            placeholder="Xin chào, cùng mình khám phá vương quốc Toán học nhé!"
            onChange={(e) =>
              onChange({
                ...spec,
                config: { ...spec.config, welcomeText: e.target.value },
              })
            }
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={spec.config.narrationEnabled !== false}
            onChange={(e) =>
              onChange({
                ...spec,
                config: { ...spec.config, narrationEnabled: e.target.checked },
              })
            }
          />
          Cho phép bật giọng đọc tiếng Việt trên màn chơi
        </label>
      </section>
    </section>
  );
}

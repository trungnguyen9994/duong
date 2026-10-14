import { useState } from "react";
import { Mascot } from "./Mascot";

function ActionIcon({ kind }: { kind: "create" | "play" | "pptx" }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      {kind === "create" ? (
        <>
          <path
            d="M15 15Q8 15 5 44Q4 54 14 52L24 44H40L50 52Q60 53 59 44L54 22Q52 15 44 15Z"
            fill="white"
          />
          <path
            d="M16 26V39M10 32H23"
            stroke="#5cb735"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="43" cy="28" r="3" fill="#5cb735" />
          <circle cx="49" cy="35" r="3" fill="#5cb735" />
        </>
      ) : kind === "play" ? (
        <>
          <rect x="6" y="10" width="52" height="42" rx="9" fill="white" />
          <path d="M26 20L43 31 26 43Z" fill="#179ae4" />
        </>
      ) : (
        <>
          <rect x="23" y="8" width="34" height="46" rx="4" fill="#fff0d4" />
          <rect x="6" y="16" width="33" height="33" rx="5" fill="white" />
          <path
            d="M18 25H24Q32 25 32 31T24 37H18M18 25V42"
            fill="none"
            stroke="#ee7825"
            strokeWidth="4"
          />
          <path
            d="M43 18H50M43 25H50M43 32H50M43 39H50"
            stroke="#ee7825"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}
export function HomeHero({
  onCreate,
  onPlay,
  onExport,
}: {
  onCreate: () => void;
  onPlay: () => void;
  onExport: () => void;
}) {
  const [girlFailed, setGirlFailed] = useState(false);
  return (
    <section className="home-hero">
      <div className="home-landscape">
        <div className="home-explorer home-explorer-left">
          <Mascot character="explorer" />
        </div>
        <div className="home-center">
          <div className="home-wood-sign">
            <span className="sign-leaf sign-leaf-left" aria-hidden="true">
              🌿
            </span>
            <span className="sign-leaf sign-leaf-right" aria-hidden="true">
              🌿
            </span>
            <h1>Thiết kế trò chơi dạy học</h1>
            <p className="home-slogan">Dễ dàng – Sinh động – Hiệu quả</p>
            <span className="sign-divider" />
            <p className="home-audience">Dành cho giáo viên Tiểu học lớp 3</p>
          </div>
          <div className="home-big-actions">
            <button className="home-action create" onClick={onCreate}>
              <ActionIcon kind="create" />
              <span>
                Tạo trò chơi
                <br />
                <small>bằng mẫu có sẵn</small>
              </span>
            </button>
            <button className="home-action play" onClick={onPlay}>
              <ActionIcon kind="play" />
              <span>
                Chơi trực tuyến
                <br />
                <small>ngay trên website</small>
              </span>
            </button>
            <button className="home-action pptx" onClick={onExport}>
              <ActionIcon kind="pptx" />
              <span>
                Tải PowerPoint
                <br />
                <small>sử dụng trong lớp</small>
              </span>
            </button>
          </div>
        </div>
        <div className="home-explorer home-explorer-right">
          {girlFailed ? (
            <Mascot character="star" />
          ) : (
            <img
              src="/art/explorer-girl.png"
              alt="Bạn nhỏ thám hiểm cùng Bé Sao"
              onError={() => setGirlFailed(true)}
            />
          )}
        </div>
      </div>
      <div className="home-benefits">
        <div>
          <span>💡</span>
          <p>
            <b>Mẫu phiêu lưu sẵn có</b>
            <small>4 chặng, dễ chỉnh sửa</small>
          </p>
        </div>
        <div>
          <span>⭐</span>
          <p>
            <b>Dễ sử dụng</b>
            <small>Không cần biết lập trình</small>
          </p>
        </div>
        <div>
          <span>☁️</span>
          <p>
            <b>Chơi trên Web</b>
            <small>Và xuất PowerPoint offline</small>
          </p>
        </div>
        <div>
          <span>👫</span>
          <p>
            <b>Cùng học, cùng chơi</b>
            <small>Dành cho học sinh lớp 3</small>
          </p>
        </div>
      </div>
    </section>
  );
}

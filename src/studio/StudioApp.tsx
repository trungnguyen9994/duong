import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { AuthProvider, RequireAuth, useAuth } from "./auth";
import { api, configured, backend } from "./client";
import {
  templateRegistry,
  templateTypes,
  type StudioSpec,
} from "../domain/studio-spec";
import { App as LegacyApp } from "../App";
import { Player } from "../features/player/Player";
import { sampleGame } from "../domain/sample";
import { Builder } from "./builder";
import { QuestionBank } from "./QuestionBank";
import { AdminPanel } from "./AdminPanel";
import { useCatalog } from "./useCatalog";
import "./utilities.css";
import "./studio.css";
import { Home, Header } from "./HomePage";
import "./homepage.css";
import { DemoPlayer, SharedPlayer } from "./GamePlayer";

export type GameRow = {
  id: string;
  spec: StudioSpec;
  revision: number;
  status: string;
  updated_at: string;
};
type ExportRow = {
  id: string;
  status: string;
  created_at: string;
  error?: string;
};
export type Asset = {
  id: string;
  owner_id: string | null;
  name: string;
  status: string;
  url?: string;
  thumbnailUrl?: string;
  alt_text?: string;
  revision?: number;
};
export const subjects: Record<string, string> = {
  math: "Toán",
  vietnamese: "Tiếng Việt",
  science: "Tự nhiên và Xã hội",
  ethics: "Đạo đức",
  technology: "Công nghệ",
  other: "Khác",
};
function Login() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const [mode, setMode] = useState(params.get("mode") || "login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const requested = params.get("next") || "/dashboard";
  const next =
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.startsWith("/login")
      ? requested
      : "/dashboard";
  useEffect(() => {
    if (session && mode !== "update") navigate(next, { replace: true });
  }, [session, mode, next, navigate]);
  useEffect(() => {
    const { data } = backend.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!configured)
        throw new Error(
          "Backend chưa được cấu hình. Hãy kiểm tra máy chủ API.",
        );
      localStorage.setItem("edugame-return", next);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const result =
        mode === "signup"
          ? await backend.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: name },
                emailRedirectTo: redirectTo,
              },
            })
          : mode === "reset"
            ? await backend.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login?mode=update`,
              })
            : mode === "update"
              ? await backend.auth.updateUser({ password })
              : await backend.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup")
        setMessage(
          import.meta.env.VITE_LOCAL_MAIL_URL
            ? "Đã gửi thư xác minh. Mở hộp thư local tại http://127.0.0.1:8025 để xác minh email."
            : "Đã gửi thư xác minh. Hãy kiểm tra hộp thư email của bạn.",
        );
      if (mode === "reset")
        setMessage(
          "Nếu email tồn tại, thư đặt lại mật khẩu sẽ được gửi tới hộp thư local.",
        );
      if (mode === "update") {
        setMessage("Đã đổi mật khẩu.");
        navigate(next);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể đăng nhập.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="eg-auth">
      <form className="eg-card" onSubmit={submit}>
        <h1>
          {mode === "signup"
            ? "Tạo tài khoản giáo viên"
            : mode === "reset"
              ? "Quên mật khẩu"
              : mode === "update"
                ? "Đặt mật khẩu mới"
                : "Chào mừng trở lại!"}
        </h1>
        <p>Cùng tạo những giờ học đầy hứng thú.</p>
        <div className="eg-tabs">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => setMode("login")}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            aria-pressed={mode === "signup"}
            onClick={() => setMode("signup")}
          >
            Đăng ký
          </button>
        </div>
        {mode === "signup" && (
          <label>
            Tên hiển thị
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoComplete="name"
            />
          </label>
        )}
        {mode !== "update" && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Mật khẩu
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        )}
        <button className="eg-button" disabled={busy}>
          {busy
            ? "Đang xử lý…"
            : mode === "signup"
              ? "Đăng ký"
              : mode === "reset"
                ? "Gửi thư đặt lại"
                : mode === "update"
                  ? "Lưu mật khẩu"
                  : "Đăng nhập"}
        </button>
        <button
          className="eg-quiet"
          type="button"
          onClick={() => setMode("reset")}
        >
          Quên mật khẩu?
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
function Callback() {
  const { session, loading } = useAuth();
  if (loading) return <p role="status">Đang xác minh…</p>;
  const target = localStorage.getItem("edugame-return") || "/dashboard";
  return session ? (
    <Navigate
      to={
        target.startsWith("/") && !target.startsWith("//")
          ? target
          : "/dashboard"
      }
      replace
    />
  ) : (
    <div className="eg-card">
      Chưa xác minh được email. <Link to="/login">Trở lại đăng nhập</Link>
    </div>
  );
}
export function TeacherLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return (
    <div className="eg-workspace">
      <aside className="eg-sidebar">
        <p>KHÔNG GIAN GIÁO VIÊN</p>
        {[
          ["/dashboard", "▦ Trò chơi của tôi"],
          ["/builder/new", "＋ Tạo trò chơi mới"],
          ["/library", "▧ Thư viện mẫu"],
          ["/questions", "? Ngân hàng câu hỏi"],
          ["/media", "▣ Tài nguyên"],
          ["/exports", "⇩ Lịch sử xuất"],
          ["/help", "☷ Hướng dẫn"],
        ].map(([to, label]) => (
          <NavLink key={to} to={to}>
            {label}
          </NavLink>
        ))}
        {profile?.role !== "teacher" && (
          <NavLink to="/admin">⚙ Quản trị</NavLink>
        )}
      </aside>
      <main className="eg-main">{children}</main>
    </div>
  );
}
function Library() {
  const [searchParams] = useSearchParams();
  const {
    subjects: catalogSubjects,
    enabledTemplates,
    error: catalogError,
  } = useCatalog();
  const [type, setType] = useState(""),
    [subject, setSubject] = useState(""),
    [grade, setGrade] = useState(""),
    [query, setQuery] = useState(searchParams.get("q") || ""),
    [pptx, setPptx] = useState(false);
  return (
    <div className="eg-workspace">
      <aside className="eg-sidebar">
        <h2>Khám phá mẫu</h2>
        <label>
          Môn học
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tất cả môn</option>
            {Object.entries(catalogSubjects).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Khối
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Tất cả khối</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Loại trò chơi
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả mẫu</option>
            {templateTypes.map((t) => (
              <option key={t} value={t}>
                {templateRegistry[t].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={pptx}
            onChange={(e) => setPptx(e.target.checked)}
          />{" "}
          Đã hỗ trợ xuất PPTX
        </label>
      </aside>
      <main className="eg-main">
        <h1>Mẫu trò chơi</h1>
        {catalogError && <p role="alert">{catalogError}</p>}
        <p>
          Chọn một thế giới để bắt đầu bài học.{" "}
          {subject && catalogSubjects[subject]} {grade && `· Lớp ${grade}`}
        </p>
        <input
          aria-label="Tìm mẫu"
          placeholder="Tìm mẫu trò chơi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="eg-grid">
          {templateTypes
            .filter((t) => enabledTemplates.includes(t))
            .filter(
              (t) =>
                (!type || t === type) &&
                templateRegistry[t].name
                  .toLocaleLowerCase("vi")
                  .includes(query.toLocaleLowerCase("vi")) &&
                (!pptx || templateRegistry[t].released),
            )
            .map((t) => {
              const template = templateRegistry[t];
              return (
                <article className="eg-template eg-card" key={t}>
                  <img src={template.image} alt="" />
                  <div>
                    <h2>{template.name}</h2>
                    <span className="eg-tag">Đa môn · Khối 1–5</span>
                    <p>{template.pptx}</p>
                    {template.released ? (
                      <div className="eg-actions">
                        <Link to={`/demo/${t}`}>Chơi thử</Link>
                        <Link
                          className="eg-button"
                          to={`/builder/new?template=${t}&subject=${subject}&grade=${grade}`}
                        >
                          Sử dụng mẫu
                        </Link>
                      </div>
                    ) : (
                      <>
                        <span className="eg-tag">Sắp ra mắt</span>
                        {t === "journey" && (
                          <p>
                            <Link to="/demo/journey">
                              Chơi demo Hành trình hiện có
                            </Link>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
        {pptx && !templateTypes.some((t) => templateRegistry[t].released) && (
          <div className="eg-empty">
            Các bản xuất V4.1 đang được hoàn thiện và kiểm thử.
          </div>
        )}
      </main>
    </div>
  );
}
function Dashboard({ exportsOnly = false }: { exportsOnly?: boolean }) {
  const { subjects: catalogSubjects } = useCatalog();
  const [showArchived, setShowArchived] = useState(false);
  const [data, setData] = useState<{
      games: GameRow[];
      exports: ExportRow[];
      exportsCount: number;
      plays: number;
    } | null>(null),
    [error, setError] = useState("");
  const load = () => {
    setError("");
    void api<typeof data & {}>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  return (
    <TeacherLayout>
      <div className="eg-title">
        <div>
          <p className="eg-eyebrow">EDUGAME STUDIO</p>
          <h1>{exportsOnly ? "Lịch sử xuất" : "Trò chơi của tôi"}</h1>
        </div>
        <Link className="eg-button" to="/builder/new">
          ＋ Tạo trò chơi
        </Link>
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={load}>Thử lại</button>
        </p>
      ) : !data ? (
        <p role="status">Đang tải dữ liệu…</p>
      ) : exportsOnly ? (
        data.exports.length ? (
          <div className="eg-card">
            {data.exports.map((job) => (
              <p key={job.id}>
                {new Date(job.created_at).toLocaleString("vi")} · {job.status}{" "}
                {job.error}
                {job.status === "completed" && (
                  <button
                    onClick={() =>
                      void api<{ signedUrl: string }>(
                        `/exports/${job.id}/download`,
                      )
                        .then((file) => window.location.assign(file.signedUrl))
                        .catch((e) => setError(e.message))
                    }
                  >
                    Tải PowerPoint
                  </button>
                )}
              </p>
            ))}
          </div>
        ) : (
          <div className="eg-empty">Chưa có lượt xuất PowerPoint.</div>
        )
      ) : (
        <>
          <div className="eg-stats">
            {[
              ["Trò chơi", data.games.length],
              [
                "Bản nháp",
                data.games.filter((g) => g.status === "draft").length,
              ],
              ["Lượt chơi", data.plays],
              ["Lượt xuất", data.exportsCount],
            ].map(([label, value]) => (
              <article className="eg-card" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <h2>Gần đây</h2>
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Hiện cả bài đã lưu trữ
          </label>
          {data.games.length ? (
            <div className="eg-grid">
              {data.games
                .filter((g) => showArchived || g.status !== "archived")
                .map((g) => (
                  <Link
                    className="eg-card eg-game"
                    key={g.id}
                    to={`/builder/${g.id}`}
                  >
                    <img src={templateRegistry[g.spec.kind].image} alt="" />
                    <h2>{g.spec.metadata.title || "Chưa đặt tên"}</h2>
                    <p>
                      {catalogSubjects[g.spec.metadata.subjectId] ||
                        subjects[g.spec.metadata.subjectId] ||
                        g.spec.metadata.subjectId}{" "}
                      · Lớp {g.spec.metadata.grade}
                    </p>
                    <span className="eg-tag">
                      {g.status === "draft" ? "Bản nháp" : g.status} · Phiên bản
                      lưu {g.revision}
                    </span>
                  </Link>
                ))}
            </div>
          ) : (
            <div className="eg-empty">
              <h2>Bài học tiếp theo bắt đầu ở đây</h2>
              <p>
                Bạn chưa có trò chơi. Tạo bản nháp hoặc xem các mẫu trước nhé.
              </p>
              <Link className="eg-button" to="/builder/new">
                Tạo bản nháp đầu tiên
              </Link>
            </div>
          )}
          <p>
            <Link to="/legacy">Mở kho bài cũ trên trình duyệt này</Link>
          </p>
        </>
      )}
    </TeacherLayout>
  );
}
export function Media({ select }: { select?: (asset: Asset) => void }) {
  const [assets, setAssets] = useState<Asset[]>([]),
    [tab, setTab] = useState("default"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    void api<Asset[]>("/assets")
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (
        file.size > 5242880 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw new Error("Chỉ nhận PNG/JPEG/WebP, tối đa 5 MB.");
      const request = await api<{
        jobId: string;
        assetId: string;
        path: string;
        token: string;
      }>("/uploads/request", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          bytes: file.size,
          mime: file.type,
          key: crypto.randomUUID(),
        }),
      });
      const result = await backend.storage
        .from("uploads")
        .uploadToSignedUrl(request.path, request.token, file, {
          contentType: file.type,
        });
      if (result.error) throw result.error;
      await api(`/uploads/${request.jobId}/complete`, { method: "POST" });
      for (let i = 0; i < 80; i++) {
        const job = await api<{ status: string; error?: string }>(
          `/jobs/${request.jobId}`,
        );
        if (job.status === "failed") throw new Error(job.error);
        if (job.status === "completed") {
          setTab("mine");
          load();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setError("Ảnh đang xử lý. Bạn có thể tải lại danh sách sau.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Thư viện ảnh</h1>
      <p>
        Ảnh cá nhân luôn riêng tư. PNG, JPEG, WebP · tối đa 5 MB · 24 megapixel
        · ảnh tĩnh.
      </p>
      <div className="eg-tabs">
        <button
          aria-pressed={tab === "default"}
          onClick={() => setTab("default")}
        >
          Thư viện mặc định
        </button>
        <button aria-pressed={tab === "mine"} onClick={() => setTab("mine")}>
          Ảnh của tôi
        </button>
        <label className="eg-button">
          {busy ? "Đang xử lý…" : "＋ Tải ảnh lên"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Đang tải ảnh…</p>
      ) : (
        <div className="eg-grid">
          {assets
            .filter((a) => (tab === "mine" ? !!a.owner_id : !a.owner_id))
            .map((a) => (
              <article className="eg-card" key={a.id}>
                {a.url && (
                  <img
                    className="eg-asset"
                    src={a.thumbnailUrl || a.url}
                    alt={a.alt_text || a.name}
                  />
                )}
                <p>{a.name}</p>
                {a.status === "ready" ? (
                  <div className="eg-actions">
                    {select && (
                      <button onClick={() => select(a)}>Chọn ảnh</button>
                    )}
                    {a.owner_id && (
                      <button
                        onClick={() =>
                          void api(`/assets/${a.id}`, { method: "DELETE" })
                            .then(load)
                            .catch((e) => setError(e.message))
                        }
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                ) : (
                  <span>Đang chờ xử lý</span>
                )}
              </article>
            ))}
        </div>
      )}
      {!loading &&
        !assets.some((a) => (tab === "mine" ? !!a.owner_id : !a.owner_id)) && (
          <div className="eg-empty">
            {tab === "mine"
              ? "Bạn chưa tải ảnh lên."
              : "Chưa có ảnh mặc định được duyệt nguồn và quyền sử dụng."}
          </div>
        )}
    </section>
  );
}
function Help() {
  return (
    <main className="eg-help eg-card">
      <h1>Cùng tạo một tiết học vui</h1>
      <ol>
        <li>Đăng ký email và xác minh tài khoản.</li>
        <li>Chọn mẫu, đặt tên và thêm nội dung theo sáu bước.</li>
        <li>Chọn ảnh có quyền sử dụng từ thư viện hoặc ảnh cá nhân.</li>
        <li>Chơi thử, kiểm tra đáp án và khả năng xuất PowerPoint.</li>
      </ol>
      <p>
        Học liệu mẫu cần giáo viên duyệt trước khi dùng trên lớp. Các mẫu V4.1
        đang được hoàn thiện tuần tự.
      </p>
      <Link className="eg-button" to="/library">
        Khám phá mẫu
      </Link>
    </main>
  );
}
export function StudioApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="eg-app">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<Callback />} />
            <Route path="/library" element={<Library />} />
            <Route path="/help" element={<Help />} />
            <Route path="/play/:token" element={<SharedPlayer />} />
            <Route path="/demo/:type" element={<DemoPlayer />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/exports"
              element={
                <RequireAuth>
                  <Dashboard exportsOnly />
                </RequireAuth>
              }
            />
            <Route
              path="/builder/:id"
              element={
                <RequireAuth>
                  <TeacherLayout>
                    <Builder />
                  </TeacherLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/media"
              element={
                <RequireAuth>
                  <TeacherLayout>
                    <Media />
                  </TeacherLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/questions"
              element={
                <RequireAuth>
                  <TeacherLayout>
                    <QuestionBank />
                  </TeacherLayout>
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPanel />
                </RequireAuth>
              }
            />
            <Route
              path="/legacy"
              element={
                <RequireAuth>
                  <LegacyApp />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <main className="eg-help">
                  <h1>Không tìm thấy trang</h1>
                  <Link to="/">Về trang chủ</Link>
                </main>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

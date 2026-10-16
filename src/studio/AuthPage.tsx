import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth";
import { backend } from "./client";
import "./auth-page.css";

function AuthIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M9 5a13 13 0 0 1 3 0c6 0 10 7 10 7a19 19 0 0 1-4 4M6 6a23 23 0 0 0-4 6s4 7 10 7a12 12 0 0 0 4-1M10 10a3 3 0 0 0 4 4" />
      </>
    ),
    enter: (
      <>
        <path d="M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4M3 12h12m-4-4 4 4-4 4" />
      </>
    ),
    shield: (
      <>
        <path
          d="m12 2 9 4-1 8c-1 5-8 8-8 8s-7-3-8-8L3 6Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="m7 12 3 3 7-6" stroke="white" strokeWidth="2" />
      </>
    ),
    cap: (
      <>
        <path d="m2 8 10-5 10 5-10 5Z" fill="currentColor" />
        <path d="M6 11v6q6 5 12 0v-6M22 9v8" />
      </>
    ),
    game: (
      <>
        <path d="M7 6h10c4 0 7 13 3 14-2 1-4-4-5-4H9c-1 0-3 5-5 4C0 19 3 6 7 6Z" />
        <path d="M6 10v5m-2.5-2.5h5" />
        <circle cx="16" cy="11" r="1" fill="currentColor" />
        <circle cx="19" cy="14" r="1" fill="currentColor" />
      </>
    ),
    image: (
      <>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="m3 19 6-6 4 4 4-7 5 9" fill="currentColor" stroke="none" />
        <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
      </>
    ),
    play: <path d="m7 3 14 9-14 9Z" fill="currentColor" stroke="none" />,
    ppt: (
      <>
        <path d="m3 4 11-2v20L3 20Z" fill="currentColor" />
        <path d="M15 5h6v14h-6M7 16V8h3a2 2 0 0 1 0 4H7" />
        <path d="M7 16V8h3a2 2 0 0 1 0 4H7" stroke="#9d43ed" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
type Mode = "login" | "signup" | "reset" | "update";
const features = [
  ["game", "Nhiều mẫu", "trò chơi"],
  ["image", "Thư viện", "hình ảnh"],
  ["play", "Chơi trực", "tuyến"],
  ["ppt", "Xuất", "PowerPoint"],
];
export function Login() {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const mode: Mode = ["signup", "reset", "update"].includes(
    params.get("mode") || "",
  )
    ? (params.get("mode") as Mode)
    : "login";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [remember, setRemember] = useState(true),
    [failed, setFailed] = useState(false);
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
    setMessage("");
    setPassword("");
    setShowPassword(false);
  }, [mode]);
  function switchMode(value: Mode) {
    const query = new URLSearchParams(params);
    query.set("mode", value);
    if (value !== "update") query.delete("token");
    setParams(query, { replace: true });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      localStorage.setItem("edugame-return", next);
      const result =
        mode === "signup"
          ? await backend.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: name },
                emailRedirectTo: `${location.origin}/auth/callback`,
              },
            })
          : mode === "reset"
            ? await backend.auth.resetPasswordForEmail(email, {})
            : mode === "update"
              ? await backend.auth.updateUser({ password })
              : await backend.auth.signInWithPassword({
                  email,
                  password,
                  remember,
                });
      if (result.error) throw result.error;
      if (mode === "signup")
        setMessage(
          import.meta.env.VITE_LOCAL_MAIL_URL
            ? "Đã gửi thư xác minh. Mở hộp thư local tại http://127.0.0.1:8025 để xác minh email."
            : "Đã gửi thư xác minh. Hãy kiểm tra hộp thư email của bạn.",
        );
      if (mode === "reset")
        setMessage(
          "Nếu email tồn tại, thư đặt lại mật khẩu sẽ được gửi tới hộp thư của bạn.",
        );
      if (mode === "update") {
        setMessage("Đã đổi mật khẩu.");
        navigate(next);
      }
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error ? error.message : "Không thể đăng nhập.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? "Tạo tài khoản giáo viên"
      : mode === "reset"
        ? "Quên mật khẩu"
        : mode === "update"
          ? "Đặt mật khẩu mới"
          : "Chào mừng trở lại!";
  return (
    <main className="auth-page">
      <div className="auth-page-inner">
        <section className="auth-intro" aria-labelledby="auth-intro-title">
          <p className="auth-badge">
            <AuthIcon name="cap" />
            Nền tảng thiết kế trò chơi dạy học
          </p>
          <h2 id="auth-intro-title">
            Cùng tạo những <br />
            <span>giờ học</span> <em>đầy hứng thú!</em>
          </h2>
          <p className="auth-intro-description">
            Thiết kế trò chơi dạy học dành cho giáo viên Tiểu học.
            <br />
            Chơi trực tuyến và xuất PowerPoint tương tác.
          </p>
          <div className="auth-features">
            {features.map(([icon, line1, line2]) => (
              <div className={`auth-feature auth-feature-${icon}`} key={icon}>
                <span>
                  <AuthIcon name={icon} />
                </span>
                <p>
                  {line1}
                  <br />
                  {line2}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="auth-card" aria-labelledby="auth-form-title">
          <h1 id="auth-form-title">
            {title}
            {mode === "login" && (
              <span className="auth-wave" aria-hidden="true">
                👋
              </span>
            )}
          </h1>
          <p className="auth-card-description">
            {mode === "signup"
              ? "Bắt đầu tạo những giờ học sinh động cùng EduGame Studio."
              : mode === "reset"
                ? "Nhập email để nhận liên kết đặt lại mật khẩu."
                : mode === "update"
                  ? "Chọn mật khẩu mới có ít nhất 8 ký tự."
                  : "Đăng nhập để tiếp tục tạo những trò chơi dạy học thú vị."}
          </p>
          {(mode === "login" || mode === "signup") && (
            <div className="auth-tabs" aria-label="Chọn đăng nhập hoặc đăng ký">
              <button
                type="button"
                aria-pressed={mode === "login"}
                disabled={busy}
                onClick={() => switchMode("login")}
              >
                <AuthIcon name="mail" />
                Đăng nhập
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                disabled={busy}
                onClick={() => switchMode("signup")}
              >
                <AuthIcon name="user" />
                Đăng ký
              </button>
            </div>
          )}
          <form onSubmit={submit} className="auth-form" aria-busy={busy}>
            {mode === "signup" && (
              <div className="auth-field">
                <label htmlFor="auth-name">Tên hiển thị</label>
                <div className="auth-input">
                  <AuthIcon name="user" />
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    autoComplete="name"
                    placeholder="Họ và tên của bạn"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
            {mode !== "update" && (
              <div className="auth-field">
                <label htmlFor="auth-email">{mode === "login" ? "Email hoặc tên đăng nhập" : "Email"}</label>
                <div className="auth-input">
                  <AuthIcon name="mail" />
                  <input
                    id="auth-email"
                    type={mode === "login" ? "text" : "email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                    autoComplete={mode === "login" ? "username" : "email"}
                    placeholder={mode === "login" ? "Nhập email hoặc tên đăng nhập" : "Nhập email của bạn"}
                    disabled={busy}
                  />
                </div>
              </div>
            )}
            {mode !== "reset" && (
              <div className="auth-field">
                <label htmlFor="auth-password">Mật khẩu</label>
                <div className="auth-input">
                  <AuthIcon name="lock" />
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "signup"
                        ? "Tạo mật khẩu (ít nhất 8 ký tự)"
                        : "Nhập mật khẩu"
                    }
                    disabled={busy}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={busy}
                  >
                    <AuthIcon name={showPassword ? "eye" : "eyeOff"} />
                  </button>
                </div>
              </div>
            )}
            {mode === "login" && (
              <div className="auth-options">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={busy}
                  />
                  Ghi nhớ đăng nhập trong 30 ngày
                </label>
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  disabled={busy}
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}
            <button
              type="submit"
              className="eg-button auth-submit"
              disabled={busy}
            >
              <AuthIcon
                name={
                  mode === "signup"
                    ? "user"
                    : mode === "reset"
                      ? "mail"
                      : "enter"
                }
              />
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
            {(mode === "reset" || mode === "update") && (
              <button
                className="auth-back"
                type="button"
                onClick={() => switchMode("login")}
                disabled={busy}
              >
                ← Quay lại đăng nhập
              </button>
            )}
            {message && (
              <p
                className={`auth-message${failed ? " is-error" : ""}`}
                role={failed ? "alert" : "status"}
              >
                {message}
              </p>
            )}
          </form>
          <div className="auth-security">
            <AuthIcon name="shield" />
            <div>
              <strong>Tài khoản an toàn</strong>
              <p>
                Thông tin đăng nhập được bảo vệ để bạn yên tâm tạo những giờ học
                thú vị.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

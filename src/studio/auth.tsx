import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "./client";
import { Navigate, useLocation } from "react-router-dom";
import { configured, backend, api } from "./client";

type Profile = {
  id: string;
  display_name: string;
  role: "teacher" | "admin" | "super_admin";
  status: string;
  permissions: string[];
};
const Context = createContext<{
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
}>({ session: null, profile: null, loading: true, error: "" });
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let serial = 0;
    let authChanged = false;
    const update = async (value: Session | null) => {
      const request = ++serial;
      if (!active) return;
      setSession(value);
      setProfile(null);
      setError("");
      setLoading(true);
      if (value) {
        const result = await api<Profile>("/me")
          .then((data) => ({ data, error: null as Error | null }))
          .catch((error: Error) => ({ data: null, error }));
        if (!active || request !== serial) return;
        setProfile(result.data);
        if (result.error) setError(result.error.message);
      }
      if (active) setLoading(false);
    };
    if (configured) {
      void backend.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active || authChanged) return;
        if (sessionError) {
          setError(
            "Chưa kết nối được máy chủ để kiểm tra phiên. " +
              sessionError.message,
          );
          setLoading(false);
          return;
        }
        void update(data.session);
      });
      const { data } = backend.auth.onAuthStateChange((_event, value) => {
        authChanged = true;
        setTimeout(() => void update(value), 0);
      });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }
    setLoading(false);
    return () => {
      active = false;
    };
  }, []);
  return (
    <Context.Provider value={{ session, profile, loading, error }}>
      {children}
    </Context.Provider>
  );
}
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.loading) return <p role="status">Đang kiểm tra tài khoản…</p>;
  if (auth.error && !auth.session)
    return (
      <div className="eg-card" role="alert">
        {auth.error}
        <button onClick={() => window.location.reload()}>Thử lại</button>
      </div>
    );
  if (!auth.session)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (auth.error || !auth.profile)
    return (
      <div className="eg-card" role="alert">
        Không đọc được hồ sơ: {auth.error}
        <button onClick={() => window.location.reload()}>Thử lại</button>
      </div>
    );
  if (auth.profile.status !== "active")
    return (
      <div className="eg-card">
        Tài khoản đang chờ duyệt hoặc đã bị đình chỉ.
        <button onClick={() => void backend.auth.signOut()}>Đăng xuất</button>
      </div>
    );
  return children;
}

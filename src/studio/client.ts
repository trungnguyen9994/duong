export type Session = {
  user: { id: string; email: string; email_confirmed_at: string };
};
export const configured = true;
export const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";
const listeners = new Set<(event: string, session: Session | null) => void>();
const emit = (event: string, session: Session | null) =>
  listeners.forEach((fn) => fn(event, session));
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await response
    .json()
    .catch(() => ({ error: "Máy chủ không trả về dữ liệu hợp lệ." }));
  if (!response.ok)
    throw Object.assign(
      new Error(friendlyError(body.error || "Không thể kết nối máy chủ.")),
      { status: response.status },
    );
  return body;
}
async function authRequest(path: string, body?: unknown) {
  try {
    const data = await api<{ session?: Session | null }>(
      `/auth/${path}`,
      body ? { method: "POST", body: JSON.stringify(body) } : {},
    );
    return { data, error: null };
  } catch (e) {
    return {
      data: { session: null },
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
export const backend = {
  auth: {
    getSession: async () => {
      const r = await authRequest("session");
      return { data: { session: r.data.session || null }, error: r.error };
    },
    onAuthStateChange: (
      fn: (event: string, session: Session | null) => void,
    ) => {
      listeners.add(fn);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(fn);
            },
          },
        },
      };
    },
    signInWithPassword: async (input: {
      email: string;
      password: string;
      remember?: boolean;
    }) => {
      const r = await authRequest("login", input);
      if (!r.error) emit("SIGNED_IN", r.data.session || null);
      return r;
    },
    signUp: (input: {
      email: string;
      password: string;
      options: { data: { display_name: string }; emailRedirectTo: string };
    }) =>
      authRequest("signup", {
        email: input.email,
        password: input.password,
        display_name: input.options.data.display_name,
      }),
    resetPasswordForEmail: (email: string, _options: unknown) =>
      authRequest("reset", { email }),
    updateUser: async ({ password }: { password: string }) => {
      const r = await authRequest("password", {
        password,
        token: new URLSearchParams(location.search).get("token"),
      });
      if (!r.error) {
        history.replaceState(null, "", location.pathname + "?mode=update");
        emit("SIGNED_IN", r.data.session || null);
      }
      return r;
    },
    signOut: async () => {
      const r = await authRequest("logout", {});
      if (!r.error) emit("SIGNED_OUT", null);
      return r;
    },
  },
  storage: {
    from: (_bucket: string) => ({
      uploadToSignedUrl: async (
        _path: string,
        token: string,
        file: File,
        _options: unknown,
      ) => {
        try {
          const r = await fetch(
            `${apiBase}/api/files/upload?token=${encodeURIComponent(token)}`,
            {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type },
              credentials: "include",
            },
          );
          if (!r.ok) throw Error((await r.json()).error);
          return { error: null };
        } catch (e) {
          return { error: e instanceof Error ? e : Error(String(e)) };
        }
      },
    }),
  },
};
function friendlyError(message: string) {
  const translations: Record<string, string> = {
    ASSET_FORBIDDEN:
      "Bài có ảnh không thuộc quyền sử dụng. Hãy chọn ảnh thay thế trong bước Hình ảnh.",
    STORAGE_QUOTA:
      "Dung lượng tài khoản không đủ. Hãy xóa ảnh không dùng hoặc liên hệ quản trị viên.",
    UPLOAD_CONCURRENCY:
      "Đang có quá nhiều ảnh chờ xử lý. Hãy đợi ảnh trước hoàn tất.",
    EXPORT_DAILY_QUOTA: "Bạn đã dùng hết lượt xuất hôm nay.",
    EXPORT_CONCURRENCY: "Một bản PowerPoint đang được xử lý. Hãy đợi hoàn tất.",
    ACCOUNT_INACTIVE: "Tài khoản chưa được kích hoạt hoặc đã bị đình chỉ.",
    SUPER_ADMIN_REQUIRED: "Chỉ Super Admin được thực hiện thay đổi này.",
    FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
    SELF_LOCKOUT: "Không thể tự hạ quyền hoặc đình chỉ tài khoản đang sử dụng.",
    REVISION_CONFLICT:
      "Dữ liệu đã được sửa ở nơi khác. Hãy tải bản mới hoặc lưu thành bản sao.",
  };
  return (
    Object.entries(translations).find(([code]) =>
      message.includes(code),
    )?.[1] || message
  );
}

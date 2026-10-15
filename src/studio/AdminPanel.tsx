import { useEffect, useState } from "react";
import { api } from "./client";
import { useAuth } from "./auth";
import { TeacherLayout } from "./StudioApp";
type Row = Record<string, unknown>;
const sections: Record<string, string> = {
  accounts: "Tài khoản",
  subjects: "Môn học",
  templates: "Mẫu trò chơi",
  assets: "Ảnh mặc định",
  moderation: "Duyệt công bố",
  audit: "Nhật ký",
  operations: "Vận hành",
};
export function AdminPanel() {
  const { profile } = useAuth(),
    [section, setSection] = useState("accounts"),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<Row | null>(null);
  const permitted = (key: string) =>
    profile?.role === "super_admin" ||
    (profile?.role === "admin" && profile.permissions.includes(key));
  const load = () => {
    setLoading(true);
    setError("");
    void api<Row[]>(`/admin/${section}`)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [section]);
  useEffect(() => {
    if (!permitted(section)) {
      const first = Object.keys(sections).find(permitted);
      if (first) setSection(first);
    }
  }, [profile]);
  async function action(path: string, body: unknown, method = "POST") {
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setMessage("Đã cập nhật.");
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (profile?.role === "teacher")
    return (
      <TeacherLayout>
        <p role="alert">Bạn không có quyền quản trị.</p>
      </TeacherLayout>
    );
  return (
    <TeacherLayout>
      <p className="eg-eyebrow">QUẢN TRỊ EDUGAME STUDIO</p>
      <h1>{sections[section]}</h1>
      <div className="eg-tabs">
        {Object.entries(sections)
          .filter(([key]) => permitted(key))
          .map(([key, label]) => (
            <button
              key={key}
              aria-pressed={section === key}
              onClick={() => {
                setSection(key);
                setEditing(null);
                setMessage("");
              }}
            >
              {label}
            </button>
          ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {section === "subjects" && (
        <form
          className="eg-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action(
              `/admin/subjects/${f.get("id")}`,
              { name: f.get("name"), enabled: true },
              "PUT",
            );
            e.currentTarget.reset();
          }}
        >
          <h2>Thêm môn học</h2>
          <label>
            Mã môn
            <input name="id" pattern="[a-z][a-z0-9_]{0,39}" required />
          </label>
          <label>
            Tên môn
            <input name="name" maxLength={80} required />
          </label>
          <button>Thêm môn</button>
        </form>
      )}
      {editing && section === "accounts" && (
        <form
          className="eg-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              body: Row = { status: f.get("status") };
            if (profile?.role === "super_admin") {
              body.role = f.get("role");
              body.permissions = f.getAll("permission");
              for (const key of [
                "storage_limit",
                "upload_limit",
                "daily_export_limit",
                "concurrent_export_limit",
              ])
                body[key] = Number(f.get(key));
            }
            void action(`/admin/accounts/${editing.id}`, body, "PATCH");
          }}
        >
          <h2>{String(editing.display_name || editing.id)}</h2>
          <label>
            Trạng thái
            <select name="status" defaultValue={String(editing.status)}>
              <option value="active">Hoạt động</option>
              <option value="pending">Chờ duyệt</option>
              <option value="suspended">Đình chỉ</option>
            </select>
          </label>
          {profile?.role === "super_admin" && (
            <>
              <label>
                Vai trò
                <select name="role" defaultValue={String(editing.role)}>
                  {["teacher", "admin", "super_admin"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>Quyền Admin</legend>
                {Object.entries(sections).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      name="permission"
                      value={key}
                      defaultChecked={(
                        editing.permissions as string[]
                      ).includes(key)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {[
                ["storage_limit", "Dung lượng lưu trữ (byte)"],
                ["upload_limit", "Upload đồng thời"],
                ["daily_export_limit", "Xuất mỗi ngày"],
                ["concurrent_export_limit", "Export đồng thời"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    min={0}
                    defaultValue={Number(editing[key])}
                  />
                </label>
              ))}
            </>
          )}
          <button className="eg-button">Lưu thay đổi</button>
          <button type="button" onClick={() => setEditing(null)}>
            Hủy
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Đang tải dữ liệu…</p>
      ) : (
        <div className="eg-grid">
          {rows.map((row, index) => (
            <article
              className="eg-card"
              key={String(row.id || row.key || index)}
            >
              {section === "accounts" ? (
                <>
                  <h3>{String(row.display_name || row.id)}</h3>
                  <p>{String(row.email || "")}</p>
                  <p>
                    {String(row.role)} · {String(row.status)}
                  </p>
                  <p>
                    {Math.round(Number(row.storage_limit) / 1048576)} MB ·{" "}
                    {String(row.daily_export_limit)} xuất/ngày
                  </p>
                  <button onClick={() => setEditing(row)}>
                    Chỉnh sửa quyền / tài khoản
                  </button>
                </>
              ) : section === "subjects" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(
                      `/admin/subjects/${row.id}`,
                      {
                        name: f.get("name"),
                        enabled: f.get("enabled") === "on",
                      },
                      "PUT",
                    );
                  }}
                >
                  <p>{String(row.id)}</p>
                  <label>
                    Tên môn
                    <input
                      name="name"
                      defaultValue={String(row.name)}
                      required
                    />
                  </label>
                  <label>
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={!!row.enabled}
                    />
                    Đang sử dụng
                  </label>
                  <button>Lưu môn học</button>
                </form>
              ) : section === "moderation" ? (
                <>
                  <h3>
                    {String(
                      (row.spec as { metadata: { title: string } }).metadata
                        .title,
                    )}
                  </h3>
                  <details>
                    <summary>Xem nội dung</summary>
                    <pre className="eg-json">
                      {JSON.stringify(row.spec, null, 2)}
                    </pre>
                  </details>
                  <button
                    onClick={() =>
                      void action(`/admin/moderation/${row.id}`, {
                        revision: row.revision,
                        approve: true,
                      })
                    }
                  >
                    Duyệt công bố
                  </button>
                  <button
                    onClick={() =>
                      void action(`/admin/moderation/${row.id}`, {
                        revision: row.revision,
                        approve: false,
                      })
                    }
                  >
                    Trả về bản nháp
                  </button>
                </>
              ) : section === "assets" ? (
                <>
                  <h3>{String(row.name)}</h3>
                  <p>
                    {row.owner_id ? "Ảnh cá nhân" : "Ảnh mặc định"} ·{" "}
                    {String(row.status)}
                  </p>
                  {row.owner_id === profile?.id && row.status === "ready" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(`/admin/assets/${row.id}/publish`, {
                          source: f.get("source"),
                          license: f.get("license"),
                        });
                      }}
                    >
                      <label>
                        Nguồn ảnh
                        <input name="source" required minLength={3} />
                      </label>
                      <label>
                        Quyền sử dụng / giấy phép
                        <input name="license" required minLength={3} />
                      </label>
                      <button>Duyệt bản sao vào kho mặc định</button>
                    </form>
                  )}
                  {row.approved && (
                    <p>
                      {String(row.source)} · {String(row.license)}
                    </p>
                  )}
                </>
              ) : section === "templates" ? (
                <>
                  <h3>
                    {String(row.template_type)}@{String(row.version)}
                  </h3>
                  <span className="eg-tag">
                    {row.released
                      ? "Đã phát hành · Bất biến"
                      : "Chưa phát hành"}
                  </span>
                  <pre className="eg-json">
                    {JSON.stringify(row.config, null, 2)}
                  </pre>
                  <button
                    onClick={() =>
                      void action(
                        `/admin/templates/${row.template_type}`,
                        {
                          enabled: !(row.templates as { enabled: boolean })
                            ?.enabled,
                        },
                        "PUT",
                      )
                    }
                  >
                    {(row.templates as { enabled: boolean })?.enabled
                      ? "Ẩn khỏi danh mục tạo mới"
                      : "Mở cho tạo mới"}
                  </button>
                </>
              ) : section === "operations" ? (
                <>
                  <h3>Duyệt tài khoản mới</h3>
                  <p>Email luôn phải được xác minh.</p>
                  <button
                    aria-pressed={!!row.value}
                    onClick={() =>
                      void action(
                        "/admin/operations/approval",
                        { value: !row.value },
                        "PUT",
                      )
                    }
                  >
                    {row.value
                      ? "Đang bật duyệt · Bấm để tắt"
                      : "Tự kích hoạt Teacher · Bấm để bật duyệt"}
                  </button>
                </>
              ) : (
                <>
                  <p>{new Date(String(row.created_at)).toLocaleString("vi")}</p>
                  <b>{String(row.action)}</b>
                  <p>{String(row.target_id || "")}</p>
                  <pre className="eg-json">
                    {JSON.stringify(row.details, null, 2)}
                  </pre>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      {!loading && !rows.length && !error && (
        <div className="eg-empty">Chưa có dữ liệu trong mục này.</div>
      )}
    </TeacherLayout>
  );
}

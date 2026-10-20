import { useEffect, useState } from "react";
import { configured, api } from "./client";
import { templateTypes, type TemplateType } from "../domain/studio-spec";
export const initialSubjects: Record<string, string> = {
  math: "Toán",
  vietnamese: "Tiếng Việt",
  science: "Tự nhiên và Xã hội",
  ethics: "Đạo đức",
  technology: "Công nghệ",
  other: "Khác",
};
export function useCatalog() {
  const [subjects, setSubjects] = useState(initialSubjects),
    [enabledTemplates, setEnabled] = useState<TemplateType[]>([
      ...templateTypes,
    ]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!configured) return;
    let active = true,
      inFlight = false,
      failures = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function load() {
      if (!active || inFlight) return;
      clearTimeout(retry);
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const data = await api<{
          subjects: { id: string; name: string }[];
          templates: { type: TemplateType }[];
        }>("/catalog", { signal: controller.signal });
        if (!active) return;
        setSubjects(
          Object.fromEntries(data.subjects.map((row) => [row.id, row.name])),
        );
        setEnabled(data.templates.map((row) => row.type));
        setError("");
        failures = 0;
      } catch {
        if (!active) return;
        setError(
          "Chưa kết nối được danh mục môn học và mẫu. Đang tự kết nối lại…",
        );
        retry = setTimeout(
          () => void load(),
          Math.min(15000, 1000 * 2 ** Math.min(failures++, 4)),
        );
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    const reconnect = () => void load();
    void load();
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    return () => {
      active = false;
      clearTimeout(retry);
      controller?.abort();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
    };
  }, []);
  return { subjects, enabledTemplates, error };
}

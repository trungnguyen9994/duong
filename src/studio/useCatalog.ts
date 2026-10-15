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
    void api<{
      subjects: { id: string; name: string }[];
      templates: { type: TemplateType }[];
    }>("/catalog")
      .then((data) => {
        setSubjects(
          Object.fromEntries(data.subjects.map((row) => [row.id, row.name])),
        );
        setEnabled(data.templates.map((row) => row.type));
      })
      .catch(() =>
        setError("Không tải được danh mục môn học và mẫu. Hãy tải lại trang."),
      );
  }, []);
  return { subjects, enabledTemplates, error };
}

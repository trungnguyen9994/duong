import { api, backend } from "./client";
export async function uploadAsset(
  file: File,
  onStatus?: (message: string) => void,
): Promise<string> {
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
    if (job.status === "completed") return request.assetId;
    onStatus?.("Đang kiểm tra và chuẩn hóa ảnh…");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    "Ảnh còn đang xử lý. Kiểm tra lại trong thư viện ảnh trước khi nhập bài lần nữa.",
  );
}

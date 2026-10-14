import type { GameSpec } from "../../domain/game-spec";

export type Draft = { spec: GameSpec; updatedAt: string };
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("math3-library", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("games", { keyPath: "spec.id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Không mở được bộ nhớ trình duyệt. Hãy sao lưu JSON."));
    request.onblocked = () =>
      reject(new Error("Hãy đóng các tab trò chơi khác rồi tải lại."));
  }).catch((error) => {
    dbPromise = undefined;
    throw error;
  }));
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("games", mode);
    const req = run(tx.objectStore("games"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () =>
      reject(
        new Error(
          "Không lưu được dữ liệu. Hãy sao lưu JSON trước khi đóng trang.",
        ),
      );
    tx.onabort = () =>
      reject(new Error("Thao tác lưu bị hủy. Hãy sao lưu JSON."));
  });
}
export const listDrafts = () =>
  operation("readonly", (s) => s.getAll()) as Promise<Draft[]>;
export const saveDraft = (spec: GameSpec) =>
  operation("readwrite", (s) =>
    s.put({ spec, updatedAt: new Date().toISOString() }),
  );
export const deleteDraft = (id: string) =>
  operation("readwrite", (s) => s.delete(id));
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
export const safeName = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 80) || "Toan3";

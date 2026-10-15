import { pathToFileURL } from "node:url";
import { admin, checked } from "./client";
export async function cleanup() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const candidates = checked(
    await admin
      .from("assets")
      .select("*")
      .in("status", ["deleted", "failed"])
      .lt("created_at", cutoff)
      .limit(100),
  );
  let removed = 0;
  for (const asset of candidates) {
    const refs = checked(
      await admin
        .from("asset_references")
        .select("game_id")
        .eq("asset_id", asset.id),
    );
    const bank = checked(
      await admin.from("questions").select("id").eq("body->>imageId", asset.id),
    );
    const jobs = checked(
      await admin
        .from("jobs")
        .select("id")
        .in("status", ["queued", "running"])
        .contains("payload", { assetIds: [asset.id] }),
    );
    if (refs.length || bank.length || jobs.length) continue;
    const paths = new Set(
      [
        asset.path,
        asset.thumbnail_path,
        `${asset.owner_id}/${asset.id}.webp`,
        `${asset.owner_id}/${asset.id}-thumb.webp`,
      ].filter((p): p is string => !!p),
    );
    checked(await admin.storage.from("media").remove([...paths]));
    checked(
      await admin.storage
        .from("uploads")
        .remove([`${asset.owner_id}/${asset.id}`]),
    );
    checked(
      await admin
        .from("assets")
        .update({ bytes: 0, path: null, thumbnail_path: null })
        .eq("id", asset.id)
        .in("status", ["deleted", "failed"]),
    );
    removed++;
  }
  const exports = checked(
    await admin
      .from("jobs")
      .select("id,result")
      .eq("kind", "export")
      .eq("status", "completed")
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(100),
  );
  for (const job of exports) {
    if (!job.result?.path) continue;
    checked(await admin.storage.from("media").remove([job.result.path]));
    checked(
      await admin
        .from("jobs")
        .update({ result: { expired: true, bytes: 0 } })
        .eq("id", job.id),
    );
    removed++;
  }
  return { removed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(await cleanup());

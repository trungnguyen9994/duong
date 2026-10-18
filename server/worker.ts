import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { DEMO_FOREST_IMAGE } from "../src/domain/demo-assets";
import { admin, checked } from "./client";
import { renderPptx } from "./pptx";
import { assetIds, studioSpecSchema } from "../src/domain/studio-spec";
import { pathToFileURL } from "node:url";
import { cropImage } from "./media-crop";
import { validateImage } from "./image-validation";

export async function processJob() {
  const job = checked(await admin.rpc("claim_job"));
  if (!job?.id) return;
  const lease = () =>
    admin
      .from("jobs")
      .update({ lease_until: new Date(Date.now() + 120000).toISOString() })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .eq("status", "running");
  const heartbeat = setInterval(() => {
    void lease();
  }, 30000);
  try {
    const account = checked(
      await admin
        .from("profiles")
        .select("status")
        .eq("id", job.owner_id)
        .single(),
    );
    if (account.status !== "active") throw new Error("ACCOUNT_INACTIVE");
    if (job.kind === "export") {
      const spec = studioSpecSchema.parse(job.payload.spec);
      const resolved = new Map<string, Buffer>();
      for (const id of assetIds(spec)) {
        if (job.payload.demo === true && id === DEMO_FOREST_IMAGE) {
          resolved.set(
            id,
            await readFile(
              new URL("../public/art/forest.png", import.meta.url),
            ),
          );
          continue;
        }
        const asset = checked(
          await admin
            .from("assets")
            .select("*")
            .eq("id", id)
            .eq("status", "ready")
            .single(),
        );
        if (
          asset.owner_id !== job.owner_id &&
          !(asset.owner_id === null && asset.approved)
        )
          throw new Error("Không được phép dùng ảnh này.");
        const blob = checked(
          await admin.storage.from("media").download(asset.path),
        );
        resolved.set(id, Buffer.from(await blob.arrayBuffer()));
      }
      const file = await renderPptx(spec, resolved),
        path = `${job.owner_id}/exports/${job.id}.pptx`;
      checked(
        await admin.storage.from("media").upload(path, file, {
          contentType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          upsert: true,
        }),
      );
      checked(
        await admin.rpc("finish_export", {
          p_job: job.id,
          p_lease: job.lease_token,
          p_path: path,
          p_bytes: file.length,
        }),
      );
      return;
    }
    let sourcePath = job.payload.path,
      bucket = "uploads";
    if (job.payload.sourceAssetId) {
      const source = checked(
        await admin
          .from("assets")
          .select("*")
          .eq("id", job.payload.sourceAssetId)
          .eq("status", "ready")
          .single(),
      );
      if (
        source.owner_id !== job.owner_id &&
        !(source.owner_id === null && source.approved)
      )
        throw new Error("ASSET_FORBIDDEN");
      sourcePath = source.path;
      bucket = "media";
      checked(
        await admin
          .from("assets")
          .update({
            source: source.source,
            license: source.license,
            alt_text: source.alt_text,
          })
          .eq("id", job.payload.assetId),
      );
    }
    const blob = checked(await admin.storage.from(bucket).download(sourcePath));
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (!job.payload.sourceAssetId && bytes.length > 5242880)
      throw new Error("Ảnh vượt 5 MB.");
    await validateImage(
      bytes,
      job.payload.mime,
      job.payload.sourceAssetId ? undefined : job.payload.bytes,
      job.payload.sourceAssetId ? 33554432 : 5242880,
    );
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp)
      throw new Error("Chữ ký file không phải PNG/JPEG/WebP.");
    if (
      job.payload.mime !==
      (png ? "image/png" : jpeg ? "image/jpeg" : "image/webp")
    )
      throw new Error("MIME không khớp chữ ký file.");
    const metadata = await sharp(bytes, {
      limitInputPixels: 24000000,
      animated: true,
    }).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > 24000000 ||
      (metadata.pages || 1) !== 1
    )
      throw new Error("Chỉ nhận ảnh tĩnh, tối đa 24 megapixel.");
    const pixels = job.payload.crop
      ? await cropImage(bytes, job.payload.crop)
      : bytes;
    const normalized = await sharp(pixels, { limitInputPixels: 24000000 })
      .rotate()
      .webp({ quality: 88 })
      .toBuffer();
    const normalizedSize = await sharp(normalized).metadata();
    const thumbnail = await sharp(normalized)
      .resize(360, 240, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    const path = `${job.owner_id}/${job.payload.assetId}.webp`,
      thumb = `${job.owner_id}/${job.payload.assetId}-thumb.webp`;
    checked(
      await admin.storage
        .from("media")
        .upload(path, normalized, { contentType: "image/webp", upsert: true }),
    );
    checked(
      await admin.storage
        .from("media")
        .upload(thumb, thumbnail, { contentType: "image/webp", upsert: true }),
    );
    checked(
      await admin.rpc("finish_upload", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_path: path,
        p_thumb: thumb,
        p_bytes: normalized.length + thumbnail.length,
        p_width: normalizedSize.width,
        p_height: normalizedSize.height,
      }),
    );
    checked(await admin.storage.from("uploads").remove([job.payload.path]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xử lý thất bại";
    const current = checked(
      await admin
        .from("jobs")
        .select("lease_token,status")
        .eq("id", job.id)
        .single(),
    );
    if (current.lease_token !== job.lease_token || current.status !== "running")
      return;
    const retry =
      job.attempts < 3 &&
      /fetch|timeout|ECONN|temporar|503|502|504/i.test(message);
    checked(
      await admin
        .from("jobs")
        .update({
          status: retry ? "queued" : "failed",
          error: message,
          lease_until: null,
        })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token),
    );
    if (job.kind === "upload" && !retry) {
      checked(
        await admin
          .from("assets")
          .update({ status: "failed" })
          .eq("id", job.payload.assetId)
          .neq("status", "ready"),
      );
      checked(await admin.storage.from("uploads").remove([job.payload.path]));
      checked(
        await admin.storage
          .from("media")
          .remove([
            `${job.owner_id}/${job.payload.assetId}.webp`,
            `${job.owner_id}/${job.payload.assetId}-thumb.webp`,
          ]),
      );
      checked(
        await admin
          .from("assets")
          .update({ bytes: 0 })
          .eq("id", job.payload.assetId)
          .eq("status", "failed"),
      );
    }
    if (job.kind === "export" && !retry)
      await admin.storage
        .from("media")
        .remove([`${job.owner_id}/exports/${job.id}.pptx`]);
    console.error(`Job ${job.id}: ${message}`);
  } finally {
    clearInterval(heartbeat);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  console.log("EduGame worker đang nhận việc.");
  while (!stopping) {
    try {
      await processJob();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

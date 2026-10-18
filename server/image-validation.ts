import sharp from "sharp";
export const MAX_IMAGE_BYTES = 5242880;
export function imageMime(bytes: Buffer): string {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    // libvips may expose APNG as a single PNG frame: inspect the animation chunk.
    for(let offset=8;offset+12<=bytes.length;){
      const length=bytes.readUInt32BE(offset);
      if(length>bytes.length-offset-12)break;
      if(bytes.toString('ascii',offset+4,offset+8)==='acTL')throw Error('Chỉ nhận ảnh tĩnh.');
      offset+=length+12;
    }
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw Error("Chỉ nhận ảnh PNG/JPEG/WebP hợp lệ.");
}
export async function validateImage(
  bytes: Buffer,
  mime: string,
  expectedBytes?: number,
  maxBytes = MAX_IMAGE_BYTES,
) {
  if (
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    bytes.length > maxBytes
  )
    throw Error("Ảnh phải có dung lượng từ 1 byte đến 5 MB.");
  if (expectedBytes !== undefined && bytes.length !== expectedBytes)
    throw Error("Dung lượng ảnh không khớp yêu cầu upload.");
  if (imageMime(bytes) !== mime) throw Error("MIME không khớp chữ ký file.");
  let metadata;
  try {
    metadata = await sharp(bytes, {
      limitInputPixels: 24000000,
      animated: true,
      failOn: "warning",
    }).metadata();
  } catch {
    throw Error("Ảnh lỗi hoặc vượt giới hạn xử lý.");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > 24000000 ||
    Math.max(metadata.width, metadata.height) > 12000 ||
    Math.max(
      metadata.width / metadata.height,
      metadata.height / metadata.width,
    ) > 20 ||
    (metadata.pages || 1) !== 1
  )
    throw Error(
      "Chỉ nhận ảnh tĩnh tối đa 24 megapixel, cạnh dài 12000 px và tỷ lệ không quá 20:1.",
    );
  return metadata;
}

// Read only publicly linked lessons. Stop on any access restriction.
import JSZip from "jszip";
import { readFile, writeFile } from "node:fs/promises";

const origin = "https://edulive.net";
const grade = Number(process.argv[2] || 3);
if (![1, 2, 3].includes(grade))
  throw new Error("Usage: node scripts/inspect-edulive.mjs [1|2|3]");
const courseUrl = `${origin}/bai-giang-toan-lop-${grade}-sach-ket-noi-tri-thuc-voi-cuoc-song-tap-2`;
const cookies = new Map();
let token;
async function request(url, form) {
  const response = await fetch(new URL(url, origin), {
    method: form ? "POST" : "GET",
    headers: {
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      ...(form
        ? {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
          }
        : {}),
    },
    body: form ? new URLSearchParams({ ...form, _token: token }) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      position = pair.indexOf("=");
    cookies.set(pair.slice(0, position), pair.slice(position + 1));
  }
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${new URL(url, origin).pathname}`,
    );
  return response;
}
function flatten(objects = []) {
  return objects.flatMap((object) => [object, ...flatten(object.objects)]);
}
const html = await (await request(courseUrl)).text();
token = html.match(/<meta name="csrf-token" content="([^"]+)"/)?.[1];
if (!token) throw new Error("Missing CSRF token");
const catalog = [
  ...html.matchAll(
    /<a\b(?=[^>]*\bclass="[^"]*\bitem-document\b[^"]*")[^>]*>[\s\S]*?<\/a>/g,
  ),
].map(([anchor]) => ({
  name: anchor
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
  url: anchor.match(/href="(https:\/\/edulive\.net\/bai-[^"#]+)"/)?.[1],
}));
const urls = [...new Set(catalog.map((lesson) => lesson.url).filter(Boolean))];
if (!urls.length)
  throw new Error(
    "No publicly linked lessons found; existing inspection was not overwritten.",
  );
const inspectionPath = new URL(
  grade === 3
    ? "../data/edulive-inspection.json"
    : `../data/edulive-inspection-grade${grade}-volume2.json`,
  import.meta.url,
);
if (process.argv.includes("--catalog-only")) {
  const previous = JSON.parse(await readFile(inspectionPath, "utf8"));
  if (previous.courseUrl !== courseUrl)
    throw new Error("Inspection belongs to a different course.");
  await writeFile(
    inspectionPath,
    JSON.stringify(
      {
        ...previous,
        listedLessons: catalog.length,
        lockedLessons: catalog.filter((lesson) => !lesson.url),
      },
      null,
      2,
    ),
  );
  console.log(
    `Grade ${grade}: ${catalog.length} listed lessons, ${urls.length} public links, ${catalog.length - urls.length} locked.`,
  );
  process.exit(0);
}
const lessons = [];
for (const url of urls) {
  try {
    const page = await (await request(url)).text();
    const id = page.match(/let document_id = (\d+)/)?.[1];
    if (!id) throw new Error("Lesson ID unavailable");
    const document = await (
      await request("/course-library/document/getContent", { document_id: id })
    ).json();
    if (!document.Data?.Slides) throw new Error("No accessible slide data");
    const file = await (
      await request("/getFileUrl", { uri: document.Data.ZipFileUrl })
    ).json();
    if (!file.file_url) throw new Error("Slide archive unavailable");
    const archiveResponse = await fetch(file.file_url, {
      signal: AbortSignal.timeout(30000),
    });
    if (!archiveResponse.ok)
      throw new Error(`Archive HTTP ${archiveResponse.status}`);
    const archive = await JSZip.loadAsync(await archiveResponse.arrayBuffer());
    const slides = [];
    for (const slide of document.Data.Slides) {
      const entry = archive.file(slide.FileJsonUrl.split("/").pop());
      if (!entry) continue;
      const body = JSON.parse(await entry.async("string"));
      const objects = flatten(body.objects);
      slides.push({
        id: slide.Id,
        index: slide.Index + 1,
        texts: objects
          .filter(
            (object) => typeof object.text === "string" && object.text.trim(),
          )
          .map((object) => ({
            id: object.ObjectId,
            name: object.name,
            text: object.text,
            top: object.top,
            left: object.left,
            hidden: object.hideWhenStart,
          })),
        variables: body.globalVariables,
        objectVariables: body.objectVariables,
        events: body.eventManager,
      });
    }
    lessons.push({ id, url, name: document.Name, slides });
    console.log(`${id}: ${slides.length} slides · ${document.Name}`);
  } catch (error) {
    lessons.push({ url, error: error.message });
    console.log(`Unavailable: ${url} · ${error.message}`);
  }
}
const report = {
  courseUrl,
  grade,
  volume: 2,
  fetchedAt: new Date().toISOString(),
  listedLessons: catalog.length,
  lockedLessons: catalog.filter((lesson) => !lesson.url),
  lessons,
};
await writeFile(inspectionPath, JSON.stringify(report, null, 2));
console.log(
  `Read ${lessons.filter((lesson) => !lesson.error).length}/${urls.length} publicly linked lessons.`,
);

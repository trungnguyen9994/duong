import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import JSZip from "jszip";

test("teacher edits, saves, backs up, plays all 12 questions and downloads PPTX", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("library.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dùng mẫu này" }).click();
  await page
    .getByLabel("Tên trò chơi", { exact: true })
    .fill("Bài học thử nghiệm local");
  await expect(
    page.getByText("Đã lưu trên máy này", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("builder.png"),
    fullPage: true,
  });
  const backupEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sao lưu JSON", exact: true }).click();
  const backup = await backupEvent;
  const spec = JSON.parse(await fs.readFile((await backup.path())!, "utf8"));
  expect(spec.questions).toHaveLength(12);
  await page
    .getByRole("button", { name: "Thư viện", exact: false })
    .filter({ hasText: "←" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bài học thử nghiệm local" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mở trình soạn" }).click();
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  await page.getByRole("button", { name: "Bắt đầu hành trình" }).click();
  const answers = ["C", "C", "C", "D", "C", "B", "C", "B", "C", "D", "C", "D"];
  for (let i = 0; i < 12; i++) {
    if ([0, 2, 6, 10].includes(i))
      await page.getByRole("button", { name: "Bắt đầu chặng" }).click();
    if (i === 0) {
      await page.locator(".choice").nth(0).click();
      await expect(
        page.getByText("Chưa đúng, em thử lại nhé!", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".team").nth(0)).toContainText("0");
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await page.screenshot({
        path: testInfo.outputPath("player.png"),
        fullPage: true,
      });
    }
    await page
      .locator(".choice")
      .nth(["A", "B", "C", "D"].indexOf(answers[i]))
      .click();
    await expect(page.locator(".feedback.correct")).toContainText(
      i === 0 ? "+5 điểm" : "+10 điểm",
    );
    await page
      .locator(".feedback.correct")
      .getByRole("button", { name: i === 11 ? "Xem tổng kết" : "Tiếp tục" })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Vương quốc đã được giải cứu!" }),
  ).toBeVisible();
  await expect(page.locator(".team").nth(0)).toContainText("25");
  await expect(page.locator(".ranking").first()).toContainText("Hạng 1");
  await page.getByRole("button", { name: "Về trình soạn" }).click();
  await page.getByRole("button", { name: "Xem trước", exact: true }).click();
  await page
    .getByRole("button", { name: "Tiếp tục phiên trước", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vương quốc đã được giải cứu!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Về trình soạn" }).click();
  await page.getByRole("button", { name: "Kiểm tra & xuất" }).click();
  await expect(
    page.getByRole("button", { name: "Tải PowerPoint" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  const pptxEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải PowerPoint" }).click();
  const pptx = await pptxEvent;
  expect(pptx.suggestedFilename()).toMatch(/\.pptx$/);
  expect((await fs.stat((await pptx.path())!)).size).toBeGreaterThan(10_000);
  await pptx.saveAs(testInfo.outputPath("sample.pptx"));
  await page
    .getByRole("button", { name: "Thư viện", exact: false })
    .filter({ hasText: "←" })
    .click();
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(spec)),
    });
  await expect(page.getByLabel("Tên trò chơi", { exact: true })).toHaveValue(
    "Bài học thử nghiệm local (bản nhập)",
  );
  const roundtripEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sao lưu JSON", exact: true }).click();
  const roundtrip = JSON.parse(
    await fs.readFile((await (await roundtripEvent).path())!, "utf8"),
  );
  expect(roundtrip.questions).toEqual(spec.questions);
  expect(roundtrip.stages).toEqual(spec.stages);
  expect(errors).toEqual([]);
});

test("teacher manages question order, stages, reserve content and embedded images", async ({
  page,
}) => {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng mẫu này" }).click();
  await page
    .getByRole("button", { name: "Chuyển câu 1 xuống", exact: true })
    .click();
  await expect(page.locator(".question-select").first()).toContainText(
    "hai thừa số",
  );
  await page
    .getByRole("button", { name: "Chuyển chặng 1 xuống", exact: true })
    .click();
  await expect(page.locator(".stage-select").first()).toContainText(
    "Núi Phép tính",
  );
  await page.getByLabel("Chuyển câu sang chặng").selectOption("2");
  await expect(page.locator(".stage-item.selected")).toContainText(
    "Hang Bí mật",
  );
  const imageInput = page.getByLabel("Ảnh minh họa", { exact: false });
  await imageInput.setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("wrong"),
  });
  await expect(page.getByText("Chỉ hỗ trợ ảnh PNG hoặc JPEG.")).toBeVisible();
  await imageInput.setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Ảnh đã chọn")).toBeVisible();
  await page
    .getByRole("button", { name: "Chọn từ 8 câu dự phòng", exact: false })
    .click();
  await page.locator(".reserve-choice").first().click();
  await expect(
    page.getByRole("textbox", { name: "Đề bài", exact: true }),
  ).toHaveValue("Tìm số còn thiếu: □ × 2 = 18");
  await page.getByRole("button", { name: "Xóa câu", exact: true }).click();
  await expect(page.locator(".stage-item.selected")).toContainText("5 câu hỏi");
  const backupEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sao lưu JSON", exact: true }).click();
  const data = JSON.parse(
    await fs.readFile((await (await backupEvent).path())!, "utf8"),
  );
  expect(data.questions).toHaveLength(12);
  expect(data.assets).toHaveLength(1);
  expect(data.assets[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Kiểm tra & xuất" }).click();
  await page.getByRole("checkbox").check();
  const pptxEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải PowerPoint" }).click();
  const zip = await JSZip.loadAsync(
    await fs.readFile((await (await pptxEvent).path())!),
  );
  expect(
    Object.keys(zip.files).some(
      (path) => path.startsWith("ppt/media/") && !zip.files[path].dir,
    ),
  ).toBe(true);
});

test("invalid drafts and malformed JSON are blocked; narrow layout fits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo trò chơi", exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra & xuất" }).click();
  await expect(page.getByText("Còn 4 lỗi.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại sửa" }).click();
  await page.getByRole("button", { name: "Thêm", exact: false }).click();
  await page.getByLabel("Đề bài", { exact: true }).fill("Câu chưa có đáp án");
  await page.getByRole("button", { name: "Xem trước" }).click();
  await expect(page.getByText("Hãy sửa các lỗi trước khi chơi.")).toBeVisible();
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schemaVersion":"99"}'),
    });
  await expect(
    page.getByText("JSON không hợp lệ:", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

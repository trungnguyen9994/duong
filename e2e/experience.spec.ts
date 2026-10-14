import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import JSZip from "jszip";

test("homepage navigation and three actions lead to working tools", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Thiết kế trò chơi dạy học" }),
  ).toBeVisible();
  await expect(page.locator(".home-explorer-right img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".home-explorer-right img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("homepage.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hướng dẫn", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Chọn nền và nhân vật");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Tạo trò chơi bằng mẫu có sẵn" })
    .click();
  await expect(
    page.getByRole("button", { name: "Dùng mẫu này" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Trang chủ", exact: true }).click();
  await page
    .getByRole("button", { name: "Chơi trực tuyến ngay trên website" })
    .click();
  await expect(
    page.getByRole("button", { name: "Bắt đầu hành trình" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Về trình soạn" }).click();
  await page.getByRole("button", { name: "Trang chủ", exact: true }).click();
  await page
    .getByRole("button", { name: "Tải PowerPoint sử dụng trong lớp" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Chọn cách tổ chức trò chơi",
  );
  await expect(
    page.getByRole("button", { name: "Tải PowerPoint", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Trang chủ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Thiết kế trò chơi dạy học" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("homepage-mobile.png"),
    fullPage: true,
  });
});

test("visible countdown decreases, pauses, resumes, warns and resets for retry", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [],
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Chơi trực tuyến ngay trên website" })
    .click();
  await page.getByRole("button", { name: "Bắt đầu hành trình" }).click();
  await page.getByRole("button", { name: "Bắt đầu chặng" }).click();
  await expect(page.getByRole("timer")).toContainText("00:45");
  await page.clock.runFor(3000);
  await expect(page.getByRole("timer")).toContainText("00:42");
  await page
    .getByRole("button", { name: "Tạm dừng đồng hồ", exact: true })
    .click();
  await page.clock.runFor(5000);
  await expect(page.getByRole("timer")).toContainText("00:42");
  await page
    .getByRole("button", { name: "Tiếp tục đồng hồ", exact: true })
    .click();
  await page.clock.runFor(33000);
  await expect(page.locator(".countdown")).toHaveClass(/low/);
  await expect(page.getByRole("timer")).toContainText("00:09");
  await page.clock.runFor(9000);
  await expect(page.getByRole("timer")).toContainText("00:00");
  await expect(page.locator(".speech-bubble")).toContainText(
    "Đồng hồ đã hết giờ",
  );
  await page.getByRole("button", { name: "Nghe Bé Sao", exact: false }).click();
  await expect(page.locator(".speech-bubble")).toContainText(
    "Máy chưa có giọng tiếng Việt",
  );
  await page.locator(".choice").nth(0).click();
  await expect(page.locator(".speech-bubble")).toContainText("Không sao đâu");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("timer")).toContainText("00:45");
  await page.screenshot({
    path: testInfo.outputPath("adventure-player.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("adventure-mobile.png"),
    fullPage: true,
  });
});

test("custom stage backgrounds and dialogue survive edits, JSON and PPTX export", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dùng mẫu này" }).click();
  await page
    .getByRole("button", { name: "Nền & nhân vật", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Hang pha lê bí mật", exact: false })
    .last()
    .click();
  await page
    .getByLabel("Lời chào của nhân vật ở chặng này")
    .fill("Chào các bạn nhỏ, cùng khám phá hang pha lê nhé!");
  await page.getByRole("button", { name: "Rồng Số vui vẻ" }).click();
  await page.getByLabel("Tải ảnh nền cho chặng").setInputFiles({
    name: "background.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".stage-card.selected")).toContainText(
    "Ảnh của bạn",
  );
  await page.screenshot({
    path: testInfo.outputPath("background-editor.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Soạn câu hỏi", exact: false })
    .click();
  await page.getByLabel("Ảnh minh họa", { exact: false }).setInputFiles({
    name: "question.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Ảnh đã chọn")).toBeVisible();
  await page.getByRole("button", { name: "Gỡ ảnh", exact: true }).click();
  const backupEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sao lưu JSON", exact: true }).click();
  const spec = JSON.parse(
    await fs.readFile((await (await backupEvent).path())!, "utf8"),
  );
  expect(spec.assets).toHaveLength(1);
  expect(spec.stages[0].backgroundAssetId).toBe(spec.assets[0].id);
  expect(spec.stages[0].introText).toContain("hang pha lê");
  expect(spec.config.character).toBe("dragon");
  await page.getByRole("button", { name: "Kiểm tra & xuất" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  const pptxEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Tải PowerPoint", exact: true })
    .click();
  const zip = await JSZip.loadAsync(
    await fs.readFile((await (await pptxEvent).path())!),
  );
  const intro = await zip.file("ppt/slides/slide4.xml")!.async("string");
  expect(intro).toContain("Chào các bạn nhỏ");
  expect(intro).toContain("<p:pic>");
  const relationships = await zip
    .file("ppt/slides/_rels/slide4.xml.rels")!
    .async("string");
  expect(relationships).not.toContain('TargetMode="External"');
});

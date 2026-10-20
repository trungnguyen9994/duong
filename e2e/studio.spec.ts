import "dotenv/config";
import { test, expect } from "@playwright/test";
import { sql, pool } from "../server/database";
import bcrypt from "bcryptjs";
import { storage } from "../server/storage";
test.afterAll(async () => {
  await pool.end();
});
import { migrateLegacy } from "../src/domain/studio-migration";
import { sampleGame } from "../src/domain/sample";
import { defaultQuestions } from "../src/data/default-questions";

test("catalog reconnects after database startup without reloading the page", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/catalog", (route) => {
    requests++;
    return requests < 2
      ? route.fulfill({
          status: 503,
          json: { error: "Database đang khởi động" },
        })
      : route.fulfill({
          json: {
            subjects: [{ id: "math", name: "Toán đã phục hồi" }],
            templates: [{ type: "journey" }],
          },
        });
  });
  await page.goto("/library");
  await expect(page.getByRole("alert")).toContainText("Đang tự kết nối lại");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page
      .getByRole("combobox", { name: /Môn học/ })
      .locator('option[value="math"]'),
  ).toHaveText("Toán đã phục hồi");
  await expect(page.locator(".eg-template")).toHaveCount(1);
  expect(requests).toBeGreaterThanOrEqual(2);
});

test("question bank filters original Edulive questions by textbook and keeps source answers", async ({
  page,
}) => {
  // Isolate the UI from the unavailable local database; never bypass real auth.
  const userId = "00000000-0000-4000-8000-000000000001";
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        session: {
          user: {
            id: userId,
            email: "question-bank-test@example.invalid",
            email_confirmed_at: "2026-10-20T00:00:00Z",
          },
        },
      },
    }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        id: userId,
        display_name: "Kiểm tra kho câu hỏi",
        role: "teacher",
        status: "active",
        permissions: [],
      },
    }),
  );
  await page.route("**/api/questions", (route) =>
    route.fulfill({ json: defaultQuestions }),
  );
  await page.goto("/questions");
  await expect(page.getByRole("status")).toContainText("168 câu hỏi");
  await page.getByRole("button", { name: "Trang sau →" }).click();
  await page
    .getByLabel("Bộ sách", { exact: true })
    .selectOption("Kết nối tri thức với cuộc sống");
  await expect(page.getByRole("status")).toContainText("48 câu hỏi");
  await page.getByLabel("Lớp", { exact: true }).selectOption("3");
  await expect(page.getByRole("status")).toContainText("25 câu hỏi");
  await expect(page.getByRole("status")).toContainText("Hiển thị 1–12");
  await expect(page.locator(".question-bank-card")).toHaveCount(12);
  await expect(
    page.getByText(/Các bài bị khóa, bài cần hình minh họa/),
  ).toBeVisible();
  await page
    .getByLabel("Bài học", { exact: true })
    .selectOption("Bài 45. Các số có 4 chữ số. Số 10 000 - tiết 2 - trang 6");
  await expect(page.getByRole("status")).toContainText("4 câu hỏi");
  await page
    .getByPlaceholder("Nhập nội dung hoặc tên bài…")
    .fill("hàng chục là 7");
  await expect(page.locator(".question-bank-card")).toHaveCount(1);
  const card = page.locator(".question-bank-card");
  await expect(card).toContainText("Kết nối tri thức với cuộc sống · Tập 2");
  await expect(
    card.getByRole("link", { name: "Nguồn Edulive · Slide 12" }),
  ).toHaveAttribute(
    "href",
    "https://edulive.net/bai-45-cac-so-co-4-chu-so-so-10-000-tiet-2-trang-6v1",
  );
  await card.getByText("Xem đáp án và lời giải").click();
  await expect(card).toContainText("Đáp án: B. 8 275");
  await expect(card).toContainText(
    "Nguồn chưa cung cấp lời giải cho câu hỏi này.",
  );
  await page.getByPlaceholder("Nhập nội dung hoặc tên bài…").fill("");
  await page.getByLabel("Bộ sách", { exact: true }).selectOption("Cánh Diều");
  await expect(page.getByRole("status")).toContainText("120 câu hỏi");
  await expect(page.getByLabel("Bài học", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Lớp", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Bộ sách", { exact: true })
    .selectOption("Kết nối tri thức với cuộc sống");
  await page.getByLabel("Lớp", { exact: true }).selectOption("1");
  await expect(page.getByRole("status")).toContainText("7 câu hỏi");
  await expect(page.locator(".question-bank-card")).toHaveCount(7);
  await expect(
    page.getByRole("heading", { name: "Số 13 gồm có:", exact: true }),
  ).toBeVisible();
  for (const card of await page.locator(".question-bank-card").all()) {
    await expect(card.locator("small")).toContainText("Toán 1");
  }
  await page
    .getByLabel("Bài học", { exact: true })
    .selectOption("Bài 21: Số tròn chục (Tiết 3) - Trang 8");
  await expect(page.getByRole("status")).toContainText("1 câu hỏi");
  await page.getByLabel("Lớp", { exact: true }).selectOption("2");
  await expect(page.getByLabel("Bài học", { exact: true })).toHaveValue("");
  await expect(page.getByRole("status")).toContainText("16 câu hỏi");
  for (const card of await page.locator(".question-bank-card").all()) {
    await expect(card.locator("small")).toContainText("Toán 2");
  }
  await page
    .getByPlaceholder("Nhập nội dung hoặc tên bài…")
    .fill("thanh sô-cô-la");
  await expect(page.locator(".question-bank-card")).toHaveCount(1);
  await page
    .locator(".question-bank-card")
    .getByText("Xem đáp án và lời giải")
    .click();
  await expect(page.locator(".question-bank-card")).toContainText(
    "Đáp án: C. 50",
  );
});

test("Vietnamese narration waits for a suitable voice and stops on pause or mute", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      voices: [{ name: "English", lang: "en-US", localService: true }],
      spoken: [] as { text: string; lang: string; rate: number }[],
      active: false,
      cancels: 0,
    };
    const events = new EventTarget();
    const synth = {
      getVoices: () => state.voices,
      cancel: () => {
        state.active = false;
        state.cancels++;
      },
      speak: (u: { text: string; voice: { lang: string }; rate: number }) => {
        state.active = true;
        state.spoken.push({ text: u.text, lang: u.voice.lang, rate: u.rate });
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: synth,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.assign(window, {
      __narration: state,
      __loadVietnamese: () => {
        state.voices.push({
          name: "Vietnamese",
          lang: "vi-VN",
          localService: true,
        });
        events.dispatchEvent(new Event("voiceschanged"));
      },
    });
  });
  await page.goto("/demo/journey");
  await expect(
    page.getByText(/Máy chưa có giọng đọc tiếng Việt/),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__narration.spoken.length),
  ).toBe(0);
  await page.evaluate(() => (window as any).__loadVietnamese());
  await expect
    .poll(() => page.evaluate(() => (window as any).__narration.spoken.length))
    .toBe(1);
  const voice = await page.evaluate(
    () => (window as any).__narration.spoken[0],
  );
  expect(voice.lang).toBe("vi-VN");
  expect(voice.rate).toBe(0.85);
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__narration.active)).toBe(
    false,
  );
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__narration.spoken.length))
    .toBe(2);
  await page.getByRole("button", { name: "Tắt âm", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__narration.active)).toBe(
    false,
  );
  await page.getByRole("button", { name: "Bật âm", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__narration.spoken.length))
    .toBe(3);
  await page
    .getByRole("button", { name: "Nghe lại lời thoại", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__narration.spoken.length))
    .toBe(4);
  await page.getByRole("link", { name: "Mẫu trò chơi", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__narration.active)).toBe(
    false,
  );
});

test("public pages, responsive layout and login return", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Tạo trò chơi dạy học/ }),
  ).toBeVisible();
  await expect(page.locator(".eg-template")).toHaveCount(0);
  await page.getByRole("link", { name: "Mẫu trò chơi" }).click();
  await expect(page.locator(".eg-template")).toHaveCount(3);
  await page.getByRole("link", { name: "Sử dụng mẫu" }).first().click();
  await expect(page).toHaveURL(/login\?next=/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("login layout supports password visibility, mode links and mobile", async ({
  page,
}) => {
  await page.goto("/login?next=%2Flibrary");
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await password.fill("Example-password-123");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Hiện mật khẩu", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("checkbox", { name: "Ghi nhớ đăng nhập" }).uncheck();
  await page
    .getByRole("button", { name: "Quên mật khẩu?", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Quên mật khẩu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quay lại đăng nhập", exact: false })
    .click();
  await page.getByRole("link", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByLabel("Tên hiển thị", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(
    /next=%2Flibrary.*mode=signup|mode=signup.*next=%2Flibrary/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Đăng ký", exact: true }).last(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("teacher imports, saves, edits, plays journey and queues server PPTX", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `e2e-${crypto.randomUUID()}@example.test`,
    password = crypto.randomUUID() + "Aa1!",
    owner = crypto.randomUUID();
  await sql(
    "INSERT INTO users(id,email,password_hash,email_confirmed_at) VALUES (?,?,?,UTC_TIMESTAMP(3))",
    [owner, email, await bcrypt.hash(password, 12)],
  );
  await sql("INSERT INTO profiles(id,email,display_name) VALUES (?,?,?)", [
    owner,
    email,
    "Giáo viên thử nghiệm",
  ]);
  try {
    await page.goto("/login");
    await page
      .getByLabel("Email hoặc tên đăng nhập", { exact: true })
      .fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("heading", { name: "Trò chơi của tôi" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Tạo bản nháp đầu tiên" }).click();
    const spec = await migrateLegacy(sampleGame(), async () =>
      crypto.randomUUID(),
    );
    await page
      .locator("summary")
      .filter({ hasText: "Nhập bài có sẵn / chuyển bài cũ" })
      .click();
    await page.getByLabel("Nhập JSON mới / bài cũ").setInputFiles({
      name: "lesson.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(spec)),
    });
    await page
      .getByLabel("Tên trò chơi", { exact: true })
      .fill("Bài nghiệm thu V4.1");
    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await expect(page).toHaveURL(/builder\/[a-f0-9-]{36}$/);
    await page.getByRole("button", { name: "3 Tùy chỉnh" }).click();
    await page
      .locator("summary")
      .filter({ hasText: "Hình ảnh và nhân vật" })
      .click();
    await page
      .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
      .setInputFiles("public/art/forest.png");
    await page
      .getByRole("button", { name: "Chọn ảnh", exact: true })
      .first()
      .click();
    await page
      .getByRole("combobox", { name: "Cách đặt ảnh", exact: true })
      .selectOption("cover");
    await page
      .getByRole("button", {
        name: "Lưu thành ảnh mới và sử dụng",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Lưu thành ảnh mới và sử dụng",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 20000 });
    await page
      .getByLabel("Mô tả ảnh (alt text)", { exact: true })
      .fill("Khu rừng nhiều cây xanh");
    await page
      .getByRole("button", { name: "Lưu mô tả ảnh cá nhân", exact: true })
      .click();
    await page.getByRole("button", { name: "4 Hoàn tất" }).click();
    await page.getByRole("button", { name: "Chơi thử", exact: true }).click();
    await expect(page.getByRole("timer")).toContainText("00:45");
    await page.getByRole("button", { name: "Bắt đầu chặng" }).click();
    await page.getByRole("button", { name: "A. 6", exact: true }).click();
    await expect(page.getByText(/Thử lại nhé!/).first()).toBeVisible();
    await page.getByRole("button", { name: "Chọn lại", exact: true }).click();
    await page.getByRole("button", { name: "C. 24", exact: true }).click();
    await expect(page.locator(".eg-roster-scores strong").first()).toHaveText(
      "5",
    );
    await page.getByRole("button", { name: "← Thoát", exact: true }).click();
    const download = page.waitForEvent("download", { timeout: 60000 });
    await page
      .getByRole("button", { name: "Xuất PowerPoint", exact: true })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/pptx$/);
  } finally {
    const assets = await sql(
      "SELECT path,thumbnail_path FROM assets WHERE owner_id=?",
      [owner],
    );
    const paths = assets
      .flatMap((r) => [r.path, r.thumbnail_path])
      .filter(Boolean);
    paths.push(
      ...(await sql("SELECT result FROM jobs WHERE owner_id=?", [owner]))
        .map((r) => r.result?.path)
        .filter(Boolean),
    );
    await storage.from("media").remove(paths);
    await sql("DELETE FROM audit_log WHERE actor_id=?", [owner]);
    await sql("DELETE FROM share_links WHERE owner_id=?", [owner]);
    await sql(
      "DELETE r FROM asset_references r JOIN games g ON g.id=r.game_id WHERE g.owner_id=?",
      [owner],
    );
    for (const table of [
      "play_sessions",
      "questions",
      "games",
      "jobs",
      "assets",
    ])
      await sql(`DELETE FROM ${table} WHERE owner_id=?`, [owner]);
    await sql("DELETE FROM profiles WHERE id=?", [owner]);
    await sql("DELETE FROM users WHERE id=?", [owner]);
  }
});

test("picture demo reveals only correct tiles and accepts an early guess", async ({
  page,
}) => {
  await page.goto("/demo/picture_reveal");
  await page.getByRole("button", { name: "Mở ô 1", exact: true }).click();
  await page.getByRole("button", { name: "B. Bánh kẹo", exact: true }).click();
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await page.getByRole("button", { name: "A. Nước", exact: true }).click();
  await page.getByRole("button", { name: "Mở mảnh ghép", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ô 1 đã mở", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".eg-roster-scores strong").first()).toHaveText(
    "5",
  );
  await page.getByLabel("Đoán bức tranh").fill("Rừng cây");
  await page.getByRole("button", { name: "Đoán tranh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chính xác! Rừng cây" }),
  ).toBeVisible();
});
test("wheel result matches its selected segment and Vietnamese scoring", async ({
  page,
}) => {
  await page.goto("/demo/word_wheel");
  await page.evaluate(() => {
    Object.defineProperty(window.crypto, "getRandomValues", {
      value: (array: Uint32Array) => {
        array[0] = 1;
        return array;
      },
    });
  });
  const reduced = page.getByRole("button", {
    name: "Giảm chuyển động",
    exact: true,
  });
  if ((await reduced.getAttribute("aria-pressed")) !== "true")
    await reduced.click();
  await page.getByRole("button", { name: "Quay vòng", exact: true }).click();
  await expect(page.locator(".eg-play-panel [role=status]")).toContainText(
    "20 điểm",
  );
  await page.getByRole("button", { name: "A", exact: true }).click();
  await expect(page.locator(".eg-roster-scores strong").first()).toHaveText(
    "20",
  );
  await expect(page.locator(".eg-word-board")).toContainText("Á");
  await page.getByRole("button", { name: "Quay vòng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ă", exact: true }).click();
  await expect(page.locator(".eg-roster-scores > div").nth(1)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.getByLabel("Giải cụm từ", { exact: true }).fill("cánh diều");
  await page
    .getByRole("button", { name: "Giải cụm từ (+50)", exact: true })
    .click();
  await expect(page.locator(".eg-roster-scores strong").nth(1)).toHaveText(
    "50",
  );
  await expect(page.locator(".eg-word-board")).toContainText("CÁNH DIỀU");
});

test("wheel visibly animates before announcing its result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/demo/word_wheel");
  await page.evaluate(() => {
    Object.defineProperty(window.crypto, "getRandomValues", {
      value: (array: Uint32Array) => {
        array[0] = 3;
        return array;
      },
    });
  });
  const reduced = page.getByRole("button", {
    name: "Giảm chuyển động",
    exact: true,
  });
  if ((await reduced.getAttribute("aria-pressed")) === "true")
    await reduced.click();
  await page.getByRole("button", { name: "Quay vòng", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang quay…" })).toBeDisabled();
  const wheel = page.locator(".eg-wheel");
  const first = await wheel.evaluate((e) => getComputedStyle(e).transform);
  await page.waitForTimeout(400);
  expect(await wheel.evaluate((e) => getComputedStyle(e).transform)).not.toBe(
    first,
  );
  await expect(page.locator(".eg-play-panel [role=status]")).not.toContainText(
    "40 điểm",
  );
  await expect(page.locator(".eg-play-panel [role=status]")).toContainText(
    "40 điểm",
    { timeout: 5000 },
  );
  const degrees = await wheel.evaluate((e) =>
    Number((e as HTMLElement).style.transform.match(/rotate\((.+)deg\)/)?.[1]),
  );
  expect((degrees + 3 * 45 + 22.5) % 360).toBe(0);
});

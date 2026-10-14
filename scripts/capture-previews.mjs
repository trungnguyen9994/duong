import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/previews', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('.home-explorer-right img').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'docs/previews/homepage.png' });
  await page.getByRole('button', { name: 'Dùng mẫu này' }).click();
  await page.getByRole('button', { name: 'Nền & nhân vật', exact: false }).click();
  await page.screenshot({ path: 'docs/previews/background-editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await page.getByRole('button', { name: 'Bắt đầu chặng' }).click();
  await page.screenshot({ path: 'docs/previews/player.png', fullPage: true });
  console.log('Saved homepage, background editor and player previews.');
} finally { await browser.close(); }

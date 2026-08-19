import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { config } from '../../config.js';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: config.headless,
  });
}

export async function newContext(
  browser: Browser,
  storageFile?: string,
): Promise<BrowserContext> {
  return browser.newContext({
    acceptDownloads: true,
    storageState:
      storageFile && fs.existsSync(storageFile)
        ? storageFile
        : undefined,
  });
}

export async function openPage(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import path from "node:path";

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(
        path.join(
          process.cwd(),
          "node_modules",
          "@sparticuz",
          "chromium",
          "bin",
        ),
      ),
      headless: true,
    });
  }

  return (await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--window-size=1920,1080",
    ],
  })) as unknown as Browser;
}

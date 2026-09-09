import type { Browser } from "puppeteer-core";
import { launchBrowser } from "@/lib/launchBrowser";

let browserPromise: Promise<Browser> | null = null;
let translationQueue = Promise.resolve();
let lastTranslationStartedAt = 0;
const MIN_REQUEST_INTERVAL_MS = 2500;

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
};

const translateOnPage = async (text: string, from: string, to: string) => {
  const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastTranslationStartedAt));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastTranslationStartedAt = Date.now();
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(
      `https://translate.google.com/?sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&op=translate&text=${encodeURIComponent(text)}`,
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );

    await page.waitForSelector('[jsname="W297wb"]', { timeout: 20000 });
    const translated = await page.$$eval(
      '[jsname="W297wb"]',
      (elements) => elements
        .map((element) => element.textContent?.trim() || "")
        .filter(Boolean)
        .join("\n"),
    );

    if (!translated) throw new Error("Google Translate web returned an empty result");
    return translated;
  } finally {
    await page.close();
  }
};

export function translateViaGoogleWeb(text: string, from = "auto", to = "vi") {
  const task = translationQueue.then(() => translateOnPage(text, from, to));
  translationQueue = task.then(() => undefined, () => undefined);
  return task;
}

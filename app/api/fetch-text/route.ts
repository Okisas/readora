import { NextRequest, NextResponse } from "next/server";
import { launchBrowser } from "@/lib/launchBrowser";

export const maxDuration = 300;

const supportedDomains = ["faloo.com", "qidian.com", "alicesw.com"];

const isHostOf = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    const { url } = await request.json();
    const parsedUrl = new URL(String(url || ""));
    const hostname = parsedUrl.hostname.toLowerCase();

    if (
      parsedUrl.protocol !== "https:" ||
      !supportedDomains.some((domain) => isHostOf(hostname, domain))
    ) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ link chương từ Faloo, Qidian và AliceSW" },
        { status: 400 },
      );
    }

    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" });
    let pageUrl = parsedUrl.toString();
    const qidianChapter = parsedUrl.pathname.match(
      /^\/chapter\/(\d+)\/(\d+)\/?$/i,
    );

    // Qidian's public chapter URL often serves an anti-bot shell to
    // automated browsers. The equivalent reader host exposes the same
    // chapter content and keeps the user's chapter/book ids.
    if (hostname === "qidian.com" || hostname.endsWith(".qidian.com")) {
      if (qidianChapter) {
        pageUrl = `https://vipreader.qidian.com/chapter/${qidianChapter[1]}/${qidianChapter[2]}/`;
      }
    }

    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .waitForSelector(
        hostname.includes("qidian.com")
          ? ".read-content.j_readContent, .read-content, .content"
          : "body",
        { timeout: hostname.includes("qidian.com") ? 15000 : 8000 },
      )
      .catch(() => {});
    await new Promise((resolve) =>
      setTimeout(resolve, hostname.includes("qidian.com") ? 4500 : 2500),
    );

    const result = await page.evaluate((siteHost) => {
      const clean = (value: string) =>
        value
          .replace(/\u00a0/g, " ")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n[ \t]+/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

      const firstText = (selectors: string[]) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) return clean(element.textContent);
        }
        return "";
      };

      const textFromParagraphs = (selectors: string[]) => {
        for (const selector of selectors) {
          const container = document.querySelector(selector);
          if (!container) continue;

          const paragraphs = Array.from(container.querySelectorAll("p"))
            .filter(
              (paragraph) =>
                !paragraph.querySelector('a[href*="pay.faloo.com"]'),
            )
            .map((paragraph) => clean(paragraph.textContent || ""))
            .filter(
              (paragraph) =>
                !/立即抢充|活动时间|VIP点券|广告|充值优惠/i.test(paragraph),
            )
            .filter(Boolean);
          const content = clean(
            paragraphs.length > 0 ? paragraphs.join("\n\n") : container.textContent || "",
          );
          if (content) return content;
        }
        return "";
      };

      if (siteHost.includes("faloo.com")) {
        return {
          site: "Faloo",
          title: firstText([".c_l_title h1", ".c_l_title"]),
          content: textFromParagraphs([".noveContent"]),
        };
      }

      if (siteHost.includes("qidian.com")) {
        return {
          site: "Qidian",
          title: firstText([
            ".j_chapterName",
            "h3.j_chapterName",
            ".main-text-wrap h3",
            "h1[data-v-8f6d58f8]",
            "h1.text-rh3",
            "h1",
          ]),
          content: textFromParagraphs([
            ".read-content.j_readContent",
            ".read-content",
            ".chapter-content",
            ".content-text",
            ".book-content",
            "article",
          ]),
        };
      }

      return {
        site: "AliceSW",
        title: firstText(["h1", ".chapter-title", ".title"]),
        content: textFromParagraphs([
          ".txtnav",
          ".read-content",
          ".chapter-content",
          ".content",
          "article",
        ]),
      };
    }, hostname);

    if (!result.content) {
      return NextResponse.json(
        { error: `Không tìm thấy nội dung chương trên ${result.site}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      site: result.site,
      title: result.title,
      content: result.content,
    });
  } catch (error) {
    console.error("Text chapter fetch error:", error);
    return NextResponse.json(
      { error: "Không thể lấy nội dung chương từ URL này" },
      { status: 500 },
    );
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

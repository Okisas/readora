// app/api/fetch-manga/route.ts
import { NextRequest, NextResponse } from "next/server";
import { launchBrowser } from "@/lib/launchBrowser";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL không hợp lệ" }, { status: 400 });
    }

    const isSupportedUrl =
      parsedUrl.protocol === "https:" &&
      [
        "webtoons.com",
        "bookwalker.com",
        "mangaplus.shueisha.co.jp",
        "mangadex.org",
      ].some(
        (domain) =>
          parsedUrl.hostname === domain ||
          parsedUrl.hostname.endsWith(`.${domain}`),
      );

    if (!isSupportedUrl) {
      return NextResponse.json(
        {
          error:
            "Hiện chỉ hỗ trợ link từ Webtoon, BookWalker hoặc Manga Plus",
        },
        { status: 400 },
      );
    }

    if (
      parsedUrl.hostname === "mangadex.org" ||
      parsedUrl.hostname.endsWith(".mangadex.org")
    ) {
      const chapterId = parsedUrl.pathname.match(
        /\/chapter\/([0-9a-f-]{36})(?:\/|$)/i,
      )?.[1];

      if (!chapterId) {
        return NextResponse.json(
          { error: "Không tìm thấy mã chapter MangaDex trong URL" },
          { status: 400 },
        );
      }

      const atHomeResponse = await fetch(
        `https://api.mangadex.org/at-home/server/${chapterId}`,
        { headers: { Accept: "application/json" } },
      );

      if (!atHomeResponse.ok) {
        return NextResponse.json(
          {
            error:
              "Không thể lấy danh sách ảnh MangaDex. Hãy kiểm tra Cloudflare WARP hoặc quyền truy cập chapter.",
          },
          { status: 502 },
        );
      }

      const atHomeData = await atHomeResponse.json();
      const baseUrl = atHomeData.baseUrl;
      const chapterHash = atHomeData.chapter?.hash;
      const pageNames = atHomeData.chapter?.data;

      if (!baseUrl || !chapterHash || !Array.isArray(pageNames)) {
        return NextResponse.json(
          { error: "Phản hồi MangaDex không có danh sách ảnh hợp lệ" },
          { status: 502 },
        );
      }

      const images = await Promise.all(
        pageNames.map(async (pageName: string) => {
          const imageUrl = `${baseUrl}/data/${chapterHash}/${encodeURIComponent(pageName)}`;
          const imageResponse = await fetch(imageUrl, {
            headers: { Referer: "https://mangadex.org/" },
          });

          if (!imageResponse.ok) return null;

          const contentType =
            imageResponse.headers.get("content-type") || "image/jpeg";
          if (!contentType.startsWith("image/")) return null;

          const buffer = Buffer.from(await imageResponse.arrayBuffer());
          return `data:${contentType};base64,${buffer.toString("base64")}`;
        }),
      );

      const validImages = images.filter(
        (image): image is string => image !== null,
      );

      if (validImages.length === 0) {
        return NextResponse.json(
          {
            error:
              "MangaDex không trả về ảnh. Hãy bật Traffic and DNS (HTTPS) trước khi thử lại.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        success: true,
        images: validImages,
        total: validImages.length,
      });
    }

    const browser = await launchBrowser();

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Đợi ảnh load
    await page
      .waitForSelector('img._images, img[src^="blob:"]', { timeout: 10000 })
      .catch(() => {});

    const isWebtoon =
      parsedUrl.hostname === "webtoons.com" ||
      parsedUrl.hostname.endsWith(".webtoons.com");

    // Webtoon lazy-loads chapter images as the reader is scrolled. Keep this
    // branch separate from BookWalker/Manga Plus so unrelated page images are
    // never mixed into the result.
    if (isWebtoon) {
      await page.evaluate(async () => {
        let lastHeight = 0;
        for (let index = 0; index < 40; index += 1) {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((resolve) => setTimeout(resolve, 350));
          const height = document.body.scrollHeight;
          if (height === lastHeight) break;
          lastHeight = height;
        }
        window.scrollTo(0, 0);
      });
    }

    // LẤY URL ẢNH TỪ CLASS _images
    const imageUrls = await page.evaluate(() => {
      const urls: string[] = [];

      // Lấy tất cả ảnh có class "_images"
      const imgs = document.querySelectorAll("img._images");

      imgs.forEach((img) => {
        const src =
          img.getAttribute("data-url") || img.getAttribute("src") || "";
        if (src && src.startsWith("http")) {
          urls.push(src);
        }
      });

      // Lọc bỏ trùng lặp URL
      return Array.from(new Set(urls));
    });

    let imageSources = await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      const sources: string[] = [];

      for (const img of imgs) {
        const src =
          img.getAttribute("data-url") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("src") ||
          "";
        const isLargeImage =
          img.naturalWidth >= 300 && img.naturalHeight >= 300;

        if (src.startsWith("blob:") && (img.alt.toLowerCase().startsWith("page") || isLargeImage)) {
          try {
            const response = await fetch(src);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            sources.push(dataUrl);
          } catch {
            // The blob may have expired before it was read.
          }
        } else if (
          src.startsWith("http") &&
          img.naturalWidth >= 300 &&
          img.naturalHeight >= 500 &&
          !/logo|icon|avatar|banner|advert|store|app[-_]?download|social/i.test(src)
        ) {
          sources.push(src);
        }
      }

      // Manga Plus may render a page into a canvas instead of an img tag.
      for (const canvas of Array.from(document.querySelectorAll("canvas"))) {
        if (
          canvas.width < 300 ||
          canvas.height < 500 ||
          canvas.height / canvas.width < 1.1
        ) continue;

        try {
          sources.push(canvas.toDataURL("image/png"));
        } catch {
          // A cross-origin canvas cannot be exported.
        }
      }

      return Array.from(new Set(sources));
    });

    if (isWebtoon) {
      imageSources = await page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll("img._images"))
          .map((img) =>
            img.getAttribute("data-url") ||
            img.getAttribute("data-src") ||
            img.getAttribute("src") ||
            "",
          )
          .filter((src) => src.startsWith("http"));

        return Array.from(new Set(urls));
      });
    }

    // BookWalker only keeps the current page as a blob image. Moving the
    // reader with the wheel creates the next blob, so capture each page in
    // sequence instead of reading the DOM only once.
    if (parsedUrl.hostname === "bookwalker.com" || parsedUrl.hostname.endsWith(".bookwalker.com")) {
      const bookWalkerSources: string[] = [];
      const seenSources = new Set<string>();
      let actionIndex = 0;

      const directBookWalkerSources = await page.evaluate(async () => {
        const pageNodes = Array.from(
          document.querySelectorAll<HTMLElement>("[data-href][data-page-number]"),
        )
          .map((node) => ({
            href: node.dataset.href || "",
            pageNumber: Number(node.dataset.pageNumber || 0),
          }))
          .filter((item) => item.href)
          .sort((a, b) => a.pageNumber - b.pageNumber);

        const resourceTemplate = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .find((resourceUrl) => /\/h1280\/[^?]+\.webp(?:\?|$)/i.test(resourceUrl));

        const downloadedSources = await Promise.all(
          pageNodes.map(async (pageNode) => {
            try {
              const rootRelativeHref = `/${pageNode.href.replace(/^\/+/, "")}`;
              const imageUrl = resourceTemplate
                ? resourceTemplate.replace(/h1280\/[^?]+/i, pageNode.href)
                : new URL(rootRelativeHref, window.location.origin).href;
              const response = await fetch(imageUrl);
              if (!response.ok) return null;

              const blob = await response.blob();
              if (!blob.type.startsWith("image/")) return null;

              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
              });
            } catch {
              return null;
            }
          }),
        );

        return downloadedSources.filter(
          (source): source is string => source !== null,
        );
      });

      const readerPoint = await page.evaluate(() => {
        const image = Array.from(document.querySelectorAll("img")).find((candidate) =>
          (candidate.getAttribute("src") || "").startsWith("blob:"),
        );
        const rect = image?.getBoundingClientRect();
        return rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: 960, y: 540 };
      });
      await page.mouse.move(readerPoint.x, readerPoint.y);

      for (let pageIndex = 0; pageIndex < 50 && directBookWalkerSources.length < 2; pageIndex += 1) {
        const currentSource = await page.evaluate(async () => {
          const image = Array.from(document.querySelectorAll("img"))
            .find((candidate) => {
              const src = candidate.getAttribute("src") || "";
              return (
                src.startsWith("blob:") &&
                (candidate.alt.toLowerCase().startsWith("page") ||
                  (candidate.naturalWidth >= 300 && candidate.naturalHeight >= 300))
              );
            });

          if (!image) return null;

          try {
            const response = await fetch(image.src);
            const blob = await response.blob();
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
          } catch {
            return null;
          }
        });

        if (!currentSource) break;

        if (seenSources.has(currentSource)) {
          const actions = [
            () => page.mouse.wheel({ deltaY: 800 }),
            () => page.mouse.wheel({ deltaY: -800 }),
            () => page.mouse.wheel({ deltaX: -800 }),
            () => page.keyboard.press("ArrowLeft"),
            () => page.keyboard.press("ArrowRight"),
          ];

          if (actionIndex < actions.length) {
            await actions[actionIndex]();
            actionIndex += 1;
            await new Promise((resolve) => setTimeout(resolve, 900));
            continue;
          }

          break;
        }

        seenSources.add(currentSource);
        bookWalkerSources.push(currentSource);

        actionIndex = 0;
        await page.mouse.wheel({ deltaY: 800 });
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      imageSources =
        directBookWalkerSources.length > 1
          ? directBookWalkerSources
          : bookWalkerSources;
    }

    if (
      parsedUrl.hostname === "mangaplus.shueisha.co.jp" ||
      parsedUrl.hostname.endsWith(".mangaplus.shueisha.co.jp")
    ) {
      const mangaPlusSources = [...imageSources];
      const seenSources = new Set(mangaPlusSources);
      let idleScrolls = 0;

      await page.mouse.move(960, 540);

      for (let scrollIndex = 0; scrollIndex < 50; scrollIndex += 1) {
        await page.mouse.wheel({ deltaY: 900 });
        await new Promise((resolve) => setTimeout(resolve, 700));

        const newlyRenderedSources = await page.evaluate(() => {
          const sources: string[] = [];

          for (const img of Array.from(document.querySelectorAll("img"))) {
            const src =
              img.getAttribute("data-src") ||
              img.getAttribute("src") ||
              "";
            if (
              src.startsWith("http") &&
              img.naturalWidth >= 300 &&
              img.naturalHeight >= 500 &&
              !/logo|icon|avatar|banner|advert|store|app[-_]?download|social/i.test(src)
            ) {
              sources.push(src);
            }
          }

          for (const canvas of Array.from(document.querySelectorAll("canvas"))) {
            if (
              canvas.width < 300 ||
              canvas.height < 500 ||
              canvas.height / canvas.width < 1.1
            ) continue;
            try {
              sources.push(canvas.toDataURL("image/png"));
            } catch {
              // Ignore canvases that are protected by cross-origin rules.
            }
          }

          return Array.from(new Set(sources));
        });

        let added = 0;
        for (const source of newlyRenderedSources) {
          if (!seenSources.has(source)) {
            seenSources.add(source);
            mangaPlusSources.push(source);
            added += 1;
          }
        }

        idleScrolls = added === 0 ? idleScrolls + 1 : 0;
        if (idleScrolls >= 3) break;
      }

      imageSources = mangaPlusSources;
    }

    await browser.close();

    if (imageSources.length === 0) {
      return NextResponse.json(
        {
          error: "Không tìm thấy ảnh truyện",
        },
        { status: 404 },
      );
    }

    // Tải ảnh từ server và chuyển thành base64
    const imagesBase64 = await Promise.all(
      imageSources.slice(0, 50).map(async (imgUrl) => {
        try {
          if (imgUrl.startsWith("data:")) {
            return imgUrl;
          }

          const response = await fetch(imgUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Referer: url,
            },
          });
          if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
            return null;
          }
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          return `data:${contentType};base64,${base64}`;
        } catch (err) {
          console.error("Failed to fetch:", imgUrl);
          return null;
        }
      }),
    );

    const validImages = imagesBase64.filter((img) => img !== null);

    return NextResponse.json({
      success: true,
      images: validImages,
      total: validImages.length,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error:
          "Không thể lấy ảnh: " +
          (error instanceof Error ? error.message : "Lỗi không xác định"),
      },
      { status: 500 },
    );
  }
}

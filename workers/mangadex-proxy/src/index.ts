const allowedOrigins = new Set([
  "https://readora.ddns.net",
  "https://readora-q6xgk3ral-okisas-projects.vercel.app",
  "http://localhost:3000",
]);

const getCorsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") || "")
    ? request.headers.get("Origin")!
    : "https://readora.ddns.net",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  Vary: "Origin",
});

const json = (body: unknown, request: Request, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...getCorsHeaders(request) },
  });

const getChapterId = (value: string) => {
  try {
    return new URL(value).pathname.match(/\/chapter\/([0-9a-f-]{36})/i)?.[1];
  } catch {
    return value.match(/^[0-9a-f-]{36}$/i)?.[0];
  }
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(request) });

    const requestUrl = new URL(request.url);
    if (request.method === "GET" && requestUrl.pathname === "/image") {
      const imageUrl = requestUrl.searchParams.get("url");
      if (!imageUrl || !imageUrl.startsWith("https://uploads.mangadex.org/")) {
        return json({ error: "URL ảnh MangaDex không hợp lệ" }, request, 400);
      }
      const response = await fetch(imageUrl, {
        headers: { Accept: "image/avif,image/webp,image/*" },
      });
      if (!response.ok) return json({ error: `MangaDex image lỗi (${response.status})` }, request, response.status);
      const headers = new Headers(response.headers);
      Object.entries(getCorsHeaders(request)).forEach(([key, value]) => headers.set(key, value));
      headers.set("Cache-Control", "public, max-age=3600");
      return new Response(response.body, { status: response.status, headers });
    }

    if (request.method !== "POST") return json({ error: "Chỉ hỗ trợ POST hoặc GET /image" }, request, 405);

    const body = await request.json().catch(() => ({})) as { url?: string; chapterId?: string };
    const chapterId = getChapterId(body.chapterId || body.url || "");
    if (!chapterId) return json({ error: "Không tìm thấy mã chapter MangaDex" }, request, 400);

    const apiResponse = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: { Accept: "application/json", "User-Agent": "Readora/1.0" },
    });
    if (!apiResponse.ok) return json({ error: `MangaDex API lỗi (${apiResponse.status})` }, request, apiResponse.status);

    const data = await apiResponse.json() as {
      baseUrl?: string;
      chapter?: { hash?: string; data?: string[] };
    };
    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash;
    const pages = data.chapter?.data;
    if (!baseUrl || !hash || !pages?.length) return json({ error: "MangaDex không trả về danh sách trang" }, request, 502);

    const proxyOrigin = new URL(request.url).origin;
    const images = pages.map((page) =>
      `${proxyOrigin}/image?url=${encodeURIComponent(`${baseUrl}/data/${hash}/${page}`)}`,
    );
    return json({ success: true, images, total: images.length }, request);
  },
};

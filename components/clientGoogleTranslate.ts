const CLIENT_CHUNK_LENGTH = 4500;
const CLIENT_CHUNK_DELAY_MS = 700;

const parseGoogleResponse = (data: unknown) => {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  return data[0]
    .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
    .join("")
    .trim();
};

const splitText = (text: string) => {
  const chunks: string[] = [];
  for (let index = 0; index < text.length;) {
    const end = Math.min(index + CLIENT_CHUNK_LENGTH, text.length);
    const boundary = end < text.length ? text.lastIndexOf("\n", end) : end;
    const splitAt = boundary > index + 500 ? boundary : end;
    chunks.push(text.slice(index, splitAt).trim());
    index = splitAt;
  }
  return chunks.filter(Boolean);
};

export async function translateFromBrowser(
  text: string,
  source: string,
  target: string,
  onChunk?: (text: string, index: number, total: number, sourceText: string) => void,
) {
  const chunks = splitText(text);
  const translated: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", source || "auto");
      url.searchParams.set("tl", target);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", chunks[index]);

      const response = await fetch(url, {
        signal: controller.signal,
        mode: "cors",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Client Google translation failed (${response.status})`);

      const result = parseGoogleResponse(await response.json());
      if (!result) throw new Error("Client Google translation returned an empty result");

      translated.push(result);
      onChunk?.(result, index, chunks.length, chunks[index]);
    } finally {
      window.clearTimeout(timeout);
    }

    if (index < chunks.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, CLIENT_CHUNK_DELAY_MS));
    }
  }

  return translated.join("\n\n");
}

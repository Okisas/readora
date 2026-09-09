import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type MemoryEntry = {
  source: string;
  target: string;
  text: string;
  translatedText: string;
  provider: string;
  updatedAt: string;
  hits: number;
};

type MemoryFile = Record<string, MemoryEntry>;

const memoryPath = path.join(process.cwd(), "data", "translation-memory.json");
let memoryPromise: Promise<MemoryFile> | null = null;
let writeQueue = Promise.resolve();

const normalize = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim();

const makeKey = (text: string, source: string, target: string) =>
  JSON.stringify([source, target, normalize(text)]);

const loadMemory = async (): Promise<MemoryFile> => {
  try {
    return JSON.parse(await readFile(memoryPath, "utf8")) as MemoryFile;
  } catch {
    return {};
  }
};

const getMemory = () => {
  if (!memoryPromise) memoryPromise = loadMemory();
  return memoryPromise;
};

export async function findTranslation(
  text: string,
  source: string,
  target: string,
) {
  const entry = (await getMemory())[makeKey(text, source, target)];
  if (!entry) return null;

  // Không dùng lại kết quả bị cắt cụt do Google Web chỉ trả về một phần DOM.
  // Với đoạn dài, bản dịch quá ngắn gần như chắc chắn là cache lỗi.
  const minimumLength = entry.text.length >= 200
    ? Math.max(40, Math.floor(entry.text.length * 0.25))
    : 1;
  if (entry.translatedText.length < minimumLength) return null;
  if (normalize(entry.translatedText) === normalize(entry.text)) return null;

  entry.hits += 1;
  entry.updatedAt = new Date().toISOString();
  scheduleWrite(await getMemory());
  return entry.translatedText;
}

export async function rememberTranslation({
  text,
  translatedText,
  source,
  target,
  provider,
}: {
  text: string;
  translatedText: string;
  source: string;
  target: string;
  provider: string;
}) {
  const sourceText = normalize(text);
  const resultText = normalize(translatedText);
  if (!sourceText || !resultText || sourceText === resultText) return;

  const memory = await getMemory();
  const key = makeKey(sourceText, source, target);
  const previous = memory[key];
  memory[key] = {
    source,
    target,
    text: sourceText,
    translatedText: resultText,
    provider,
    updatedAt: new Date().toISOString(),
    hits: previous?.hits ?? 0,
  };

  // Giữ file local không tăng vô hạn. Xóa các mục ít dùng/cũ nhất khi quá lớn.
  const entries = Object.entries(memory);
  if (entries.length > 50000) {
    entries
      .sort(([, a], [, b]) => (a.hits - b.hits) || a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, entries.length - 50000)
      .forEach(([oldKey]) => delete memory[oldKey]);
  }

  scheduleWrite(memory);
}

function scheduleWrite(memory: MemoryFile) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(memoryPath), { recursive: true });
    await writeFile(memoryPath, JSON.stringify(memory, null, 2), "utf8");
  });
}

export async function getTranslationMemoryStats() {
  const memory = await getMemory();
  return {
    entries: Object.keys(memory).length,
    path: memoryPath,
  };
}

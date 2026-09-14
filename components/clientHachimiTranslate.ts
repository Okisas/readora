import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "DanVP/MoxhiMT-30-web";

type TranslationPipeline = (text: string, options?: Record<string, unknown>) => Promise<
  Array<{ translation_text?: string }>
>;

let translatorPromise: Promise<TranslationPipeline> | null = null;

const getTranslator = () => {
  if (!translatorPromise) {
    const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
    translatorPromise = pipeline("translation", MODEL_ID, {
      device: hasWebGpu ? "webgpu" : "wasm",
      dtype: hasWebGpu ? "fp16" : "q8",
    } as never) as unknown as Promise<TranslationPipeline>;
    translatorPromise.catch(() => {
      translatorPromise = null;
    });
  }
  return translatorPromise;
};

export async function translateWithHachimi(text: string) {
  const translator = await getTranslator();
  const output = await translator(text, {
    max_new_tokens: 512,
    num_beams: 1,
  });
  const translated = output[0]?.translation_text?.trim();
  if (!translated) throw new Error("HachimiMT không trả về bản dịch");
  return translated;
}

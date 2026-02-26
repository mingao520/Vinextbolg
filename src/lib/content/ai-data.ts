// 运行时加载 AI 缓存数据

import type { AICacheFile, ArticleSeo, ArticleSummary } from "../ai/types";

// 构建时通过 Vite 加载 JSON
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore dynamic import of generated data files
import summariesJson from "../../../data/ai-summaries.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore dynamic import of generated data files
import seoJson from "../../../data/ai-seo.json";

const summaryCache = summariesJson as unknown as AICacheFile<ArticleSummary> | undefined;
const seoCache = seoJson as unknown as AICacheFile<ArticleSeo> | undefined;

export function getAISummary(slug: string): ArticleSummary | null {
  const entry = summaryCache?.articles?.[slug];
  return entry?.data ?? null;
}

export function getAISeo(slug: string): ArticleSeo | null {
  const entry = seoCache?.articles?.[slug];
  return entry?.data ?? null;
}

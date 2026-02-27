// Umami Analytics 集成
// 用于文章阅读量统计展示

// Local API route (used by client components)
export const API_PAGE_HITS = "/api/analytics/hits";

export interface PageHitItem {
  page: string;
  hit: number;
}

// 兼容旧代码的导出
export { fetchUmamiPageViews as fetchPageViews } from "./umami";
export type { UmamiStatsResult as StatsResult } from "./umami";

// Server-side cache for hits data (shared across requests)
interface HitsCache {
  data: PageHitItem[];
  timestamp: number;
}

let serverHitsCache: HitsCache | null = null;
const SERVER_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * 服务端获取单篇文章的浏览量（用于 Server Components）
 * 优化：内部使用缓存，避免重复请求 Umami
 */
export async function getPageHits(slug: string): Promise<number> {
  // 检查缓存
  if (serverHitsCache && Date.now() - serverHitsCache.timestamp < SERVER_CACHE_TTL) {
    return calculateHitsForSlug(serverHitsCache.data, slug);
  }

  try {
    // 服务端渲染需要使用完整 URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/analytics/hits`;

    const res = await fetch(apiUrl, { 
      signal: AbortSignal.timeout(10000),
      cache: "no-store", // 避免 Next.js 自动缓存，我们自己控制
    });

    if (!res.ok) throw new Error(`Hits API error: ${res.status}`);

    const json = await res.json() as { data: PageHitItem[] };
    const data = json.data || [];

    // 更新缓存
    serverHitsCache = { data, timestamp: Date.now() };

    return calculateHitsForSlug(data, slug);
  } catch (error) {
    console.error("[Server] Failed to fetch hits:", error);
    // 有缓存时返回过期缓存
    if (serverHitsCache) {
      return calculateHitsForSlug(serverHitsCache.data, slug);
    }
    return 0;
  }
}

/**
 * 计算指定 slug 的总浏览量（处理多路径如 /slug, /slug/, /slug/amp/）
 */
function calculateHitsForSlug(data: PageHitItem[], slug: string): number {
  let total = 0;
  for (const item of data) {
    const itemSlug = extractSlugFromPath(item.page);
    if (itemSlug === slug) {
      total += item.hit;
    }
  }
  return total;
}

/**
 * 从路径提取 slug
 */
function extractSlugFromPath(page: string): string {
  // 移除开头的 / 和结尾的 /amp/
  return page
    .replace(/^\//, "")
    .replace(/\/amp\/?$/, "")
    .replace(/\/$/, "");
}

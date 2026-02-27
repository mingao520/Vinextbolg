import { articlePageSize, categoryMap, siteConfig } from "@/lib/site-config";
import { extractSlug, parsePositivePage } from "@/lib/utils";
import { getAllPosts } from "./posts";
import type { PostItem } from "./types";

const categoryNameMap = new Map<string, string>(
  categoryMap.map((item) => [item.text, item.name]),
);

// 服务端缓存（6小时）
interface HitsCache {
  data: Map<string, number>;
  timestamp: number;
  loading: boolean;
}

let hitsCache: HitsCache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface PostListingResult {
  category?: string;
  categoryName?: string;
  posts: PostItem[];
  visiblePosts: PostItem[];
  hitsMap: Map<string, number>;
  hitsLoading: boolean;
  requestedPage: number;
  page: number;
  pageTotal: number;
}

async function getHitsMap(): Promise<{
  hitsMap: Map<string, number>;
  hitsLoading: boolean;
}> {
  if (hitsCache && Date.now() - hitsCache.timestamp < CACHE_TTL_MS) {
    return { hitsMap: hitsCache.data, hitsLoading: hitsCache.loading };
  }

  const staleCache = hitsCache;

  const fetchPromise = (async () => {
    const hitsMap = new Map<string, number>();
    let loading = true;

    try {
      const apiPath = siteConfig.analyticsApiUrl;
      if (!apiPath) throw new Error("analyticsApiUrl not configured");

      // 服务端渲染需要使用完整 URL
      // 本地开发使用 localhost，生产使用 siteUrl
      const isServer = typeof window === "undefined";
      // 在 vinext 中，开发环境可以通过检查 process.env 或其他方式判断
      const baseUrl = isServer ? "http://localhost:3000" : "";
      const apiUrl = `${baseUrl}${apiPath}`;

      console.log("[Server] Fetching hits from:", apiUrl);

      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      
      console.log("[Server] Hits API response:", res.status);
      if (!res.ok) throw new Error(`stat API error: ${res.status}`);

      const json = (await res.json()) as { total?: number; data: Array<{ page: string; hit: number }> };
      console.log("[Server] Hits data count:", json.data?.length, "Total:", json.total);
      for (const item of json.data) {
        const slug = extractSlug(item.page);
        const existing = hitsMap.get(slug) ?? 0;
        hitsMap.set(slug, existing + item.hit);
      }
      loading = false;
      console.log("[Server] Hits map size:", hitsMap.size);
    } catch (error) {
      console.error("[Server] Failed to fetch hits:", error);
    }

    hitsCache = { data: hitsMap, timestamp: Date.now(), loading };
    return { hitsMap, hitsLoading: loading };
  })();

  if (staleCache) {
    fetchPromise.catch(() => {});
    return { hitsMap: staleCache.data, hitsLoading: staleCache.loading };
  }

  return fetchPromise;
}

export function isKnownCategory(category: string): boolean {
  return categoryNameMap.has(category);
}

export function getCategoryName(category: string): string {
  return categoryNameMap.get(category) ?? category;
}

export async function getPostListing(params: {
  category?: string;
  pageParam?: string;
}): Promise<PostListingResult> {
  const category = params.category;
  const requestedPage = parsePositivePage(params.pageParam);
  const allPosts = getAllPosts();

  const hitsPromise = getHitsMap();

  const posts =
    category && category !== "hot"
      ? allPosts.filter((post) => post.categories.includes(category))
      : allPosts;

  const { hitsMap, hitsLoading } = await hitsPromise;

  const sortedPosts =
    category === "hot"
      ? [...posts].sort(
          (a, b) => (hitsMap.get(b.slug) ?? 0) - (hitsMap.get(a.slug) ?? 0),
        )
      : posts;

  const pageTotal = Math.max(1, Math.ceil(sortedPosts.length / articlePageSize));
  const page = Math.min(requestedPage, pageTotal);
  const start = (page - 1) * articlePageSize;

  return {
    category,
    categoryName: category ? getCategoryName(category) : undefined,
    posts: sortedPosts,
    visiblePosts: sortedPosts.slice(start, start + articlePageSize),
    hitsMap,
    hitsLoading,
    requestedPage,
    page,
    pageTotal,
  };
}

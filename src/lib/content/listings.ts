import { EXTERNAL_API_PAGE_HITS, type PageHitItem } from "@/lib/analytics";
import { articlePageSize, categoryMap } from "@/lib/site-config";
import { getAllPosts } from "./posts";
import type { PostItem } from "./types";

const categoryNameMap = new Map<string, string>(
  categoryMap.map((item) => [item.text, item.name]),
);

// In-memory cache for hits data
interface HitsCache {
  data: Map<string, number>;
  timestamp: number;
  loading: boolean;
}

let hitsCache: HitsCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

function parsePageNumber(pageParam?: string): number {
  if (!pageParam) return 1;
  const parsed = Number(pageParam);
  if (!Number.isFinite(parsed)) return 1;
  const integer = Math.trunc(parsed);
  return integer > 0 ? integer : 1;
}

/**
 * Extract slug from page path/URL
 * Handles formats:
 * - "/article-slug" → "article-slug"
 * - "https://luolei.org/article-slug/" → "article-slug"
 * - "https://x.luolei.org/article-slug" → "article-slug"
 */
function extractSlug(page: string): string {
  // Remove protocol and domain if present
  let path = page;
  
  // Handle full URLs like "https://luolei.org/article-slug/"
  if (path.includes("://")) {
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch {
      // If URL parsing fails, treat as path
    }
  }
  
  // Remove leading and trailing slashes
  return path.replace(/^\//, "").replace(/\/$/, "");
}

async function getHitsMap(): Promise<{
  hitsMap: Map<string, number>;
  hitsLoading: boolean;
}> {
  // Check if cache is valid
  if (hitsCache && Date.now() - hitsCache.timestamp < CACHE_TTL_MS) {
    return { hitsMap: hitsCache.data, hitsLoading: hitsCache.loading };
  }

  // Return stale cache immediately to avoid blocking, then refresh in background
  const staleCache = hitsCache;

  // Start fresh fetch
  const fetchPromise = (async () => {
    const hitsMap = new Map<string, number>();
    let loading = true;

    try {
      const hitsRes = await fetch(EXTERNAL_API_PAGE_HITS, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      const hitsJson = (await hitsRes.json()) as { data?: PageHitItem[] };
      for (const item of hitsJson.data ?? []) {
        const slug = extractSlug(item.page);
        // Accumulate hits for the same slug (handles /slug, /slug/, /slug/amp/ etc.)
        const existingHit = hitsMap.get(slug) ?? 0;
        hitsMap.set(slug, existingHit + item.hit);
      }
      loading = false;
    } catch {
      // Keep loading = true on error
    }

    // Update cache
    hitsCache = {
      data: hitsMap,
      timestamp: Date.now(),
      loading,
    };

    return { hitsMap, hitsLoading: loading };
  })();

  // If we have stale cache, return it immediately and refresh in background
  if (staleCache) {
    // Trigger background refresh
    fetchPromise.catch(() => {});
    return { hitsMap: staleCache.data, hitsLoading: staleCache.loading };
  }

  // First request, wait for data
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
  const requestedPage = parsePageNumber(params.pageParam);
  const allPosts = getAllPosts();
  
  // Start fetching hits in parallel with filtering
  const hitsPromise = getHitsMap();
  
  const posts =
    category && category !== "hot"
      ? allPosts.filter((post) => post.categories.includes(category))
      : allPosts;

  // Wait for hits data
  const { hitsMap, hitsLoading } = await hitsPromise;

  // Sort posts by hits for hot category
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

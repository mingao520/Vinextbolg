// GA4 集成后，这个文件仅保留类型定义和 API 路径
// 实际数据获取逻辑在 src/lib/ga4.ts

// Local API route (used by client components)
export const API_PAGE_HITS = "/api/analytics/hits";

export interface PageHitItem {
  page: string;
  hit: number;
}

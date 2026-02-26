// Original external API endpoint
export const EXTERNAL_API_PAGE_HITS = "https://st.luolei.org/ga";

// Local cached API route (used by client components)
export const API_PAGE_HITS = "/api/analytics/hits";

export interface PageHitItem {
  page: string;
  hit: number;
}

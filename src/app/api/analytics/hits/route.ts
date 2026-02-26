import { NextResponse } from "next/server";
import { fetchGA4PageViews, isGA4Configured } from "@/lib/ga4";

export const runtime = "edge";

export const revalidate = 21600; // 6 小时

let cache: { data: { total: number; data: Array<{ page: string; hit: number }> }; timestamp: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log("[Analytics] Using cached data");
      return NextResponse.json(cache.data, {
        headers: {
          "Cache-Control": "public, max-age=21600",
          "X-Cache": "HIT",
        },
      });
    }

    if (!isGA4Configured()) {
      console.warn("[Analytics] GA4 not configured");
      return NextResponse.json(
        { total: 0, data: [] },
        { headers: { "Cache-Control": "public, max-age=3600", "X-Cache": "MISS" } }
      );
    }

    console.log("[Analytics] Fetching from GA4...");
    const results = await fetchGA4PageViews();
    const data = { total: results.length, data: results };
    cache = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=21600",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "Cache-Control": "public, max-age=3600", "X-Cache": "STALE" },
      });
    }
    return NextResponse.json(
      { total: 0, data: [] },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  }
}

import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 21600; // 6 小时

interface CacheEntry {
  data: { total: number; data: Array<{ page: string; hit: number }> };
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000;

// 从环境变量读取配置（Edge Runtime 支持）
function getUmamiConfig() {
  return {
    apiUrl: process.env.UMAMI_API_URL || "https://u.is26.com/api",
    websiteId: process.env.UMAMI_WEBSITE_ID || "185ef031-29b2-49e3-bc50-1c9f80b4e831",
    apiToken: process.env.UMAMI_API_TOKEN || "",
  };
}

interface UmamiPageView {
  page: string;
  hit: number;
}

/**
 * 从 Umami API 获取页面浏览量数据
 */
async function fetchUmamiPageViews(): Promise<{
  total: number;
  data: UmamiPageView[];
}> {
  const { apiUrl, websiteId, apiToken } = getUmamiConfig();

  if (!apiUrl || !websiteId) {
    console.warn("[Umami] API URL or Website ID not configured");
    return { total: 0, data: [] };
  }

  // 计算时间范围：从 2015-01-01 到 2030-01-01
  const startAt = new Date("2015-01-01").getTime();
  const endAt = new Date("2030-01-01").getTime();

  // 构建请求头
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // 只在有 Token 时添加认证（公开数据可不认证）
  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  }

  // 使用 /metrics 端点获取页面路径统计
  const metricsUrl = new URL(`${apiUrl}/websites/${websiteId}/metrics`);
  metricsUrl.searchParams.set("startAt", startAt.toString());
  metricsUrl.searchParams.set("endAt", endAt.toString());
  metricsUrl.searchParams.set("type", "path");

  console.log("[Umami] Fetching metrics from:", metricsUrl.toString());

  const response = await fetch(metricsUrl.toString(), {
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("[Umami] API error:", response.status, errorText);
    throw new Error(`Umami API error: ${response.status}`);
  }

  const metricsData = (await response.json()) as Array<{
    x: string;
    y: number;
  }>;

  console.log(`[Umami] Got ${metricsData.length} metrics entries`);

  const pageData = metricsData.map((item) => ({
    page: item.x,
    hit: item.y,
  }));

  const total = pageData.reduce((sum, item) => sum + item.hit, 0);

  console.log(`[Umami] Total pageviews: ${total}, Pages: ${pageData.length}`);

  return {
    total,
    data: pageData,
  };
}

export async function GET() {
  try {
    // 检查缓存
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data, {
        headers: { "Cache-Control": "public, max-age=21600", "X-Cache": "HIT" },
      });
    }

    // 从 Umami 获取数据
    const umamiData = await fetchUmamiPageViews();

    // 构造响应格式
    const data = {
      total: umamiData.total,
      data: umamiData.data,
    };

    // 更新缓存
    cache = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=21600", "X-Cache": "MISS" },
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);

    // 有缓存时返回过期缓存
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "Cache-Control": "public, max-age=3600", "X-Cache": "STALE" },
      });
    }

    // 无缓存时返回空数据
    return NextResponse.json(
      { total: 0, data: [] },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }
}

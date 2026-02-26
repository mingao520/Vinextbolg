import { NextResponse } from "next/server";
import { EXTERNAL_API_PAGE_HITS } from "@/lib/analytics";

export const runtime = "edge";

// Cache for 5 minutes at the edge
export const revalidate = 300;

interface CfRequestInit extends RequestInit {
  cf?: {
    cacheTtl?: number;
    cacheEverything?: boolean;
  };
}

export async function GET() {
  try {
    const response = await fetch(EXTERNAL_API_PAGE_HITS, {
      cf: {
        // Cache in Cloudflare's edge for 5 minutes
        cacheTtl: 300,
        cacheEverything: true,
      },
    } as CfRequestInit);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        // Cache in browser for 2 minutes
        "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    // Return empty data on error
    return NextResponse.json(
      { data: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  }
}

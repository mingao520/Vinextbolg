import { SignJWT } from "jose";

// GA4 Data API 配置
const GA4_CONFIG = {
  propertyId: process.env.GA4_PROPERTY_ID || "123456789",
  clientEmail: process.env.GA4_CLIENT_EMAIL || "",
  privateKey: process.env.GA4_PRIVATE_KEY || "",
};

interface GA4Row {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

interface GA4Response {
  rows?: GA4Row[];
}

/**
 * 将 Base64 字符串转换为 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 解析 PEM 格式的私钥
 */
function parsePrivateKey(pem: string): ArrayBuffer {
  // 移除 PEM 头尾标记和换行符
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  
  return base64ToArrayBuffer(cleaned);
}

/**
 * 生成 Google API 访问用的 JWT Token
 */
async function getAccessToken(): Promise<string> {
  if (!GA4_CONFIG.clientEmail || !GA4_CONFIG.privateKey) {
    throw new Error("GA4 credentials not configured");
  }

  // 解析 PEM 私钥
  const keyData = parsePrivateKey(GA4_CONFIG.privateKey);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await new SignJWT({
    iss: GA4_CONFIG.clientEmail,
    sub: GA4_CONFIG.clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token fetch failed: ${tokenResponse.status} ${error}`);
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };
  return access_token;
}

/**
 * 从 GA4 Data API 获取页面浏览量数据
 */
export async function fetchGA4PageViews(): Promise<Array<{ page: string; hit: number }>> {
  try {
    const accessToken = await getAccessToken();
    
    // 计算日期范围（GA4 数据有延迟，查询前天及之前的数据）
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // 昨天
    const startDate = new Date("2016-01-01"); // GA4 要求开始日期 > 2015-08-13

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_CONFIG.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: startDate.toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
            },
          ],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          dimensionFilter: {
            filter: {
              fieldName: "pagePath",
              stringFilter: {
                matchType: "BEGINS_WITH",
                value: "/",
              },
            },
          },
          orderBys: [
            {
              metric: { metricName: "screenPageViews" },
              desc: true,
            },
          ],
          limit: 10000,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[GA4] API error:", response.status, error);
      throw new Error(`GA4 API error: ${response.status}`);
    }

    const data = (await response.json()) as GA4Response;
    
    const results = (data.rows || []).map((row) => ({
      page: row.dimensionValues[0].value,
      hit: parseInt(row.metricValues[0].value, 10) || 0,
    }));

    console.log(`[GA4] Fetched ${results.length} pages`);
    return results;
  } catch (error) {
    console.error("[GA4] Failed to fetch:", error);
    return [];
  }
}

/**
 * 验证 GA4 配置是否完整
 */
export function isGA4Configured(): boolean {
  return !!(
    GA4_CONFIG.propertyId &&
    GA4_CONFIG.propertyId !== "123456789" &&
    GA4_CONFIG.clientEmail &&
    GA4_CONFIG.privateKey
  );
}

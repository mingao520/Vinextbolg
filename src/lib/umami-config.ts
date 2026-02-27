/**
 * Umami 配置管理
 * 支持本地开发和生产环境
 */

// 默认配置（用于本地开发）
const DEFAULT_CONFIG = {
  apiUrl: "https://u.is26.com/api",
  websiteId: "185ef031-29b2-49e3-bc50-1c9f80b4e831",
  scriptUrl: "https://u.is26.com/script.js",
  // 注意：API Token 应该从环境变量读取
  // 本地开发时可以在 .env 中设置，生产环境通过 wrangler secret 设置
};

export interface UmamiConfig {
  apiUrl: string;
  websiteId: string;
  apiToken: string;
  scriptUrl: string;
}

/**
 * 获取 Umami 配置
 * 优先从环境变量读取，否则使用默认值
 */
export function getUmamiConfig(): UmamiConfig {
  return {
    apiUrl: process.env.UMAMI_API_URL || DEFAULT_CONFIG.apiUrl,
    websiteId: process.env.UMAMI_WEBSITE_ID || DEFAULT_CONFIG.websiteId,
    apiToken: process.env.UMAMI_API_TOKEN || "",
    scriptUrl: process.env.UMAMI_SCRIPT_URL || DEFAULT_CONFIG.scriptUrl,
  };
}

/**
 * 站点配置中使用的 Umami 设置
 */
export const siteUmamiConfig = {
  websiteId: DEFAULT_CONFIG.websiteId,
  scriptUrl: DEFAULT_CONFIG.scriptUrl,
};

"use client";

import Script from "next/script";
import { siteConfig } from "@/lib/site-config";

/**
 * Umami Analytics Script
 * 
 * 注意：Umami 通过 data-domains 限制只在配置的域名上统计
 * 本地开发（localhost）不会产生新的统计数据，但页面能正常加载
 */
export function UmamiScript() {
  const websiteId = siteConfig.umamiWebsiteId;
  const scriptUrl = siteConfig.umamiScriptUrl;

  // 没有配置时不加载
  if (!websiteId || !scriptUrl) {
    return null;
  }

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      strategy="lazyOnload"
      // 限制只在 luolei.org 及其子域名上产生统计数据
      // 本地开发时不会发送统计数据，但页面功能正常
      data-domains="luolei.org,www.luolei.org"
    />
  );
}

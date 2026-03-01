"use client";

import Script from "next/script";
import { siteConfig } from "@/lib/site-config";

/**
 * Google Analytics (gtag.js)
 * 仅作为并行统计保留，不参与站内展示数据源（站内仍以 Umami 为准）。
 */
export function GoogleAnalyticsScript() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const measurementId = siteConfig.googleAnalyticsId;

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-gtag"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = window.gtag || gtag;
            gtag('js', new Date());
            gtag('config', '${measurementId}');
          `,
        }}
      />
    </>
  );
}

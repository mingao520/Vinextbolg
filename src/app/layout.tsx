import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeColorMeta } from "@/components/theme-color-meta";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
  description: siteConfig.description,
  keywords: [
    "ZUOLUOTV",
    "科技",
    "旅行",
    "生活方式",
    "程序员",
    "前端",
    "罗磊",
    "独立博客",
  ],
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    type: "website",
    url: siteConfig.siteUrl,
    siteName: siteConfig.title,
  },
  icons: {
    icon: [
      { url: "/legacy/favicon.ico", sizes: "32x32" },
      { url: "/legacy/favicon.png", type: "image/png", sizes: "256x256" },
    ],
    apple: [
      { url: "/legacy/favicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.title,
  },
  applicationName: siteConfig.title,
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="scroll-pt-[60px]">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <ThemeColorMeta />
      </head>
      <body className="antialiased pt-[52px]">
        <SiteHeader />
        {children}
        <SiteFooter />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${siteConfig.analyticsId}`}
          strategy="lazyOnload"
        />
        <Script id="gtag-init" strategy="lazyOnload">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${siteConfig.analyticsId}');`}
        </Script>
      </body>
    </html>
  );
}

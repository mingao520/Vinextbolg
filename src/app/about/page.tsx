import type { Metadata } from "next";
import { getMultiModelProfileData } from "@/lib/content/author-profile";
import { siteConfig } from "@/lib/site-config";
import { AboutPageClient } from "./client";

export function generateMetadata(): Metadata {
  const canonical = `${siteConfig.siteUrl}/about`;
  return {
    title: "关于",
    description:
      "基于博客内容、X 动态与 GitHub 履历的 AI 第三方视角作者画像，支持多 AI 模型视角切换。",
    alternates: {
      canonical,
    },
    openGraph: {
      title: `关于 | ${siteConfig.title}`,
      description:
        "基于博客内容、X 动态与 GitHub 履历的 AI 第三方视角作者画像。",
      type: "profile",
      url: canonical,
      siteName: siteConfig.title,
      locale: "zh_CN",
    },
  };
}

export default function AboutPage() {
  const { manifest, reports } = getMultiModelProfileData();

  // Serialize for client component
  const serializedReports = reports.map((r) => ({
    modelId: r.model.id,
    meta: r.meta,
    report: r.report,
  }));

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-14 pt-8 md:px-8 md:pt-10">
      <AboutPageClient
        manifest={manifest}
        reports={serializedReports}
      />
    </main>
  );
}

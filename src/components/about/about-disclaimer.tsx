import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import type { ProfileMeta } from "@/lib/content/author-profile";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

interface AboutDisclaimerProps {
  disclaimer: string;
  meta: ProfileMeta;
}

export function AboutDisclaimer({ disclaimer, meta }: AboutDisclaimerProps) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-5 text-sm leading-7 text-zinc-600 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:text-zinc-400">
      <p>{disclaimer}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-500">
        <span>更新于 {formatDateTime(meta.lastUpdated)}</span>
        <span className="hidden md:inline">·</span>
        <span>
          {meta.modelName} by {meta.provider}
        </span>
        <span className="hidden md:inline">·</span>
        <span>来源 {meta.sources.join(" / ")}</span>
      </div>
      <p className="mt-3">
        若你希望了解更完整的第一手内容，可直接查看{" "}
        <Link
          href="/"
          className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:decoration-zinc-700 dark:hover:text-zinc-200"
        >
          博客文章归档
        </Link>{" "}
        与{" "}
        <a
          href={siteConfig.social.github}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:decoration-zinc-700 dark:hover:text-zinc-200"
        >
          GitHub
        </a>
        。
      </p>
    </section>
  );
}

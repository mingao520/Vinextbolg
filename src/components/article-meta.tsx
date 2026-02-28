"use client";

import type { PostDetail } from "@/lib/content/types";
import { getBannerImage } from "@/lib/content/utils";
import { usePageHits } from "@/hooks/use-article-hits";
import { IconCalendar, IconEye, IconLoading, IconClock } from "@/components/icons";

interface ArticleMetaProps {
  post: PostDetail;
  /** 服务端预获取的浏览量（可选） */
  hits?: number;
}

export function ArticleMeta({ post, hits: serverHits }: ArticleMetaProps) {
  const banner = getBannerImage(post.cover);
  
  // 只有未提供服务端数据时才使用客户端 hook
  const { loading: clientLoading, hits: clientHits } = usePageHits(
    post.slug, 
    /* enabled */ serverHits === undefined
  );
  
  // 优先使用服务端数据
  const hits = serverHits ?? clientHits;
  const loading = serverHits === undefined && clientLoading;

  return (
    <header
      className="relative h-48 sm:h-56 md:h-64 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 bg-cover bg-center"
      style={banner ? { backgroundImage: `url(${banner})` } : undefined}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* 内容 */}
      <div className="relative h-full flex items-center px-5 md:px-10">
        <div className="max-w-xl">
          <h1 className="text-xl md:text-2xl font-bold text-white leading-tight line-clamp-3 md:line-clamp-2">
            {post.title}
          </h1>
          
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-neutral-200">
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="h-3.5 w-3.5" />
              {post.date}
            </span>
            <span className="text-neutral-400/60 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1">
              <IconEye className="h-3.5 w-3.5" />
              {loading ? (
                <IconLoading className="h-2.5 w-2.5 animate-spin text-neutral-300" />
              ) : (
                <>{hits.toLocaleString()} 浏览</>
              )}
            </span>
            <span className="text-neutral-400/60 hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1">
              <IconClock className="h-3.5 w-3.5" />
              {post.readingTime}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

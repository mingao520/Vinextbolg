import Link from "next/link";
import type { PostItem } from "@/lib/content/types";
import { getPreviewImage } from "@/lib/content/utils";

interface ArticleBottomNavProps {
  prev: PostItem | null;
  next: PostItem | null;
}

function NavCard({
  post,
  direction
}: {
  post: PostItem;
  direction: "prev" | "next";
}) {
  const bg = getPreviewImage(post.cover);
  const isPrev = direction === "prev";

  return (
    <Link
      href={post.url}
      className="group relative flex-1 h-36 sm:h-40 md:h-44 rounded-lg overflow-hidden bg-zinc-100"
      style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/30" />
      
      {/* 内容 */}
      <div className={`relative h-full flex flex-col justify-center px-5 py-4 md:px-6 ${isPrev ? 'items-start' : 'items-end text-right'}`}>
        <p className="text-xs text-white/70 mb-1.5 tracking-wide">{isPrev ? '← 上一篇' : '下一篇 →'}</p>
        <p className="text-sm sm:text-base text-white font-medium line-clamp-2 leading-snug">
          {post.title}
        </p>
      </div>
    </Link>
  );
}

export function ArticleBottomNav({ prev, next }: ArticleBottomNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex flex-col md:flex-row gap-4 mt-6">
      {prev && <NavCard post={prev} direction="prev" />}
      {next && <NavCard post={next} direction="next" />}
    </nav>
  );
}

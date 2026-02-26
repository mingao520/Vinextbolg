import type { PostItem } from "@/lib/content/types";
import { ArticleCard } from "./article-card";

interface ArticleListProps {
  posts: PostItem[];
  hitsMap?: Map<string, number>;
  hitsLoading?: boolean;
}

export function ArticleList({
  posts,
  hitsMap,
  hitsLoading = false,
}: ArticleListProps) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-4 md:px-6 lg:px-2">
      <ul className="grid grid-cols-1 gap-6 pt-3 sm:grid-cols-2 md:pt-6 lg:grid-cols-3 xl:grid-cols-4">
        {posts.map((post, index) => (
          <li
            key={post.slug}
            className="flex flex-col"
          >
            <ArticleCard
              post={post}
              hits={hitsMap?.get(post.slug) ?? 0}
              hitsLoading={hitsLoading}
              priority={index < 4}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

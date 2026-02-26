import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { CategoryNav } from "@/components/category-nav";
import { PaginationNav } from "@/components/pagination-nav";
import { getPostListing } from "@/lib/content/listings";
import { siteConfig } from "@/lib/site-config";

interface PagePageProps {
  params: Promise<{ page: string }>;
}

export async function generateMetadata({
  params,
}: PagePageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNum = parseInt(page, 10);

  return {
    alternates: {
      canonical: `${siteConfig.siteUrl}/page/${pageNum}`,
    },
    title: `第 ${pageNum} 页`,
  };
}

export default async function PagePage({ params }: PagePageProps) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 2) {
    permanentRedirect("/");
  }

  const listing = await getPostListing({ pageParam: page });

  if (listing.requestedPage > listing.pageTotal) {
    notFound();
  }

  return (
    <main className="pb-8 pt-2">
      <CategoryNav />
      <ArticleList
        posts={listing.visiblePosts}
        hitsMap={listing.hitsMap}
        hitsLoading={listing.hitsLoading}
      />
      <PaginationNav page={listing.page} pageTotal={listing.pageTotal} />
    </main>
  );
}

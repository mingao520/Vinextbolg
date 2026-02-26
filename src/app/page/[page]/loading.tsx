import { CategoryNav } from "@/components/category-nav";
import { PaginationNav } from "@/components/pagination-nav";

interface LoadingProps {
  params?: Promise<{ page: string }>;
}

export default async function Loading({ params }: LoadingProps) {
  const routeParams = params ? await params : { page: "1" };
  const page = parseInt(routeParams.page, 10) || 1;

  // Generate skeleton cards
  const skeletonCards = Array.from({ length: 12 }, (_, i) => (
    <li
      key={i}
      className="flex w-full flex-shrink flex-grow flex-col px-4 py-3 sm:w-1/2 sm:px-3 md:w-1/4"
    >
      <article className="group flex h-full flex-col">
        <div className="overflow-hidden flex-1 h-full rounded-t bg-white shadow-lg dark:bg-zinc-800">
          <div className="flex min-h-60 flex-wrap md:min-h-40 lg:min-h-40">
            <div className="block overflow-hidden relative h-60 w-full bg-zinc-100 dark:bg-neutral-900 md:h-40 lg:h-40">
              <div className="absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="mt-5 w-full px-6">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 md:h-3" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 md:h-3" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden mt-auto h-12 flex-none rounded-b rounded-t-none bg-white px-6 py-3 shadow-lg dark:bg-zinc-800">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </article>
    </li>
  ));

  return (
    <main className="pb-8 pt-2">
      <CategoryNav />
      <div className="mx-auto -mt-4 max-w-[1240px] px-4 sm:px-4 md:px-6 lg:px-2">
        <ul className="-mx-3 flex flex-wrap justify-between pt-3 sm:mx-1 md:mx-0 md:pt-6">
          {skeletonCards}
        </ul>
      </div>
      <PaginationNav page={page} pageTotal={page + 1} />
    </main>
  );
}

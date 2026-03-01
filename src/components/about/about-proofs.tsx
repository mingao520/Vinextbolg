import type { ProofItem } from "@/lib/content/author-profile";

interface AboutProofsProps {
  posts: ProofItem[];
  tweets: ProofItem[];
  projects: ProofItem[];
}

function ProofSection({
  title,
  items,
}: {
  title: string;
  items: ProofItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={`${title}-${item.url}-${item.title}`}
            className="rounded-xl border border-zinc-200/70 bg-white px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/70"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:text-zinc-300"
            >
              {item.title}
            </a>
            <p className="mt-1 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              {item.reason}
            </p>
            {item.date ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {item.date}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AboutProofs({ posts, tweets, projects }: AboutProofsProps) {
  if (posts.length === 0 && tweets.length === 0 && projects.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <ProofSection title="代表文章" items={posts} />
      <ProofSection title="X 动态" items={tweets} />
      <ProofSection title="GitHub 项目" items={projects} />
    </div>
  );
}

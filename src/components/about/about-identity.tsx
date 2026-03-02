import type { IdentityCard } from "@/lib/content/author-profile";

const ROLE_EMOJIS: Record<string, string> = {
  网络: "🌐",
  工具: "🔧",
  效率: "⚡",
  旅行: "✈️",
  城市: "🏙️",
  前端: "💻",
  工程: "🛠️",
  开源: "🔓",
  AI: "🤖",
  写作: "✏️",
  教程: "📝",
  摄影: "📷",
  消费: "💰",
  健康: "❤️",
  部署: "🚀",
  生活: "🌍",
  运动: "🏃",
  跑: "🏃",
  马拉松: "🏃",
  家庭: "🏠",
  家: "🏠",
};

function getEmoji(name: string): string {
  for (const [key, emoji] of Object.entries(ROLE_EMOJIS)) {
    if (name.includes(key)) return emoji;
  }
  return "📌";
}

interface AboutIdentityProps {
  identities: IdentityCard[];
}

export function AboutIdentity({ identities }: AboutIdentityProps) {
  if (identities.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        他的不同面
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        不只是写代码的人
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {identities.map((identity) => (
          <article
            key={identity.name}
            className="group rounded-xl border border-zinc-200/70 bg-white p-4 transition-colors hover:border-zinc-300/80 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:hover:border-zinc-700/80"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-lg" aria-hidden="true">
                {getEmoji(identity.name)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {identity.name}
                </h3>
                <p className="mt-1.5 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                  {identity.description}
                </p>
                {identity.link ? (
                  <a
                    href={identity.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    了解更多
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

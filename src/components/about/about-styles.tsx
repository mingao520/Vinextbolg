import type { StyleItem } from "@/lib/content/author-profile";

interface AboutStylesProps {
  styles: StyleItem[];
}

const TRAIT_ACCENTS: { bg: string; border: string; dot: string }[] = [
  {
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    border: "border-amber-200/60 dark:border-amber-800/40",
    dot: "bg-amber-400 dark:bg-amber-500",
  },
  {
    bg: "bg-sky-50/60 dark:bg-sky-950/20",
    border: "border-sky-200/60 dark:border-sky-800/40",
    dot: "bg-sky-400 dark:bg-sky-500",
  },
  {
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
    border: "border-violet-200/60 dark:border-violet-800/40",
    dot: "bg-violet-400 dark:bg-violet-500",
  },
  {
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    dot: "bg-emerald-400 dark:bg-emerald-500",
  },
  {
    bg: "bg-rose-50/60 dark:bg-rose-950/20",
    border: "border-rose-200/60 dark:border-rose-800/40",
    dot: "bg-rose-400 dark:bg-rose-500",
  },
];

export function AboutStyles({ styles }: AboutStylesProps) {
  if (styles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        如果你认识他
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        跟他相处久了，你大概会注意到这些
      </p>
      <div className="mt-4 space-y-3">
        {styles.map((style, i) => {
          const accent = TRAIT_ACCENTS[i % TRAIT_ACCENTS.length];
          return (
            <div
              key={style.trait}
              className={`rounded-xl border px-4 py-3.5 ${accent.bg} ${accent.border}`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${accent.dot}`}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {style.trait}
                </h3>
              </div>
              <p className="mt-1.5 pl-[18px] text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                {style.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import type { StrengthGroup } from "@/lib/content/author-profile";

interface AboutStrengthsProps {
  strengths: StrengthGroup[];
}

export function AboutStrengths({ strengths }: AboutStrengthsProps) {
  if (strengths.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        做事哲学
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        从他做过的事里，能看到这些模式
      </p>
      <div className="mt-4 space-y-4">
        {strengths.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-zinc-200/70 bg-white px-4 py-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/70"
          >
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {group.title}
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {group.points.map((point) => (
                <li key={`${group.title}-${point}`} className="flex gap-2">
                  <span
                    className="mt-[11px] inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

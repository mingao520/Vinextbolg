interface AboutTagsProps {
  tags: string[];
}

export function AboutTags({ tags }: AboutTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-zinc-200/80 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:text-zinc-300"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

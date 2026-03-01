"use client";

import { useState, useCallback } from "react";
import type { ModelEntry } from "@/lib/content/author-profile";

interface ModelSwitcherProps {
  models: ModelEntry[];
  activeModelId: string;
  onModelChange: (modelId: string) => void;
}

const MODEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  gemini: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
  },
  qwen: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
  },
  kimi: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

function getModelColors(icon: string) {
  return MODEL_COLORS[icon] ?? {
    bg: "bg-zinc-50 dark:bg-zinc-900/30",
    border: "border-zinc-200 dark:border-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
  };
}

export function ModelSwitcher({
  models,
  activeModelId,
  onModelChange,
}: ModelSwitcherProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-1 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      {models.map((model) => {
        const isActive = model.id === activeModelId;
        const colors = getModelColors(model.icon);

        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onModelChange(model.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? `${colors.bg} ${colors.border} ${colors.text} border shadow-sm`
                : "border border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60"
            }`}
            aria-pressed={isActive}
          >
            <ModelIcon icon={model.icon} className="h-4 w-4" />
            <span>{model.name}</span>
            {model.generatedBy === "ai" && (
              <span className="ml-0.5 text-[10px] opacity-60">AI</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Model Icons (inline SVGs for each provider) ─────────────

function ModelIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case "gemini":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86zm2-15.86c3.95.49 7 3.85 7 7.93s-3.05 7.44-7 7.93V4.07z" />
        </svg>
      );
    case "qwen":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case "kimi":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      );
  }
}

// ─── About Client Wrapper ────────────────────────────────────
// This wraps all about sections and manages model switching state

interface AboutClientProps {
  defaultModelId: string;
  models: ModelEntry[];
  children: (activeModelId: string) => React.ReactNode;
}

export function AboutClient({ defaultModelId, models, children }: AboutClientProps) {
  const [activeModelId, setActiveModelId] = useState(defaultModelId);

  const handleModelChange = useCallback((modelId: string) => {
    setActiveModelId(modelId);
    // Update URL without page reload
    const url = new URL(window.location.href);
    if (modelId === defaultModelId) {
      url.searchParams.delete("model");
    } else {
      url.searchParams.set("model", modelId);
    }
    window.history.replaceState(null, "", url.toString());
  }, [defaultModelId]);

  return (
    <>
      <div className="mt-5">
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-500">
          切换 AI 模型视角
        </p>
        <ModelSwitcher
          models={models}
          activeModelId={activeModelId}
          onModelChange={handleModelChange}
        />
      </div>
      {children(activeModelId)}
    </>
  );
}

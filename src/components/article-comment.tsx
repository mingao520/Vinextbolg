"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";

interface ArtalkInstance {
  setDarkMode: (dark: boolean) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    Artalk?: {
      init: (config: Record<string, unknown>) => ArtalkInstance;
    };
  }
}

interface ArticleCommentProps {
  slug: string;
  title: string;
}

export function ArticleComment({ slug, title }: ArticleCommentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Use Intersection Observer to detect when comment section is visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: "200px", // Start loading 200px before visible
        threshold: 0 
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Load comments when visible
  useEffect(() => {
    if (!isVisible || shouldLoad) return;

    // Small delay to prioritize critical content
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, shouldLoad]);

  // Initialize Artalk when ready
  useEffect(() => {
    if (!shouldLoad) return;

    const scriptId = "artalk-js";
    const styleId = "artalk-css";
    let artalk: ArtalkInstance | null = null;
    let observer: MutationObserver | null = null;

    const init = () => {
      if (!window.Artalk || !containerRef.current) return;
      artalk = window.Artalk.init({
        el: containerRef.current,
        pageKey: `${siteConfig.siteUrl}/${slug}/`,
        pageTitle: title,
        server: siteConfig.comments.server,
        site: siteConfig.comments.siteName,
        gravatar: {
          mirror: siteConfig.comments.gravatarMirror,
        },
      });

      // Sync dark mode with current theme
      const html = document.documentElement;
      artalk.setDarkMode(html.classList.contains("dark"));

      // Watch for theme changes via MutationObserver
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === "class" && artalk) {
            artalk.setDarkMode(
              (m.target as HTMLElement).classList.contains("dark"),
            );
          }
        }
      });
      observer.observe(html, { attributes: true });
    };

    if (!document.getElementById(styleId)) {
      const css = document.createElement("link");
      css.id = styleId;
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/artalk/dist/Artalk.css";
      document.head.appendChild(css);
    }

    const existed = document.getElementById(scriptId);
    if (existed) {
      init();
      return () => {
        observer?.disconnect();
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://cdn.jsdelivr.net/npm/artalk/dist/Artalk.js";
    script.async = true;
    script.defer = true;
    script.onload = () => init();
    document.body.appendChild(script);

    return () => {
      observer?.disconnect();
    };
  }, [shouldLoad, slug, title]);

  return (
    <div id="Comments" ref={containerRef} className="mt-6">
      {!shouldLoad && (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
          <span>评论加载中...</span>
        </div>
      )}
    </div>
  );
}

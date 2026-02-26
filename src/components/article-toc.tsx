"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface ArticleTocProps {
  headings: TocHeading[];
}

export function ArticleToc({ headings }: ArticleTocProps) {
  const tocHeadings = useMemo(
    () =>
      headings.filter((heading) => heading.level === 2 || heading.level === 3),
    [headings],
  );
  const [activeId, setActiveId] = useState(tocHeadings[0]?.id ?? "");
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const isClickScrolling = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tocHeadings.length) return;

    const updateActiveHeading = () => {
      // 如果是点击导致的滚动，跳过检测
      if (isClickScrolling.current) return;

      const offset = 110; // 与 CSS scroll-margin-top 保持一致
      let currentId = tocHeadings[0]?.id ?? "";

      for (const heading of tocHeadings) {
        const element = document.getElementById(heading.id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - offset <= 0) {
          currentId = heading.id;
        }
      }

      setActiveId(currentId);
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [tocHeadings]);

  useEffect(() => {
    if (!tocHeadings.length) return;

    const markerHeight = 36;
    const current = activeId || tocHeadings[0]?.id;
    if (!current) return;

    const marker = markerRef.current;
    if (!marker) return;

    const el = document.querySelector<HTMLAnchorElement>(
      `a[data-toc-id="${current}"]`,
    );
    if (!el) return;

    const top = el.offsetTop + (el.offsetHeight - markerHeight) / 2;
    marker.style.transform = `translateY(${Math.max(0, top)}px)`;
  }, [activeId, tocHeadings]);

  const handleClick = (id: string) => {
    // 设置点击标志，暂时禁用 scroll 检测
    isClickScrolling.current = true;
    setActiveId(id);

    // 清除之前的定时器
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // 1 秒后恢复 scroll 检测
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrolling.current = false;
    }, 1000);
  };

  if (!tocHeadings.length) {
    return null;
  }

  return (
    <div className="hidden lg:block lg:w-[220px] lg:flex-shrink-0">
      <div className="fixed top-[110px] w-[220px] max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
        <div className="article-toc">
          <span
            aria-hidden="true"
            ref={markerRef}
            className="article-toc-marker"
          />
          <p className="article-toc-title">本文导览</p>
          <ul className="space-y-1">
            {tocHeadings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  data-toc-id={heading.id}
                  className={`article-toc-link ${
                    heading.level === 3 ? "pl-3" : ""
                  } ${activeId === heading.id ? "is-active" : ""}`}
                  onClick={() => handleClick(heading.id)}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

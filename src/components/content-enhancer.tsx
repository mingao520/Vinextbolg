"use client";

import { useEffect } from "react";
import mediumZoom from "medium-zoom";
import { createRoot, type Root } from "react-dom/client";
import { TweetCard } from "./tweet-card";

// 注意：favicon 现在由服务端在构建时处理，见 src/lib/content/posts.ts
// 这里只处理 favicon 加载错误的情况

// 渲染 TweetCard 到占位符
function hydrateTweetCards(roots: Root[]) {
  const placeholders = document.querySelectorAll(".tweet-card-placeholder");

  placeholders.forEach((placeholder) => {
    const tweetId = placeholder.getAttribute("data-tweet-id");
    if (!tweetId) return;

    // 检查是否已经 hydrate
    if (placeholder.hasAttribute("data-hydrated")) return;

    // 创建 React root 并渲染 TweetCard
    const root = createRoot(placeholder);
    roots.push(root);
    root.render(<TweetCard tweetId={tweetId} />);

    placeholder.setAttribute("data-hydrated", "true");
  });
}

export function ContentEnhancer() {
  useEffect(() => {
    const roots: Root[] = [];

    // 图片加载处理：标记已加载的图片，防止布局抖动
    const handleImageLoad = (img: HTMLImageElement) => {
      img.setAttribute("data-loaded", "true");
    };

    // 监听所有文章图片的加载事件
    const articleImages = document.querySelectorAll<HTMLImageElement>(
      ".article-body img:not(.favicon)"
    );

    articleImages.forEach((img) => {
      // 检查图片是否已经完成加载
      if (img.complete) {
        handleImageLoad(img);
      } else {
        img.addEventListener("load", () => handleImageLoad(img), { once: true });
        img.addEventListener("error", () => img.setAttribute("data-loaded", "error"), { once: true });
      }
    });

    // 图片放大功能（在图片加载完成后启用）
    const zoom = mediumZoom(".article-body img:not(.favicon)[data-loaded='true']", {
      background: "var(--vp-c-bg)",
      margin: 24,
    });

    // 处理 favicon 加载错误的情况
    // 服务端构建时已插入 favicon，但可能加载失败
    const links = document.querySelectorAll<HTMLAnchorElement>(
      ".article-body a.has-favicon"
    );

    links.forEach((link) => {
      const img = link.querySelector("img.favicon") as HTMLImageElement | null;
      if (!img) return;

      // 如果图片已经加载完成但失败了
      if (img.complete && img.naturalHeight === 0) {
        link.classList.remove("has-favicon");
        link.classList.add("err-favicon");
        return;
      }

      // 监听错误事件
      img.onerror = () => {
        link.classList.remove("has-favicon");
        link.classList.add("err-favicon");
      };
    });

    // Hydrate TweetCards
    hydrateTweetCards(roots);

    return () => {
      zoom.detach();
      for (const root of roots) {
        root.unmount();
      }
    };
  }, []);

  return null;
}

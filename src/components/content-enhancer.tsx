"use client";

import { useEffect } from "react";
import mediumZoom from "medium-zoom";
import { createRoot, type Root } from "react-dom/client";
import { TweetCard } from "./tweet-card";

interface UmamiTrackPayload {
  article_path: string;
  article_slug: string;
  target_url: string;
  target_domain: string;
  link_text: string;
}

interface UmamiApi {
  track: (eventName: string, eventData?: UmamiTrackPayload) => void;
}

declare global {
  interface Window {
    umami?: UmamiApi;
  }
}

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

function getExternalLink(link: HTMLAnchorElement): URL | null {
  const href = link.getAttribute("href");
  if (!href) return null;

  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.origin === window.location.origin) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function ensureExternalLinkAttrs(link: HTMLAnchorElement, externalUrl: URL) {
  link.setAttribute("target", "_blank");

  const relSet = new Set(
    (link.getAttribute("rel") ?? "")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  relSet.add("noopener");
  relSet.add("noreferrer");
  link.setAttribute("rel", Array.from(relSet).join(" "));
  link.dataset.externalLink = "true";
  link.dataset.externalDomain = externalUrl.hostname.toLowerCase();
}

function getArticleInfo() {
  const articlePath = window.location.pathname || "/";
  const articleSlug = articlePath.replace(/^\/+|\/+$/g, "") || "index";
  return { articlePath, articleSlug };
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

    const allLinks = document.querySelectorAll<HTMLAnchorElement>(
      ".article-body a[href]"
    );

    // 兜底确保外链新窗口打开，避免文章内点击直接跳出当前页
    allLinks.forEach((link) => {
      const externalUrl = getExternalLink(link);
      if (!externalUrl) return;
      ensureExternalLinkAttrs(link, externalUrl);
    });

    const handleOutboundClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const link = target.closest<HTMLAnchorElement>(".article-body a[href]");
      if (!link) return;

      const externalUrl = getExternalLink(link);
      if (!externalUrl) return;

      ensureExternalLinkAttrs(link, externalUrl);

      const { articlePath, articleSlug } = getArticleInfo();
      const linkText = (link.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      window.umami?.track?.("article_outbound_click", {
        article_path: articlePath,
        article_slug: articleSlug,
        target_url: externalUrl.href,
        target_domain: externalUrl.hostname.toLowerCase(),
        link_text: linkText || "(empty)",
      });
    };

    const articleBody = document.querySelector<HTMLElement>(".article-body");
    articleBody?.addEventListener("click", handleOutboundClick, true);

    // Hydrate TweetCards
    hydrateTweetCards(roots);

    return () => {
      zoom.detach();
      articleBody?.removeEventListener("click", handleOutboundClick, true);
      for (const root of roots) {
        root.unmount();
      }
    };
  }, []);

  return null;
}

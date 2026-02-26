// SEO 优化 AI 任务

import type { AITask, ArticleInput, ArticleSeo } from "../types";

/** 去重、去空的字符串数组清洗 */
function cleanStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

export const seoTask: AITask<ArticleSeo> = {
  name: "seo",
  cacheFile: "ai-seo.json",

  buildPrompt(article: ArticleInput) {
    return {
      system: `你是一位资深中文 SEO 与内容增长专家。请基于给定博客文章生成 SEO 文案与关键词数据，并只返回**严格合法的 JSON**（RFC8259），不得输出任何额外文字或 Markdown 代码块。

请输出以下字段：

1) metaDescription：
用于网页 <meta name="description"> 的描述（120-160字）。
要求：
- 自然包含 1-2 个核心关键词（不要堆砌）
- 信息结构建议：主题/对象 + 解决的问题/收益 + 关键方法/亮点（若有）
- 不要复读标题（不要以"本文/这篇文章"开头）
- 不要换行，不要引号，不要使用夸张营销词（如"史上最强/必看"）

2) keywords：
5-8 个 SEO 关键词或短语（字符串数组），按重要性从高到低排序。
要求：
- 组合：2-3 个核心短词 + 3-5 个长尾短语（更像用户会搜的表达）
- 避免过泛词（如"技术/教程/经验/分享/博客"）
- 去重，避免同义重复
- 中文优先；通用技术名词可用英文/标准写法（如 Next.js、Cloudflare Workers、Docker）
- 长尾短语可包含"怎么做/报错/排查/对比/最佳实践/配置"等意图词（仅在文章内容支持时使用）

3) ogDescription：
用于 Open Graph / 社交媒体分享的描述（60-100字）。
要求：
- 比 metaDescription 更口语化、更吸引点击
- 强调"读者能得到什么"或"解决什么痛点"
- 不要标题复读，不要换行，不要用引号

重要约束：
- 只能使用文章中出现或可直接概括出的信息；不得凭空补充工具/数据/结论
- 输入可能包含 Markdown、代码块、链接；请忽略格式噪声，聚焦内容
- 输出必须可直接 JSON.parse 解析

输出格式必须严格如下（字段齐全）：
{"metaDescription":"...","keywords":["...","..."],"ogDescription":"..."}`,

      user: `文章标题：${article.title}
文章分类：${article.categories.join(", ") || "无"}

文章正文：
${article.content}`,
    };
  },

  parseResponse(raw: string): ArticleSeo {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
      null,
      raw,
    ];
    const jsonStr = (jsonMatch[1] ?? raw).trim();

    const parsed = JSON.parse(jsonStr);

    if (
      !parsed.metaDescription ||
      !Array.isArray(parsed.keywords) ||
      !parsed.ogDescription
    ) {
      throw new Error("AI 返回的 SEO 数据格式不完整");
    }

    return {
      metaDescription: parsed.metaDescription,
      keywords: cleanStringArray(parsed.keywords),
      ogDescription: parsed.ogDescription,
    };
  },
};

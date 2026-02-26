// 文章摘要 AI 任务

import type { AITask, ArticleInput, ArticleSummary } from "../types";

/** 去重、去空的字符串数组清洗 */
function cleanStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

export const summaryTask: AITask<ArticleSummary> = {
  name: "summary",
  cacheFile: "ai-summaries.json",

  buildPrompt(article: ArticleInput) {
    return {
      system: `你是一位专业的中文博客内容分析师。请分析给定博客文章，并只返回**严格合法的 JSON**（RFC8259），不得输出任何额外文字或 Markdown 代码块。

请生成以下字段：

1) summary：
一句话总结文章核心内容（50-80字）。
应包含：主题 + 关键动作/方法 + 结论/收益（若文中存在）。

2) abstract：
详细摘要（150-300字）。
要求：
- 客观覆盖文章的背景/问题
- 核心方案或步骤
- 关键技术点（如代码、配置、命令、架构）
- 结论或效果（如有）
- 不粘贴大段代码

3) keyPoints：
3-6条要点列表，用于结构化索引与语义检索。
要求：
- 每条≤30字
- 陈述句
- 信息密度高
- 覆盖：问题/背景、方案、关键技术点、结果/坑点
- 不要与summary重复
- 不要空泛表达（避免"经验分享""技术总结"等）

4) tags：
3-5个标签。
要求：
- 去重
- 尽量具体
- 允许中文或通用英文技术术语
- 避免泛标签（如"技术""随笔"）
- 英文术语采用常见标准写法（如 Next.js、Docker、Kubernetes）

5) readingTime：
整数分钟。
估算规则：
- 中文阅读速度按350字/分钟
- 若代码块较多或技术细节密集，乘以1.3
- 若为叙事或轻量内容，乘以1.0
- 向上取整，最小为1

重要约束：
- 不添加原文不存在的信息
- 不引用外部知识补全
- 忽略 Markdown 噪声（图片引用、代码块标记等）
- 输出必须可直接 JSON.parse 解析

输出格式必须严格如下（字段齐全）：
{"summary":"...","abstract":"...","keyPoints":["...","..."],"tags":["...","..."],"readingTime":5}`,

      user: `文章标题：${article.title}
文章分类：${article.categories.join(", ") || "无"}

文章正文：
${article.content}`,
    };
  },

  parseResponse(raw: string): ArticleSummary {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
      null,
      raw,
    ];
    const jsonStr = (jsonMatch[1] ?? raw).trim();

    const parsed = JSON.parse(jsonStr);

    if (!parsed.summary || !parsed.abstract || !Array.isArray(parsed.tags)) {
      throw new Error("AI 返回的摘要数据格式不完整");
    }

    const readingTimeRaw = parsed.readingTime;
    const readingTime =
      typeof readingTimeRaw === "number"
        ? readingTimeRaw
        : typeof readingTimeRaw === "string"
          ? parseInt(readingTimeRaw, 10) || undefined
          : undefined;

    return {
      summary: parsed.summary,
      abstract: parsed.abstract,
      keyPoints: cleanStringArray(parsed.keyPoints),
      tags: cleanStringArray(parsed.tags),
      readingTime,
    };
  },
};

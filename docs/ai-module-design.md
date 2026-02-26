# AI 模块设计方案 - 需求评审文档

## 1. 需求概述

为博客接入 AI 大模型能力，实现文章内容的智能摘要、SEO 优化等功能。要求模块可扩展，API 参数可配置，处理结果可缓存，支持增量和强制更新。

## 2. 现状分析

| 项目 | 现状 |
|------|------|
| 文章数量 | 339 篇 markdown 文件 |
| 现有摘要 | frontmatter `description` 字段（部分文章有，部分自动截取前 180 字） |
| 现有 SEO | `generateMetadata` 使用 `excerpt` 作为 description，无 keywords |
| 缓存模式 | `data/tweets-cache.json` 单文件缓存（已有先例） |
| 脚本模式 | `scripts/fetch-tweets.mjs` 批量预处理（已有先例） |
| 环境变量 | `.env` + `.env.example` 管理敏感配置 |

## 3. 架构设计

### 3.1 总体架构

```
scripts/ai-process.mjs          ← 离线批处理脚本（构建时/手动运行）
  ├── src/lib/ai/client.ts       ← OpenAI 兼容 API 客户端
  ├── src/lib/ai/config.ts       ← AI 配置管理
  ├── src/lib/ai/prompts.ts      ← Prompt 模板
  ├── src/lib/ai/types.ts        ← 类型定义
  └── src/lib/ai/tasks/          ← 可扩展任务目录
      ├── summary.ts             ← 文章摘要任务
      └── seo.ts                 ← SEO 优化任务

data/
  ├── ai-summaries.json          ← 摘要缓存
  └── ai-seo.json                ← SEO 缓存

src/lib/content/ai-data.ts      ← 运行时读取缓存数据
```

### 3.2 核心设计决策

**为什么是离线脚本而非运行时调用 AI？**

1. 博客部署在 Cloudflare Workers Edge，运行时调用 AI API 会增加请求延迟（1-5秒）
2. 339 篇文章的 AI 处理成本不低，应避免重复调用
3. 与现有模式一致 —— `fetch-tweets.mjs` 也是离线预处理 + JSON 缓存
4. 缓存数据可以 Git 提交，确保部署时数据就绪，无需在 Edge 环境访问 AI API

**为什么是单 JSON 文件而非每篇文章一个文件？**

1. 与 `tweets-cache.json` 模式一致
2. 在 Vite 构建时可通过 `import` 一次性加载
3. 339 篇文章的缓存数据量不大（预估 < 500KB）
4. 方便查看和管理

## 4. 详细设计

### 4.1 配置参数（.env）

```bash
# AI API 配置（OpenAI 兼容）
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_API_KEY=your_ai_api_key_here
AI_MODEL=doubao-seed-2-0-pro-260215
```

说明：
- `AI_BASE_URL` — 任何 OpenAI 兼容 API 的 Base URL（豆包、OpenAI、DeepSeek、Moonshot 等均可）
- `AI_API_KEY` — API 密钥
- `AI_MODEL` — 模型名称

### 4.2 API 客户端（src/lib/ai/client.ts）

使用标准 OpenAI Chat Completions 格式调用，不引入 SDK 依赖：

```typescript
// POST {BASE_URL}/chat/completions
{
  model: "doubao-seed-2-0-pro-260215",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ],
  temperature: 1,      
  response_format: { type: "json_object" }  // 强制 JSON 输出
}
```

> 注意：你提供的示例使用了 `/responses` 端点，这是豆包的特有 API。为了兼容性，我们统一使用 OpenAI 标准的 `/chat/completions` 端点，豆包也支持该端点。

### 4.3 缓存数据结构

**data/ai-summaries.json**

```jsonc
{
  "meta": {
    "lastUpdated": "2026-02-26T10:00:00Z",
    "model": "doubao-seed-2-0-pro-260215",
    "totalProcessed": 280
  },
  "articles": {
    "raycast-sink": {
      "summary": "一句话摘要（50-80字）",
      "abstract": "详细摘要（150-300字，用于文章页展示）",
      "tags": ["Raycast", "短链", "插件开发"],
      "contentHash": "a1b2c3d4",      // 文章内容 MD5 前8位
      "processedAt": "2026-02-26T10:00:00Z"
    }
  }
}
```

**data/ai-seo.json**

```jsonc
{
  "meta": {
    "lastUpdated": "2026-02-26T10:00:00Z",
    "model": "doubao-seed-2-0-pro-260215",
    "totalProcessed": 280
  },
  "articles": {
    "raycast-sink": {
      "metaDescription": "SEO 优化的 meta description（120-160字）",
      "keywords": ["Raycast插件", "短链管理", "Sink", "开发工具"],
      "ogDescription": "OpenGraph 描述（偏社交分享风格，60-100字）",
      "contentHash": "a1b2c3d4",
      "processedAt": "2026-02-26T10:00:00Z"
    }
  }
}
```

**contentHash 的作用：**
- 每次运行脚本时，计算文章 markdown 内容的 hash
- 如果 hash 与缓存中一致，跳过该文章（内容未变）
- 如果 hash 不同，说明文章有更新，重新调用 AI 处理
- 如果使用 `--force`，忽略 hash 强制重新处理

### 4.4 Prompt 设计

**摘要 Prompt（summary task）**

```
你是一位专业的中文博客内容分析师。请分析以下博客文章，返回 JSON 格式的分析结果。

要求：
1. summary：一句话总结文章核心内容（50-80字），要精炼准确
2. abstract：详细摘要（150-300字），覆盖文章的主要观点和关键信息
3. tags：3-5个内容标签，反映文章的核心主题（使用中文或通用英文技术术语）

注意：
- 文章语言为中文，请用中文输出
- 摘要应客观准确，不要添加原文没有的信息
- 如果文章包含代码/技术内容，摘要中应体现技术要点

严格按以下 JSON 格式输出，不要添加任何其他内容：
{"summary":"...","abstract":"...","tags":["...","..."]}
```

**SEO Prompt（seo task）**

```
你是一位资深的 SEO 优化专家。请分析以下博客文章，生成 SEO 优化数据。

文章标题：{title}
文章分类：{categories}

要求：
1. metaDescription：适合搜索引擎的 meta description（120-160字），包含核心关键词，有吸引力
2. keywords：5-8个 SEO 关键词/短语，兼顾搜索量和相关性
3. ogDescription：适合社交媒体分享的描述（60-100字），有吸引力，让人想点击

SEO 最佳实践：
- meta description 应自然包含 1-2 个核心关键词
- keywords 应包含长尾关键词和短关键词的组合
- 中文内容优先使用中文关键词，技术术语可保留英文
- ogDescription 应比 metaDescription 更口语化和有吸引力

严格按以下 JSON 格式输出，不要添加任何其他内容：
{"metaDescription":"...","keywords":["...","..."],"ogDescription":"..."}
```

### 4.5 批处理脚本（scripts/ai-process.mjs）

**用法：**

```bash
# 处理所有文章（跳过已缓存且内容未变的文章）
pnpm ai:process

# 强制重新处理所有文章
pnpm ai:process --force

# 只处理指定文章
pnpm ai:process --slug=raycast-sink

# 只运行特定任务
pnpm ai:process --task=summary
pnpm ai:process --task=seo

# 处理最近 N 篇文章（按日期排序）
pnpm ai:process --recent=10

# 只处理没有缓存的文章（不检查 hash 变化）
pnpm ai:process --new-only

# Dry run（不实际调用 AI，只显示会处理哪些文章）
pnpm ai:process --dry-run
```

**处理流程：**

```
1. 读取所有 markdown 文件
2. 读取现有缓存文件 (data/ai-summaries.json, data/ai-seo.json)
3. 对每篇文章：
   a. 计算内容 hash
   b. 检查缓存是否存在 且 hash 是否一致
   c. 如果缓存有效 → 跳过
   d. 如果缓存无效或 --force → 加入处理队列
4. 对队列中的文章逐篇调用 AI（带并发控制，默认 3 并发）
5. 每处理完一篇立即写入缓存文件（防止中途失败丢失进度）
6. 输出处理报告
```

**并发与限速：**
- 默认并发数 3（可通过 `--concurrency=N` 调整）
- 每个请求之间间隔 500ms（避免触发 API 限速）
- 单个请求超时 30 秒
- 失败自动重试 1 次
- 累计失败超过 5 次暂停并提示

**输出示例：**

```
🤖 AI 文章处理器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 扫描结果:
   总文章数: 339
   已缓存(有效): 280
   需要处理: 59
   - 新文章: 12
   - 内容变更: 47

🔄 处理中... [=====>          ] 12/59

✅ 处理完成:
   成功: 57
   失败: 2
   耗时: 3m 24s

⚠️  失败文章:
   - some-old-article (API 超时)
   - another-article (JSON 解析失败)
```

### 4.6 运行时数据消费（src/lib/content/ai-data.ts）

```typescript
// 构建时加载 AI 缓存数据（与 markdownFiles 加载方式一致）
import aiSummaries from '../../../data/ai-summaries.json';
import aiSeo from '../../../data/ai-seo.json';

export function getAISummary(slug: string) { ... }
export function getAISeo(slug: string) { ... }
```

**集成到文章页面的方式：**

1. **SEO metadata** — 在 `generateMetadata` 中优先使用 AI 生成的 `metaDescription` 和 `keywords`
2. **文章页展示** — 在文章头部区域展示 AI `abstract`（可选，作为 TL;DR 区块）
3. **文章列表** — AI `summary` 可替代自动截取的 excerpt（更精准）
4. **JSON-LD** — 使用 AI 的 `metaDescription` 增强 Schema.org 数据

### 4.7 可扩展性设计

每个 AI 任务是一个独立模块，遵循统一接口：

```typescript
interface AITask<T> {
  name: string;                              // 任务名称
  cacheFile: string;                         // 缓存文件名
  buildPrompt(article: ArticleInput): {      // 构建 prompt
    system: string;
    user: string;
  };
  parseResponse(raw: string): T;             // 解析 AI 响应
}
```

**后续可扩展的任务示例：**

| 任务 | 说明 | 缓存文件 |
|------|------|----------|
| `summary` | 文章摘要 | `ai-summaries.json` |
| `seo` | SEO 优化 | `ai-seo.json` |
| `translate` | 文章标题/摘要翻译（英文） | `ai-translations.json` |
| `related` | 推荐相关文章 | `ai-related.json` |
| `sentiment` | 文章情感/风格分析 | `ai-sentiment.json` |

新增任务只需在 `src/lib/ai/tasks/` 目录下添加新文件，实现 `AITask` 接口即可。

## 5. 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/ai/client.ts` | OpenAI 兼容 API 客户端 |
| `src/lib/ai/config.ts` | AI 配置（读取环境变量） |
| `src/lib/ai/types.ts` | 类型定义 |
| `src/lib/ai/prompts.ts` | Prompt 模板 |
| `src/lib/ai/tasks/summary.ts` | 摘要任务 |
| `src/lib/ai/tasks/seo.ts` | SEO 任务 |
| `src/lib/content/ai-data.ts` | 运行时读取 AI 缓存 |
| `scripts/ai-process.mjs` | 批处理脚本 |
| `data/ai-summaries.json` | 摘要缓存数据 |
| `data/ai-seo.json` | SEO 缓存数据 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `.env.example` | 添加 `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` |
| `package.json` | 添加 `ai:process` script |
| `src/app/[slug]/page.tsx` | `generateMetadata` 集成 AI SEO 数据 |
| `src/lib/content/types.ts` | 添加 AI 数据类型 |
| `.gitignore` | 确认 `.env` 已忽略（已有），缓存 json 文件**不忽略**（需要提交） |

## 6. 操作手册

### 6.1 首次配置

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 AI API 相关配置

# 2. 处理所有文章
pnpm ai:process

# 3. 检查生成的缓存数据
cat data/ai-summaries.json | jq '.meta'
cat data/ai-seo.json | jq '.meta'
```

### 6.2 日常使用

```bash
# 写了新文章后，只处理新增的
pnpm ai:process --new-only

# 修改了某篇文章，重新处理
pnpm ai:process --slug=article-name

# 批量更新（会自动检测内容变化）
pnpm ai:process
```

### 6.3 强制更新

```bash
# 强制重新处理所有文章（如更换了模型或调整了 prompt）
pnpm ai:process --force

# 强制重新处理某篇文章
pnpm ai:process --slug=article-name --force

# 强制只更新 SEO 数据
pnpm ai:process --task=seo --force
```

### 6.4 切换 AI 模型

只需修改 `.env` 中的配置即可：

```bash
# 切换到 DeepSeek
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=deepseek-chat

# 切换到 OpenAI
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o

# 切换到 Moonshot
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=sk-xxx
AI_MODEL=moonshot-v1-8k
```

切换模型后，建议 `--force` 重新处理以保证结果质量一致。

## 7. 成本预估

以豆包 doubao-seed-2-0-pro 为例：

| 项目 | 估算 |
|------|------|
| 平均文章长度 | ~120 行 markdown ≈ 2000 字 ≈ 3000 token |
| 每篇处理 2 个任务 | ~6000 input token + ~500 output token |
| 339 篇全量处理 | ~220 万 input token + ~17 万 output token |
| 预估费用 | 豆包价格极低，全量处理约 ¥1-3 |
| 增量处理 | 通常只需处理几篇，几乎无成本 |

## 8. 待确认事项

1. **AI 摘要在前端的展示方式** — 是否需要在文章页面显示 AI 摘要（如 TL;DR 区块）？还是仅用于 SEO 和列表页 excerpt？
2. **缓存文件是否提交到 Git** — 建议提交（确保部署一致性），但文件可能有几百 KB，是否接受？
3. **是否需要在文章页面展示 AI 生成的 tags** — 当前 frontmatter 有 `categories`，AI 的 `tags` 更细粒度，是否需要展示？
4. **API 端点确认** — 你提供的示例使用了 `/api/v3/responses`（豆包特有），需确认该 API 也支持标准的 `/api/v3/chat/completions` 端点
5. **执行优先级** — 先实现哪个任务？建议先做 summary（即时可见效果），再做 seo

## 9. 实施计划

| 阶段 | 内容 | 预估工作量 |
|------|------|-----------|
| Phase 1 | AI 模块基础框架（client, config, types, task 接口） | 核心代码 |
| Phase 2 | Summary 任务 + 批处理脚本 | 脚本 + prompt 调试 |
| Phase 3 | SEO 任务 | 复用框架，新增 prompt |
| Phase 4 | 前端集成（metadata, 文章页, 列表页） | 页面修改 |
| Phase 5 | 文档 + .env.example 更新 | 收尾 |

/**
 * 多模型 AI 画像报告生成
 *
 * 读取 data/author-context.json，用指定 AI 模型生成画像报告，
 * 输出到 data/reports/{model-id}.json 并更新 manifest.json。
 *
 * 用法:
 *   node scripts/generate-profile-report.mjs                  # 用默认 AI 模型生成
 *   node scripts/generate-profile-report.mjs --model=gpt-4o   # 指定模型 ID
 *   node scripts/generate-profile-report.mjs --all            # 遍历所有注册模型
 *   node scripts/generate-profile-report.mjs --no-ai          # 规则模板兜底
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./utils/load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTEXT_FILE = path.join(DATA_DIR, "author-context.json");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const MANIFEST_FILE = path.join(REPORTS_DIR, "manifest.json");
const MODELS_CONFIG_FILE = path.join(ROOT_DIR, ".profile-models.json");
const MODELS_EXAMPLE_FILE = path.join(ROOT_DIR, ".profile-models.example.json");

// ─── 模型配置加载 ────────────────────────────────────────────

async function loadModelConfig() {
  try {
    const raw = await fs.readFile(MODELS_CONFIG_FILE, "utf-8");
    const config = JSON.parse(raw);
    if (!Array.isArray(config?.models)) {
      throw new Error(".profile-models.json 中缺少 models 数组");
    }
    // 只返回 enabled 的模型
    return config.models.filter((m) => m.enabled !== false);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `❌ 未找到 .profile-models.json\n` +
          `   请复制 .profile-models.example.json 为 .profile-models.json 并填入真实 API Key：\n` +
          `   cp .profile-models.example.json .profile-models.json`,
      );
    } else {
      console.error(`❌ 读取 .profile-models.json 失败: ${err.message}`);
    }
    process.exit(1);
  }
}

// ─── CLI 参数 ────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let modelId = null;
  for (const arg of args) {
    if (arg.startsWith("--model=")) {
      modelId = arg.slice("--model=".length).trim();
    }
  }
  return {
    modelId,
    all: args.includes("--all"),
    noAI: args.includes("--no-ai"),
    force: args.includes("--force"),
  };
}

// ─── 工具函数 ────────────────────────────────────────────────

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function truncate(text, max = 120) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[#>*_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── AI API 调用 ─────────────────────────────────────────────

async function callAI({ baseUrl, apiKey, model, messages, temperature = 0.4, stream = false }) {
  const body = {
    model,
    messages,
    max_tokens: 8192,
    stream,
  };
  // 只在 temperature 不为 null 时设置（某些模型如 Kimi K2.5 不接受自定义 temperature）
  if (temperature !== null) {
    body.temperature = temperature;
  }

  const url = `${baseUrl}/chat/completions`;
  console.log(`      → POST ${url.replace(/\/v\d.*/, "/...")} (model=${model}, stream=${stream})`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 分钟超时
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API 失败: ${response.status} ${text.slice(0, 500)}`);
  }

  if (stream) {
    // SSE 流式读取
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) result += delta;
        } catch {
          // 忽略无法解析的行
        }
      }
    }

    if (!result) throw new Error("AI 流式响应为空");
    return result;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回空内容");
  }
  return content;
}

function parseJsonText(text) {
  // 尝试从 markdown 代码块提取
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (match?.[1] ?? text).trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    // 二次尝试：去除可能的 BOM 或前导空白
    const cleaned = raw.replace(/^\uFEFF/, "").replace(/^[^{]*/, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      console.error("      ⚠️  JSON 解析失败，原始内容前 500 字符:");
      console.error("      ", raw.slice(0, 500));
      throw new Error(`JSON 解析失败: ${e.message}`);
    }
  }
}

// ─── AI 报告生成 ──────────────────────────────────────────────

function buildSystemPrompt() {
  return `你是一位中文科技写作编辑。请基于给定上下文，以第三方视角生成作者画像 JSON。
要求：
1. 严格只输出一个 JSON 对象，不要包含 markdown 代码块标记、注释或多余文本。
2. 语气客观、克制、具体，不要夸张和空泛。
3. 必须遵守给定 schema，字段齐全。
4. 结论必须可由上下文支撑，避免编造。
5. 文案使用中文，第三人称，不使用"我"。
6. proofs 中的 posts/tweets/projects 必须引用上下文中真实存在的内容，URL 必须来自上下文。
7. hero.summary 应该能在一句话内概括此人最核心的特质。
8. identities 至少 3 个，每个需包含 evidence 字段证据。
9. strengths 至少 2 组，每组至少3个 points。
10. styles 至少 3 个行为特征。
11. proofs.posts 至少 5 篇，proofs.tweets 至少 3 条，proofs.projects 至少 3 个。
12. 基于所有数据进行深度分析，给出有洞察力的画像，不要只停留在表面描述。

输出 schema:
{
  "report": {
    "hero": {"title":"AI 视角下的罗磊","summary":"一句话概括","intro":"2-3句详细介绍"},
    "identities":[{"name":"身份标签","description":"描述","evidence":"具体证据","link":"相关URL"}],
    "strengths":[{"title":"类别名","points":["具体能力1","具体能力2"]}],
    "styles":[{"trait":"特质名","description":"描述"}],
    "proofs":{
      "posts":[{"title":"文章标题","url":"文章URL","reason":"选择理由","date":"YYYY-MM-DD"}],
      "tweets":[{"title":"推文标题","url":"推文URL","reason":"选择理由","date":"ISO日期"}],
      "projects":[{"title":"项目名","url":"项目URL","reason":"选择理由"}]
    },
    "disclaimer":"AI 生成声明"
  }
}`;
}

/**
 * 构建结构化文本 prompt（比直接 JSON.stringify 更高效、更易理解）
 */
function buildUserPrompt(context) {
  const sections = [];

  // 个人简介
  const p = context.profile ?? {};
  sections.push(`## 个人简介
姓名: ${p.name ?? "罗磊"} (${p.nameEn ?? "Luo Lei"})
头衔: ${p.headline ?? ""}
简介: ${p.bio ?? ""}
位置: ${p.location ?? ""}`);

  // 职业经历
  if (context.experience?.length) {
    const expLines = context.experience
      .map((e) => `- ${e.period ?? ""} | ${e.title} @ ${e.company}\n  ${e.description}`)
      .join("\n");
    sections.push(`## 职业经历\n${expLines}`);
  }

  // 技能
  if (context.skills && Object.keys(context.skills).length) {
    const skillLines = Object.entries(context.skills)
      .map(([cat, items]) => `- ${cat}: ${Array.isArray(items) ? items.join(", ") : items}`)
      .join("\n");
    sections.push(`## 技术技能\n${skillLines}`);
  }

  // 教育
  if (context.education) {
    sections.push(`## 教育背景\n${context.education.degree} - ${context.education.school}\n${context.education.note ?? ""}`);
  }

  // 关键成就
  if (context.highlights?.length) {
    sections.push(`## 关键成就与亮点\n${context.highlights.map((h) => `- ${h}`).join("\n")}`);
  }

  // 副业项目
  if (context.sideProjects?.length) {
    sections.push(`## 副业项目\n${context.sideProjects.map((s) => `- ${s}`).join("\n")}`);
  }

  // 公共活动
  if (context.publicActivities?.length) {
    sections.push(`## 公共活动\n${context.publicActivities.map((a) => `- ${a}`).join("\n")}`);
  }

  // GitHub 项目
  if (context.projects?.length) {
    const projLines = context.projects
      .map((proj) => `- ${proj.name}: ${proj.description} (${proj.url}) [${(proj.tags ?? []).join(", ")}]`)
      .join("\n");
    sections.push(`## GitHub 开源项目\n${projLines}`);
  }

  // 博客文章（每篇只要标题+摘要+关键词，非常紧凑）
  if (context.posts?.length) {
    const postLines = context.posts
      .map((post) => {
        const kp = post.keyPoints?.length ? ` [${post.keyPoints.join("; ")}]` : "";
        return `- ${post.date?.slice(0, 10)} | ${post.title}: ${post.summary ?? ""}${kp} (${post.url})`;
      })
      .join("\n");
    sections.push(`## 博客文章（共 ${context.posts.length} 篇，按时间倒序）\n${postLines}`);
  }

  // 推文
  if (context.tweets?.length) {
    const tweetLines = context.tweets
      .map((t) => {
        const m = t.metrics ?? {};
        const stats = `❤️${m.like_count ?? 0} 🔁${m.retweet_count ?? 0} 💬${m.reply_count ?? 0}`;
        return `- ${t.date?.slice(0, 10)} | ${t.text?.slice(0, 120)} ${stats} (${t.url})`;
      })
      .join("\n");
    sections.push(`## X (Twitter) 推文（共 ${context.tweets.length} 条，按互动量排序）\n${tweetLines}`);
  }

  return `请根据以下作者的全面数据，生成深度人物画像报告。\n\n${sections.join("\n\n")}`;
}

async function generateReportWithAI(context, modelEntry) {
  const baseUrl = modelEntry.baseUrl;
  const apiKey = modelEntry.apiKey;
  const model = modelEntry.id;

  if (!baseUrl || !apiKey) {
    throw new Error(
      `模型 ${modelEntry.name} 缺少 baseUrl 或 apiKey，请检查 .profile-models.json`,
    );
  }

  const userPrompt = buildUserPrompt(context);
  console.log(`      → prompt 长度: ${userPrompt.length} 字符`);

  const content = await callAI({
    baseUrl,
    apiKey,
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
    temperature: "temperature" in modelEntry ? modelEntry.temperature : 0.4,
    stream: modelEntry.stream === true,
  });

  console.log(`      → AI 响应长度: ${content.length} 字符`);

  const parsed = parseJsonText(content);
  const report = parsed?.report;
  if (!report) {
    console.error("      ⚠️  AI 返回的 JSON 结构:");
    console.error("      ", JSON.stringify(parsed).slice(0, 300));
    throw new Error("AI 返回缺少 report 字段");
  }

  return {
    meta: {
      lastUpdated: new Date().toISOString(),
      model: modelEntry.id,
      modelName: modelEntry.name,
      provider: modelEntry.provider,
      generatedBy: "ai",
      sources: ["posts", "tweets", "github"],
    },
    report,
  };
}

// ─── 规则兜底报告 ────────────────────────────────────────────

function toProofReasonFromTweet(text) {
  const cleaned = stripMarkdown(text).replace(/^https?:\/\/\S+\s*/g, "");
  return truncate(
    cleaned || "该动态反映了作者近期关注的议题与表达风格。",
    72,
  );
}

function buildRuleBasedReport(context) {
  const posts = (context.posts ?? []).slice(0, 5).map((post) => ({
    title: post.title,
    url: post.url,
    reason: post.summary || "该文章可体现作者近期关注方向。",
    date: post.date,
  }));

  const tweets = (context.tweets ?? []).slice(0, 3).map((tweet) => ({
    title: `X 动态 · ${tweet.date ? tweet.date.slice(0, 10) : "未知日期"}`,
    url: tweet.url,
    reason: toProofReasonFromTweet(tweet.text),
    date: tweet.date,
  }));

  const projects = (context.projects ?? []).slice(0, 4).map((project) => ({
    title: project.name,
    url: project.url,
    reason: project.description || "该项目体现了作者的工程实践方向。",
  }));

  const majorProjectNames = projects
    .map((item) => item.title)
    .slice(0, 2)
    .join("、");
  const highLevelTopic = context.highlights?.[0]
    ? truncate(context.highlights[0], 56)
    : "持续输出技术、产品与生活方式内容";

  return {
    meta: {
      lastUpdated: new Date().toISOString(),
      model: "rule-based",
      modelName: "规则模板",
      provider: "Local",
      generatedBy: "rule-based",
      sources: ["posts", "tweets", "github"],
    },
    report: {
      hero: {
        title: "AI 视角下的罗磊",
        summary:
          "如果把他放在技术内容创作者光谱中，罗磊更接近把工程能力、产品审美和生活方式长期结合的全栈实践者。",
        intro: `从近期内容看，他的核心重心是：${highLevelTopic}。`,
      },
      identities: [
        {
          name: "全栈开发者",
          description: "长期围绕 Web、工具链和云边部署做完整链路实践。",
          evidence: majorProjectNames
            ? `代表项目包括 ${majorProjectNames}。`
            : "持续发布编程与工具类文章和项目。",
          link: "https://github.com/foru17",
        },
        {
          name: "内容创作者",
          description: "在博客与社交平台稳定输出高频、可执行的经验内容。",
          evidence: posts[0]
            ? `近期文章《${posts[0].title}》体现了强执行与复盘风格。`
            : "博客长期保持内容更新。",
          link: "https://luolei.org",
        },
        {
          name: "数字生活方式实践者",
          description: "强调效率工具、审美细节和可持续工作流的结合。",
          evidence: context.tweets?.length
            ? "从 X 动态可见其对工具、工作方式与生活质量的持续讨论。"
            : "在历史内容中反复呈现技术与生活融合主题。",
        },
      ],
      strengths: [
        {
          title: "技术与工程",
          points: [
            "偏向端到端交付，覆盖前端、后端与部署链路。",
            "重视工程可维护性，倾向脚本化与可复用方案。",
            "对 AI 工具落地有持续实践。",
          ],
        },
        {
          title: "产品与审美",
          points: [
            "关注工具体验与视觉细节，不止于「功能可用」。",
            "内容表达注重结构化、可复现与读者理解成本。",
          ],
        },
      ],
      styles: [
        {
          trait: "行动导向",
          description: "习惯快速验证想法，先做可用版本，再逐步迭代。",
        },
        {
          trait: "真诚公开",
          description: "愿意公开讨论决策、困惑与经验，形成可信内容风格。",
        },
        {
          trait: "长期主义",
          description: "在技术输出与个人生活方式建设上保持长期投入。",
        },
      ],
      proofs: { posts, tweets, projects },
      disclaimer:
        "该页面由规则模板生成，旨在帮助访客快速建立认知，可能存在概括偏差，请以原始文章、动态与项目信息为准。",
    },
  };
}

// ─── Manifest 管理 ───────────────────────────────────────────

async function updateManifest(modelEntry, reportMeta) {
  const manifest = await readJson(MANIFEST_FILE, {
    defaultModel: null,
    models: [],
  });

  const existing = manifest.models.findIndex((m) => m.id === modelEntry.id);
  const entry = {
    id: modelEntry.id,
    name: modelEntry.name,
    provider: modelEntry.provider,
    icon: modelEntry.icon,
    generatedAt: reportMeta.lastUpdated,
    generatedBy: reportMeta.generatedBy,
  };

  if (existing >= 0) {
    manifest.models[existing] = entry;
  } else {
    manifest.models.push(entry);
  }

  if (!manifest.defaultModel) {
    manifest.defaultModel = modelEntry.id;
  }

  await writeJson(MANIFEST_FILE, manifest);
  return manifest;
}

// ─── 主流程 ──────────────────────────────────────────────────

async function generateForModel(context, modelEntry, { noAI = false, force = false } = {}) {
  const reportFile = path.join(REPORTS_DIR, `${modelEntry.id}.json`);

  // 检查是否已有 AI 生成的报告，无 --force 则跳过
  if (!force && !noAI) {
    const existing = await readJson(reportFile, null);
    if (existing?.meta?.generatedBy === "ai") {
      console.log(`   ⏭️  ${modelEntry.name} 已有 AI 报告 (${existing.meta.lastUpdated?.slice(0, 10)})，跳过。使用 --force 强制重新生成`);
      return existing;
    }
  }

  let report;
  if (noAI) {
    report = buildRuleBasedReport(context);
    report.meta.model = modelEntry.id;
    report.meta.modelName = modelEntry.name;
    report.meta.provider = modelEntry.provider;
    console.log(`   ℹ️  使用规则模板生成（${modelEntry.name}）`);
  } else {
    try {
      console.log(`   🤖 调用 ${modelEntry.name} (${modelEntry.id})...`);
      report = await generateReportWithAI(context, modelEntry);
      console.log(`   ✅ ${modelEntry.name} 报告生成成功`);
    } catch (error) {
      console.warn(
        `   ⚠️  ${modelEntry.name} AI 生成失败，回退规则模板: ${error.message}`,
      );
      report = buildRuleBasedReport(context);
      report.meta.model = modelEntry.id;
      report.meta.modelName = modelEntry.name;
      report.meta.provider = modelEntry.provider;
    }
  }

  await writeJson(reportFile, report);
  await updateManifest(modelEntry, report.meta);
  console.log(`   📄 已写入: ${reportFile}`);
  return report;
}

async function main() {
  const args = parseArgs();
  await loadEnv();

  // 读取模型配置
  const modelRegistry = await loadModelConfig();

  // 读取上下文数据
  const context = await readJson(CONTEXT_FILE, null);
  if (!context) {
    console.error(
      "❌ 未找到 data/author-context.json，请先运行: node scripts/build-author-context.mjs",
    );
    process.exit(1);
  }

  await fs.mkdir(REPORTS_DIR, { recursive: true });

  if (args.all) {
    // 为所有启用的模型并行生成报告
    console.log(`\n🚀 为所有 ${modelRegistry.length} 个模型并行生成报告...${args.force ? " (--force 强制重新生成)" : ""}\n`);
    const results = await Promise.allSettled(
      modelRegistry.map((entry) =>
        generateForModel(context, entry, { noAI: args.noAI, force: args.force })
      ),
    );
    // 汇总结果
    const summary = results.map((r, i) => {
      const name = modelRegistry[i].name;
      if (r.status === "fulfilled") {
        const by = r.value?.meta?.generatedBy ?? "unknown";
        return `   ${by === "ai" ? "✅" : "📋"} ${name}: ${by}`;
      }
      return `   ❌ ${name}: ${r.reason?.message ?? "未知错误"}`;
    });
    console.log("\n📊 生成结果汇总:");
    summary.forEach((s) => console.log(s));
  } else if (args.modelId) {
    // 指定模型
    const entry = modelRegistry.find((m) => m.id === args.modelId);
    if (!entry) {
      console.error(
        `❌ 未知模型: ${args.modelId}\n可用模型: ${modelRegistry.map((m) => m.id).join(", ")}`,
      );
      process.exit(1);
    }
    console.log(`\n🚀 为 ${entry.name} 生成报告...\n`);
    await generateForModel(context, entry, { noAI: args.noAI, force: true }); // 指定模型时默认 force
  } else {
    // 默认：使用第一个注册模型
    const entry = modelRegistry[0];
    console.log(`\n🚀 为默认模型 ${entry.name} 生成报告...\n`);
    await generateForModel(context, entry, { noAI: args.noAI, force: args.force });
  }

  console.log("\n✅ 报告生成完成");
}

main().catch((error) => {
  console.error("❌ 生成失败:", error.message);
  process.exit(1);
});

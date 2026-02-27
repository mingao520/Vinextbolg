#!/usr/bin/env node

/**
 * GA4 → Umami 数据迁移脚本
 *
 * 从 GA4 统计 API 获取历史浏览量，通过 Umami 的 /api/send 接口写入
 *
 * 用法:
 *   node scripts/migrate-ga-to-umami.mjs                    预览模式（不写入）
 *   node scripts/migrate-ga-to-umami.mjs --run              实际执行迁移
 *   node scripts/migrate-ga-to-umami.mjs --run --scale=0.1  按 10% 比例缩放
 *   node scripts/migrate-ga-to-umami.mjs --run --max=500    每篇文章最多 500 次
 *   node scripts/migrate-ga-to-umami.mjs --run --concurrency=30  并发数（默认 20）
 *   node scripts/migrate-ga-to-umami.mjs --run --top=50     只迁移 top 50 文章
 *   node scripts/migrate-ga-to-umami.mjs --run --slug=pc-2025  只迁移指定文章
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT_DIR, "content/posts");

// ─── 配置 ───────────────────────────────────────────────────

const UMAMI_HOST = "https://u.is26.com";
const UMAMI_WEBSITE_ID = "185ef031-29b2-49e3-bc50-1c9f80b4e831";
const GA_API_URL = "https://st.luolei.org/ga";
const SITE_HOSTNAME = "luolei.org";

// 进度保存文件（断点续传用）
const PROGRESS_FILE = path.join(ROOT_DIR, "data", "umami-migration-progress.json");

// ─── CLI 参数 ────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    run: false,
    scale: 1,
    max: Infinity,
    concurrency: 20,
    top: Infinity,
    slug: null,
    resume: false,
  };

  for (const arg of args) {
    if (arg === "--run") opts.run = true;
    else if (arg === "--resume") opts.resume = true;
    else if (arg.startsWith("--scale=")) opts.scale = parseFloat(arg.split("=")[1]);
    else if (arg.startsWith("--max=")) opts.max = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--concurrency=")) opts.concurrency = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--top=")) opts.top = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--slug=")) opts.slug = arg.split("=")[1];
  }

  return opts;
}

// ─── 获取所有文章 slug ──────────────────────────────────────

async function getArticleSlugs() {
  const files = await fs.readdir(CONTENT_DIR);
  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

// ─── 从路径提取 slug ────────────────────────────────────────

function extractSlug(pagePath) {
  return pagePath
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/\/amp$/, "")
    .split("/")[0];
}

// ─── 获取 GA4 数据 ──────────────────────────────────────────

async function fetchGAData() {
  console.log(`\n📊 正在从 GA4 获取数据: ${GA_API_URL}`);
  const res = await fetch(GA_API_URL, { signal: AbortSignal.timeout(30000) });

  if (!res.ok) {
    throw new Error(`GA API 请求失败: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  console.log(`   获取到 ${json.data?.length || 0} 条路径数据，总浏览量: ${json.total?.toLocaleString() || "N/A"}`);
  return json;
}

// ─── 聚合 GA4 数据到 slug ───────────────────────────────────

function aggregateBySlug(gaData, articleSlugs) {
  const slugSet = new Set(articleSlugs);
  const slugHits = new Map();

  for (const item of gaData) {
    const slug = extractSlug(item.page);
    if (!slug || !slugSet.has(slug)) continue;

    const existing = slugHits.get(slug) || 0;
    slugHits.set(slug, existing + item.hit);
  }

  // 按浏览量降序排列
  return [...slugHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, hits]) => ({ slug, hits }));
}

// ─── 生成分散的历史日期 ─────────────────────────────────────

function generateDates(count) {
  const dates = [];
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const start = now - oneYear;

  for (let i = 0; i < count; i++) {
    // 在过去一年内均匀分布，加一些随机偏移
    const t = start + (oneYear * i) / count + Math.random() * (oneYear / count);
    dates.push(new Date(t));
  }

  return dates;
}

// ─── 发送单条 pageview 到 Umami ─────────────────────────────

async function sendPageview(urlPath, title) {
  const payload = {
    type: "event",
    payload: {
      website: UMAMI_WEBSITE_ID,
      url: urlPath,
      hostname: SITE_HOSTNAME,
      language: "zh-CN",
      screen: "1920x1080",
      title: title || "",
      referrer: "",
    },
  };

  const res = await fetch(`${UMAMI_HOST}/api/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Umami API 错误: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── 并发控制 ────────────────────────────────────────────────

async function runConcurrent(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = { error: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ─── 保存/加载进度 ──────────────────────────────────────────

async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { completed: {} };
  }
}

async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── 主流程 ─────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log("═══════════════════════════════════════════════");
  console.log("  GA4 → Umami 数据迁移工具");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Umami:     ${UMAMI_HOST}`);
  console.log(`  Website:   ${UMAMI_WEBSITE_ID}`);
  console.log(`  模式:      ${opts.run ? "🚀 执行模式" : "👀 预览模式（加 --run 执行）"}`);
  if (opts.scale !== 1) console.log(`  缩放比例:  ${opts.scale}`);
  if (opts.max !== Infinity) console.log(`  单篇上限:  ${opts.max}`);
  if (opts.top !== Infinity) console.log(`  只迁移:    Top ${opts.top}`);
  if (opts.slug) console.log(`  指定文章:  ${opts.slug}`);
  console.log(`  并发数:    ${opts.concurrency}`);

  // 1. 获取文章列表
  const articleSlugs = await getArticleSlugs();
  console.log(`\n📁 找到 ${articleSlugs.length} 篇文章`);

  // 2. 获取 GA4 数据
  const gaJson = await fetchGAData();
  const gaData = gaJson.data || [];

  // 3. 聚合并匹配
  let slugData = aggregateBySlug(gaData, articleSlugs);
  console.log(`\n🔗 匹配到 ${slugData.length} 篇文章有浏览数据`);

  // 4. 过滤
  if (opts.slug) {
    slugData = slugData.filter((d) => d.slug === opts.slug);
    if (slugData.length === 0) {
      console.log(`\n❌ 未找到文章: ${opts.slug}`);
      process.exit(1);
    }
  }

  if (opts.top !== Infinity) {
    slugData = slugData.slice(0, opts.top);
  }

  // 5. 应用缩放和上限
  const migrationPlan = slugData.map((d) => ({
    slug: d.slug,
    originalHits: d.hits,
    targetHits: Math.min(Math.ceil(d.hits * opts.scale), opts.max),
  }));

  const totalOriginal = migrationPlan.reduce((s, d) => s + d.originalHits, 0);
  const totalTarget = migrationPlan.reduce((s, d) => s + d.targetHits, 0);

  // 6. 加载断点进度
  const progress = opts.resume ? await loadProgress() : { completed: {} };
  const alreadyDone = Object.keys(progress.completed).length;
  if (opts.resume && alreadyDone > 0) {
    console.log(`\n🔄 断点续传: 已完成 ${alreadyDone} 篇文章`);
  }

  // 7. 打印预览
  console.log("\n┌─────────────────────────────────────────────────────┐");
  console.log("│  文章                              原始浏览    目标  │");
  console.log("├─────────────────────────────────────────────────────┤");

  for (const item of migrationPlan.slice(0, 30)) {
    const done = progress.completed[item.slug] ? " ✅" : "";
    const slug = item.slug.padEnd(30).slice(0, 30);
    const orig = item.originalHits.toLocaleString().padStart(10);
    const target = item.targetHits.toLocaleString().padStart(8);
    console.log(`│  ${slug}  ${orig}  ${target}${done}  │`);
  }

  if (migrationPlan.length > 30) {
    console.log(`│  ... 还有 ${migrationPlan.length - 30} 篇文章                              │`);
  }

  console.log("├─────────────────────────────────────────────────────┤");
  console.log(`│  合计:  原始 ${totalOriginal.toLocaleString()} → 目标 ${totalTarget.toLocaleString()} 次请求`.padEnd(53) + "│");

  const estimatedMinutes = Math.ceil(totalTarget / (opts.concurrency * 10) / 60);
  console.log(`│  预估耗时: ~${estimatedMinutes} 分钟 (并发 ${opts.concurrency})`.padEnd(53) + "│");
  console.log("└─────────────────────────────────────────────────────┘");

  if (!opts.run) {
    console.log("\n💡 这是预览模式。加 --run 参数执行实际迁移。");
    console.log("   如果数据量太大，可以用以下参数控制:");
    console.log("   --scale=0.1     按比例缩放（如 10%）");
    console.log("   --max=1000      每篇文章最多 1000 次");
    console.log("   --top=50        只迁移 Top 50 文章");
    console.log("   --slug=xxx      只迁移指定文章");
    console.log("   --resume        断点续传");
    process.exit(0);
  }

  // 8. 执行迁移
  console.log("\n🚀 开始迁移...\n");

  let totalSent = 0;
  let totalErrors = 0;

  for (const item of migrationPlan) {
    if (progress.completed[item.slug]) {
      console.log(`  ⏭️  ${item.slug} (已完成，跳过)`);
      continue;
    }

    const urlPath = `/${item.slug}`;
    const count = item.targetHits;

    console.log(`  📝 ${item.slug}: 发送 ${count.toLocaleString()} 次 pageview...`);

    // 分批发送
    const BATCH_SIZE = 200;
    let sent = 0;
    let errors = 0;

    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const batchCount = batchEnd - batchStart;

      const tasks = Array.from({ length: batchCount }, () => () => sendPageview(urlPath, ""));

      const results = await runConcurrent(tasks, opts.concurrency);
      const batchErrors = results.filter((r) => r?.error).length;

      sent += batchCount - batchErrors;
      errors += batchErrors;

      // 打印进度
      const pct = Math.round(((batchEnd) / count) * 100);
      process.stdout.write(`\r     进度: ${pct}% (${sent.toLocaleString()}/${count.toLocaleString()})${errors > 0 ? ` ❌${errors}` : ""}`);

      // 小延迟避免过载
      if (batchEnd < count) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    console.log(`\r     ✅ 完成: ${sent.toLocaleString()} 成功${errors > 0 ? `, ${errors} 失败` : ""}                    `);

    totalSent += sent;
    totalErrors += errors;

    // 保存进度
    progress.completed[item.slug] = { sent, errors, timestamp: Date.now() };
    await saveProgress(progress);
  }

  // 9. 打印结果
  console.log("\n═══════════════════════════════════════════════");
  console.log("  迁移完成！");
  console.log(`  成功: ${totalSent.toLocaleString()} 条`);
  if (totalErrors > 0) console.log(`  失败: ${totalErrors.toLocaleString()} 条`);
  console.log("═══════════════════════════════════════════════\n");

  if (totalErrors > 0) {
    console.log("  💡 如有失败，可用 --resume 断点续传重试\n");
  }
}

main().catch((err) => {
  console.error("\n❌ 迁移失败:", err.message);
  process.exit(1);
});

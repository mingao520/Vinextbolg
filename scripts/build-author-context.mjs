/**
 * 构建作者上下文数据（模型无关）
 *
 * 聚合博客文章、推文和 GitHub 数据为统一的 author-context.json，
 * 作为所有 AI 模型的标准化输入。
 *
 * 用法:
 *   node scripts/build-author-context.mjs
 *   node scripts/build-author-context.mjs --refresh-tweets
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";
import { loadEnv } from "./utils/load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const POSTS_DIR = path.join(ROOT_DIR, "content", "posts");
const SOURCES_DIR = path.join(DATA_DIR, "sources");
const OUTPUT_FILE = path.join(DATA_DIR, "author-context.json");

const DEFAULT_SITE_URL = "https://luolei.org";
const DEFAULT_USERNAME = "luoleiorg";
const MAX_POSTS = 120;
const MAX_TWEETS = 80;
const MAX_PROJECTS = 10;
const TWEET_CACHE_MAX_AGE_DAYS = 7;

// ─── 工具函数 ────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    refreshTweets: args.includes("--refresh-tweets"),
  };
}

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

// ─── 博客数据 ────────────────────────────────────────────────

async function collectMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function toSlug(relativePath) {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/\.md$/, "")
    .replace(/\//g, "-");
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

function truncate(text, max = 120) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function collectBlogDigest(siteUrl) {
  const files = await collectMarkdownFiles(POSTS_DIR);
  const aiSummaries = await readJson(path.join(DATA_DIR, "ai-summaries.json"), {
    articles: {},
  });

  const posts = [];
  for (const filePath of files) {
    const relative = path.relative(POSTS_DIR, filePath);
    const slug = toSlug(relative);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = matter(raw);
    const data = parsed.data ?? {};
    if (!data.title || !data.date || data.hide) continue;

    const summaryEntry = aiSummaries?.articles?.[slug]?.data ?? null;
    const plainContent = stripMarkdown(parsed.content);

    posts.push({
      title: String(data.title),
      date: String(data.date),
      url: `${siteUrl.replace(/\/$/, "")}/${slug}`,
      categories: Array.isArray(data.categories)
        ? data.categories.map((c) => String(c))
        : [],
      summary: summaryEntry?.summary ?? truncate(plainContent, 100),
      keyPoints: Array.isArray(summaryEntry?.keyPoints)
        ? summaryEntry.keyPoints
        : [],
    });
  }

  posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return posts.slice(0, MAX_POSTS);
}

// ─── 推文数据 ────────────────────────────────────────────────

function tweetScore(tweet) {
  const m = tweet.metrics ?? {};
  const likes = Number(m.like_count ?? 0);
  const bookmarks = Number(m.bookmark_count ?? 0);
  const retweets = Number(m.retweet_count ?? 0);
  const replies = Number(m.reply_count ?? 0);
  const quotes = Number(m.quote_count ?? 0);
  return likes + bookmarks * 1.5 + retweets * 1.8 + replies + quotes * 1.2;
}

function normalizeAuthorTweetsCache(payload) {
  if (!payload?.tweets || !Array.isArray(payload.tweets)) return [];
  const username = payload?.meta?.username ?? DEFAULT_USERNAME;
  return payload.tweets.map((tweet) => ({
    id: tweet.id,
    text: tweet.text ?? "",
    date: tweet.created_at ?? "",
    url: `https://x.com/${username}/status/${tweet.id}`,
    metrics: tweet.public_metrics ?? {},
  }));
}

function normalizeTweetCardCache(payload) {
  const map = payload?.tweets ?? {};
  return Object.values(map)
    .filter((tweet) => tweet?.author?.username === DEFAULT_USERNAME)
    .map((tweet) => ({
      id: tweet.id,
      text: tweet.text ?? "",
      date: tweet.created_at ?? "",
      url: `https://x.com/${tweet.author?.username ?? DEFAULT_USERNAME}/status/${tweet.id}`,
      metrics: tweet.public_metrics ?? {},
    }));
}

function isCacheStale(cacheData, maxAgeDays) {
  const updatedAt = cacheData?.meta?.lastUpdated;
  if (!updatedAt) return true;
  const age = Date.now() - new Date(updatedAt).getTime();
  return age > maxAgeDays * 24 * 60 * 60 * 1000;
}

async function collectTweets() {
  // 优先使用作者专用推文缓存
  const authorCache = await readJson(
    path.join(DATA_DIR, "author-tweets-cache.json"),
    null,
  );
  if (authorCache?.tweets?.length) {
    const tweets = normalizeAuthorTweetsCache(authorCache);
    return {
      tweets: [...tweets].sort((a, b) => tweetScore(b) - tweetScore(a)).slice(0, MAX_TWEETS),
      source: "author-tweets-cache",
      fetchedAt: authorCache?.meta?.lastUpdated ?? new Date().toISOString(),
      count: tweets.length,
      stale: isCacheStale(authorCache, TWEET_CACHE_MAX_AGE_DAYS),
    };
  }

  // 回退到通用推文缓存
  const tweetCardCache = await readJson(
    path.join(DATA_DIR, "tweets-cache.json"),
    { tweets: {} },
  );
  const tweets = normalizeTweetCardCache(tweetCardCache);
  return {
    tweets: [...tweets].sort((a, b) => tweetScore(b) - tweetScore(a)).slice(0, MAX_TWEETS),
    source: "tweets-cache",
    fetchedAt: tweetCardCache?.lastUpdated ?? new Date().toISOString(),
    count: tweets.length,
    stale: true, // 通用缓存不是为此用途设计的
  };
}

// ─── GitHub 数据 ──────────────────────────────────────────────

async function collectGithubData() {
  const resume = await readJson(path.join(DATA_DIR, "github-resume.json"), {
    profile: {},
    highlights: [],
    experience: [],
    projects: [],
  });

  return {
    profile: resume.profile ?? {},
    highlights: Array.isArray(resume.highlights) ? resume.highlights : [],
    experience: Array.isArray(resume.experience) ? resume.experience : [],
    sideProjects: Array.isArray(resume.sideProjects) ? resume.sideProjects : [],
    publicActivities: Array.isArray(resume.publicActivities) ? resume.publicActivities : [],
    skills: resume.skills ?? {},
    education: resume.education ?? null,
    projects: Array.isArray(resume.projects)
      ? resume.projects.slice(0, MAX_PROJECTS)
      : [],
    updatedAt: resume?.meta?.lastUpdated ?? null,
  };
}

// ─── 主流程 ──────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  await loadEnv();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

  console.log("📦 收集博客文章数据...");
  const posts = await collectBlogDigest(siteUrl);
  console.log(`   └─ ${posts.length} 篇文章`);

  // 保存博客摘要到 sources
  await writeJson(path.join(SOURCES_DIR, "blog-digest.json"), {
    generatedAt: new Date().toISOString(),
    count: posts.length,
    posts,
  });

  console.log("🐦 收集推文数据...");
  const tweetResult = await collectTweets();
  if (tweetResult.stale) {
    console.log(
      `   ⚠️  推文缓存已过期（来源: ${tweetResult.source}）`,
    );
    if (args.refreshTweets) {
      console.log("   🔄 正在刷新推文（需要 TWITTER_BEARER_TOKEN）...");
      // 动态导入并执行 fetch-author-tweets
      try {
        const { execSync } = await import("child_process");
        execSync("node scripts/fetch-author-tweets.mjs", {
          cwd: ROOT_DIR,
          stdio: "inherit",
        });
        // 重新读取
        const refreshed = await collectTweets();
        tweetResult.tweets = refreshed.tweets;
        tweetResult.fetchedAt = refreshed.fetchedAt;
        tweetResult.count = refreshed.count;
        tweetResult.stale = false;
        console.log(`   └─ 刷新完成，${refreshed.count} 条推文`);
      } catch (err) {
        console.warn(`   ❌ 推文刷新失败: ${err.message}`);
      }
    } else {
      console.log("   💡 使用 --refresh-tweets 标志可自动刷新");
    }
  }
  console.log(`   └─ ${tweetResult.tweets.length} 条推文（来源: ${tweetResult.source}）`);

  console.log("🐙 收集 GitHub 数据...");
  const github = await collectGithubData();
  console.log(`   └─ ${github.projects.length} 个项目`);

  // 保存 GitHub 数据到 sources
  await writeJson(path.join(SOURCES_DIR, "github-profile.json"), {
    generatedAt: new Date().toISOString(),
    ...github,
  });

  // ── 构建统一上下文 ──
  const context = {
    $schema: "author-context-v1",
    generatedAt: new Date().toISOString(),
    profile: {
      name: github.profile?.name ?? "罗磊",
      headline:
        github.profile?.headline ??
        "全栈开发者 / 内容创作者 / 数字游民实践者",
      location: github.profile?.location ?? "Shenzhen, China",
      social: github.profile?.social ?? {
        github: "https://github.com/foru17",
        x: "https://x.com/luoleiorg",
        youtube: "https://zuoluo.tv/youtube",
        blog: siteUrl,
      },
    },
    experience: github.experience,
    sideProjects: github.sideProjects,
    publicActivities: github.publicActivities,
    skills: github.skills,
    education: github.education,
    highlights: github.highlights,
    posts,
    tweets: tweetResult.tweets,
    projects: github.projects,
    sourceVersions: {
      tweets: {
        fetchedAt: tweetResult.fetchedAt,
        count: tweetResult.count,
        source: tweetResult.source,
      },
      posts: {
        scannedAt: new Date().toISOString(),
        count: posts.length,
      },
      github: {
        updatedAt: github.updatedAt,
      },
    },
  };

  await writeJson(OUTPUT_FILE, context);
  console.log(`\n✅ 已生成: ${OUTPUT_FILE}`);
  console.log(`📊 数据概览: ${posts.length} 文章 / ${tweetResult.tweets.length} 推文 / ${github.projects.length} 项目`);
}

main().catch((error) => {
  console.error("❌ 构建失败:", error.message);
  process.exit(1);
});

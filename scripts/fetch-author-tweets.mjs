/**
 * 获取作者时间线推文并缓存（用于 About 页面画像）
 *
 * 用法:
 *   source .env && node scripts/fetch-author-tweets.mjs
 *   source .env && node scripts/fetch-author-tweets.mjs --username=luoleiorg --max=80
 *   source .env && node scripts/fetch-author-tweets.mjs --include-replies
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "data", "author-tweets-cache.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    username: "luoleiorg",
    max: 60,
    includeReplies: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--username=")) {
      flags.username = arg.slice("--username=".length).trim() || flags.username;
    } else if (arg.startsWith("--max=")) {
      const value = Number.parseInt(arg.slice("--max=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        flags.max = Math.min(200, value);
      }
    } else if (arg === "--include-replies") {
      flags.includeReplies = true;
    }
  }

  return flags;
}

async function loadEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  try {
    const content = await fs.readFile(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing .env
  }
}

async function requestJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API 请求失败: ${response.status} ${text.slice(0, 500)}`);
  }

  return response.json();
}

function mapMedia(includes) {
  const mediaMap = new Map();
  for (const media of includes?.media ?? []) {
    mediaMap.set(media.media_key, {
      type: media.type,
      url: media.url,
      preview_image_url: media.preview_image_url,
      width: media.width,
      height: media.height,
    });
  }
  return mediaMap;
}

function extractTweets(payload) {
  const mediaMap = mapMedia(payload.includes);
  return (payload.data ?? []).map((tweet) => {
    const media = (tweet.attachments?.media_keys ?? [])
      .map((key) => mediaMap.get(key))
      .filter(Boolean);

    return {
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics ?? null,
      media,
      conversation_id: tweet.conversation_id,
      referenced_tweets: tweet.referenced_tweets ?? [],
    };
  });
}

async function getUserByUsername(username, token) {
  const userUrl = new URL(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`,
  );
  userUrl.searchParams.set("user.fields", "id,name,username,description,profile_image_url");
  const payload = await requestJson(userUrl.toString(), token);
  if (!payload?.data?.id) {
    throw new Error(`未找到用户: ${username}`);
  }
  return payload.data;
}

async function fetchAuthorTweets(userId, token, options) {
  const allTweets = [];
  let nextToken = null;
  let requestCount = 0;

  while (allTweets.length < options.max) {
    const remaining = options.max - allTweets.length;
    const pageSize = Math.min(100, remaining);

    const timelineUrl = new URL(
      `https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets`,
    );
    timelineUrl.searchParams.set("max_results", String(pageSize));
    timelineUrl.searchParams.set(
      "tweet.fields",
      "created_at,public_metrics,attachments,conversation_id,referenced_tweets",
    );
    timelineUrl.searchParams.set(
      "expansions",
      "attachments.media_keys",
    );
    timelineUrl.searchParams.set(
      "media.fields",
      "type,url,preview_image_url,width,height",
    );
    if (!options.includeReplies) {
      timelineUrl.searchParams.set("exclude", "retweets,replies");
    } else {
      timelineUrl.searchParams.set("exclude", "retweets");
    }
    if (nextToken) {
      timelineUrl.searchParams.set("pagination_token", nextToken);
    }

    const payload = await requestJson(timelineUrl.toString(), token);
    const tweets = extractTweets(payload);
    requestCount += 1;

    if (tweets.length === 0) break;
    allTweets.push(...tweets);

    nextToken = payload?.meta?.next_token ?? null;
    if (!nextToken) break;
  }

  return {
    tweets: allTweets.slice(0, options.max),
    requestCount,
  };
}

async function main() {
  await loadEnv();
  const args = parseArgs();
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.error("❌ 缺少 TWITTER_BEARER_TOKEN，请先在 .env 中配置");
    process.exit(1);
  }

  console.log(`🔍 获取用户信息 @${args.username} ...`);
  const user = await getUserByUsername(args.username, token);
  console.log(`✅ 用户: ${user.name} (@${user.username})`);

  console.log(
    `📡 拉取时间线推文（max=${args.max}，includeReplies=${args.includeReplies}）...`,
  );
  const { tweets, requestCount } = await fetchAuthorTweets(user.id, token, {
    max: args.max,
    includeReplies: args.includeReplies,
  });

  const cache = {
    meta: {
      lastUpdated: new Date().toISOString(),
      username: user.username,
      fetchedCount: tweets.length,
      requestCount,
      includeReplies: args.includeReplies,
    },
    user,
    tweets,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(cache, null, 2), "utf-8");
  console.log(`✅ 已写入: ${OUTPUT_PATH}`);
  console.log(`📊 推文数量: ${tweets.length}`);
}

main().catch((error) => {
  console.error("❌ 失败:", error.message);
  process.exit(1);
});

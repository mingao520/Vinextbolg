// AI 配置 —— 从环境变量读取

import type { AIConfig } from "./types";

export function getAIConfig(): AIConfig {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      "缺少 AI 配置，请在 .env 中设置 AI_BASE_URL, AI_API_KEY, AI_MODEL",
    );
  }

  return { baseUrl, apiKey, model };
}

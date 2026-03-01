/**
 * 共用 .env 加载工具
 * 简易解析 .env 文件并注入 process.env（不覆盖已有变量）
 */

import fs from "fs/promises";
import path from "path";

const ROOT_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

export async function loadEnv(envPath) {
  const filePath = envPath || path.join(ROOT_DIR, ".env");
  try {
    const content = await fs.readFile(filePath, "utf-8");
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

export function getRootDir() {
  return ROOT_DIR;
}

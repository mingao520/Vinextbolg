# Umami 统计迁移方案报告

## 1. 背景与目标

### 1.1 原始数据来源
- **来源**: Google Analytics 历史数据
- **API 地址**: https://st.luolei.org/ga
- **数据总量**: 1,383 条原始记录

### 1.2 目标系统
- **目标**: 自托管 Umami v3.0.3
- **地址**: https://u.is26.com
- **Website ID**: `185ef031-29b2-49e3-bc50-1c9f80b4e831`

### 1.3 迁移目标
将 GA 历史浏览量数据完整迁移到 Umami，使文章卡片和详情页能显示历史浏览量。

---

## 2. 数据清洗与处理

### 2.1 原始数据结构
```json
{
  "total": 1383,
  "data": [
    {"page": "/how-to-get-a-us-mobile-phone-number", "hit": 164676},
    {"page": "/how-to-get-a-us-mobile-phone-number/", "hit": 745},
    ...
  ]
}
```

### 2.2 数据清洗规则
1. **过滤垃圾路径**:
   - `/wp-admin/*`, `/assets/*`, `/admin.php`
   - `*.js`, `*.css`, `*.png` 等静态资源
   - `/undefined`, `/null`, 包含 `<script>` 的路径

2. **路径标准化**:
   - `/slug/` 和 `/slug` 统一为 `/slug`
   - 确保以 `/` 开头

3. **数据聚合**:
   - 相同路径的浏览量合并累加
   - 如 `/needless/` (745) + `/needless` (31707) = `/needless` (32452)

### 2.3 清洗后数据
- **有效文章数**: 967 篇
- **总浏览量 (PV)**: 2,196,857

---

## 3. 数据模型映射

### 3.1 UV:PV:访客比例
根据需求，采用 **1:1:1** 简化模型：
- UV (独立访客) = PV (浏览量)
- 每个浏览对应一个独立 session
- **无需区分新/回访客，不关注时间维度**

### 3.2 Umami 表结构
Umami 使用两张核心表存储访问数据：

```sql
-- session 表：存储访客会话
session (
  session_id UUID PRIMARY KEY,
  website_id UUID,
  browser VARCHAR,    -- 标记为 'GAImport'
  os VARCHAR,         -- 标记为 'GAImport'
  device VARCHAR,     -- 标记为 'GAImport'
  country CHAR(2),    -- 'CN'
  created_at TIMESTAMP
)

-- website_event 表：存储页面浏览事件
website_event (
  event_id UUID PRIMARY KEY,
  website_id UUID,
  session_id UUID REFERENCES session(session_id),
  url_path VARCHAR,   -- 文章路径如 '/how-to-get-a-us-mobile-phone-number'
  event_type INT,     -- 1 = pageview
  created_at TIMESTAMP
)
```

### 3.3 数据导入逻辑
对于每篇文章 (path, views)：
1. 创建 `views` 个 session 记录
2. 为每个 session 创建 1 个 pageview event
3. session 和 event 通过 session_id 关联

**示例**: 文章 `/example` 有 1000 次浏览
- 插入 1000 条 session 记录
- 插入 1000 条 event 记录 (url_path = '/example')

---

## 4. 前端集成方案

### 4.1 API 路由
- **端点**: `/api/analytics/hits`
- **缓存**: Edge Cache 6 小时 + Client Cache 2 分钟
- **数据源**: Umami API `/api/websites/{id}/metrics?type=path`

### 4.2 数据查询
使用 Umami v3 API：
```bash
GET /api/websites/{website_id}/metrics?startAt=1420070400000&endAt=1893456000000&type=path
Authorization: Bearer {token}
```

返回格式：
```json
[
  {"x": "/how-to-get-a-us-mobile-phone-number", "y": 164676},
  ...
]
```

### 4.3 文章展示
- **文章卡片**: 显示浏览量数字
- **文章详情**: 显示 "X 浏览"
- **热门排序**: 使用浏览量排序

---

## 5. 当前状态与问题

### 5.1 已完成工作
1. ✅ GA 数据清洗（967 篇文章）
2. ✅ Umami API 客户端开发
3. ✅ 前端统计组件集成
4. ✅ API 缓存策略实现
5. ✅ 测试数据导入（100 条验证通过）

### 5.2 核心问题
**数据导入性能瓶颈**

| 指标 | 数值 |
|------|------|
| 文章数 | 967 篇 |
| 总浏览量 | 2,196,857 |
| 需插入 session 数 | 2,196,857 |
| 需插入 event 数 | 2,196,857 |
| 预估导入时间 | 2-4 小时 |

**问题原因**:
- PostgreSQL 单条插入 440 万条记录性能低下
- 远程 SSH 执行超时（默认 60-300 秒）
- 事务批量插入需要大量内存

---

## 6. 可选方案

### 方案 A：后台完整导入（推荐）
**实施方式**:
1. 创建后台导入脚本（Node.js/Python）
2. 分批导入（每批 10,000 条）
3. 使用 PostgreSQL COPY 命令或批量 INSERT
4. 在服务器后台运行（screen/tmux）

**优点**: 数据完整，完全兼容 Umami API
**缺点**: 耗时 2-4 小时，期间新数据会混杂

**时间预估**:
- 前 100 篇文章（约 100 万 PV）: 30-60 分钟
- 剩余 867 篇文章（约 120 万 PV）: 1-3 小时

---

### 方案 B：分层导入（快速见效）
**实施方式**:
1. **高流量文章** (> 5000 浏览): 全部导入（约 150 篇，占 90% 流量）
2. **中流量文章** (1000-5000): 标记为 "热门"，可暂不导入详细数据
3. **低流量文章** (< 1000): 显示为 0 或隐藏数字

**优点**: 15 分钟完成，覆盖 90% 浏览量
**缺点**: 部分文章显示 0 浏览

---

### 方案 C：统计表方案（绕过 Umami 表）
**实施方式**:
1. 在 Umami 数据库创建独立表 `ga_page_stats`
2. 存储 `path`, `views` 两列（967 行）
3. 修改网站 API 查询此表而非标准 Umami API

**SQL 示例**:
```sql
CREATE TABLE ga_page_stats (
  url_path TEXT PRIMARY KEY,
  views INT NOT NULL,
  website_id UUID
);
-- 仅插入 967 行数据
```

**优点**: 秒级完成，数据完整
**缺点**: 需要修改前端 API 查询逻辑，不完全使用 Umami 标准接口

---

### 方案 D：混合方案（推荐平衡）
**实施方式**:
1. **高流量文章** (Top 200): 完整导入 Umami 标准表
2. **低流量文章**: 使用 `ga_page_stats` 表存储
3. API 层合并两个数据源

**优点**: 平衡了性能和完整性
**缺点**: 维护两套数据源

---

## 7. 技术实现细节

### 7.1 导入脚本核心逻辑（方案 A）
```python
# 伪代码
for article in articles:
    path = article['path']
    views = article['views']
    
    # 批量插入 sessions
    sessions = [generate_uuid() for _ in range(views)]
    batch_insert('session', sessions)
    
    # 批量插入 events
    events = [(uuid, path) for uuid in sessions]
    batch_insert('website_event', events)
```

### 7.2 关键 SQL（Umami v3）
```sql
-- 清空数据
TRUNCATE website_event, session;

-- 批量插入（使用 generate_series）
INSERT INTO session (session_id, website_id, browser, os, device, screen, language, country, created_at)
SELECT gen_random_uuid(), 'website_id', 'GAImport', 'GAImport', 'GAImport', '0x0', 'zh-CN', 'CN', NOW()
FROM generate_series(1, {views_count});

-- 关联插入 events
INSERT INTO website_event (...)
SELECT gen_random_uuid(), website_id, session_id, NOW(), '{path}', ..., 1, ..., 'luolei.org'
FROM session
WHERE website_id = '{website_id}' AND browser = 'GAImport'
AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = session.session_id);
```

---

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 导入过程中新数据丢失 | 中 | 导入期间暂停 Umami 追踪或记录缺失数据 |
| 导入失败导致数据不完整 | 中 | 分批导入，每批验证，失败可回滚 |
| 数据库性能下降 | 低 | 导入完成后 ANALYZE 表，检查索引 |
| 数据重复 | 高 | 导入前 TRUNCATE，确保 session_id 唯一 |

---

## 9. 推荐方案

**推荐方案 A（后台完整导入）**，原因：
1. 完全使用 Umami 标准能力，无技术债务
2. 数据完整，所有文章都有浏览量
3. 可配合 Umami 后续功能（如实时统计、图表等）

**执行计划**:
1. 开发 Node.js 批量导入脚本（使用 pg COPY）
2. 在服务器后台执行（tmux + nohup）
3. 每 10 万条验证一次
4. 完成后验证数据完整性

**预计耗时**: 3-4 小时

---

## 10. 附录

### A. 数据样本
**Top 10 文章浏览量**:
| 路径 | 浏览量 |
|------|--------|
| / | 510,823 |
| /how-to-get-a-us-mobile-phone-number | 165,421 |
| /hiwifi-shadowsocks | 87,182 |
| /cuniq-uk-sim-card-china-roaming | 52,385 |
| /how-to-open-a-bank-account-in-hongkong-2024 | 41,655 |

### B. 相关文件
- `/tmp/umami-reimport/ga_cleaned.json` - 清洗后数据（967 条）
- `/tmp/umami-reimport/import_all_data.sql` - 完整导入 SQL
- `/src/lib/umami.ts` - Umami API 客户端
- `/src/app/api/analytics/hits/route.ts` - API 路由

---

**报告日期**: 2026-02-27
**撰写人**: AI Assistant
**待审核**: 技术方案合理性、导入脚本实现

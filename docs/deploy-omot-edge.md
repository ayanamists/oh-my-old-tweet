# omot-edge 部署指南

## 前置条件

- Cloudflare 账号，已登录 `wrangler`：`npx wrangler login`
- 已创建 R2 bucket（见下方步骤）

---

## Step 1 — 创建 R2 Bucket 并部署 Worker（Step 2 功能：边缘缓存）

```bash
# 1. 创建 R2 bucket（名称必须与 wrangler.toml 中的 bucket_name 一致）
npx wrangler r2 bucket create omot-cache

# 2. 部署 Worker
cd packages/omot-edge
npx wrangler deploy
```

部署成功后，Worker URL 形如 `https://omot-edge.<your-subdomain>.workers.dev`。

### （可选）启用 API Key 访问控制

不设置则 Worker 对公网开放；设置后所有请求必须携带 Bearer Token。

```bash
cd packages/omot-edge
npx wrangler secret put OMOT_API_KEY
# 在提示符处输入你想要的 key，回车确认
```

设置后验证：

```bash
# 无 key → 401
curl -s -o /dev/null -w "%{http_code}" \
  "https://omot-edge.<your-subdomain>.workers.dev/healthz"
# → 200（healthz 永远不需要 key）

curl -s -o /dev/null -w "%{http_code}" \
  "https://omot-edge.<your-subdomain>.workers.dev/snapshot?url=..."
# → 401

# 带 key → 正常响应
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <your-key>" \
  "https://omot-edge.<your-subdomain>.workers.dev/snapshot?url=..."
# → 200
```

### 前端配置

打开 OMOT 应用 → 侧边栏 → **Edge Worker Settings**：
- **Edge Worker URL**：填入上方 Worker URL，点击 ✓ 保存
- **API Key**：填入上一步设置的 key，点击 ✓ 保存（未设置 key 则留空）

---

## Step 2 — 创建 D1 数据库并应用 Schema（Step 3 功能：全文搜索 + 预热）

```bash
# 1. 创建 D1 数据库，记录输出中的 database_id
npx wrangler d1 create omot-db
```

编辑 `packages/omot-edge/wrangler.toml`，取消注释并填入 `database_id`：

```toml
[[d1_databases]]
binding      = "OMOT_DB"
database_name = "omot-db"
database_id  = "<粘贴上一步输出的 id>"
```

```bash
# 2. 应用 Schema（建表 + FTS5 虚拟表 + 触发器）
npx wrangler d1 migrations apply omot-db --remote

# 3. 重新部署（让 Worker 绑定 D1）
npx wrangler deploy
```

之后访问 `/search` 路由即可使用全文搜索。cron 预热每天自动运行（见 `wrangler.toml` 的 `[triggers]` 配置）。

---

## 验证部署

```bash
# 检查 Worker 是否响应
curl https://omot-edge.<your-subdomain>.workers.dev/

# 测试 snapshot 端点（替换为真实 archive.org URL）
curl "https://omot-edge.<your-subdomain>.workers.dev/snapshot?url=https%3A%2F%2Fweb.archive.org%2Fweb%2F20200101120000%2Fhttps%3A%2F%2Ftwitter.com%2Fjack%2Fstatus%2F20"

# 测试搜索（需要 D1 中有数据后才会有结果）
curl "https://omot-edge.<your-subdomain>.workers.dev/search?q=hello"
```

---

## 本地开发

```bash
cd packages/omot-edge
npx wrangler dev        # 启动本地 Worker，监听 http://localhost:8787
```

本地开发时 R2/D1 均使用本地模拟（Miniflare），不消耗远程资源。

---

## 费用估算（参考）

| 资源 | 免费额度 | 预估用量 |
|---|---|---|
| Workers 请求 | 10万次/天 | 低流量完全免费 |
| R2 存储 | 10 GB | 每条 tweet ~2 KB，500万条 ≈ 10 GB |
| R2 操作 | A类10万次/月，B类1000万次/月 | 读多写少，B类为主 |
| D1 行读取 | 500万次/天 | 搜索低频，免费额度充裕 |

预计月费 **$0–5**（R2 超出免费额度后 $0.015/GB·月）。

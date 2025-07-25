# Blinko Todo 日历同步

自动将 Blinko 待办事项同步到你的日历应用，基于 Cloudflare Workers 构建。

## 🚀 功能特性

- ✅ 自动同步 Blinko 待办事项到 ICS 日历格式
- ✅ 支持按标签分类（所有、工作、个人）
- ✅ 每小时自动同步，无需手动操作
- ✅ 固定 URL 订阅，无需频繁更新
- ✅ 基于 Cloudflare Workers，高性能且稳定

## 📅 订阅 URL

将以下 URL 添加到你的日历应用中：

```
https://todo.folio.cool/todo.ics
```

## 🛠️ 技术栈

- **后端**: Cloudflare Workers
- **前端**: Next.js + TypeScript + Tailwind CSS
- **存储**: Cloudflare KV
- **部署**: Wrangler CLI

## 📁 项目结构

```
├── src/
│   └── worker.ts          # Cloudflare Worker 主文件
├── app/
│   ├── page.tsx           # 主页面
│   ├── layout.tsx         # 布局组件
│   └── worker-dashboard/  # Worker 管理面板
├── scripts/
│   └── deploy-worker.sh   # 部署脚本
├── wrangler.toml          # Worker 配置
├── next.config.js         # Next.js 配置
└── package.json           # 项目依赖
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
# 设置 Blinko Token
npx wrangler secret put BLINKO_TOKEN

# 查看当前配置
npx wrangler kv:key list --binding=KV_NAMESPACE
```

### 3. 部署 Worker
```bash
npm run deploy:worker
```

### 4. 本地开发
```bash
# 前端开发
npm run dev

# Worker 开发
npm run deploy:worker-dev
```

## 📊 管理面板

访问 `/worker-dashboard` 查看：
- 同步状态
- 生成的日历文件
- 手动触发同步
- 系统监控

## 🔧 API 端点

- `GET /api/test` - 检查 API 连接状态
- `GET /api/status` - 获取同步状态
- `GET /api/calendars` - 获取日历文件列表
- `POST /api/sync` - 手动触发同步

## �� 许可证

MIT License 
# Blinko Todo 日历同步

自动将 Blinko 待办事项同步到你的日历应用，基于 Cloudflare Workers 构建。

## 🚀 功能特性

- ✅ 自动同步 Blinko 待办事项到 ICS 日历格式
- ✅ 支持按标签分类（所有、工作、个人）
- ✅ 每小时自动同步，无需手动操作
- ✅ 固定 URL 订阅，无需频繁更新
- ✅ 基于 Cloudflare Workers，高性能且稳定
- ✅ 支持东八区时间自动处理
- ✅ 实时状态监控面板

## 📅 订阅 URL

将以下 URL 添加到你的日历应用中：

```
https://todo.folio.cool/todo.ics
```

### 各平台添加方法

**iOS/macOS 日历**
1. 打开日历应用
2. 点击「日历」→「添加订阅」
3. 粘贴上述 URL

**Google Calendar**
1. 左侧栏点击「+」→「从 URL 添加」
2. 粘贴 URL 并点击「添加日历」

**Outlook**
1. 「文件」→「帐户设置」→「Internet 日历」
2. 点击「新建」，粘贴 URL

## 🛠️ 技术栈

- **后端**: Cloudflare Workers + KV 存储
- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **部署**: Wrangler CLI
- **定时任务**: Cloudflare Cron Triggers
- **域名**: 自定义域名支持

## 📁 项目结构

```
├── src/
│   └── worker.ts          # Cloudflare Worker 主文件
├── app/
│   ├── page.tsx           # 主页面
│   ├── layout.tsx         # 布局组件
│   └── worker-dashboard/  # Worker 管理面板
│       └── page.tsx       # 管理面板页面
├── blinko/
│   ├── route.ts           # Blinko API 路由
│   └── verify/
│       └── route.ts       # 验证路由
├── scripts/
│   └── deploy-worker.sh   # 部署脚本
├── wrangler.toml          # Worker 配置
├── next.config.js         # Next.js 配置
├── package.json           # 项目依赖
└── Todo时间管理说明.md   # 使用说明文档
```

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd blinko-ics-calendar-worker
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量

#### Cloudflare Workers 环境变量
```bash
# 设置 Blinko Token（必需）
npx wrangler secret put BLINKO_TOKEN

# 可选：设置其他环境变量
npx wrangler secret put CUSTOM_DOMAIN
```

#### 本地开发环境变量
创建 `.env.local` 文件：
```env
BLINKO_TOKEN=your_blinko_token_here
BLINKO_API_BASE=https://blinko.folio.cool/api/v1
SYNC_INTERVAL=3600
```

### 4. 配置 Wrangler

编辑 `wrangler.toml` 文件，更新以下配置：

```toml
name = "your-worker-name"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[vars]
BLINKO_API_BASE = "your_blinko_api_base"
SYNC_INTERVAL = "3600"

[[kv_namespaces]]
binding = "KV_NAMESPACE"
id = "your_kv_namespace_id"
preview_id = "your_preview_kv_namespace_id"

[triggers]
crons = ["0 * * * *"] # 每小时执行一次

[[routes]]
pattern = "your-domain.com/*"
zone_name = "your-domain.com"
```

### 5. 部署 Worker
```bash
# 部署到生产环境
npm run deploy:worker

# 或者先在开发环境测试
npm run deploy:worker-dev
```

### 6. 本地开发
```bash
# 启动前端开发服务器
npm run dev

# 启动 Worker 开发服务器
npm run deploy:worker-dev
```

## 📊 管理面板

访问 `/worker-dashboard` 查看：
- 📈 同步状态和统计
- 📋 生成的日历文件预览
- 🔄 手动触发同步操作
- 🛠️ 系统监控和日志
- ⚙️ 配置管理

## 🔧 API 端点

### 基础 API
- `GET /api/test` - 检查 API 连接状态
- `GET /api/status` - 获取同步状态和统计信息
- `GET /api/calendars` - 获取日历文件列表
- `POST /api/sync` - 手动触发同步

### 日历 API
- `GET /todo.ics` - 获取主日历文件
- `GET /work.ics` - 获取工作相关待办
- `GET /personal.ics` - 获取个人待办

### Blinko 集成 API
- `POST /blinko` - Blinko webhook 接口
- `GET /blinko/verify` - 验证 Blinko 连接

## 🔧 配置说明

### 环境变量详解

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `BLINKO_TOKEN` | Blinko API 访问令牌 | ✅ | - |
| `BLINKO_API_BASE` | Blinko API 基础 URL | ❌ | `https://blinko.folio.cool/api/v1` |
| `SYNC_INTERVAL` | 同步间隔（秒） | ❌ | `3600` |

### KV 存储配置

项目使用 Cloudflare KV 存储日历数据和同步状态：

```bash
# 查看 KV 数据
npx wrangler kv:key list --binding=KV_NAMESPACE

# 获取特定键值
npx wrangler kv:key get "calendar_data" --binding=KV_NAMESPACE

# 删除键值
npx wrangler kv:key delete "calendar_data" --binding=KV_NAMESPACE
```

### 定时任务配置

默认每小时执行一次同步，可在 `wrangler.toml` 中修改：

```toml
[triggers]
crons = [
  "0 * * * *",     # 每小时
  "*/30 * * * *",  # 每30分钟
  "0 */6 * * *"    # 每6小时
]
```

## 🛠️ 故障排除

### 常见问题

**1. 同步失败**
```bash
# 检查 Worker 日志
npx wrangler tail

# 验证 Blinko 连接
curl -H "Authorization: Bearer YOUR_TOKEN" https://blinko.folio.cool/api/v1/notes
```

**2. 日历不更新**
- 检查日历应用的刷新间隔设置
- 验证订阅 URL 是否正确
- 查看管理面板的同步状态

**3. 部署问题**
```bash
# 重新认证 Cloudflare
npx wrangler auth login

# 检查 wrangler.toml 配置
npx wrangler whoami
```

### 调试模式

启用调试模式获取详细日志：

```bash
# 开发环境调试
DEBUG=1 npm run deploy:worker-dev

# 查看实时日志
npx wrangler tail --format=pretty
```

## 🤝 贡献指南

欢迎提交 Issues 和 Pull Requests！

### 开发流程

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 提交前运行测试：`npm run lint`

### 本地测试

```bash
# 运行 lint 检查
npm run lint

# 构建项目
npm run build

# 测试 Worker
npm run deploy:worker-dev
```

## 📝 更新日志

### v1.0.0
- ✨ 初始版本发布
- ✅ 基础同步功能
- ✅ 管理面板
- ✅ 定时任务支持
- ✅ 东八区时间处理

## 🔗 相关链接

- [Blinko 官网](https://blinko.folio.cool)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [ICS 格式规范](https://tools.ietf.org/html/rfc5545)

## 📞 支持

如果你遇到问题：
1. 查看本文档的故障排除部分
2. 在 GitHub Issues 中搜索类似问题
3. 创建新的 Issue 并提供详细信息

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

---

Made with ❤️ by [Your Name] 
#!/bin/bash

# Blinko ICS Calendar Worker 部署脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI 未安装，请先安装：npm install -g wrangler"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查登录状态
check_login() {
    log_info "检查 Cloudflare 登录状态..."
    
    if ! wrangler whoami &> /dev/null; then
        log_warning "未登录 Cloudflare，正在登录..."
        wrangler login
    fi
    
    log_success "Cloudflare 登录状态正常"
}

# 创建 KV 命名空间
create_kv_namespaces() {
    log_info "创建 KV 命名空间..."
    
    # 检查是否已存在
    if wrangler kv:namespace list | grep -q "BLINKO_CALENDARS"; then
        log_warning "KV 命名空间已存在，跳过创建"
        return
    fi
    
    # 创建生产环境命名空间
    log_info "创建生产环境 KV 命名空间..."
    PROD_NS=$(wrangler kv:namespace create BLINKO_CALENDARS --preview=false 2>&1 | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    # 创建预览环境命名空间
    log_info "创建预览环境 KV 命名空间..."
    PREVIEW_NS=$(wrangler kv:namespace create BLINKO_CALENDARS --preview 2>&1 | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    # 更新 wrangler.toml
    sed -i.bak "s/id = \"your-kv-namespace-id\"/id = \"$PROD_NS\"/" wrangler.toml
    sed -i.bak "s/preview_id = \"your-preview-kv-namespace-id\"/preview_id = \"$PREVIEW_NS\"/" wrangler.toml
    
    log_success "KV 命名空间创建完成"
    log_info "生产环境 ID: $PROD_NS"
    log_info "预览环境 ID: $PREVIEW_NS"
}

# 设置环境变量
setup_environment() {
    log_info "设置环境变量..."
    
    # 检查是否已设置 BLINKO_TOKEN
    if ! wrangler secret list | grep -q "BLINKO_TOKEN"; then
        log_warning "BLINKO_TOKEN 未设置，请手动设置："
        log_info "wrangler secret put BLINKO_TOKEN"
        read -p "是否现在设置？(y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            wrangler secret put BLINKO_TOKEN
        fi
    else
        log_success "BLINKO_TOKEN 已设置"
    fi
}

# 构建项目
build_project() {
    log_info "构建项目..."
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装依赖..."
        npm install
    fi
    
    # 构建 Worker
    log_info "构建 Worker..."
    npm run build:worker
    
    log_success "项目构建完成"
}

# 部署 Worker
deploy_worker() {
    log_info "部署 Worker..."
    
    # 选择部署环境
    echo "选择部署环境："
    echo "1) 生产环境"
    echo "2) 预览环境"
    echo "3) 本地开发"
    read -p "请选择 (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            log_info "部署到生产环境..."
            wrangler deploy
            ;;
        2)
            log_info "部署到预览环境..."
            wrangler deploy --env staging
            ;;
        3)
            log_info "启动本地开发服务器..."
            wrangler dev
            ;;
        *)
            log_error "无效选择"
            exit 1
            ;;
    esac
    
    log_success "Worker 部署完成"
}

# 测试部署
test_deployment() {
    log_info "测试部署..."
    
    # 获取 Worker URL
    WORKER_URL=$(wrangler whoami 2>/dev/null | grep -o 'https://[^.]*\.workers\.dev' || echo "")
    
    if [ -z "$WORKER_URL" ]; then
        log_warning "无法获取 Worker URL，跳过测试"
        return
    fi
    
    log_info "测试 Worker URL: $WORKER_URL"
    
    # 测试状态 API
    if curl -s "$WORKER_URL/api/status" > /dev/null; then
        log_success "Worker 状态 API 正常"
    else
        log_warning "Worker 状态 API 测试失败"
    fi
    
    # 测试日历列表 API
    if curl -s "$WORKER_URL/api/calendars" > /dev/null; then
        log_success "日历列表 API 正常"
    else
        log_warning "日历列表 API 测试失败"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_success "部署完成！"
    echo
    echo "📋 部署信息："
    echo "=================="
    
    # 获取 Worker URL
    WORKER_URL=$(wrangler whoami 2>/dev/null | grep -o 'https://[^.]*\.workers\.dev' || echo "未知")
    echo "🌐 Worker URL: $WORKER_URL"
    
    echo
    echo "🔗 API 端点："
    echo "  - 状态检查: $WORKER_URL/api/status"
    echo "  - 日历列表: $WORKER_URL/api/calendars"
    echo "  - 手动同步: $WORKER_URL/api/sync (POST)"
    
    echo
    echo "📊 管理界面："
    echo "  - 访问 /worker-dashboard 查看管理界面"
    
    echo
    echo "🛠️  常用命令："
    echo "  - 查看日志: wrangler tail"
    echo "  - 本地开发: wrangler dev"
    echo "  - 重新部署: wrangler deploy"
    echo "  - 查看 KV: wrangler kv:key list --binding=KV_NAMESPACE"
    
    echo
    echo "📚 文档："
    echo "  - 查看 README_WORKERS.md 获取详细使用说明"
}

# 主函数
main() {
    echo "🚀 Blinko ICS Calendar Worker 部署脚本"
    echo "======================================"
    echo
    
    # 检查是否在项目根目录
    if [ ! -f "wrangler.toml" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 执行部署步骤
    check_dependencies
    check_login
    create_kv_namespaces
    setup_environment
    build_project
    deploy_worker
    test_deployment
    show_deployment_info
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        echo "用法: $0 [选项]"
        echo
        echo "选项："
        echo "  --help, -h    显示帮助信息"
        echo "  --skip-kv     跳过 KV 命名空间创建"
        echo "  --skip-test   跳过部署测试"
        echo
        echo "示例："
        echo "  $0             完整部署"
        echo "  $0 --skip-kv   跳过 KV 创建"
        echo "  $0 --skip-test 跳过测试"
        exit 0
        ;;
    --skip-kv)
        log_warning "跳过 KV 命名空间创建"
        SKIP_KV=true
        ;;
    --skip-test)
        log_warning "跳过部署测试"
        SKIP_TEST=true
        ;;
esac

# 运行主函数
main "$@" 
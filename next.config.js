/** @type {import('next').NextConfig} */
const nextConfig = {
  // 输出为静态文件
  output: 'export',
  
  // 禁用图片优化
  images: {
    unoptimized: true,
  },
  
  // 环境变量配置
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig; 
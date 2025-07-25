'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Blinko Todo 日历同步
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            自动将 Blinko 待办事项同步到你的日历应用
          </p>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            🚀 快速开始
          </h2>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-gray-900">订阅日历 URL</h3>
              <p className="text-gray-600 mt-1">
                将以下 URL 添加到你的日历应用中：
              </p>
              <div className="mt-2">
                <div className="bg-gray-100 p-3 rounded">
                  <p className="text-sm font-mono text-gray-800 break-all">
                    https://todo.folio.cool/todo.ics
                  </p>
                  <p className="text-xs text-gray-500 mt-1">所有待办事项</p>
                </div>
              </div>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-gray-900">自动同步</h3>
              <p className="text-gray-600 mt-1">
                系统每小时自动同步一次，无需手动操作
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            📊 管理面板
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/worker-dashboard"
              className="block p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Worker 管理面板
              </h3>
              <p className="text-gray-600">
                查看同步状态、管理日历文件、手动触发同步
              </p>
            </Link>
            
            <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                API 状态检查
              </h3>
              <p className="text-gray-600 mb-3">
                检查 Worker 和 Blinko API 的连接状态
              </p>
              <a 
                href="https://blinko-ics-calendar-worker.minxufeng.workers.dev/api/test"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                查看状态
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500">
          <p>基于 Cloudflare Workers 构建</p>
          <p className="mt-1">每小时自动同步 Blinko 待办事项到 ICS 日历</p>
        </div>
      </div>
    </div>
  );
} 
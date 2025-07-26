'use client';

import { useState, useEffect } from 'react';

interface CalendarFile {
  name: string;
  lastUpdated?: string;
  size?: number;
}

interface SyncResult {
  calendarName: string;
  status: 'success' | 'error';
  count?: number;
  filename?: string;
  error?: string;
}

interface SyncStatus {
  status: string;
  lastSync?: string;
  results: SyncResult[];
}

export default function WorkerDashboard() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://your-worker.your-subdomain.workers.dev';

  useEffect(() => {
    loadStatus();
    loadCalendars();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch(`${workerUrl}/api/status`);
      if (response.ok) {
        const status = await response.json();
        setSyncStatus(status);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const loadCalendars = async () => {
    try {
      const response = await fetch(`${workerUrl}/api/calendars`);
      if (response.ok) {
        const calendarList = await response.json();
        setCalendars(calendarList);
      }
    } catch (error) {
      console.error('Failed to load calendars:', error);
    }
  };

  const triggerManualSync = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`${workerUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            calendarName: 'Manual Sync',
            size: 100
          }
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manual-sync.ics';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setMessage('手动同步成功！');
        
        // 重新加载状态
        setTimeout(() => {
          loadStatus();
          loadCalendars();
        }, 2000);
      } else {
        setMessage('手动同步失败');
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      setMessage('手动同步失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCalendar = async (filename: string) => {
    try {
      const response = await fetch(`${workerUrl}/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setMessage('下载失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Blinko ICS 日历 Worker 管理
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Worker 状态</h3>
              <p className="text-blue-600">
                {syncStatus ? '运行中' : '未知'}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">最后同步</h3>
              <p className="text-green-600">
                {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : '从未同步'}
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-800 mb-2">日历文件</h3>
              <p className="text-purple-600">
                {calendars.length} 个文件
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-md mb-6 ${
              message.includes('成功') 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              onClick={triggerManualSync}
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '同步中...' : '手动触发同步'}
            </button>
            
            <button
              onClick={() => { loadStatus(); loadCalendars(); }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              刷新状态
            </button>
          </div>
        </div>

        {/* 同步结果 */}
        {syncStatus && syncStatus.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">同步结果</h2>
            <div className="space-y-4">
              {syncStatus.results.map((result, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  result.status === 'success' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {result.calendarName}
                      </h3>
                      <p className={`text-sm ${
                        result.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {result.status === 'success' 
                          ? `成功同步 ${result.count} 个 Todo`
                          : `同步失败: ${result.error}`
                        }
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      result.status === 'success' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.status === 'success' ? '成功' : '失败'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 日历文件列表 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">日历文件</h2>
          {calendars.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最后更新
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件大小
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calendars.map((calendar, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {calendar.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calendar.lastUpdated ? formatDate(calendar.lastUpdated) : '未知'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calendar.size ? formatFileSize(calendar.size) : '未知'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => downloadCalendar(calendar.name)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          下载
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">暂无日历文件</p>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-8 p-4 bg-blue-50 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">使用说明：</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Worker 会自动每小时同步一次 Blinko Todo 数据</li>
            <li>• 同步的日历文件存储在 Cloudflare KV 中</li>
            <li>• 可以通过"手动触发同步"立即生成最新的日历文件</li>
            <li>• 下载的 ICS 文件可以直接导入到各种日历应用</li>
            <li>• 文件会在 24 小时后自动过期，确保数据新鲜度</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 
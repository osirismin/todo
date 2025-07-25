/**
 * Cloudflare Worker for Blinko ICS Calendar Auto Sync
 * 实现自动同步 Blinko Todo 到 ICS 日历
 */

// 生成ICS文件内容
function generateICSContent(todos: any[], calendarName: string = 'Blinko Todos'): string {
  const now = new Date();
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Blinko Todo Calendar//CN',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-CALDESC:Blinko Todo Items Calendar - Auto Sync`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  todos.forEach((todo, index) => {
    const todoId = todo.id || `todo-${index}`;
    const rawContent = todo.content || 'Untitled Todo';
    const created = new Date(todo.createdAt || todo.updatedAt || now.toISOString());
    const updated = new Date(todo.updatedAt || todo.createdAt || now.toISOString());
    
    // 格式化日期为ICS格式
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    // 清理标题 - 移除 Markdown 格式，提取纯文本
    const cleanTitle = rawContent
      .replace(/^\*\s*\[.*?\]\s*/, '') // 移除 "* [ ] " 或 "* [x] " 格式
      .replace(/^\s*[-*+]\s*/, '') // 移除列表标记
      .replace(/^\s+/, '') // 移除开头空格
      .replace(/\s+$/, '') // 移除结尾空格
      .substring(0, 100); // 限制长度
    
    // 清理描述文本
    const cleanDescription = rawContent
      .replace(/^\*\s*\[.*?\]\s*/, '') // 移除 Markdown 格式
      .replace(/^\s*[-*+]\s*/, '') // 移除列表标记
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .substring(0, 500); // 限制长度
    
    // 确保标题不为空
    const finalTitle = cleanTitle || '待办事项';
    
    const event = [
      'BEGIN:VEVENT',
      `UID:${todoId}@blinko.calendar`,
      `DTSTAMP:${formatDate(now)}`,
      `DTSTART:${formatDate(created)}`,
      `DTEND:${formatDate(new Date(created.getTime() + 60 * 60 * 1000))}`,
      `SUMMARY:${finalTitle}`,
      `DESCRIPTION:${cleanDescription}`,
      `CREATED:${formatDate(created)}`,
      `LAST-MODIFIED:${formatDate(updated)}`,
      'CLASS:PUBLIC',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    ];
    
    icsContent.push(...event);
  });

  icsContent.push('END:VCALENDAR');
  
  return icsContent.join('\r\n');
}

// 获取标签ID
async function getTagId(tagName: string, env: any): Promise<number | null> {
  try {
    const response = await fetch(`${env.BLINKO_API_BASE}/note/list`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.BLINKO_TOKEN}`
      },
      body: JSON.stringify({
        page: 1,
        size: 1000,
        tagId: null,
        searchText: '',
        orderBy: 'desc',
        type: 2,
        isArchived: false,
        isShare: null,
        isRecycle: false,
        withoutTag: false,
        withFile: false,
        withLink: false,
        isUseAiQuery: false,
        startDate: null,
        endDate: null,
        hasTodo: true
      })
    });

    if (response.ok) {
      const allNotes = await response.json();
      const tagMap = new Map<string, number>();
      
      allNotes.forEach((note: any) => {
        if (note.tags && Array.isArray(note.tags)) {
          note.tags.forEach((tagItem: any) => {
            if (tagItem.tag && tagItem.tag.name) {
              const tagNameFromNote = tagItem.tag.name;
              if (tagNameFromNote === tagName) {
                tagMap.set(tagNameFromNote, tagItem.tag.id);
              }
            }
          });
        }
      });
      
      return tagMap.get(tagName) || null;
    }
  } catch (error) {
    console.error('Error finding tag ID:', error);
  }
  
  return null;
}

// 获取Todo列表
async function fetchTodos(config: any, env: any): Promise<any[]> {
  let tagId = null;
  
  if (config.tagName) {
    tagId = await getTagId(config.tagName, env);
  }

  const response = await fetch(`${env.BLINKO_API_BASE}/note/list`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.BLINKO_TOKEN}`
    },
    body: JSON.stringify({
      page: 1,
      size: config.size,
      tagId,
      searchText: config.searchText || '',
      orderBy: 'desc',
      type: 2,
      isArchived: false,
      isShare: null,
      isRecycle: false,
      withoutTag: false,
      withFile: false,
      withLink: false,
      isUseAiQuery: false,
      startDate: null,
      endDate: null,
      hasTodo: true
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch todos: ${response.statusText}`);
  }

  return await response.json();
}

// 保存ICS文件到KV存储
async function saveICSFile(icsContent: string, filename: string, env: any): Promise<void> {
  const metadata = {
    lastUpdated: new Date().toISOString(),
    size: icsContent.length,
    filename
  };
  
  await env.KV_NAMESPACE.put(filename, icsContent, {
    metadata,
    expirationTtl: 86400 // 24小时过期
  });
}

// 自动同步任务
async function autoSync(env: any): Promise<void> {
  const syncConfigs = [
    {
      calendarName: 'Todo',
      size: 100
    }
  ];

  const results = [];

  for (const config of syncConfigs) {
    try {
      console.log(`Syncing calendar: ${config.calendarName}`);
      
      const todos = await fetchTodos(config, env);
      const icsContent = generateICSContent(todos, config.calendarName);
      
      const filename = 'todo.ics';
      await saveICSFile(icsContent, filename, env);
      
      results.push({
        calendarName: config.calendarName,
        status: 'success',
        count: todos.length,
        filename
      });
      
      console.log(`✅ Synced ${todos.length} todos for ${config.calendarName}`);
    } catch (error) {
      console.error(`❌ Failed to sync ${config.calendarName}:`, error);
      results.push({
        calendarName: config.calendarName,
        status: 'error',
        error: error.message
      });
    }
  }

  // 保存同步结果
  await env.KV_NAMESPACE.put('sync-results', JSON.stringify({
    lastSync: new Date().toISOString(),
    results
  }));
}

// 处理HTTP请求
async function handleRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // API 路由
    if (path.startsWith('/api/')) {
      return await handleAPIRequest(request, env);
    }

    // 静态文件服务
    if (path.endsWith('.ics')) {
      return await handleICSFile(request, env);
    }

    // 默认返回404
    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// 处理API请求
async function handleAPIRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/test' && request.method === 'GET') {
    // 测试端点 - 检查环境变量和API连接
    try {
      const testResponse: any = {
        hasToken: !!env.BLINKO_TOKEN,
        tokenStart: env.BLINKO_TOKEN ? env.BLINKO_TOKEN.substring(0, 10) + '...' : 'not set',
        apiBase: env.BLINKO_API_BASE || 'not set',
        syncInterval: env.SYNC_INTERVAL || 'not set'
      };
      
      // 测试简单的 fetch
      try {
        const response = await fetch(`${env.BLINKO_API_BASE}/note/list`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.BLINKO_TOKEN}`
          },
          body: JSON.stringify({
            page: 1,
            size: 5,
            tagId: null,
            searchText: '',
            orderBy: 'desc',
            type: 2,
            isArchived: false,
            isShare: null,
            isRecycle: false,
            withoutTag: false,
            withFile: false,
            withLink: false,
            isUseAiQuery: false,
            startDate: null,
            endDate: null,
            hasTodo: true
          })
        });
        
        testResponse.apiStatus = response.status;
        testResponse.apiStatusText = response.statusText;
        
        if (response.ok) {
          const data = await response.json();
          testResponse.dataCount = data.length || 0;
          testResponse.sampleData = data.slice(0, 1);
        } else {
          const errorText = await response.text();
          testResponse.errorDetails = errorText;
        }
      } catch (fetchError) {
        testResponse.fetchError = fetchError.message;
      }
      
      return new Response(JSON.stringify(testResponse, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  if (path === '/api/sync' && request.method === 'POST') {
    // 手动触发同步
    const body = await request.json();
    const { config } = body;
    
    if (config) {
      const todos = await fetchTodos(config, env);
      const icsContent = generateICSContent(todos, config.calendarName);
      
      // 保存到 KV 存储
      const filename = 'todo.ics';
      await saveICSFile(icsContent, filename, env);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'File generated successfully',
        filename,
        count: todos.length
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  if (path === '/api/status' && request.method === 'GET') {
    // 获取同步状态
    const syncResults = await env.KV_NAMESPACE.get('sync-results');
    const status = syncResults ? JSON.parse(syncResults) : null;
    
    return new Response(JSON.stringify({
      status: 'running',
      lastSync: status?.lastSync,
      results: status?.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (path === '/api/calendars' && request.method === 'GET') {
    // 获取可用的日历文件列表
    const keys = await env.KV_NAMESPACE.list();
    const calendars = [];
    
    for (const key of keys.keys) {
      if (key.name.endsWith('.ics')) {
        const metadata = key.metadata as any;
        calendars.push({
          name: key.name,
          lastUpdated: metadata?.lastUpdated,
          size: metadata?.size
        });
      }
    }
    
    return new Response(JSON.stringify(calendars), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response('Not Found', { status: 404 });
}

// 处理ICS文件请求
async function handleICSFile(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const filename = url.pathname.substring(1); // 移除开头的 /
  
  const icsContent = await env.KV_NAMESPACE.get(filename);
  
  if (!icsContent) {
    return new Response('File not found', { status: 404 });
  }
  
  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600', // 1小时缓存
    },
  });
}

// Worker 入口点
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    return handleRequest(request, env);
  },

  // 定时任务 - 每小时执行一次
  async scheduled(event: any, env: any, ctx: any): Promise<void> {
    console.log('Starting scheduled sync...');
    await autoSync(env);
    console.log('Scheduled sync completed');
  },
}; 
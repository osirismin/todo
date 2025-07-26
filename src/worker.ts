/**
 * Cloudflare Worker for Blinko ICS Calendar Auto Sync
 */

// 东八区时间处理工具函数
class CSTTimeHandler {
  // 东八区偏移量（8小时，单位毫秒）
  static CST_OFFSET = 8 * 60 * 60 * 1000;
  
  // 创建东八区时间
  static createCSTTime(year?: number, month?: number, day?: number, hour?: number, minute?: number): Date {
    const now = new Date();
    const cstNow = new Date(now.getTime() + CSTTimeHandler.CST_OFFSET);
    
    const cstYear = year ?? cstNow.getUTCFullYear();
    const cstMonth = month ?? cstNow.getUTCMonth();
    const cstDay = day ?? cstNow.getUTCDate();
    const cstHour = hour ?? cstNow.getUTCHours();
    const cstMinute = minute ?? cstNow.getUTCMinutes();
    
    // 创建UTC时间，然后减去8小时偏移量来得到正确的UTC时间
    // 这样当转换为本地时间时，会显示为东八区时间
    const utcTime = new Date(Date.UTC(cstYear, cstMonth, cstDay, cstHour, cstMinute));
    return new Date(utcTime.getTime() - CSTTimeHandler.CST_OFFSET);
  }
  
  // 将任意时间转换为东八区时间基准
  static toCSTTime(date: Date): Date {
    // 获取当前日期的年月日
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    // 按东八区处理这个时间
    return CSTTimeHandler.createCSTTime(year, month, day, hour, minute);
  }
  
  // 解析时间字符串为东八区时间（基于给定日期）
  static parseTimeInCST(timeString: string, baseDate: Date): Date {
    const [hour, minute] = timeString.split(':').map(Number);
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const baseDay = baseDate.getDate();
    
    return CSTTimeHandler.createCSTTime(baseYear, baseMonth, baseDay, hour, minute);
  }
  
  // 解析日期时间字符串为东八区时间
  static parseDateTimeInCST(year: number, month: number, day: number, hour: number, minute: number): Date {
    return CSTTimeHandler.createCSTTime(year, month - 1, day, hour, minute); // month - 1 因为Date构造函数月份从0开始
  }
  
  // 获取当前东八区时间
  static now(): Date {
    return CSTTimeHandler.createCSTTime();
  }
}

// 生成ICS文件内容
function generateICSContent(todos: any[], calendarName: string = 'Blinko Todos'): string {
  const now = CSTTimeHandler.now();
  
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
    
    // 处理创建时间和更新时间，转换为东八区基准
    const originalCreated = new Date(todo.createdAt || todo.updatedAt || now.toISOString());
    const originalUpdated = new Date(todo.updatedAt || todo.createdAt || now.toISOString());
    const created = CSTTimeHandler.toCSTTime(originalCreated);
    const updated = CSTTimeHandler.toCSTTime(originalUpdated);
    
    // 格式化日期为ICS格式 - 使用带时区信息的格式
    const formatDateWithTimezone = (date: Date) => {
      // 为了正确表示东八区时间，我们需要调整到东八区再格式化
      const cstDate = new Date(date.getTime() + CSTTimeHandler.CST_OFFSET);
      return cstDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    // 解析 todo 的时间信息
    // 优先检查 API 返回的 startDate 和 endDate 字段
    let startTime = created; // 默认使用创建时间
    let endTime = new Date(created.getTime() + 60 * 60 * 1000); // 默认1小时
    let timeSource = 'default';
    
    // 首先检查 API 返回的时间字段
    // 检查直接的 startDate/endDate 字段
    if (todo.startDate) {
      startTime = CSTTimeHandler.toCSTTime(new Date(todo.startDate));
      timeSource = 'api_startDate';
    }
    
    if (todo.endDate) {
      endTime = CSTTimeHandler.toCSTTime(new Date(todo.endDate));
      if (timeSource === 'api_startDate') {
        timeSource = 'api_both';
      } else {
        timeSource = 'api_endDate';
      }
    }
    
    // 检查 metadata 字段中的时间信息
    if (todo.metadata && typeof todo.metadata === 'object') {
      if (todo.metadata.startDate) {
        startTime = CSTTimeHandler.toCSTTime(new Date(todo.metadata.startDate));
        timeSource = timeSource === 'default' ? 'metadata_startDate' : 'metadata_both';
      }
      
      if (todo.metadata.endDate) {
        endTime = CSTTimeHandler.toCSTTime(new Date(todo.metadata.endDate));
        if (timeSource === 'metadata_startDate') {
          timeSource = 'metadata_both';
        } else if (timeSource === 'default') {
          timeSource = 'metadata_endDate';
        }
      }
    }
    
    // 如果没有 API 字段，则从内容中解析时间信息
    if (timeSource === 'default') {
      // 尝试从内容中解析时间格式，如：
      // "* [ ] 9:00-10:00 会议"
      // "* [ ] 2024-01-15 14:00 任务"
      // "* [ ] 明天10点 开会"
      
      // 检查是否有时间范围 (如 9:00-10:00)
      const timeRangeMatch = rawContent.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
      if (timeRangeMatch) {
        const [, startHour, startMin, endHour, endMin] = timeRangeMatch;
        
        // 使用东八区时间解析
        startTime = CSTTimeHandler.parseTimeInCST(`${startHour}:${startMin}`, created);
        endTime = CSTTimeHandler.parseTimeInCST(`${endHour}:${endMin}`, created);
        
        // 如果结束时间小于开始时间，假设是第二天
        if (endTime <= startTime) {
          endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        }
        timeSource = 'content_time_range';
      } else {
        // 检查是否有单独的时间 (如 14:00)
        const singleTimeMatch = rawContent.match(/(\d{1,2}):(\d{2})/);
        if (singleTimeMatch) {
          const [, hour, min] = singleTimeMatch;
          
          // 使用东八区时间解析
          startTime = CSTTimeHandler.parseTimeInCST(`${hour}:${min}`, created);
          
          // 默认持续1小时
          endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
          timeSource = 'content_single_time';
        } else {
          // 检查日期时间格式
          const dateTimeMatch = rawContent.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
          if (dateTimeMatch) {
            const [, year, month, day, hour, min] = dateTimeMatch;
            
            // 使用东八区时间解析
            startTime = CSTTimeHandler.parseDateTimeInCST(
              parseInt(year),
              parseInt(month),
              parseInt(day),
              parseInt(hour),
              parseInt(min)
            );
            
            // 默认持续1小时
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
            timeSource = 'content_date_time';
          }
        }
      }
    }
    
    // 确保时间有效且结束时间不早于开始时间
    if (!startTime || isNaN(startTime.getTime())) {
      startTime = created;
    }
    if (!endTime || isNaN(endTime.getTime()) || endTime <= startTime) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }
    
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
      `DTSTAMP:${formatDateWithTimezone(now)}`,
      `DTSTART:${formatDateWithTimezone(startTime)}`,
      `DTEND:${formatDateWithTimezone(endTime)}`,
      `SUMMARY:${finalTitle}`,
      `DESCRIPTION:${cleanDescription}\\n\\n时间来源: ${timeSource}\\n创建时间: ${created.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      `CREATED:${formatDateWithTimezone(created)}`,
      `LAST-MODIFIED:${formatDateWithTimezone(updated)}`,
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

  if (path === '/api/status' && request.method === 'GET') {
    // 基本状态检查
    const syncResults = await env.KV_NAMESPACE.get('sync-results');
    const status = syncResults ? JSON.parse(syncResults) : null;
    
    return new Response(JSON.stringify({
      status: 'running',
      hasToken: !!env.BLINKO_TOKEN,
      apiBase: env.BLINKO_API_BASE || 'not set',
      lastSync: status?.lastSync,
      results: status?.results || []
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
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
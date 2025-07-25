import { NextResponse } from 'next/server';

// 强制动态渲染
export const dynamic = 'force-dynamic';

const BLINKO_API_BASE = 'https://blinko.folio.cool/api/v1';
const BLINKO_TOKEN = process.env.BLINKO_TOKEN || process.env.NEXT_PUBLIC_BLINKO_TOKEN;

// 验证令牌格式
function validateToken(token: string | undefined): boolean {
  if (!token) return false;
  // 检查令牌是否为空或undefined
  if (token === 'undefined' || token === 'null') return false;
  // 检查令牌格式（应该是JWT格式）
  if (!token.includes('.')) return false;
  return true;
}

export async function GET(request: Request) {
  try {
    if (!BLINKO_TOKEN) {
      console.error('Blinko token is not defined');
      return NextResponse.json(
        { error: 'Blinko token is not configured' },
        { status: 500 }
      );
    }

    if (!validateToken(BLINKO_TOKEN)) {
      console.error('Invalid Blinko token format');
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const size = searchParams.get('size') || '30';
    const tagId = searchParams.get('tagId');
    const tagName = searchParams.get('tagName');
    const searchText = searchParams.get('searchText') || '';

    // 如果有标签名称，先获取对应的标签ID
    let finalTagId = tagId ? parseInt(tagId) : null;
    
    if (tagName && !finalTagId) {
      try {
        // 获取所有标签来查找对应的ID
        const tagsResponse = await fetch(`${BLINKO_API_BASE}/note/list`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BLINKO_TOKEN}`
          },
          body: JSON.stringify({
            page: 1,
            size: 1000,
            tagId: null,
            searchText: '',
            orderBy: 'desc',
            type: 0, // 只获取闪念类型的标签
            isArchived: false,
            isShare: null,
            isRecycle: false,
            withoutTag: false,
            withFile: false,
            withLink: false,
            isUseAiQuery: false,
            startDate: null,
            endDate: null,
            hasTodo: false
          })
        });

        if (tagsResponse.ok) {
          const allNotes = await tagsResponse.json();
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
          
          if (tagMap.has(tagName)) {
            finalTagId = tagMap.get(tagName) || null;
          }
        }
      } catch (error) {
        console.error('Error finding tag ID:', error);
      }
    }

    console.log('Making request to Blinko API with token:', BLINKO_TOKEN.substring(0, 10) + '...');
    console.log('Request URL:', `${BLINKO_API_BASE}/note/list`);

    const response = await fetch(`${BLINKO_API_BASE}/note/list`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BLINKO_TOKEN}`
      },
      body: JSON.stringify({
        page: parseInt(page),
        size: parseInt(size),
        tagId: finalTagId,
        searchText,
        orderBy: 'desc',
        type: 2, // 只获取TODO类型
        isArchived: false,
        isShare: null,
        isRecycle: false,
        withoutTag: false,
        withFile: false,
        withLink: false,
        isUseAiQuery: false,
        startDate: null,
        endDate: null,
        hasTodo: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Blinko API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        headers: Object.fromEntries(response.headers.entries())
      });
      return NextResponse.json(
        { error: errorData?.message || `Failed to fetch notes: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // 添加缓存头
    const responseHeaders = new Headers();
    responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    responseHeaders.set('Content-Type', 'application/json');
    
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 检查验证状态
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const verified = cookieStore.get('blinko_verified');
    
    if (verified?.value !== 'true') {
      return NextResponse.json(
        { error: '请先验证密码' },
        { status: 401 }
      );
    }

    if (!BLINKO_TOKEN) {
      console.error('Blinko token is not defined');
      return NextResponse.json(
        { error: 'Blinko token is not configured' },
        { status: 500 }
      );
    }

    if (!validateToken(BLINKO_TOKEN)) {
      console.error('Invalid Blinko token format');
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, type = 0 } = body;

    console.log('Making request to Blinko API with token:', BLINKO_TOKEN.substring(0, 10) + '...');
    console.log('Request URL:', `${BLINKO_API_BASE}/note/upsert`);

    const response = await fetch(`${BLINKO_API_BASE}/note/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BLINKO_TOKEN}`
      },
      body: JSON.stringify({
        content,
        type
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Blinko API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        headers: Object.fromEntries(response.headers.entries())
      });
      return NextResponse.json(
        { error: errorData?.message || `Failed to create note: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
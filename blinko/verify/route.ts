import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 强制动态渲染
export const dynamic = 'force-dynamic';

const BLINKO_PASSWORD = process.env.BLINKO_PASSWORD; // 使用服务端环境变量

export async function POST(request: Request) {
  try {
    if (!BLINKO_PASSWORD) {
      return NextResponse.json(
        { error: 'Password not configured' },
        { status: 500 }
      );
    }

    const { password } = await request.json();

    if (password === BLINKO_PASSWORD) {
      // 设置有效期为24小时的验证状态
      const response = NextResponse.json({ success: true });
      response.cookies.set('blinko_verified', 'true', {
        maxAge: 24 * 60 * 60, // 24小时
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      return response;
    } else {
      return NextResponse.json(
        { error: '密码错误，请重试' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Password verification error:', error);
    return NextResponse.json(
      { error: '验证失败，请重试' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const verified = cookieStore.get('blinko_verified');
    
    return NextResponse.json({ 
      verified: verified?.value === 'true' 
    });
  } catch (error) {
    return NextResponse.json({ verified: false });
  }
} 
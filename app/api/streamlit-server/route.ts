import { NextRequest, NextResponse } from 'next/server';

/**
 * Excel Uploader Server Control API
 * Electron 앱에서만 사용 가능 - 브라우저에서는 작동하지 않음
 */

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    // 이 API는 더 이상 직접 사용되지 않습니다
    // Electron IPC를 사용하도록 클라이언트 코드를 수정해야 합니다
    return NextResponse.json({
      success: false,
      message: 'Excel Uploader는 Electron 앱에서만 실행 가능합니다.',
      requiresElectron: true
    });

  } catch (error) {
    console.error('Streamlit server control error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    running: false,
    message: 'Use Electron IPC to control Excel Uploader'
  });
}

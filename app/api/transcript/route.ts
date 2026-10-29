import { NextRequest, NextResponse } from 'next/server';
import { getVideoTranscript } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  try {
    const transcript = await getVideoTranscript(videoId);
    
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not available' }, { status: 404 });
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('[Transcript API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

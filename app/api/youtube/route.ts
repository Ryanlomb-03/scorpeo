import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, getVideoInfo, getVideoTranscript, formatDuration } from '@/lib/youtube';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Get video info
    const videoInfo = await getVideoInfo(videoId);

    if (!videoInfo) {
      return NextResponse.json({ error: 'Failed to fetch video info' }, { status: 404 });
    }

    // Get transcript
    const transcript = await getVideoTranscript(videoId);

    return NextResponse.json({
      video: {
        ...videoInfo,
        duration: formatDuration(videoInfo.duration),
      },
      transcript: transcript,
    });
  } catch (error) {
    console.error('YouTube API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * YouTube API Integration
 * Handles video info retrieval and caption extraction with timestamps
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '';
const YOUTUBE_TRANSCRIPT_API_KEY = process.env.YOUTUBE_TRANSCRIPT_API_KEY || '';

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface CaptionSegment {
  text: string;
  start: number;
  duration: number;
}

export interface YouTubeCaptionTrack {
  language: string;
  name: string;
  segments: CaptionSegment[];
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Direct video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

/**
 * Get video details from YouTube Data API v3
 */
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      console.error('YouTube API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    const video = data.items[0];
    const snippet = video.snippet || {};
    const statistics = video.statistics || {};

    return {
      id: video.id,
      title: snippet.title || '',
      description: snippet.description || '',
      channelTitle: snippet.channelTitle || '',
      publishedAt: snippet.publishedAt || '',
      thumbnail: snippet.thumbnails?.standard?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      duration: video.contentDetails?.duration || '',
      viewCount: parseInt(statistics.viewCount || '0'),
      likeCount: parseInt(statistics.likeCount || '0'),
      commentCount: parseInt(statistics.commentCount || '0'),
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    return null;
  }
}

/**
 * Fetch transcript using YouTube Transcript API
 * Returns transcript as Markdown with timestamps
 */
export async function getVideoTranscript(videoId: string): Promise<string | null> {
  if (!YOUTUBE_TRANSCRIPT_API_KEY) {
    console.error('YouTube Transcript API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://youtube-transcript.ai/transcript/${videoId}.txt`,
      {
        headers: {
          'Authorization': `Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}`
        }
      }
    );

    if (response.status === 401) {
      console.error('[YouTube Transcript API] Key not recognized');
      return null;
    }

    if (response.status === 429) {
      console.error('[YouTube Transcript API] Daily quota used up');
      return null;
    }

    if (!response.ok) {
      console.error('[YouTube Transcript API] Error:', response.status, response.statusText);
      return null;
    }

    const transcript = await response.text();
    console.log('[YouTube Transcript API] Successfully fetched transcript, length:', transcript.length);
    return transcript;
  } catch (error) {
    console.error('[YouTube Transcript API] Error fetching transcript:', error);
    return null;
  }
}

/**
 * Fallback: Fetch transcript/captions for a video via YouTube Data API
 * Note: YouTube Data API v3 requires OAuth for caption download
 */
export async function getVideoTranscriptFallback(videoId: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) {
    console.error('YouTube API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      console.error('YouTube Captions API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log('[YouTube] No captions available for this video');
      return null;
    }

    const caption = data.items.find((item: any) => 
      item.snippet.language === 'en' || item.snippet.language === 'en-US' || item.snippet.trackKind === 'asr'
    );

    if (!caption) {
      console.log('[YouTube] No English captions found');
      return null;
    }

    console.log('[YouTube] Found caption track:', caption.id, caption.snippet.language);
    console.log('[YouTube] Caption download requires OAuth, using description instead');
    return null;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
}

/**
 * Convert duration string (PT4M15S) to human-readable format
 */
export function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return duration;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp to MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${secs}`;
  }
}

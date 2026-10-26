#!/usr/bin/env python3
"""
Fetch YouTube transcript using youtube-transcript-api
Usage: python fetch_transcript.py <video_id>
Output: JSON with transcript text
"""

import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Video ID required"}))
        sys.exit(1)
    
    video_id = sys.argv[1]
    
    try:
        # Fetch transcript (defaults to English)
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id, languages=['en', 'en-US'])
        
        # Format as plain text
        formatter = TextFormatter()
        text = formatter.format_transcript(transcript)
        
        # Output as JSON
        print(json.dumps({
            "success": True,
            "video_id": video_id,
            "transcript": text
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

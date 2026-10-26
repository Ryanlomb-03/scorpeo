from flask import Flask, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, VideoUnavailable
import re

app = Flask(__name__)

def extract_video_id(url_or_id):
    """Extract video ID from URL or return the ID if it's already an ID"""
    # If it's already just an ID (11 characters), return it
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    # Extract from various YouTube URL formats
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    return url_or_id

@app.route('/transcript', methods=['POST'])
def get_transcript():
    """Get transcript for a YouTube video"""
    try:
        data = request.get_json()
        if not data or 'video_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing video_id in request body'
            }), 400
        
        video_id = extract_video_id(data['video_id'])
        
        # Try to get transcript
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        
        # Combine transcript text
        transcript_text = ' '.join([entry['text'] for entry in transcript])
        
        return jsonify({
            'success': True,
            'transcript': transcript_text,
            'video_id': video_id
        })
        
    except NoTranscriptFound:
        return jsonify({
            'success': False,
            'error': 'No transcript found for this video'
        }), 404
    except VideoUnavailable:
        return jsonify({
            'success': False,
            'error': 'Video is unavailable'
        }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

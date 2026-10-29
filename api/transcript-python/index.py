from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Get video_id from query string
        from urllib.parse import urlparse, parse_qs
        query = urlparse(self.path).query
        params = parse_qs(query)
        video_id = params.get('video_id', [''])[0]
        
        if not video_id:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "video_id parameter is required"}).encode('utf-8'))
            return
        
        # Configure Webshare proxy
        # You can rotate through multiple proxies for better performance
        proxies = {
            "http": os.environ.get('WEBSHARE_PROXY', 'http://zwikfriw:u2tb6br6elmo@p.webshare.io:80/'),
            "https": os.environ.get('WEBSHARE_PROXY', 'http://zwikfriw:u2tb6br6elmo@p.webshare.io:80/')
        }

        try:
            # Fetch transcript with proxy
            transcript = YouTubeTranscriptApi.get_transcript(
                video_id, 
                proxies=proxies,
                languages=['en']
            )
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "transcript": transcript
            }).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": str(e)
            }).encode('utf-8'))

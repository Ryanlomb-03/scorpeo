# YouTube Transcript API

A simple Flask API that fetches YouTube video transcripts using the `youtube-transcript-api` library.

## Deployment Instructions

### 1. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Push this `railway-python` folder to a GitHub repository
4. Connect the repository to Railway
5. Railway will automatically detect it as a Python project and deploy it

### 2. Get the Railway URL

After deployment, Railway will provide a URL like:
```
https://your-app-name.up.railway.app
```

### 3. Update Vercel Environment Variables

Add this to your Vercel project environment variables:
```
RAILWAY_TRANSCRIPT_URL=https://your-app-name.up.railway.app
```

### 4. API Endpoints

**POST /transcript**
```json
{
  "video_id": "LJT4lCLCkCs"
}
```

Response:
```json
{
  "success": true,
  "transcript": "Full transcript text here...",
  "video_id": "LJT4lCLCkCs"
}
```

**GET /health**
Returns health status

## Local Development

```bash
pip install -r requirements.txt
python app.py
```

The API will be available at `http://localhost:5000`

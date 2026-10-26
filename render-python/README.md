# YouTube Transcript API

A simple Flask API that fetches YouTube video transcripts using the `youtube-transcript-api` library.

## Deployment Instructions for Render

### 1. Create a new repository
Create a new GitHub repository for just this `render-python` folder (e.g., `youtube-transcript-api`)

### 2. Deploy to Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select the repository you created
5. Configure:
   - **Name**: `youtube-transcript-api` (or any name you prefer)
   - **Environment**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
6. Click **"Create Web Service"**
7. Wait for deployment to complete (usually 2-3 minutes)

### 3. Get the Render URL

After deployment, Render will provide a URL like:
```
https://youtube-transcript-api.onrender.com
```

### 4. Update Vercel Environment Variables

Add this to your Vercel project environment variables:
```
RENDER_TRANSCRIPT_URL=https://youtube-transcript-api.onrender.com/transcript
```

### 5. API Endpoints

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

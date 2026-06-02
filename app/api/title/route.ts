import { NextResponse } from "next/server";

// Rotate through free API keys for redundancy and increased rate limits
const API_KEYS = [
  process.env.APIFREE_KEY_1 || "",
  process.env.APIFREE_KEY_2 || "",
  process.env.APIFREE_KEY_3 || "",
  process.env.APIFREE_KEY_4 || "",
  process.env.APIFREE_KEY_5 || "",
  process.env.APIFREE_KEY_6 || ""
].filter(key => key.length > 0);

// Helper to test if an API key is responsive with a quick "hi" check
async function testKeyResponsiveness(apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

    const res = await fetch("https://apifreellm.com/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        message: "hi",
        model: "apifreellm"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.response && data.response.length > 0;
    }
    return false;
  } catch (err) {
    console.error("Health check failed:", err);
    return false;
  }
}

// Helper to query apifreellm with automatic key rotation on 429
async function fetchWithKeyRotation(prompt: string): Promise<Response> {
  let lastErrorText = "";

  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];
    try {
      console.log(`Title generation testing Key ${i + 1}/${API_KEYS.length} responsiveness...`);
      
      // First test if the key is responsive with a quick "hi"
      const isResponsive = await testKeyResponsiveness(apiKey);
      if (!isResponsive) {
        console.warn(`Key ${i + 1} failed health check. Rotating to next key...`);
        continue;
      }

      console.log(`Key ${i + 1} is responsive. Sending title request...`);
      const res = await fetch("https://apifreellm.com/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          message: prompt,
          model: "apifreellm"
        }),
      });

      if (res.status === 429) {
        console.warn(`Key ${i + 1} rate limited (429). Rotating to next key...`);
        continue; // Immediately try the next key
      }

      if (res.ok) {
        return res;
      }

      lastErrorText = await res.text();
      console.warn(`Key ${i + 1} returned status ${res.status}: ${lastErrorText}`);
    } catch (err) {
      console.error(`Key ${i + 1} fetch exception:`, err);
    }
  }

  throw new Error(`All API keys exhausted or rate-limited. Last error: ${lastErrorText}`);
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ title: "New Chat" }, { status: 400 });
    }

    // Direct, highly specific, and language-accurate prompt
    const prompt = `Analyze this conversation opener and create a clean, descriptive 2-4 word title that captures the essence or intent. 
    
    CRITICAL RULES:
    1. The title MUST be in the same language as the conversation opener message (e.g. if the message is in Japanese, write the title in Japanese; if English, write in English).
    2. Capture the actual meaning directly. Do NOT append generic words like "Query", "Chat", "Discussion", "Topic", "Question", or "Conversation".
    3. Keep it natural and simple. Do NOT override greetings with abstract themes unless the opener actually asks for them.
    4. Return ONLY the clean title itself, with NO surrounding quotes, introductory text, punctuation, or explanations.
    
    Message: "${message}".`;

    let title = "";
    try {
      const res = await fetchWithKeyRotation(prompt);
      const data = await res.json();
      title = data.response || "";
    } catch (err) {
      console.error("Failed to generate title with key rotation:", err);
    }
    
    // Clean up title formatting
    title = title.replace(/^["'「」]|["'「」]$/g, '').trim();
    if (!title || title.length > 50) {
      title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
    }

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation route error:", error);
    return NextResponse.json({ title: "New Chat" }, { status: 500 });
  }
}

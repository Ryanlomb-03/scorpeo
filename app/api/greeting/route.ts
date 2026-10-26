import { NextResponse } from "next/server";
import { getLocalGreetingResponse, detectGreetingLanguage } from "@/lib/localGreetings";

const TOKEN_HARBOR_KEY = process.env.TOKEN_HARBOR_API_KEY || "thk_live_9AYcYHdOB5XRjybf3tDJlGw-EQ131vMYAb-JpTfZTk1Eg4EgvKE8Q2oc5WyqJnzO";
const TOKEN_HARBOR_URL = "https://tokenharbor.ai/v1/chat/completions";

const FAST_MODELS = [
  "deepseek-v4.1-flash:free",
  "deepseek-v4-flash:free",
  "mimo-v2.6-flash:free"
];

/**
 * Clean up generated greeting
 */
function cleanGreeting(raw: string): string {
  let g = raw.trim();
  g = g.replace(/^["'「」`*_#:\s]+|["'「」`*_#:\s.]+$/g, '').trim();
  g = g.split(/\r?\n/)[0].trim();
  return g;
}

/**
 * Dynamically generate a cool, casual greeting for any rare/unlisted language using Token Harbor
 */
async function generateRareLanguageGreeting(message: string): Promise<string | null> {
  if (!TOKEN_HARBOR_KEY) return null;

  for (const model of FAST_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(TOKEN_HARBOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TOKEN_HARBOR_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are Scorpeo, a friendly AI assistant. The user just said a greeting in their language. Respond with a very short, punchy, cool greeting (1 to 4 words max) in that exact same language, including a fun emoji (like 👋, 😄, ✨, 🚀, or 🤙). NEVER ask 'How can I help you?' or customer service questions. Return ONLY the greeting."
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 15,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = cleanGreeting(content);
          if (cleaned && cleaned.length <= 40) {
            return cleaned;
          }
        }
      }
    } catch {
      // Continue to next model on error/timeout
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ greeting: "Hey! 👋" });
    }

    const trimmed = message.trim();

    // 1. Check local dictionary first (instant 0ms response for 35+ top languages)
    const knownLang = detectGreetingLanguage(trimmed);
    if (knownLang) {
      const localResponse = getLocalGreetingResponse(trimmed);
      return NextResponse.json({ greeting: localResponse, source: "local", lang: knownLang });
    }

    // 2. If it's a short 1-4 word message in any of the world's 7,000+ languages
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 4 && trimmed.length <= 35) {
      const dynamicGreeting = await generateRareLanguageGreeting(trimmed);
      if (dynamicGreeting) {
        return NextResponse.json({ greeting: dynamicGreeting, source: "tokenharbor" });
      }
    }

    // Fallback to local rotating response
    const fallback = getLocalGreetingResponse(trimmed);
    return NextResponse.json({ greeting: fallback, source: "fallback" });

  } catch (error) {
    console.error("Greeting API error:", error);
    return NextResponse.json({ greeting: "Hey! 👋" });
  }
}

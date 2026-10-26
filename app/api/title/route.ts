import { NextResponse } from "next/server";

const TOKEN_HARBOR_KEY = process.env.TOKEN_HARBOR_API_KEY || "thk_live_9AYcYHdOB5XRjybf3tDJlGw-EQ131vMYAb-JpTfZTk1Eg4EgvKE8Q2oc5WyqJnzO";
const TOKEN_HARBOR_URL = "https://tokenharbor.ai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Models on Token Harbor to try in order of speed and quality
const TOKEN_HARBOR_MODELS = [
  "deepseek-v4.1-flash:free",
  "deepseek-v4-flash:free",
  "mimo-v2.6-flash:free",
  "mimo-v2.5:free"
];

/**
 * Fast greeting detection - returns simple greeting title if message is just a greeting
 */
function detectGreeting(message: string): string | null {
  const lower = message.trim().toLowerCase();
  const greetings = [
    /^hey$/,
    /^hi$/,
    /^hello$/,
    /^hi there$/,
    /^hey there$/,
    /^greetings$/,
    /^good morning$/,
    /^good afternoon$/,
    /^good evening$/,
    /^what'?s up$/,
    /^sup$/,
    /^yo$/,
    /^howdy$/,
  ];
  
  for (const pattern of greetings) {
    if (pattern.test(lower)) {
      // Return a simple, friendly greeting title
      if (lower === 'hey' || lower === 'hey there') return 'Friendly Hey';
      if (lower === 'hi' || lower === 'hi there') return 'Hi There';
      if (lower === 'hello') return 'Hello';
      if (lower === 'greetings') return 'Greetings';
      if (lower.includes('morning')) return 'Good Morning';
      if (lower.includes('afternoon')) return 'Good Afternoon';
      if (lower.includes('evening')) return 'Good Evening';
      if (lower.includes('up') || lower === 'sup') return "What's Up";
      if (lower === 'yo' || lower === 'howdy') return 'Hey There';
      return 'Greetings';
    }
  }
  return null;
}

/**
 * Clean up title formatting
 */
function cleanTitle(raw: string, fallback: string): string {
  let title = raw.trim();
  // Strip Markdown bold/italic, hashes, surrounding quotes and colons
  title = title.replace(/^["'「」`*_#:\s]+|["'「」`*_#:\s.]+$/g, '').trim();
  // Take only the first non-empty line
  title = title.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
  // Strip common label prefixes like "Title: " or "Topic: "
  title = title.replace(/^(Title|Topic|Subject):\s*/i, '').trim();

  if (!title || title.length > 50 || title.length < 2) {
    return fallback;
  }
  return title;
}

/**
 * Attempt to generate a short, perfect title using Token Harbor
 */
async function generateWithTokenHarbor(message: string): Promise<string | null> {
  if (!TOKEN_HARBOR_KEY) return null;

  for (const model of TOKEN_HARBOR_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
              content: "Generate a concise, specific 3-5 word title for this chat based on its actual technical or creative context. Never use generic fallback titles like 'Casual Conversation' or 'General Chat'. Focus on the core topic or specific subject matter introduced in the initial exchange. If the first message is purely a greeting without context (e.g., 'hey', 'hello', 'hi', 'good morning'), wait until the second message to generate a meaningful topic title, or extract the topic from the immediate follow-up context. Return ONLY the 3-5 word title, nothing else. No markdown, no quotes, no trailing punctuation."
            },
            {
              role: "user",
              content: message.slice(0, 500)
            }
          ],
          temperature: 0.3,
          max_tokens: 20,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const cleaned = cleanTitle(content, "");
        if (cleaned) {
          return cleaned;
        }
      }
    } catch {
      // Continue to next model on error/timeout
    }
  }

  return null;
}

export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = body?.message || "";

    if (!message) {
      return NextResponse.json({ title: "New Chat" }, { status: 400 });
    }

    // Fast greeting detection - no API call needed
    const greetingTitle = detectGreeting(message);
    if (greetingTitle) {
      return NextResponse.json({ title: greetingTitle, isGreeting: true });
    }

    const fallbackTitle = message.slice(0, 30) + (message.length > 30 ? "..." : "");

    // 1. Primary: Use Token Harbor for fast, smart, high-quality title generation
    const tokenHarborTitle = await generateWithTokenHarbor(message);
    if (tokenHarborTitle) {
      return NextResponse.json({ title: tokenHarborTitle, provider: "tokenharbor" });
    }

    // 2. Secondary fallback: Use Groq
    if (GROQ_API_KEY) {
      try {
        const systemPrompt = `Generate a concise, specific 3-5 word title for this chat based on its actual technical or creative context. Never use generic fallback titles like 'Casual Conversation' or 'General Chat'. Focus on the core topic or specific subject matter introduced in the initial exchange. Return ONLY the 3-5 word title, nothing else. No markdown, no quotes, no trailing punctuation.`;

        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Message: "${message.slice(0, 500)}"` }
            ],
            temperature: 0.3,
            max_tokens: 30,
            stream: false
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawTitle = data.choices?.[0]?.message?.content || "";
          const cleaned = cleanTitle(rawTitle, fallbackTitle);

          if (cleaned.length > 3 && cleaned !== message.slice(0, 30)) {
            return NextResponse.json({ title: cleaned, provider: "groq" });
          }
        }
      } catch (error) {
        console.error("Groq title generation error:", error);
      }
    }

    // 3. Final fallback: simple clean message truncation
    return NextResponse.json({ title: fallbackTitle });

  } catch (error) {
    console.error("Title generation route error:", error);
    const fallbackTitle = message ? (message.slice(0, 30) + (message.length > 30 ? "..." : "")) : "New Chat";
    return NextResponse.json({ title: fallbackTitle }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

// NVIDIA API for title generation
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ title: "New Chat" }, { status: 400 });
    }

    // Direct, highly specific, and language-accurate prompt
    const systemPrompt = `Analyze this conversation opener and create a clean, descriptive 2-4 word title that captures the essence or intent.

CRITICAL RULES:
1. The title MUST be in the same language as the conversation opener message (e.g. if the message is in Japanese, write the title in Japanese; if English, write in English).
2. Capture the actual meaning directly. Do NOT append generic words like "Query", "Chat", "Discussion", "Topic", "Question", or "Conversation".
3. Keep it natural and simple. Do NOT override greetings with abstract themes unless the opener actually asks for them.
4. Return ONLY the clean title itself, with NO surrounding quotes, introductory text, punctuation, or explanations.`;

    let title = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for titles

      const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: "minimaxai/minimax-m2.7",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Message: "${message}"` }
          ],
          temperature: 0.3,
          max_tokens: 50,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        title = data.choices[0]?.message?.content || "";
      }
    } catch (err) {
      console.error("Failed to generate title with NVIDIA API:", err);
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

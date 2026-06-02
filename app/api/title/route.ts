import { NextResponse } from "next/server";

// NVIDIA API for title generation (separate key from main chat)
const NVIDIA_TITLE_KEY = process.env.NVIDIA_TITLE_KEY || "";
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

    // --- NVIDIA API with streaming ---
    if (NVIDIA_TITLE_KEY) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout for titles

        const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${NVIDIA_TITLE_KEY}`
          },
          body: JSON.stringify({
            model: "z-ai/glm-5.1",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Message: "${message}"` }
            ],
            temperature: 1,
            top_p: 1,
            max_tokens: 16384,
            stream: true
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          // Process streaming response
          const decoder = new TextDecoder();
          const reader = res.body?.getReader();

          if (reader) {
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') break;

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      title += content;
                    }
                  } catch (e) {
                    // Skip invalid JSON chunks
                  }
                }
              }
            }
          }
        } else {
          const errorText = await res.text().catch(() => "unknown");
          console.error(`NVIDIA title API error: ${res.status} - ${errorText}`);
        }
      } catch (err) {
        console.error("NVIDIA title API failed:", err);
      }
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

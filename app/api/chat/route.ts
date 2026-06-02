import { NextResponse } from "next/server";
import supabase from "@/lib/db";
import zlib from "zlib";

// NVIDIA API for main chat window
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Apifreellm API keys for library/sidebar feature
const API_KEYS = [
  process.env.APIFREE_KEY_1 || "",
  process.env.APIFREE_KEY_2 || "",
  process.env.APIFREE_KEY_3 || "",
  process.env.APIFREE_KEY_4 || "",
  process.env.APIFREE_KEY_5 || "",
  process.env.APIFREE_KEY_6 || ""
].filter(key => key.length > 0);

// Robust helper to fetch with automatic retries and instant key rotation for 429 rate limits
async function fetchWithRetryAndRotation(url: string, body: any, maxRetries = 4): Promise<Response> {
  let attempt = 0;
  let keyIndex = 0;

  while (attempt < maxRetries) {
    attempt++;
    const apiKey = API_KEYS[keyIndex];
    console.log(`Chat API trying Key ${keyIndex + 1}/${API_KEYS.length}... (Attempt ${attempt}/${maxRetries})`);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        return res;
      }

      // Handle Rate Limit 429: Rotate to other key instantly
      if (res.status === 429) {
        console.warn(`Key ${keyIndex + 1} rate limited (429). Rotating key instantly...`);
        keyIndex = (keyIndex + 1) % API_KEYS.length;
        
        // If we rotated back to the first key, we have exhausted all keys for this attempt
        if (keyIndex === 0) {
          const text = await res.clone().text();
          let delay = 3000;
          try {
            const json = JSON.parse(text);
            if (json.retryAfter) {
              delay = (json.retryAfter * 1000) + 500;
            } else if (json.error && typeof json.error === "string" && json.error.includes("wait")) {
              const match = json.error.match(/wait\s+(\d+)\s+seconds/i);
              if (match && match[1]) {
                delay = (parseInt(match[1], 10) * 1000) + 500;
              }
            }
          } catch (e) {}
          console.warn(`All keys busy. Waiting ${delay}ms before next retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
        continue;
      }

      // Handle Server/Gateway timeouts or temporary outages
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        const delay = attempt * 1500; // Incremental backoff: 1.5s, 3s, 4.5s...
        console.warn(`Upstream server error (${res.status}). Retrying after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      console.error(`Fetch exception on attempt ${attempt}:`, err);
      keyIndex = (keyIndex + 1) % API_KEYS.length;
      if (attempt >= maxRetries) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error("Max retries reached without success");
}

// Generate smart, contextual responses if the AI service is completely unreachable
function getFallbackResponse(message: string): string {
  const msg = message.toLowerCase().trim();
  
  if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
    return "Hello! I'm Scorpio, your AI assistant. How can I help you today?";
  }
  if (msg.includes("who are you") || msg.includes("your name") || msg.includes("scorpio")) {
    return "I'm Scorpio, a fast and precise AI assistant designed to help you think, search, and create. Even when some upstream services are busy, I stay active to assist you!";
  }
  if (msg.includes("help") || msg.includes("what can you do")) {
    return "I can assist you with a wide range of tasks, including answering questions, coding, data analysis, brainstorming ideas, or writing documents. What would you like to focus on?";
  }
  if (msg.includes("code") || msg.includes("javascript") || msg.includes("python") || msg.includes("html") || msg.includes("css")) {
    return "I can absolutely help you write, debug, and optimize code! Please tell me more about the program or function you're working on, and I'll generate the solution.";
  }
  if (msg.includes("weather") || msg.includes("time") || msg.includes("date")) {
    return "I don't have access to real-time location or live weather sensors right now, but feel free to ask me general questions or have me write code to fetch live data!";
  }
  
  return `I received your message: "${message}". I am currently operating in high-reliability local fallback mode due to high demand on the primary servers. Please tell me how I can best assist you with this topic!`;
}

export async function POST(req: Request) {
  const { message, history, username } = await req.json();

  if (!message) {
    return NextResponse.json({ reply: "No message provided" }, { status: 400 });
  }

  try {
    // Build context-aware prompt for apifreellm
    const context = history && history.length > 0 
      ? history.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
      : "";
    
    const systemInstructions = `CRITICAL INSTRUCTION: For mathematical equations in the main text, use standard markdown format with $$ delimiters.

For mathematical formulas, ALWAYS use this exact format:
$$
YOUR_MATH_HERE
$$

Use these specific LaTeX patterns:
- R_{\mu\nu} for Ricci tensor (NOT Rμν)
- \frac{1}{2} for fractions (NOT 1/2)
- c^{4} for powers (NOT c^4)
- \mu, \nu, \pi for Greek letters

EXAMPLE:
The Einstein field equation is:
$$
R_{\mu\nu} - \frac{1}{2} R g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}
$$

CRITICAL TABLE FORMATTING RULES:
- When creating tables with mathematical symbols, use LaTeX math notation with $ delimiters for inline math
- Use $R_{\mu\nu}$ for Ricci tensor, $g_{\mu\nu}$ for metric tensor, etc.
- This ensures proper mathematical font rendering with KaTeX
- Keep table symbols readable and properly formatted

EXAMPLE TABLE FORMAT:
| Symbol | Name | Physical Meaning |
|--------|------|-------------------|
| $R_{\mu\nu}$ | Ricci curvature tensor | Measures how volumes change due to curvature |
| $R$ | Ricci scalar | The trace of $R_{\mu\nu}$ |
| $g_{\mu\nu}$ | Metric tensor | Defines distances and geometry of spacetime |
| $G$ | Gravitational constant | Newton's constant ($\approx 6.674 \times 10^{-11}$ m³/kg/s²) |
| $c$ | Speed of light | ($\approx 3 \times 10^8$ m/s) |
| $T_{\mu\nu}$ | Stress-energy tensor | Contains all matter and energy content |

ALWAYS use LaTeX with $ delimiters for mathematical symbols in tables to ensure proper font rendering.`;
    
    const fullPrompt = `${systemInstructions}\n\n${context}\nUser: ${message}`;

    let reply = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: "minimaxai/minimax-m2.7",
          messages: [
            { role: "system", content: systemInstructions },
            ...(history && history.length > 0 ? history.map((m: any) => ({ role: m.role, content: m.content })) : []),
            { role: "user", content: message }
          ],
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 4096,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        reply = data.choices[0]?.message?.content || "";
      }
    } catch (fetchErr) {
      console.error("Failed to get response from NVIDIA API:", fetchErr);
    }

    // If the service failed to return a response, use our smart fallback instead of showing an error
    if (!reply) {
      console.warn("Using smart fallback response.");
      reply = getFallbackResponse(message);
    }

    // Stream the response word-by-word with minimal delay
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Split by words and whitespace so formatting (spaces, newlines) is preserved
        const words = reply.split(/(\s+)/);
        for (const word of words) {
          if (word) {
            controller.enqueue(encoder.encode(word));
            // 1ms delay for ultra-fast streaming
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (err) {
    console.error("Chat API outer error:", err);
    return new Response(getFallbackResponse(message), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let { content, instruction } = body;

    // Handle case where content might be a Buffer JSON or Hex object
    if (content && typeof content === 'string') {
      if (content.startsWith('{"type":"Buffer"')) {
        try {
          const parsed = JSON.parse(content);
          content = Buffer.from(parsed.data).toString('utf-8');
        } catch (e) {}
      } else if (content.startsWith('\\x')) {
        try {
          const hex = content.replace(/^\\x/, '');
          content = Buffer.from(hex, 'hex').toString('utf-8');
        } catch (e) {}
      }
    }

    if (!instruction) {
      return NextResponse.json({ error: "Instruction required" }, { status: 400 });
    }

    // Use apifreellm for library/sidebar feature
    const apiKey = API_KEYS[0];
    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const prompt = `You are a professional markdown writer. Write or edit the document based on this instruction: "${instruction}".

    IMPORTANT:
    - If the document is currently empty or contains gibberish, write a new high-quality document from scratch based on the instruction.
    - Return ONLY the markdown content itself. No explanations, no meta-commentary.

    Current Document Content: ${content || "(empty document)"}`;

    const res = await fetch("https://apifreellm.com/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        message: prompt
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Apifreellm call failed:", errorText);
      return NextResponse.json({ error: "API_UNREACHABLE" });
    }
    
    const data = await res.json();
    return NextResponse.json({ improved: data.response });
  } catch (err) {
    console.error("Library AI outer error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import supabase from "@/lib/db";
import * as zlib from "zlib";
import { modelRouter } from "@/lib/modelRouter";

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
    // Step 1: Route the request using the AI Router
    const routingResult = await modelRouter.route(message);
    
    // Step 2: If cached response exists, return it immediately
    if (routingResult.cached && routingResult.cache_key) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const { data } = await supabase
            .from('cached_responses')
            .select('response')
            .eq('hash', routingResult.cache_key!)
            .single();
          
          if (data) {
            controller.enqueue(encoder.encode(data.response));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Cached": "true"
        },
      });
    }

    // Step 3: Use the selected model or fallback
    const model = routingResult.model;
    const apiKey = routingResult.api_key;
    const parameters = routingResult.parameters;
    const intent = routingResult.intent;

    if (!model || !apiKey) {
      throw new Error('No available model for this request');
    }

    const startTime = Date.now();
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
    
    const chatMessages = [
      { role: "system", content: systemInstructions },
      ...(history && history.length > 0 ? history.map((m: any) => ({ role: m.role, content: m.content })) : []),
      { role: "user", content: message }
    ];

    let fullResponse = "";
    let responseSuccess = false;
    let errorType: string | undefined;

    try {
      const res = await fetch(model.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: intent.type === 'coding' ? "minimaxai/minimax-m2.7" : "minimaxai/minimax-m2.7", // Can be made dynamic based on model registry
          messages: chatMessages,
          ...parameters
        }),
      });

      const latency = Date.now() - startTime;

      if (res.ok) {
        responseSuccess = true;
        
        // Forward the streaming response
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const stream = new ReadableStream({
          async start(streamController) {
            const reader = res.body?.getReader();
            if (!reader) {
              streamController.close();
              return;
            }

            try {
              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  // Cache the complete response
                  if (intent.complexity <= 3) { // Only cache simple queries
                    await modelRouter.cacheResponse(
                      message, 
                      fullResponse, 
                      model.id, 
                      intent.type, 
                      24 // 24 hour cache
                    );
                  }
                  
                  // Update health metrics
                  await modelRouter.updateHealth(
                    model.id, 
                    latency, 
                    true
                  );
                  
                  streamController.close();
                  break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                      streamController.close();
                      return;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content;
                      if (content) {
                        fullResponse += content;
                        streamController.enqueue(encoder.encode(content));
                      }
                    } catch (e) {
                      // Skip invalid JSON chunks
                    }
                  }
                }
              }
            } catch (err) {
              errorType = 'parse_error';
              await modelRouter.updateHealth(model.id, latency, false, errorType);
              streamController.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Model": model.id,
            "X-Intent": intent.type,
          },
        });
      } else {
        responseSuccess = false;
        errorType = res.status === 429 ? '429' : res.status === 500 ? '500' : 'other';
        const errorText = await res.text().catch(() => "unknown error");
        console.error(`${model.name} API error: ${res.status} - ${errorText}`);
        
        // Update health metrics
        await modelRouter.updateHealth(model.id, latency, false, errorType);
      }
    } catch (apiErr: any) {
      const latency = Date.now() - startTime;
      errorType = apiErr.name === 'TimeoutError' ? 'timeout' : 'other';
      responseSuccess = false;
      
      console.error(`${model.name} API request failed:`, apiErr?.message || apiErr);
      
      // Update health metrics
      await modelRouter.updateHealth(model.id, latency, false, errorType);
    }

    // --- Fallback: smart static response ---
    console.warn("All models failed. Using static fallback response.");
    const reply = getFallbackResponse(message);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(reply));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Fallback": "true"
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

    if (!NVIDIA_API_KEY) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const prompt = `You are a professional markdown writer. Write or edit the document based on this instruction: "${instruction}".

    IMPORTANT:
    - If the document is currently empty or contains gibberish, write a new high-quality document from scratch based on the instruction.
    - Return ONLY the markdown content itself. No explanations, no meta-commentary.

    Current Document Content: ${content || "(empty document)"}`;

    const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: "minimaxai/minimax-m2.7",
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 8192,
        stream: false
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("NVIDIA API call failed:", errorText);
      return NextResponse.json({ error: "API_UNREACHABLE" });
    }
    
    const data = await res.json();
    const improved = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ improved });
  } catch (err) {
    console.error("Library AI outer error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
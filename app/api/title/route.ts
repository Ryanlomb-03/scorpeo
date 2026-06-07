import { NextResponse } from "next/server";
import { modelRouter } from "@/lib/modelRouter";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ title: "New Chat" }, { status: 400 });
    }

    // Use AI Router to select the fastest model for title generation
    const routingResult = await modelRouter.route(message);
    
    if (routingResult.cached && routingResult.cache_key) {
      // Cache hit - return cached title from routing
      const title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
      return NextResponse.json({ title, cached: true });
    }

    const model = routingResult.model;
    const apiKey = routingResult.api_key;

    if (!model || !apiKey) {
      // Fallback to simple message truncation
      const title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
      return NextResponse.json({ title });
    }

    // Optimized prompt for fast title generation
    const systemPrompt = `Create a clean, descriptive 2-4 word title for this conversation opener. Return ONLY the title, no quotes or explanations. Same language as the message.`;

    // Fast parameters for title generation
    const titleParameters = {
      temperature: 0.3,           // Low temperature for consistency
      top_p: 0.8,               // Focused sampling
      max_tokens: 50,            // Very short - titles are brief
      stream: false              // No streaming needed for short titles
    };

    const startTime = Date.now();
    let errorType: string | undefined;

    try {
      const res = await fetch(model.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "minimaxai/minimax-m2.7", // Can be made dynamic based on model registry
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Message: "${message}"` }
          ],
          ...titleParameters
        }),
      });

      const latency = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        let title = data.choices?.[0]?.message?.content || "";

        // Clean up title formatting
        title = title.replace(/^["'「」]|["'「」]$/g, '').trim();
        
        // Enforce title length limits
        if (!title || title.length > 50) {
          title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
        }

        // Cache the title if it's a good one
        if (title.length > 3 && title !== message.slice(0, 30)) {
          await modelRouter.cacheResponse(message, title, model.id, 'title', 48); // 48 hour cache
        }

        // Update health metrics
        await modelRouter.updateHealth(model.id, latency, true);

        return NextResponse.json({ title });
      } else {
        errorType = res.status === 429 ? '429' : res.status === 500 ? '500' : 'other';
        console.error(`Model ${model.name} title API error: ${res.status}`);
        await modelRouter.updateHealth(model.id, latency, false, errorType);
      }
    } catch (apiErr: any) {
      const latency = Date.now() - startTime;
      errorType = apiErr.name === 'TimeoutError' ? 'timeout' : 'other';
      console.error(`${model.name} title API request failed:`, apiErr?.message);
      await modelRouter.updateHealth(model.id, latency, false, errorType);
    }

    // Fallback to simple message truncation
    const title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
    return NextResponse.json({ title });

  } catch (error) {
    console.error("Title generation route error:", error);
    const { message } = await req.json().catch(() => ({ message: '' }));
    const title = message.slice(0, 30) + (message.length > 30 ? "..." : "");
    return NextResponse.json({ title }, { status: 500 });
  }
}

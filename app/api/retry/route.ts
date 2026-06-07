import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";
import { modelRouter } from "@/lib/modelRouter";

export async function POST(req: Request) {
  try {
    const { messageId, conversationId } = await req.json();

    if (!messageId || !conversationId) {
      return NextResponse.json({ error: "messageId and conversationId required" }, { status:400 });
    }

    // Get the original user message
    const { data: originalMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!originalMessage) {
      return NextResponse.json({ error: "Original message not found" }, { status: 404 });
    }

    // Get conversation history up to this message
    const { data: previousMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .lt('created_at', originalMessage.created_at);

    // Get message versions to know the retry count
    const { data: versions } = await supabase
      .from('message_versions')
      .select('*')
      .eq('message_id', messageId)
      .order('version_number', { ascending: false });

    const retryCount = versions ? versions.length : 0;
    const currentVersion = (retryCount + 1);

    // Add randomness to parameters for natural variation
    const baseTemperature = 0.7;
    const baseTopP = 0.95;
    const randomTemp = (Math.random() * 0.2 - 0.1); // -0.1 to +0.1
    const randomTopP = (Math.random() * 0.1 - 0.05); // -0.05 to +0.05

    const diversityInstruction = `IMPORTANT: This is retry #${currentVersion} of the response. Generate a SUBSTANTIALLY different answer:

1. Use a COMPLETELY DIFFERENT organization or structure
2. Start with a different opening sentence or phrase
3. Use different examples, analogies, or explanations
4. Consider different perspectives or angles
5. Avoid repeating the same bullet points or numbered list structure
6. Try a different tone or style variation
7. Make the content fresh while maintaining accuracy

Previous response was version ${retryCount}. The user wants to see something new and different.`;

    // Use AI Router for model selection
    const routingResult = await modelRouter.route(originalMessage.content);
    const model = routingResult.model;
    const apiKey = routingResult.api_key;
    const intent = routingResult.intent;

    if (!model || !apiKey) {
      return NextResponse.json({ error: "No available model for retry" }, { status: 500 });
    }

    // Build message history with diversity instruction
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

${diversityInstruction}`;

    const chatMessages = [
      { role: "system", content: systemInstructions },
      ...(previousMessages && previousMessages.length > 0 
        ? previousMessages.map((m: any) => ({ role: m.role, content: m.content })) 
        : []
      ),
      { role: "user", content: originalMessage.content }
    ];

    // Randomized parameters for diversity
    const retryParameters = {
      temperature: Math.max(0.1, Math.min(1.0, baseTemperature + randomTemp)),
      top_p: Math.max(0.1, Math.min(1.0, baseTopP + randomTopP)),
      max_tokens: 8192,
      stream: true
    };

    const startTime = Date.now();
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
          model: "minimaxai/minimax-m2.7",
          messages: chatMessages,
          ...retryParameters
        }),
      });

      const latency = Date.now() - startTime;

      if (res.ok) {
        responseSuccess = true;
        
        // Stream response and collect full content
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
                  // Store the new version in database
                  if (fullResponse) {
                    await supabase.rpc('add_message_version', {
                      p_message_id: messageId,
                      p_content: fullResponse,
                      p_model_id: model.id,
                      p_temperature: retryParameters.temperature,
                      p_top_p: retryParameters.top_p
                    });
                  }
                  
                  // Update health metrics
                  await modelRouter.updateHealth(model.id, latency, true);
                  
                  streamController.close();
                  break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

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
            "X-Retry-Count": currentVersion.toString(),
            "X-Version": currentVersion.toString(),
            "X-Total-Versions": (currentVersion).toString()
          },
        });
      } else {
        responseSuccess = false;
        errorType = res.status === 429 ? '429' : res.status === 500 ? '500' : 'other';
        console.error(`Model ${model.name} retry API error: ${res.status}`);
        await modelRouter.updateHealth(model.id, latency, false, errorType);
      }
    } catch (apiErr: any) {
      const latency = Date.now() - startTime;
      errorType = apiErr.name === 'TimeoutError' ? 'timeout' : 'other';
      console.error(`${model.name} retry API request failed:`, apiErr?.message);
      await modelRouter.updateHealth(model.id, latency, false, errorType);
    }

    // Fallback response
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });

  } catch (error) {
    console.error("Retry API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to retrieve message versions
export async function GET(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    // Get message with all versions (returns TABLE format)
    const { data, error } = await supabase.rpc('get_message_with_versions', {
      p_message_id: messageId
    });

    if (error) {
      console.error("Error fetching message versions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the table data (should be array of objects)
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/retry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
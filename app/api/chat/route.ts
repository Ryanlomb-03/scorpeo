import { SCORPEO_CORE_PROMPT } from '../../../lib/scorpeoCorePrompt';
import { detectResponseMode, getModePrompt } from '../../../lib/responseModes';
import { retrieveKnowledge } from '../../../lib/knowledgeRetrieval';
import { classifyIntent } from '../../../lib/intentRouter';
import { fastIntentDetection, IntentPlan } from '@/lib/fastIntentDetection';
import { STUDY_METHODS_OPEN_TAG, STUDY_METHODS_CLOSE_TAG, TIMETABLE_OPEN_TAG, TIMETABLE_CLOSE_TAG, MATH_MATRIX_OPEN_TAG, MATH_MATRIX_CLOSE_TAG } from '@/types/artifacts';
import { trimPrompt, trimToTokenLimit } from '@/lib/promptTrimmer';
import { extractVideoId, getVideoInfo, formatDuration } from '@/lib/youtube';

interface Message {
  role: string;
  content: string;
}

interface WikiCardData {
  title: string;
  imageUrl?: string;
  description: string;
  extract: string;
  wikiUrl?: string;
}

export async function POST(req: Request) {
  const overallStart = Date.now();
  const { messages } = await req.json();
  const lastUserMessage = messages[messages.length - 1]?.content || "";
  
  // Detect YouTube URLs in the message
  const youtubeVideoId = extractVideoId(lastUserMessage);
  let youtubeVideoInfo = null;
  
  if (youtubeVideoId) {
    console.log('[Chat Route] YouTube video detected:', youtubeVideoId);
    youtubeVideoInfo = await getVideoInfo(youtubeVideoId);
    if (youtubeVideoInfo) {
      console.log('[Chat Route] YouTube video info fetched:', youtubeVideoInfo.title);
    }
  }

  // Route to appropriate handler based on content type
  if (youtubeVideoId && youtubeVideoInfo) {
    const transcript = body.transcript || null;
    return await handleYouTubeChat(req, messages, lastUserMessage, youtubeVideoInfo, overallStart, transcript);
  }
  
  return await handleNormalChat(req, messages, lastUserMessage, overallStart);
}

async function handleYouTubeChat(req: Request, messages: any[], lastUserMessage: string, youtubeVideoInfo: any, overallStart: number, transcript?: string) {
  // Use transcript provided by client (fetched via Pyodide to avoid IP blocking)
  // If no transcript provided, fall back to description
  if (!transcript) {
    console.log('[Chat Route] No transcript provided, using description');
    transcript = youtubeVideoInfo.description || '';
  } else {
    console.log('[Chat Route] Using transcript from client, length:', transcript.length);
  }

  // Build system prompt with transcript or description
  const description = youtubeVideoInfo.description || '';
  const cleanDescription = description
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\n+/g, '\n')
    .trim();
  
  let YOUTUBE_SYSTEM_PROMPT = `You are Scorpeo, a helpful AI assistant. The user shared a YouTube video and is asking you about it.

VIDEO INFORMATION:
Title: "${youtubeVideoInfo.title}"
Channel: ${youtubeVideoInfo.channelTitle}
Duration: ${formatDuration(youtubeVideoInfo.duration)}
Views: ${youtubeVideoInfo.viewCount.toLocaleString()}
Published: ${new Date(youtubeVideoInfo.publishedAt).toLocaleDateString()}`;

  if (transcript) {
    YOUTUBE_SYSTEM_PROMPT += `\n\nVIDEO TRANSCRIPT:\n${transcript.substring(0, 3000)}\n\nUse this transcript to answer the user's questions about what is being said in the video.`;
  } else {
    YOUTUBE_SYSTEM_PROMPT += `\n\nVIDEO DESCRIPTION:\n${cleanDescription.substring(0, 1200)}\n\nBased on the title and description, discuss what this video is about.`;
  }

  YOUTUBE_SYSTEM_PROMPT += `\n\nINSTRUCTIONS:
- The video player is visible to the user so they can watch it along with your response
- DO NOT say you can't access the video or that you don't know what's in it
- Use the transcript or metadata to provide helpful insights about the video's content
- If the user asks "what is he saying?" or "what's the video about?", use the transcript information above
- When discussing specific topics or key points, include timestamps in the format [MM:SS] (single timestamp, not ranges)
- Format your response as bullet points when listing multiple topics
- ALWAYS end your response with the YouTube URL: https://www.youtube.com/watch?v=${youtubeVideoInfo.id}
- Be conversational and helpful`;

  const SYSTEM_PROMPT: Message = {
    role: "system",
    content: YOUTUBE_SYSTEM_PROMPT
  };

  const payloadMessages = [SYSTEM_PROMPT, ...messages.slice(-1)];
  
  const groqModel = 'qwen/qwen3.8-27b';
  const maxTokens = 512;
  const temperature = 0.7;

  try {
    const { GroqProvider } = await import('../../../lib/ai/providers/groq');
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      console.error('[Chat Route] Groq API key not configured');
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
    }

    const groqProvider = new GroqProvider(groqApiKey);
    const abortController = new AbortController();

    const aiRequest = {
      messages: payloadMessages,
      model: groqModel,
      taskType: 'conversation' as any,
      capabilities: { chat: true, streaming: true } as any,
      temperature,
      maxTokens,
      stream: true,
      signal: abortController.signal,
    };

    console.log('[Chat Route] YouTube chat request config:', { model: groqModel, maxTokens, hasTranscript: !!transcript });

    return streamFromGroq(groqProvider, aiRequest, abortController, overallStart);
  } catch (error) {
    console.error('[Chat Route] YouTube chat error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), { status: 500 });
  }
}

async function handleNormalChat(req: Request, messages: any[], lastUserMessage: string, overallStart: number) {
  // Track fetched entities for deduplication
  const fetchedEntities = new Set<string>();

  // 0. Fast intent detection using Cloudflare Clef (runs before everything else)
  const intentStart = Date.now();
  
  // Extract conversation context for better routing
  const conversationContext = messages.slice(-3).map((m: Message) => m.content);
  
  // Skip Clef for simple requests to reduce latency
  let fastIntent;
  if (fastIntentDetection.shouldSkipClef(lastUserMessage, conversationContext)) {
    console.log('[Chat Route] Skipping Clef - using local fast path');
    fastIntent = fastIntentDetection.localDetect(lastUserMessage);
  } else {
    fastIntent = await fastIntentDetection.detect(lastUserMessage, conversationContext);
  }
  
  const intentEnd = Date.now();
  const intentPlan = fastIntent.plan;
  
  console.log(`[Chat Route] Timing - Intent Detection: ${intentEnd - intentStart}ms`);
  console.log(`[Chat Route] Fast Intent Detection:`, {
    intent: fastIntent.intent,
    suggestedArtifacts: fastIntent.suggestedArtifacts,
    confidence: fastIntent.confidence,
    shouldShowCard: fastIntent.shouldShowCard,
    knowledgeLevel: fastIntent.knowledgeLevel,
    plan: intentPlan ? {
      userIntent: intentPlan.userIntent,
      knowledgeStrategy: intentPlan.knowledgeStrategy,
      artifactIntent: intentPlan.artifactIntent,
      requiredTools: intentPlan.requiredTools,
      reason: intentPlan.reason
    } : null
  });

  // Build artifact instructions for the AI based on the intent plan
  let artifactInstructions = '';
  if (intentPlan && fastIntent.suggestedArtifacts.length > 0) {
    artifactInstructions = `\n\n[INTENT PLAN]\nUser Intent: ${intentPlan.userIntent}\nKnowledge Strategy: ${intentPlan.knowledgeStrategy}\nArtifact Intent: ${intentPlan.artifactIntent}\nRequired Tools: ${intentPlan.requiredTools.join(', ') || 'none'}\nReason: ${intentPlan.reason || ''}\n\n[ARTIFACT INSTRUCTIONS]\n${fastIntent.toolInstructions}`;
  } else if (fastIntent.suggestedArtifacts.length > 0) {
    artifactInstructions = `\n\n[ARTIFACT SUGGESTIONS]\n${fastIntent.toolInstructions}\nSuggested artifacts: ${fastIntent.suggestedArtifacts.join(', ')}`;
  }

  // 1. Classify intent to determine if knowledge retrieval is needed
  let intent;
  let knowledgeLevel;
  
  if (intentPlan) {
    const strategyToLevel: Record<string, number> = {
      'model_knowledge': 0,
      'retrieve_sources': 2,
      'tool_assisted': 1,
      'clarify': 0
    };
    knowledgeLevel = strategyToLevel[intentPlan.knowledgeStrategy] || 0;
    intent = {
      type: intentPlan.userIntent,
      confidence: intentPlan.confidence || 0.7,
      knowledgeLevel,
      shouldShowCard: fastIntent.shouldShowCard
    };
  } else {
    intent = classifyIntent(lastUserMessage);
    knowledgeLevel = intent.knowledgeLevel;
  }
  
  console.log(`[Chat Route] Final Intent:`, {
    type: intent.type,
    confidence: intent.confidence,
    knowledgeLevel,
    shouldShowCard: intent.shouldShowCard,
  });
  
  let wikiContext = "";
  let wikiCardData: WikiCardData | null = null;

  // Only retrieve knowledge if intent requires it (Level 1-3)
  if (intent.knowledgeLevel > 0) {
    const retrievalStart = Date.now();
    const retrieval = await retrieveKnowledge(lastUserMessage);
    const retrievalEnd = Date.now();
    
    console.log(`[Chat Route] Timing - Knowledge Retrieval: ${retrievalEnd - retrievalStart}ms`);
    
    if (retrieval.data && retrieval.shouldShowCard) {
      if (retrieval.source === 'wikipedia') {
        wikiCardData = {
          title: retrieval.data.title,
          imageUrl: retrieval.data.thumbnail || null,
          description: retrieval.data.description || "",
          extract: retrieval.data.extract,
          wikiUrl: retrieval.data.url,
        };
        wikiContext = `\n\n[WIKIPEDIA DATA FOR "${retrieval.data.title}"]:
Description: ${retrieval.data.description}
Summary: ${retrieval.data.extract}
Source: ${retrieval.data.url}`;
      } else if (retrieval.source === 'wikidata') {
        wikiCardData = {
          title: retrieval.data.label,
          description: retrieval.data.description || "Entity",
          extract: JSON.stringify(retrieval.data.claims, null, 2),
          wikiUrl: retrieval.data.url,
        };
        wikiContext = `\n\n[WIKIDATA DATA FOR "${retrieval.data.label}":
Description: ${retrieval.data.description}
Structured Data: ${JSON.stringify(retrieval.data.claims, null, 2)}
Source: ${retrieval.data.url}`;
      }
    }
  } else {
    console.log(`[Chat Route] No retrieval needed (Level 0 - model knowledge only)`);
  }

  // 3. Detect response mode
  const detectedMode = detectResponseMode(lastUserMessage);
  const modePrompt = detectedMode ? getModePrompt(detectedMode) : '';
  const modeInstruction = detectedMode 
    ? `\n\n[RESPONSE MODE: ${detectedMode.toUpperCase()}]\n${modePrompt}` 
    : '';

  // 4. Combine into master system prompt using Scorpeo Core
  let fullSystemPrompt = `${SCORPEO_CORE_PROMPT}

${artifactInstructions}${wikiContext}${modeInstruction}`;

  // Trim the system prompt to avoid 413 errors
  const trimmedPrompt = trimPrompt(fullSystemPrompt, 'aggressive');
  const finalSystemPrompt = trimToTokenLimit(trimmedPrompt.compressed, 3000);

  const SYSTEM_PROMPT: Message = {
    role: "system",
    content: finalSystemPrompt
  };

  const payloadMessages = [SYSTEM_PROMPT, ...messages.slice(-3)];

  // Use Groq for normal chat
  let groqModel = 'qwen/qwen3.8-27b';
  let maxTokens = 1024;
  let temperature = 0.7;
  let useNvidiaDirectly = false;

  if (fastIntent.knowledgeLevel > 1 || fastIntent.suggestedArtifacts.length > 0) {
    useNvidiaDirectly = true;
    maxTokens = 2048;
    temperature = 0.5;
  }

  try {
    const encoder = new TextEncoder();
    let streamClosed = false;
    let abortController: AbortController | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        const originalClose = controller.close.bind(controller);
        controller.close = () => {
          streamClosed = true;
          if (abortController) abortController.abort();
          originalClose();
        };

        if (wikiCardData) {
          const wikiPayload = JSON.stringify({ type: 'wiki_card', data: wikiCardData });
          if (!streamClosed) {
            controller.enqueue(encoder.encode(`[WIKI_CARD_START]${wikiPayload}[WIKI_CARD_END]`));
          }
        }

        try {
          if (useNvidiaDirectly) {
            const { NVIDIAProvider } = await import('../../../lib/ai/providers/nvidia');
            const nvidiaApiKey = process.env.NVIDIA_API_KEY;
            const nvidiaProvider = new NVIDIAProvider(nvidiaApiKey);
            abortController = new AbortController();

            const aiRequest = {
              messages: payloadMessages,
              model: 'minimaxai/minimax-m3.1-flash',
              taskType: 'conversation' as any,
              capabilities: { chat: true, streaming: true } as any,
              temperature,
              maxTokens,
              stream: true,
              signal: abortController.signal,
            };

            for await (const chunk of nvidiaProvider.stream(aiRequest)) {
              if (streamClosed) break;
              if (chunk.type === 'text' && chunk.content) {
                controller.enqueue(encoder.encode(chunk.content));
              }
            }
          } else {
            const { GroqProvider } = await import('../../../lib/ai/providers/groq');
            const groqApiKey = process.env.GROQ_API_KEY;
            const groqProvider = new GroqProvider(groqApiKey);
            abortController = new AbortController();

            const aiRequest = {
              messages: payloadMessages,
              model: groqModel,
              taskType: 'conversation' as any,
              capabilities: { chat: true, streaming: true } as any,
              temperature,
              maxTokens,
              stream: true,
              signal: abortController.signal,
            };

            console.log('[Chat Route] Groq request config:', { model: groqModel, maxTokens });

            for await (const chunk of groqProvider.stream(aiRequest)) {
              if (streamClosed) break;
              if (chunk.type === 'text' && chunk.content) {
                controller.enqueue(encoder.encode(chunk.content));
              }
            }
          }
        } catch (error) {
          console.error('[Chat Route] Stream error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error('[Chat Route] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

async function streamFromGroq(groqProvider: any, aiRequest: any, abortController: AbortController, overallStart: number) {
  const encoder = new TextEncoder();
  let streamClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const originalClose = controller.close.bind(controller);
      controller.close = () => {
        streamClosed = true;
        abortController.abort();
        originalClose();
      };

      try {
        for await (const chunk of groqProvider.stream(aiRequest)) {
          if (streamClosed) break;
          if (chunk.type === 'text' && chunk.content) {
            controller.enqueue(encoder.encode(chunk.content));
          }
        }
      } catch (error) {
        console.error('[Chat Route] Groq stream error:', error);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

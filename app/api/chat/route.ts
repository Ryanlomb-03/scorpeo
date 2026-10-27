import { SCORPEO_CORE_PROMPT } from '../../../lib/scorpeoCorePrompt';
import { detectResponseMode, getModePrompt } from '../../../lib/responseModes';
import { retrieveKnowledge } from '../../../lib/knowledgeRetrieval';
import { classifyIntent } from '../../../lib/intentRouter';
import { fastIntentDetection, IntentPlan } from '@/lib/fastIntentDetection';
import { STUDY_METHODS_OPEN_TAG, STUDY_METHODS_CLOSE_TAG, TIMETABLE_OPEN_TAG, TIMETABLE_CLOSE_TAG, MATH_MATRIX_OPEN_TAG, MATH_MATRIX_CLOSE_TAG } from '@/types/artifacts';
import { trimPrompt, trimToTokenLimit } from '@/lib/promptTrimmer';
import { extractVideoId, getVideoInfo, formatDuration } from '@/lib/youtube';

// Extract word for dictionary lookup
function extractWordForDictionary(message: string): string | null {
  const lower = message.toLowerCase();
  
  // Patterns for dictionary queries
  const patterns = [
    /(?:pronounce|pronunciation|define|definition|meaning|synonym|antonym|etymology|spell)\s+(?:of\s+)?["'`]?([a-zA-Z]{2,})["'`]?/i,
    /(?:how do you say|how to pronounce)\s+(?:the word\s+)?["'`]?([a-zA-Z]{2,})["'`]?/i,
    /(?:what does|what's the meaning of)\s+(?:the word\s+)?["'`]?([a-zA-Z]{2,})["'`]?\s+mean/i,
    /(?:dictionary|lookup)\s+(?:for\s+)?["'`]?([a-zA-Z]{2,})["'`]?/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Check if message is just a single word
  if (/^[a-zA-Z]{2,}$/.test(message.trim())) {
    return message.trim();
  }
  
  return null;
}

// Extract news query
function extractNewsQuery(message: string): string | null {
  const lower = message.toLowerCase();
  
  // Very aggressive check - if ANY of these keywords are present, treat as news
  const newsKeywords = ['news', 'stories', 'headlines', 'latest', 'recent', 'today', 'technology', 'tech', 'ai', 'recent stories'];
  
  for (const keyword of newsKeywords) {
    if (lower.includes(keyword)) {
      // Extract topic after the keyword
      const index = lower.indexOf(keyword);
      const afterKeyword = message.substring(index + keyword.length).trim();
      // Remove filler words
      const topic = afterKeyword.replace(/^(about|on|in|for|the|a|an)\s+/i, '').trim();
      return topic || 'general';
    }
  }
  
  return null;
}

async function handleNewsChat(req: Request, messages: any[], lastUserMessage: string, query: string, overallStart: number) {
  const freeNewsApiKey = process.env.FREENEWSAPI_KEY;
  const guardianApiKey = process.env.GUARDIAN_API_KEY;
  
  if (!freeNewsApiKey && !guardianApiKey) {
    console.log('[Chat Route] No news API keys configured, proceeding with normal chat');
    return await handleNormalChat(req, messages, lastUserMessage, overallStart);
  }

  try {
    let newsInfo = `NEWS QUERY: ${query === 'general' ? 'Latest headlines' : query}\n\n`;
    let articlesFound = false;

    // Try Guardian API first (has full text, tags, and images)
    if (guardianApiKey) {
      try {
        console.log('[Chat Route] Fetching news from Guardian API:', query);
        let guardianUrl = `https://content.guardianapis.com/search?api-key=${guardianApiKey}&show-fields=trailText,thumbnail,bodyText,headline,byline&order-by=newest&page-size=5`;
        
        if (query !== 'general') {
          guardianUrl += `&q=${encodeURIComponent(query)}`;
        }
        
        const guardianResponse = await fetch(guardianUrl);
        if (guardianResponse.ok) {
          const guardianData = await guardianResponse.json();
          
          if (guardianData.response && guardianData.response.results && guardianData.response.results.length > 0) {
            newsInfo += `FOUND ${guardianData.response.results.length} ARTICLES FROM THE GUARDIAN:\n\n`;
            guardianData.response.results.forEach((article: any, index: number) => {
              newsInfo += `${index + 1}. ${article.webTitle}\n`;
              newsInfo += `   Publisher: The Guardian\n`;
              newsInfo += `   Published: ${new Date(article.webPublicationDate).toLocaleDateString()}\n`;
              newsInfo += `   URL: ${article.webUrl}\n`;
              
              if (article.fields && article.fields.thumbnail) {
                newsInfo += `   Image: ${article.fields.thumbnail}\n`;
              }
              
              if (article.fields && article.fields.trailText) {
                newsInfo += `   Summary: ${article.fields.trailText}\n`;
              }
              
              if (article.fields && article.fields.bodyText) {
                newsInfo += `   Full Text Available: Yes\n`;
              }
              
              newsInfo += `\n`;
            });
            articlesFound = true;
          }
        }
      } catch (guardianError) {
        console.log('[Chat Route] Guardian API failed, trying Free News API:', guardianError);
      }
    }

    // Fallback to Free News API if Guardian didn't return results
    if (!articlesFound && freeNewsApiKey) {
      try {
        console.log('[Chat Route] Fetching news from Free News API:', query);
        let apiUrl = `https://api.freenewsapi.io/v1/news?language=en&country=US&order_by=recent&offset=0`;
        
        if (query !== 'general') {
          apiUrl += `&in_title=${encodeURIComponent(query)}`;
        }
        
        const response = await fetch(apiUrl, {
          headers: {
            'x-api-key': freeNewsApiKey
          }
        });
        
        if (response.ok) {
          const newsData = await response.json();
          
          if (newsData.data && newsData.data.length > 0) {
            newsInfo += `FOUND ${newsData.data.length} ARTICLES:\n\n`;
            newsData.data.slice(0, 5).forEach((article: any, index: number) => {
              newsInfo += `${index + 1}. ${article.title}\n`;
              newsInfo += `   Publisher: ${article.publisher}\n`;
              newsInfo += `   Published: ${new Date(article.published_at).toLocaleDateString()}\n`;
              newsInfo += `   UUID: ${article.uuid}\n\n`;
            });
            articlesFound = true;
          }
        }
      } catch (freeNewsError) {
        console.log('[Chat Route] Free News API failed:', freeNewsError);
      }
    }

    if (!articlesFound) {
      newsInfo += 'No articles found matching your query.\n';
    }
    
    console.log('[Chat Route] News info fetched for:', query);
    
    // Build system prompt with news info
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const NEWS_SYSTEM_PROMPT = `You are Scorpeo, a helpful AI assistant. The user is asking about current news.

CURRENT DATE: ${currentDate}
CURRENT TIME: ${currentTime}

${newsInfo}

INSTRUCTIONS:
- Use the news information above to provide current news updates
- Summarize the key stories
- If the user asked about a specific topic, focus on relevant articles
- Provide context about what's happening
- Be conversational and helpful
- Mention the publication date and source for each story
- If article images are available, include them in your response using markdown image syntax: ![alt text](url)
- You can fetch full article details using the UUID or URL if needed`;

    const SYSTEM_PROMPT: Message = {
      role: "system",
      content: NEWS_SYSTEM_PROMPT
    };

    const payloadMessages = [SYSTEM_PROMPT, ...messages.slice(-1)];
    
    const groqModel = 'qwen/qwen3.8-27b';
    const temperature = 0.7;
    const maxTokens = 4096;

    const aiRequest = {
      model: groqModel,
      messages: payloadMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    console.log('[Chat Route] News chat request:', { query, model: groqModel });

    // Inline streaming (same as handleNormalChat)
    const { GroqProvider } = await import('../../../lib/ai/providers/groq');
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqProvider = new GroqProvider(groqApiKey);
    const abortController = new AbortController();
    
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
    console.error('[Chat Route] News chat error:', error);
    // Fallback to normal chat on error
    return await handleNormalChat(req, messages, lastUserMessage, overallStart);
  }
}

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
  const { messages, transcript, videoId } = await req.json();
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

  // Detect dictionary lookup queries
  const wordToLookup = extractWordForDictionary(lastUserMessage);
  if (wordToLookup) {
    console.log('[Chat Route] Dictionary lookup detected for word:', wordToLookup);
    return await handleDictionaryChat(req, messages, lastUserMessage, wordToLookup, overallStart);
  }

  // Detect news lookup queries - BEFORE YouTube to prioritize news
  const newsQuery = extractNewsQuery(lastUserMessage);
  console.log('[Chat Route] News query check:', { message: lastUserMessage, newsQuery });
  if (newsQuery) {
    console.log('[Chat Route] News lookup detected for query:', newsQuery);
    return await handleNewsChat(req, messages, lastUserMessage, newsQuery, overallStart);
  }

  // Route to appropriate handler based on content type
  if (youtubeVideoId && youtubeVideoInfo) {
    return await handleYouTubeChat(req, messages, lastUserMessage, youtubeVideoInfo, overallStart, transcript);
  }
  
  return await handleNormalChat(req, messages, lastUserMessage, overallStart);
}

async function handleDictionaryChat(req: Request, messages: any[], lastUserMessage: string, word: string, overallStart: number) {
  try {
    // Fetch word definition from Free Dictionary API
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      // If rate limited or error, proceed with normal chat but inform the AI
      console.log('[Chat Route] Dictionary API failed, proceeding with normal chat');
      return await handleNormalChat(req, messages, lastUserMessage, overallStart);
    }
    
    const dictionaryData = await response.json();
    
    // Format dictionary data for the AI
    let dictionaryInfo = `WORD: ${word}\n\n`;
    
    if (dictionaryData && dictionaryData.length > 0) {
      const entry = dictionaryData[0];
      
      // Phonetic/ pronunciation
      if (entry.phonetic) {
        dictionaryInfo += `PRONUNCIATION: ${entry.phonetic}\n`;
      }
      
      if (entry.phonetics && entry.phonetics.length > 0) {
        const audioUrl = entry.phonetics.find((p: any) => p.audio)?.audio;
        if (audioUrl) {
          dictionaryInfo += `AUDIO: ${audioUrl}\n`;
        }
      }
      
      // Meanings/definitions
      if (entry.meanings && entry.meanings.length > 0) {
        dictionaryInfo += `\nDEFINITIONS:\n`;
        entry.meanings.forEach((meaning: any, index: number) => {
          dictionaryInfo += `\n${meaning.partOfSpeech.toUpperCase()}:\n`;
          meaning.definitions.slice(0, 3).forEach((def: any, defIndex: number) => {
            dictionaryInfo += `  ${defIndex + 1}. ${def.definition}\n`;
            if (def.example) {
              dictionaryInfo += `     Example: "${def.example}"\n`;
            }
            if (def.synonyms && def.synonyms.length > 0) {
              dictionaryInfo += `     Synonyms: ${def.synonyms.slice(0, 5).join(', ')}\n`;
            }
            if (def.antonyms && def.antonyms.length > 0) {
              dictionaryInfo += `     Antonyms: ${def.antonyms.slice(0, 5).join(', ')}\n`;
            }
          });
        });
      }
      
      // Origin/Etymology
      if (entry.origin) {
        dictionaryInfo += `\nETYMOLOGY: ${entry.origin}\n`;
      }
    }
    
    console.log('[Chat Route] Dictionary info fetched for:', word);
    
    // Build system prompt with dictionary info
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const DICTIONARY_SYSTEM_PROMPT = `You are Scorpeo, a helpful AI assistant. The user is asking about a word.

CURRENT DATE: ${currentDate}
CURRENT TIME: ${currentTime}

${dictionaryInfo}

INSTRUCTIONS:
- Use the dictionary information above to provide a comprehensive answer about the word
- Include pronunciation, definitions, examples, synonyms, and antonyms
- If the user asked about pronunciation specifically, focus on that
- If the user asked about synonyms or antonyms, focus on those
- Be conversational and helpful
- You can add additional context or usage examples beyond what's in the dictionary`;

    const SYSTEM_PROMPT: Message = {
      role: "system",
      content: DICTIONARY_SYSTEM_PROMPT
    };

    const payloadMessages = [SYSTEM_PROMPT, ...messages.slice(-1)];
    
    const groqModel = 'qwen/qwen3.8-27b';
    const temperature = 0.7;
    const maxTokens = 4096;

    const aiRequest = {
      model: groqModel,
      messages: payloadMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    console.log('[Chat Route] Dictionary chat request:', { word, model: groqModel });

    const abortController = new AbortController();
    return streamFromGroq('groq', aiRequest, abortController, overallStart);
    
  } catch (error) {
    console.error('[Chat Route] Dictionary chat error:', error);
    // Fallback to normal chat on error
    return await handleNormalChat(req, messages, lastUserMessage, overallStart);
  }
}

async function handleYouTubeChat(req: Request, messages: any[], lastUserMessage: string, youtubeVideoInfo: any, overallStart: number, transcript?: string) {
  // Try to fetch transcript using YouTube Data API
  let videoTranscript: string = transcript || '';
  
  if (!videoTranscript && process.env.YOUTUBE_API_KEY) {
    try {
      console.log('[Chat Route] Fetching transcript from YouTube Data API');
      const response = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${youtubeVideoInfo.id}&key=${process.env.YOUTUBE_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          // For caption track, we need to download the actual caption content
          const captionId = data.items[0].id;
          const captionResponse = await fetch(`https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${process.env.YOUTUBE_API_KEY}`);
          if (captionResponse.ok) {
            const captionData = await captionResponse.json();
            // Decode caption content if available
            if (captionData.snippet?.simple) {
              videoTranscript = captionData.snippet.simple;
              console.log('[Chat Route] Transcript fetched from YouTube Data API, length:', videoTranscript.length);
            }
          }
        }
      }
    } catch (error) {
      console.log('[Chat Route] YouTube Data API transcript fetch failed:', error);
    }
  }

  // If no transcript from API, use description
  if (!videoTranscript) {
    console.log('[Chat Route] No transcript from API, using description');
    const description = youtubeVideoInfo.description || '';
    videoTranscript = description.replace(/https?:\/\/[^\s]+/g, '').replace(/\n+/g, '\n').trim();
  } else {
    console.log('[Chat Route] Using transcript, length:', videoTranscript.length);
  }

  // Build system prompt with transcript or description
  let YOUTUBE_SYSTEM_PROMPT = `You are Scorpeo, a helpful AI assistant. The user shared a YouTube video and is asking you about it.

VIDEO INFORMATION:
Title: "${youtubeVideoInfo.title}"
Channel: ${youtubeVideoInfo.channelTitle}
Duration: ${formatDuration(youtubeVideoInfo.duration)}
Views: ${youtubeVideoInfo.viewCount.toLocaleString()}
Published: ${new Date(youtubeVideoInfo.publishedAt).toLocaleDateString()}

VIDEO CONTENT:
${videoTranscript}

INSTRUCTIONS:
- The video player is visible to the user so they can watch it along with your response
- DO NOT say you can't access the video or that you don't know what's in it
- Use the content above to provide detailed insights about the video's content
- If the user asks "what is he saying?" or "what's the video about?", provide a comprehensive summary
- Extract and list key points, main arguments, and important details
- When discussing specific topics or key points, include timestamps in the format [MM:SS] (single timestamp, not ranges)
- Format your response as bullet points when listing multiple topics
- DO NOT include the YouTube URL in your response - the embedded player is already visible
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
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  let fullSystemPrompt = `${SCORPEO_CORE_PROMPT}

CURRENT DATE: ${currentDate}
CURRENT TIME: ${currentTime}

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

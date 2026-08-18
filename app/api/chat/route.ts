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

const SYSTEM_PROMPT: Message = {
  role: "system",
  content: `You are Scorpio, a witty, sharp, and intelligent AI built by Codedwaves.
- Multi-lingual & Slang Aware: Respond in the exact language/slang used by the user (e.g., Sheng/Kiswahili for "sasa", Russian for "privyet").
- Structured Notebook Lessons: When teaching languages, start with a Markdown Character Table, phonetics/pronunciation, and 3 practice words before full sentences.
- Thinking Rules: Keep internal thoughts inside  tags strictly concise (2-3 sentences max).
- Math: Format math with LaTeX ($...$ inline, $$...$$ block).
- External Data: When external dictionary or Wikipedia data is appended to your context, use it to give 100% accurate grammatical and factual responses.`
};

// Free Dictionary API lookup
async function fetchDictionary(word: string) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data[0]; // Returns definitions, partsOfSpeech, phonetics
  } catch {
    return null;
  }
}

// 1. Search Wikipedia for best matching article title
async function searchWikipedia(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "ScorpioAI/1.0 (contact@codedwaves.com)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const topResult = data.query?.search?.[0]?.title;
    return topResult || null;
  } catch (error) {
    console.error("Wikipedia search failed:", error);
    return null;
  }
}

// 2. Fetch full article summary for the best title
async function fetchWikipediaSummary(title: string) {
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(summaryUrl, {
      headers: { "User-Agent": "ScorpioAI/1.0 (contact@codedwaves.com)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title,
      description: data.description || "",
      extract: data.extract || "",
      imageUrl: data.thumbnail?.source || null,
      wikiUrl: data.content_urls?.desktop?.page || null,
    };
  } catch (error) {
    console.error("Wikipedia summary fetch failed:", error);
    return null;
  }
}

// Wikipedia Summary REST API lookup with deduplication and search
async function fetchWikipediaCard(topic: string, fetchedEntities: Set<string>): Promise<WikiCardData | null> {
  const normalizedTopic = topic.toLowerCase().trim();
  
  // If entity was already fetched in this session, skip image payload
  if (fetchedEntities.has(normalizedTopic)) {
    return null;
  }

  try {
    // First search for the best matching title
    const matchedTitle = await searchWikipedia(topic);
    if (!matchedTitle) return null;
    
    // Then fetch the summary for the matched title
    const summaryData = await fetchWikipediaSummary(matchedTitle);
    if (!summaryData || !summaryData.extract) return null;
    
    fetchedEntities.add(normalizedTopic); // Mark entity as fetched

    return {
      title: summaryData.title,
      imageUrl: summaryData.imageUrl || null,
      description: summaryData.description || "",
      extract: summaryData.extract
    };
  } catch {
    return null;
  }
}

// Intent detection for dictionary and Wikipedia queries
function detectIntent(lastMessage: string): { type: 'dictionary' | 'wikipedia' | null; query: string } {
  const lower = lastMessage.toLowerCase();
  
  // Dictionary intent patterns
  const dictPatterns = [
    /define\s+(\w+)/i,
    /is\s+(\w+)\s+(a\s+)?(noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection)/i,
    /what\s+(does|is)\s+(\w+)\s+mean/i,
    /meaning\s+of\s+(\w+)/i
  ];
  
  for (const pattern of dictPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { type: 'dictionary', query: match[1] };
    }
  }
  
  // Wikipedia intent patterns
  const wikiPatterns = [
    /what\s+is\s+(.+?)(?:\?|$)/i,
    /who\s+is\s+(.+?)(?:\?|$)/i,
    /tell\s+me\s+about\s+(.+?)(?:\?|$)/i,
    /explain\s+(.+?)(?:\?|$)/i
  ];
  
  for (const pattern of wikiPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { type: 'wikipedia', query: match[1].trim() };
    }
  }
  
  return { type: null, query: '' };
}

// Provider 1: Cloudflare Workers AI
async function callCloudflare(messages: Message[]) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    }
  );
  if (!response.ok) throw new Error(`Cloudflare failed: ${response.status}`);
  return response;
}

// Provider 2: NVIDIA NIM
async function callNvidia(messages: Message[]) {
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-ai/deepseek-r1",
      messages,
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 4096,
      stream: true,
    }),
  });
  if (!response.ok) throw new Error(`NVIDIA NIM failed: ${response.status}`);
  return response;
}

// Provider 3: Groq Cloud
async function callGroq(messages: Message[]) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-72b-instruct",
      messages,
      temperature: 0.6,
      max_tokens: 4096,
      stream: true,
    }),
  });
  if (!response.ok) throw new Error(`Groq failed: ${response.status}`);
  return response;
}

// Stream processor for different API formats
async function processStream(response: Response, wikiCardData: WikiCardData | null = null) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      try {
        // Send wiki card data first if available
        if (wikiCardData) {
          const wikiPayload = JSON.stringify({ type: 'wiki_card', data: wikiCardData });
          controller.enqueue(encoder.encode(`[WIKI_CARD_START]${wikiPayload}[WIKI_CARD_END]`));
        }
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Handle different streaming formats
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                // Cloudflare format
                const content = parsed.response || parsed.result?.response || 
                               // NVIDIA/Groq format
                               parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream reading error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastUserMessage = messages[messages.length - 1]?.content || "";
  
  // Track fetched entities for deduplication
  const fetchedEntities = new Set<string>();
  
  // 1. Check if Wikipedia summary is needed
  let wikiContext = "";
  let wikiCardData: WikiCardData | null = null;
  
  // Strict entity lookup trigger - only explicit entity information requests
  const isExplicitLookup = /^(who is|what is|tell me about|search for|lookup|who was|what was|where is)\b/i.test(lastUserMessage.trim());
  
  // Skip search for contextual follow-up messages
  const isFollowUp = /^(can you|how do|teach me|tell me|explain|yes|no|more|continue|what about)\b/i.test(lastUserMessage.trim());
  
  const needsSearch = isExplicitLookup && !isFollowUp;
  
  if (needsSearch) {
    // Clean search term
    const cleanQuery = lastUserMessage
      .replace(/who is|what is|tell me about|search for|lookup|who was|what was|where is/gi, "")
      .trim();
    
    if (cleanQuery.length > 2) {
      const matchedTitle = await searchWikipedia(cleanQuery);
      if (matchedTitle) {
        // Reject irrelevant titles (e.g., query "teach me" returning manga titles)
        const queryWords = cleanQuery.toLowerCase().split(" ");
        const titleMatchesQuery = queryWords.some((word: string) =>
          word.length > 3 && matchedTitle.toLowerCase().includes(word)
        );

        if (titleMatchesQuery) {
          const summaryData = await fetchWikipediaSummary(matchedTitle);
          if (summaryData?.extract) {
            wikiCardData = {
              title: summaryData.title,
              imageUrl: summaryData.imageUrl || null,
              description: summaryData.description || "",
              extract: summaryData.extract,
              wikiUrl: summaryData.wikiUrl
            };
            wikiContext = `\n\n[LIVE SEARCH DATA FOR "${summaryData.title}"]:
Description: ${summaryData.description}
Summary: ${summaryData.extract}`;
          }
        }
      }
    }
  }

  // 2. Check if Dictionary lookup is needed
  if (lastUserMessage.toLowerCase().includes("define") || lastUserMessage.toLowerCase().includes("meaning of")) {
    const wordMatch = lastUserMessage.match(/define\s+(\w+)|meaning\s+of\s+(\w+)/i);
    if (wordMatch) {
      const word = wordMatch[1] || wordMatch[2];
      const dictData = await fetchDictionary(word);
      if (dictData) {
        wikiContext += `\n\n[DICTIONARY CONTEXT for ${word}]:\n${JSON.stringify(dictData)}`;
      }
    }
  }

  // 3. Combine into master system prompt
  const SYSTEM_PROMPT: Message = {
    role: "system",
    content: `You are Scorpio, an intelligent, sharp, and factual AI built by Codedwaves.
Factual Accuracy: When live search data is provided in context, you MUST use it as the source of truth. Never misidentify real people, YouTubers, historical figures, or public events as fictional characters.
Structured Learning: If the user asks to learn about a topic or person, give a clear overview, key facts, and offer to dive deeper.
Thinking Rules: Keep internal thinking inside  tags strictly under 2-3 sentences max.
Multi-lingual & Slang Aware: Respond in the exact language/slang used by the user.
Grammar: If Dictionary context is provided, use it for accurate grammatical information.${wikiContext}`
  };

  const payloadMessages = [SYSTEM_PROMPT, ...messages.slice(-6)];

  // 4. Chain providers (Cloudflare -> NVIDIA -> Groq)
  try {
    const response = await callCloudflare(payloadMessages);
    return await processStream(response, wikiCardData);
  } catch (err1) {
    console.warn("Cloudflare failed. Escalating to NVIDIA NIM...", err1);
  }

  try {
    const response = await callNvidia(payloadMessages);
    return await processStream(response, wikiCardData);
  } catch (err2) {
    console.warn("NVIDIA NIM failed. Escalating to Groq...", err2);
  }

  try {
    const response = await callGroq(payloadMessages);
    return await processStream(response, wikiCardData);
  } catch (err3) {
    console.error("All AI Providers failed.", err3);
    return new Response(JSON.stringify({ error: "All servers busy. Please try again shortly." }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}
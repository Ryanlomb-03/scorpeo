/**
 * Intent Router
 * Classifies user queries into different types to determine appropriate knowledge retrieval strategy
 */

export type IntentType = 'conversation' | 'entity' | 'knowledge' | 'current' | 'code' | 'math';

export interface IntentResult {
  type: IntentType;
  confidence: number; // 0-1
  knowledgeLevel: 0 | 1 | 2 | 3; // Model, Wikidata, Wikipedia, Web
  shouldShowCard: boolean;
}

/**
 * Classify user intent based on query content
 */
export function classifyIntent(query: string): IntentResult {
  const lowerQuery = query.toLowerCase().trim();

  // Level 0: Model knowledge only - no external retrieval needed
  // Casual conversation, greetings, simple questions
  const conversationPatterns = [
    /^(hi|hello|hey|howdy|greetings)/i,
    /^(how are you|how's it going|what's up|how do you do)/i,
    /^(good morning|good afternoon|good evening|good night)/i,
    /^(thanks|thank you|you're welcome|no problem)/i,
    /^(bye|goodbye|see you|later)/i,
    /^(yes|no|maybe|sure|okay|ok)/i,
    /^(i think|i feel|i believe|i guess)/i,
    /^(can you help|please help|help me)/i,
  ];

  if (conversationPatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'conversation',
      confidence: 0.9,
      knowledgeLevel: 0,
      shouldShowCard: false,
    };
  }

  // Code requests - no external knowledge needed
  const codePatterns = [
    /(write|create|implement|build|make|generate)\s+(a|an|the)?\s*(function|class|component|script|code|program|app)/i,
    /(show me|how to|explain)\s+(how\s+to\s+)?(write|code|implement|use|create)/i,
    /(javascript|python|typescript|rust|go|java|c\+\+|react|vue|angular)\s+(function|code|example)/i,
    /(fix|debug|solve|help with)\s+(this\s+)?(code|error|bug|issue)/i,
  ];

  if (codePatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'code',
      confidence: 0.85,
      knowledgeLevel: 0,
      shouldShowCard: false,
    };
  }

  // Math problems - no external knowledge needed
  const mathPatterns = [
    /(solve|calculate|compute|find)\s+(for\s+)?(x|y|z|the\s+value|the\s+answer)/i,
    /\b(solve|calculate)\s+.*[=+\-*/^]/i,
    /\b\d+[\s+\-*/^]\d+/i,
    /(equation|formula|derivative|integral)/i,
  ];

  if (mathPatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'math',
      confidence: 0.85,
      knowledgeLevel: 0,
      shouldShowCard: false,
    };
  }

  // Level 3: Web search - current/fresh information needed
  const currentPatterns = [
    /(what\s+(is|was|happened|happening|are|were)(\s+the\s+news)?\s+(today|yesterday|this\s+(week|month|year)|recent|latest|now))/i,
    /(news|breaking|recent|latest|current)\s+(about|on|for|in|today)/i,
    /(whats|what's)\s+(the\s+)?news(\s+(in|for|about|today|now|recent|latest)(\s+.+)?)?/i,
    /(price|stock|crypto|bitcoin|ethereum)\s+(today|now|current)/i,
    /(weather|forecast)\s+(today|tomorrow|now)/i,
    /(live|real-time|right\s+now)\s+(status|update|info)/i,
  ];

  if (currentPatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'current',
      confidence: 0.8,
      knowledgeLevel: 3,
      shouldShowCard: false, // Web search results don't need cards
    };
  }

  // Time queries - use clock artifact (no external retrieval needed)
  const timePatterns = [
    /(what\s+(time|is\s+the\s+time)(\s+(is|it|now|today|right\s+now))?)/i,
    /(whats|what's)\s+(the\s+)?time(\s+(in|at|for|today|now))?/i,
    /(time\s+(in|at|for|today|now))/i,
    /(current\s+time(\s+(in|at|for))?)/i,
  ];

  if (timePatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'conversation',
      confidence: 0.85,
      knowledgeLevel: 0,
      shouldShowCard: false,
    };
  }

  // Level 1: Entity lookup - Wikidata for structured facts
  // "Who is X", "What is X" (when X is a person/entity)
  const entityPatterns = [
    /^who\s+(is|was|are|were)\s+/i,
    /^what\s+(is|was)\s+(the\s+)?(name|age|height|weight|occupation|job|profession|nationality)\s+of\s+/i,
    /^tell\s+me\s+about\s+(the\s+)?(person|celebrity|actor|actress|singer|musician|artist|politician|scientist|inventor)/i,
  ];

  if (entityPatterns.some(pattern => pattern.test(lowerQuery))) {
    return {
      type: 'entity',
      confidence: 0.75,
      knowledgeLevel: 1,
      shouldShowCard: true, // Show compact entity card
    };
  }

  // Level 2: Knowledge/Explanation - Wikipedia for in-depth topics
  const knowledgePatterns = [
    /^(what|how|why|when|where|explain|describe|tell\s+me\s+about)\s+/i,
    /^(history|origin|background|story)\s+of\s+/i,
    /^(meaning|definition)\s+of\s+/i,
    /^(how\s+does|how\s+do)\s+/i,
  ];

  if (knowledgePatterns.some(pattern => pattern.test(lowerQuery))) {
    // Check if it's a factual entity question (might be Level 1)
    if (/^(who|what)\s+(is|was)\s+[a-z\s]+(\?|$)/i.test(lowerQuery)) {
      // Could be entity or knowledge - use length as heuristic
      const words = lowerQuery.split(/\s+/).length;
      if (words <= 5) {
        return {
          type: 'entity',
          confidence: 0.6,
          knowledgeLevel: 1,
          shouldShowCard: true,
        };
      }
    }

    return {
      type: 'knowledge',
      confidence: 0.7,
      knowledgeLevel: 2,
      shouldShowCard: true, // Show Wikipedia card for knowledge queries
    };
  }

  // Default: conversation (model knowledge only)
  return {
    type: 'conversation',
    confidence: 0.5,
    knowledgeLevel: 0,
    shouldShowCard: false,
  };
}

/**
 * Calculate relevance score for Wikipedia search result
 * Returns 0-1 score, where higher is more relevant
 */
export function calculateRelevanceScore(query: string, title: string, extract: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerExtract = extract.toLowerCase();

  let score = 0;

  // Exact title match
  if (lowerTitle === lowerQuery) {
    score += 0.5;
  }

  // Title contains query
  if (lowerTitle.includes(lowerQuery)) {
    score += 0.3;
  }

  // Query contains title (partial match)
  if (lowerQuery.includes(lowerTitle)) {
    score += 0.2;
  }

  // Extract contains significant query terms
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = queryWords.filter(word => lowerExtract.includes(word));
  if (matchedWords.length > 0) {
    score += (matchedWords.length / queryWords.length) * 0.2;
  }

  // Penalize if title is a disambiguation page
  if (lowerTitle.includes('(') && lowerTitle.includes(')')) {
    score -= 0.2;
  }

  // Penalize if extract is too short
  if (extract.length < 50) {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

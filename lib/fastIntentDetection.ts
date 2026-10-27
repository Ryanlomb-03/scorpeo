/**
 * Fast Intent Detection using Cloudflare Workers AI Clef
 * This layer runs before the main AI call to quickly determine:
 * - What the user wants to do
 * - Which artifacts to suggest (images, quizzes, clocks, etc.)
 * - What tools the AI should use
 * 
 * Uses @cf/cloudflare/clef for structured decision-making with choice/score/noul questions
 */

export type UserIntent =
  | "conversation"
  | "factual_question"
  | "research"
  | "create_artifact"
  | "edit_artifact"
  | "transform_content"
  | "execute_or_calculate"
  | "dictionary_lookup"
  | "news_lookup"
  | "ambiguous";

export type KnowledgeStrategy =
  | "model_knowledge"
  | "retrieve_sources"
  | "tool_assisted"
  | "clarify";

export type ArtifactIntent =
  | "none"
  | "image_generation"
  | "image_search"
  | "document"
  | "pdf"
  | "equation"
  | "graph"
  | "diagram"
  | "table"
  | "quiz"
  | "code"
  | "other_supported_artifact";

export interface IntentPlan {
  userIntent: UserIntent;
  knowledgeStrategy: KnowledgeStrategy;
  artifactIntent: ArtifactIntent;
  requiredTools: string[];
  confidence?: number;
  reason?: string;
}

interface FastIntentResult {
  intent: string;
  suggestedArtifacts: string[];
  toolInstructions: string;
  confidence: number;
  shouldShowCard: boolean;
  knowledgeLevel: number;
  plan?: IntentPlan;
}

export class FastIntentDetection {
  private cloudflareAccountId: string;
  private cloudflareApiToken: string;

  constructor() {
    this.cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  }

  async detect(message: string, conversationContext?: string[]): Promise<FastIntentResult> {
    // Fast local detection first for obvious cases (no API call)
    const localResult = this.localDetect(message);

    // If high confidence locally, return immediately (lowered threshold for speed)
    if (localResult.confidence > 0.75) {
      console.log('[Fast Intent] Using local classification (high confidence)');
      return localResult;
    }

    // Otherwise, use Cloudflare Clef for accurate structured decision
    console.log('[Fast Intent] Using Clef for classification (ambiguous request)');
    const plan = await this.cloudflareClefDetect(message, conversationContext);

    // If Clef succeeded, use its results (no fallback to local)
    console.log('[Fast Intent] Using Clef results');
    return this.planToResult(plan, message);
  }

  // Fast path for simple requests that don't need Clef
  shouldSkipClef(message: string, conversationContext?: string[]): boolean {
    const lower = message.toLowerCase();
    
    // Skip Clef for obvious greetings
    if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|good night|thanks|thank you|thx|bye|goodbye|see you|later)/i.test(lower)) {
      return true;
    }
    
    // Skip Clef for very short messages (< 30 chars) that are likely follow-ups
    if (message.length < 30 && conversationContext && conversationContext.length > 0) {
      return true;
    }
    
    // Skip Clef for simple acknowledgments
    if (/^(ok|okay|sure|yes|no|maybe|alright|got it|understood|makes sense|cool|nice|great|awesome|perfect)/i.test(lower)) {
      return true;
    }
    
    // Skip Clef for simple "how are you" responses
    if (/^(i['']?m (fine|good|great|okay|alright|not bad|doing well)|nothing much|not much|pretty good|same here|you\?)/i.test(lower)) {
      return true;
    }

    // Skip Clef for simple follow-up questions (very short)
    if (/^(what|why|how|when|where|who|which|can you|could you|will you|would you)\s+.{0,20}$/i.test(lower)) {
      return true;
    }
    
    return false;
  }

  private planToResult(plan: IntentPlan, message: string): FastIntentResult {
    const suggestedArtifacts: string[] = [];
    let toolInstructions = '';
    let shouldShowCard = false;
    let knowledgeLevel = 0;

    // Map artifact intent to suggested artifacts
    if (plan.artifactIntent !== 'none') {
      suggestedArtifacts.push(plan.artifactIntent);
    }

    // Build tool instructions based on plan
    if (plan.artifactIntent === 'image_generation') {
      toolInstructions = 'The user explicitly requested image generation. If image generation is available, create the image. Otherwise, politely explain it is unavailable.';
      shouldShowCard = true;
      knowledgeLevel = 1;
    } else if (plan.artifactIntent === 'image_search') {
      toolInstructions = 'The user wants to find existing images. Search for relevant reference images and identify their sources.';
      shouldShowCard = true;
      knowledgeLevel = 2;
    } else if (plan.artifactIntent === 'quiz') {
      toolInstructions = 'The user wants a quiz. Use the QuizArtifact component with <?quiz?> delimiters.';
      shouldShowCard = true;
      knowledgeLevel = 2;
    } else if (plan.artifactIntent === 'code') {
      toolInstructions = 'The user wants code execution demonstration. Use the WindowsArtifact component with <?windows?> delimiters.';
      shouldShowCard = true;
      knowledgeLevel = 1;
    } else if (plan.knowledgeStrategy === 'retrieve_sources') {
      toolInstructions = 'The user needs current information or cited sources. Use knowledge retrieval and reference specific sources.';
      knowledgeLevel = 2;
      shouldShowCard = true;
    } else if (plan.knowledgeStrategy === 'tool_assisted') {
      toolInstructions = 'The user requires computation or code execution. Use appropriate tools.';
      knowledgeLevel = 1;
    }

    return {
      intent: plan.userIntent,
      suggestedArtifacts,
      toolInstructions,
      confidence: plan.confidence || 0.7,
      shouldShowCard,
      knowledgeLevel,
      plan
    };
  }

  // Local detection method (public for fast path access)
  localDetect(message: string): FastIntentResult {
    const lower = message.toLowerCase();
    const suggestedArtifacts: string[] = [];
    let intent = 'conversation';
    let confidence = 0.5;
    let toolInstructions = '';
    let shouldShowCard = false;
    let knowledgeLevel = 0;

    // Calculate confidence based on keyword match strength
    const calculateConfidence = (keywords: string[], message: string): number => {
      const matches = keywords.filter(k => message.includes(k)).length;
      const ratio = matches / keywords.length;
      // Base confidence on match ratio + boost for exact phrases
      let base = ratio * 0.6;
      // Boost for longer messages (more context)
      if (message.length > 50) base += 0.1;
      // Boost for very strong matches (multiple keywords)
      if (matches >= 2) base += 0.2;
      return Math.min(base, 0.85); // Cap at 0.85 to leave room for Clef
    };

    // Image detection
    const imageKeywords = ['show me', 'visual', 'image', 'picture', 'medieval', 'ancient', 'history', 'castle', 'armor', 'architecture', 'what does it look'];
    if (imageKeywords.some(k => lower.includes(k))) {
      suggestedArtifacts.push('image');
      intent = 'visual_request';
      confidence = calculateConfidence(imageKeywords, lower);
      toolInstructions = 'The user wants to visualize something. If image generation is available, offer to create an image. Otherwise, describe the visual in detail or suggest finding reference images.';
      shouldShowCard = true;
    }

    // Dictionary lookup detection
    const dictionaryKeywords = ['pronunciation', 'define', 'meaning', 'definition', 'synonym', 'antonym', 'how do you say', 'how to pronounce', 'what does .* mean', 'dictionary', 'spell', 'etymology'];
    if (dictionaryKeywords.some(k => new RegExp(k, 'i').test(lower))) {
      intent = 'dictionary_lookup';
      confidence = 0.8;
      toolInstructions = 'The user is asking about a word - definition, pronunciation, synonyms, etc. Use the dictionary tool to provide comprehensive word information.';
      shouldShowCard = true;
      knowledgeLevel = 1;
    }

    // News lookup detection
    const newsKeywords = ['news', 'current events', 'breaking news', 'latest news', 'today in', 'what happened', 'headlines', 'recent', 'today', 'yesterday', 'latest'];
    if (newsKeywords.some(k => lower.includes(k))) {
      intent = 'news_lookup';
      confidence = 0.8;
      toolInstructions = 'The user is asking about current news or recent events. Use the news API to fetch real-time news.';
      shouldShowCard = true;
      knowledgeLevel = 2;
      knowledgeLevel = 1;
    }

    // Quiz detection
    const quizKeywords = ['quiz', 'test', 'assessment', 'practice', 'challenge', 'test me'];
    if (quizKeywords.some(k => lower.includes(k))) {
      suggestedArtifacts.push('quiz');
      intent = 'quiz_request';
      confidence = calculateConfidence(quizKeywords, lower);
      toolInstructions = 'The user wants a quiz. Use the QuizArtifact component with <?quiz?> delimiters.';
      shouldShowCard = true;
      knowledgeLevel = 2;
    }

    // Clock detection (high confidence - very specific)
    const clockKeywords = ['time', 'clock', 'what time', 'current time', 'timezone'];
    if (clockKeywords.some(k => lower.includes(k))) {
      suggestedArtifacts.push('clock');
      intent = 'time_request';
      confidence = 0.85; // High but still below threshold
      toolInstructions = 'The user wants time information. Use the ClockArtifact component with <?clock?> delimiters.';
      shouldShowCard = false;
      knowledgeLevel = 0;
    }

    // Windows artifact detection
    const windowsKeywords = ['show me the output', 'run this', 'execute', 'terminal', 'what happens when'];
    if (windowsKeywords.some(k => lower.includes(k))) {
      suggestedArtifacts.push('windows');
      intent = 'code_execution';
      confidence = calculateConfidence(windowsKeywords, lower);
      toolInstructions = 'The user wants to see terminal output. Use the WindowsArtifact component with <?windows?> delimiters.';
      shouldShowCard = true;
      knowledgeLevel = 1;
    }

    // Install sequence detection
    const installKeywords = ['install', 'setup', 'download', 'npm install', 'pip install', 'create project'];
    if (installKeywords.some(k => lower.includes(k))) {
      suggestedArtifacts.push('install');
      intent = 'installation';
      confidence = calculateConfidence(installKeywords, lower);
      toolInstructions = 'The user wants installation instructions. Use the InstallationSequence component with <?install?> delimiters.';
      shouldShowCard = true;
      knowledgeLevel = 1;
    }

    // Code generation detection
    const codeKeywords = ['create', 'generate', 'write', 'build', 'function', 'component', 'react', 'nextjs', 'python'];
    if (codeKeywords.some(k => lower.includes(k)) && suggestedArtifacts.length === 0) {
      intent = 'code_generation';
      confidence = calculateConfidence(codeKeywords, lower);
      toolInstructions = 'The user wants code. Write clean, production-ready code with proper syntax highlighting.';
      knowledgeLevel = 1;
    }

    return {
      intent,
      suggestedArtifacts,
      toolInstructions,
      confidence,
      shouldShowCard,
      knowledgeLevel
    };
  }

  private async cloudflareClefDetect(message: string, conversationContext?: string[]): Promise<IntentPlan> {
    try {
      const requestBody = {
        model: 'clef-flash',
        state: {
          message: message.slice(0, 500),
          conversationContext: conversationContext?.slice(-2) || []
        },
        questions: {
          userIntent: {
            type: 'choice',
            instructions: 'Classify the user\'s primary intent',
            criteria: {
              conversation: 'Casual chat, greetings, or general conversation',
              factual_question: 'Direct question requiring factual answer',
              research: 'Request for in-depth research with sources',
              create_artifact: 'Explicit request to create something (image, document, etc.)',
              edit_artifact: 'Request to modify existing content',
              transform_content: 'Convert content from one format to another',
              execute_or_calculate: 'Request for calculation, code execution, or computation',
              ambiguous: 'Unclear or could be interpreted multiple ways'
            }
          },
          knowledgeStrategy: {
            type: 'choice',
            instructions: 'Determine the best knowledge strategy for this request',
            criteria: {
              model_knowledge: 'Stable knowledge the model likely knows',
              retrieve_sources: 'Current information or cited sources needed',
              tool_assisted: 'Requires computation, code execution, or specific tool',
              clarify: 'Essential information missing, needs clarification'
            }
          },
          artifactIntent: {
            type: 'choice',
            instructions: 'What artifact type is requested, if any?',
            criteria: {
              none: 'No artifact requested',
              image_generation: 'Explicit request to generate/create a new image',
              image_search: 'Request to find existing images or photographs',
              document: 'Request to create a document',
              pdf: 'Explicit request to create PDF',
              equation: 'Mathematical equation needed',
              graph: 'Plot or graph visualization needed',
              diagram: 'Diagram or schematic needed',
              table: 'Table or structured data needed',
              quiz: 'Quiz or assessment requested',
              code: 'Code execution or terminal output needed',
              other_supported_artifact: 'Other supported artifact type'
            }
          },
          requiresWebRetrieval: {
            type: 'noul',
            instructions: 'Does this request require web search or live data retrieval?'
          },
          requiresComputation: {
            type: 'noul',
            instructions: 'Does this request require calculation, computation, or code execution?'
          },
          requiresDocumentRendering: {
            type: 'noul',
            instructions: 'Does this request require document or PDF rendering?'
          },
          explicitlyRequestsImageGeneration: {
            type: 'noul',
            instructions: 'Does the user explicitly request generating or creating a new image?'
          },
          requiresFileAccess: {
            type: 'noul',
            instructions: 'Does this request require access to uploaded files?'
          },
          confidence: {
            type: 'score',
            instructions: 'How confident are you in this classification?',
            criteria: ['Very uncertain', 'Somewhat uncertain', 'Moderately confident', 'Very confident', 'Extremely confident']
          }
        }
      };

      console.log('[Clef Detection] Request sent');

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run/@cf/cloudflare/clef`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.cloudflareApiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      const data = await response.json();
      console.log('[Clef Detection] Response status:', response.status);
      
      // Validate and parse Clef response
      // Cloudflare REST API returns: { success: true, result: { model, answers, usage }, errors: [], messages: [] }
      // Workers AI binding returns: { model, answers, usage }
      const answers = data.result?.answers || data.answers;
      
      if (!answers) {
        console.warn('[Clef Detection] Invalid response structure - missing answers');
        throw new Error('Invalid Clef response structure');
      }
      
      // Validate enum values
      const validUserIntents: UserIntent[] = ['conversation', 'factual_question', 'research', 'create_artifact', 'edit_artifact', 'transform_content', 'execute_or_calculate', 'ambiguous'];
      const validKnowledgeStrategies: KnowledgeStrategy[] = ['model_knowledge', 'retrieve_sources', 'tool_assisted', 'clarify'];
      const validArtifactIntents: ArtifactIntent[] = ['none', 'image_generation', 'image_search', 'document', 'pdf', 'equation', 'graph', 'diagram', 'table', 'quiz', 'code', 'other_supported_artifact'];

      const userIntent = validUserIntents.includes(answers.userIntent?.choice) ? answers.userIntent.choice as UserIntent : 'ambiguous';
      const knowledgeStrategy = validKnowledgeStrategies.includes(answers.knowledgeStrategy?.choice) ? answers.knowledgeStrategy.choice as KnowledgeStrategy : 'model_knowledge';
      const artifactIntent = validArtifactIntents.includes(answers.artifactIntent?.choice) ? answers.artifactIntent.choice as ArtifactIntent : 'none';

      // Build required tools array based on noul questions
      const requiredTools: string[] = [];
      if (answers.requiresWebRetrieval?.noul > 0.5) requiredTools.push('web_retrieval');
      if (answers.requiresComputation?.noul > 0.5) requiredTools.push('computation');
      if (answers.requiresDocumentRendering?.noul > 0.5) requiredTools.push('document_rendering');
      if (answers.requiresFileAccess?.noul > 0.5) requiredTools.push('file_access');

      const plan: IntentPlan = {
        userIntent,
        knowledgeStrategy,
        artifactIntent,
        requiredTools,
        confidence: answers.confidence?.score || 0.7,
        reason: this.buildReason(userIntent, knowledgeStrategy, artifactIntent)
      };

      console.log('[Clef Detection] Success:', {
        userIntent,
        knowledgeStrategy,
        artifactIntent,
        confidence: plan.confidence
      });

      return plan;
    } catch (error) {
      console.warn('[Clef Detection] Error, falling back to local:', error instanceof Error ? error.message : error);
      return this.fallbackPlan(message);
    }
  }

  private buildReason(userIntent: UserIntent, knowledgeStrategy: KnowledgeStrategy, artifactIntent: ArtifactIntent): string {
    const parts: string[] = [];
    parts.push(`Intent: ${userIntent}`);
    parts.push(`Strategy: ${knowledgeStrategy}`);
    if (artifactIntent !== 'none') {
      parts.push(`Artifact: ${artifactIntent}`);
    }
    return parts.join(', ');
  }

  private fallbackPlan(message: string): IntentPlan {
    // Improved fallback that doesn't default to conversation for everything
    const lower = message.toLowerCase();
    let userIntent: UserIntent = 'ambiguous';
    let knowledgeStrategy: KnowledgeStrategy = 'model_knowledge';
    let artifactIntent: ArtifactIntent = 'none';
    const requiredTools: string[] = [];

    // Explicit artifact requests
    if (lower.includes('generate an image') || lower.includes('create an image') || lower.includes('make an image')) {
      userIntent = 'create_artifact';
      artifactIntent = 'image_generation';
      knowledgeStrategy = 'tool_assisted';
    } else if (lower.includes('find images') || lower.includes('search for images') || lower.includes('real photographs')) {
      userIntent = 'research';
      artifactIntent = 'image_search';
      knowledgeStrategy = 'retrieve_sources';
    } else if (lower.includes('quiz') || lower.includes('test') || lower.includes('assessment')) {
      userIntent = 'create_artifact';
      artifactIntent = 'quiz';
    } else if (lower.includes('plot') || lower.includes('graph') || lower.includes('chart')) {
      userIntent = 'execute_or_calculate';
      artifactIntent = 'graph';
      knowledgeStrategy = 'tool_assisted';
    } else if (lower.includes('pdf') || lower.includes('document')) {
      userIntent = 'create_artifact';
      artifactIntent = 'pdf';
      knowledgeStrategy = 'tool_assisted';
    } else if (lower.includes('research') || lower.includes('cite sources') || lower.includes('current information')) {
      userIntent = 'research';
      knowledgeStrategy = 'retrieve_sources';
    } else if (lower.includes('calculate') || lower.includes('compute') || /\d+\s*[\+\-\*\/]\s*\d+/.test(message)) {
      userIntent = 'execute_or_calculate';
      knowledgeStrategy = 'tool_assisted';
    } else if (lower.includes('do you know') || lower.includes('what is') || lower.includes('tell me about')) {
      userIntent = 'factual_question';
    } else if (this.isGreeting(lower)) {
      userIntent = 'conversation';
    }

    return {
      userIntent,
      knowledgeStrategy,
      artifactIntent,
      requiredTools,
      confidence: 0.6, // Lower confidence for fallback
      reason: 'Fallback classification due to Clef unavailability'
    };
  }

  private isGreeting(message: string): boolean {
    const greetingPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|good night)/i,
      /^(thanks|thank you|thx)/i,
      /^(how are you|how are you doing|how's it going)/i,
      /^(bye|goodbye|see you|later)/i,
    ];
    return greetingPatterns.some(pattern => pattern.test(message));
  }
}

export const fastIntentDetection = new FastIntentDetection();

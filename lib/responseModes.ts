export type ResponseMode =
  | 'explain'
  | 'deep-dive'
  | 'quick-answer'
  | 'step-by-step'
  | 'compare'
  | 'code'
  | 'math'
  | 'research'
  | 'brainstorm'
  | 'creative';

export interface ResponseModeConfig {
  id: ResponseMode;
  name: string;
  icon: string;
  keywords: string[];
  patterns: RegExp[];
  prompt: string;
}

export const responseModes: ResponseModeConfig[] = [
  {
    id: 'explain',
    name: 'Explain',
    icon: '💡',
    keywords: ['explain', 'what is', 'how does', 'tell me about', 'describe'],
    patterns: [/^(what|how|why|explain|describe)/i],
    prompt: 'Provide a clear, educational explanation. Use examples and analogies to make concepts easy to understand. Keep it concise but thorough.'
  },
  {
    id: 'deep-dive',
    name: 'Deep Dive',
    icon: '🔬',
    keywords: ['deep dive', 'in depth', 'detailed', 'comprehensive', 'thorough'],
    patterns: [/deep.?dive|in.?depth|detailed|comprehensive|thorough/i],
    prompt: 'Provide a comprehensive, in-depth analysis. Cover multiple perspectives, edge cases, and nuanced details. Be thorough and exhaustive.'
  },
  {
    id: 'quick-answer',
    name: 'Quick Answer',
    icon: '⚡',
    keywords: ['quick', 'brief', 'short', 'summarize', 'tl;dr'],
    patterns: [/quick|brief|short|summarize|tl;dr|tldr/i],
    prompt: 'Provide a direct, concise answer. Get straight to the point without unnecessary elaboration. Keep it under 3 sentences when possible.'
  },
  {
    id: 'step-by-step',
    name: 'Step-by-Step',
    icon: '📋',
    keywords: ['step by step', 'how to', 'tutorial', 'guide', 'instructions'],
    patterns: [/step.?by.?step|how to|tutorial|guide|instructions/i],
    prompt: 'Provide a clear, numbered step-by-step guide. Use the ::step:: marker for each step. Include prerequisites and troubleshooting tips.'
  },
  {
    id: 'compare',
    name: 'Compare',
    icon: '⚖️',
    keywords: ['compare', 'difference', 'vs', 'versus', 'better'],
    patterns: [/compare|difference|vs|versus|better|which one/i],
    prompt: 'Provide a structured comparison using a table format. Highlight key differences, pros and cons, and use cases for each option.'
  },
  {
    id: 'code',
    name: 'Code',
    icon: '💻',
    keywords: ['code', 'function', 'implement', 'write', 'programming'],
    patterns: [/code|function|implement|write|programming|debug|fix/i],
    prompt: 'Provide working code examples with syntax highlighting. Include comments explaining key parts. Show usage examples and edge cases.'
  },
  {
    id: 'math',
    name: 'Math',
    icon: '📐',
    keywords: ['calculate', 'solve', 'equation', 'formula', 'math'],
    patterns: [/calculate|solve|equation|formula|math|derivative|integral/i],
    prompt: 'Provide mathematical solutions with properly formatted LaTeX equations. Show your work step by step. Include units and context.'
  },
  {
    id: 'research',
    name: 'Research',
    icon: '🔍',
    keywords: ['research', 'find', 'look up', 'information', 'data'],
    patterns: [/research|find|look up|information|data|statistics/i],
    prompt: 'Provide well-researched information with citations when possible. Include relevant context, sources, and recent developments. Be factual and objective.'
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    icon: '🧠',
    keywords: ['brainstorm', 'ideas', 'suggest', 'creative', 'think of'],
    patterns: [/brainstorm|ideas|suggest|creative|think of|list/i],
    prompt: 'Generate multiple creative ideas and possibilities. Be expansive and think outside the box. Organize ideas by category or theme.'
  },
  {
    id: 'creative',
    name: 'Creative',
    icon: '✨',
    keywords: ['write', 'story', 'poem', 'creative', 'narrative'],
    patterns: [/write|story|poem|creative|narrative|essay/i],
    prompt: 'Provide creative, engaging content with good flow and style. Use vivid language and compelling narratives. Adapt tone to the request.'
  }
];

export function detectResponseMode(message: string): ResponseMode | null {
  const lowerMessage = message.toLowerCase();
  
  for (const mode of responseModes) {
    // Check keywords
    if (mode.keywords.some(keyword => lowerMessage.includes(keyword))) {
      return mode.id;
    }
    
    // Check patterns
    if (mode.patterns.some(pattern => pattern.test(message))) {
      return mode.id;
    }
  }
  
  return null;
}

export function getModePrompt(mode: ResponseMode): string {
  const modeConfig = responseModes.find(m => m.id === mode);
  return modeConfig?.prompt || '';
}

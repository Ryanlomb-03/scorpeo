/**
 * Prompt Trimmer - Reduces prompt size by removing redundant content
 * Inspired by https://github.com/Aderali06/prompt-trimmer
 */

export interface TrimResult {
  original: string;
  compressed: string;
  originalChars: number;
  compressedChars: number;
  savedChars: number;
  savingsRatio: number;
}

/**
 * Compresses a prompt by removing redundant content
 * - Removes excessive whitespace
 * - Removes duplicate lines
 * - Compacts verbose phrases
 * - Removes polite filler words
 */
export function trimPrompt(prompt: string, level: 'conservative' | 'moderate' | 'aggressive' = 'moderate'): TrimResult {
  let compressed = prompt;
  const originalChars = prompt.length;

  // Level 1: Conservative - just whitespace and duplicate lines
  if (level === 'conservative' || level === 'moderate' || level === 'aggressive') {
    // Remove excessive whitespace
    compressed = compressed.replace(/[ \t]+/g, ' ');
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    
    // Remove duplicate lines
    const lines = compressed.split('\n');
    const uniqueLines: string[] = [];
    const seenLines = new Set<string>();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !seenLines.has(trimmed)) {
        seenLines.add(trimmed);
        uniqueLines.push(line);
      } else if (!trimmed) {
        uniqueLines.push(line);
      }
    }
    
    compressed = uniqueLines.join('\n');
  }

  // Level 2: Moderate - remove conversational fluff
  if (level === 'moderate' || level === 'aggressive') {
    // Remove polite filler phrases
    const fillerPhrases = [
      /could you kindly please/gi,
      /would you please/gi,
      /thank you in advance/gi,
      /thanks in advance/gi,
      /as an ai assistant/gi,
      /as an ai language model/gi,
      /i'll do my best to/gi,
      /i'll try my best to/gi,
      /please note that/gi,
      /it's important to note that/gi,
      /keep in mind that/gi,
      /please feel free to/gi,
    ];

    for (const phrase of fillerPhrases) {
      compressed = compressed.replace(phrase, '');
    }

    // Remove excessive politeness
    compressed = compressed.replace(/kindly/gi, '');
    compressed = compressed.replace(/please/gi, '');
  }

  // Level 3: Aggressive - compact verbose phrases
  if (level === 'aggressive') {
    // Compact verbose phrases
    const verboseReplacements: [RegExp, string][] = [
      [/in order to/gi, 'to'],
      [/due to the fact that/gi, 'because'],
      [/for the purpose of/gi, 'for'],
      [/with regard to/gi, 'about'],
      [/in the event that/gi, 'if'],
      [/in terms of/gi, 'in'],
      [/on the basis of/gi, 'based on'],
      [/at this point in time/gi, 'now'],
      [/in the near future/gi, 'soon'],
      [/a large number of/gi, 'many'],
      [/a significant amount of/gi, 'much'],
      [/in a timely manner/gi, 'quickly'],
    ];

    for (const [pattern, replacement] of verboseReplacements) {
      compressed = compressed.replace(pattern, replacement);
    }
  }

  // Clean up any resulting double spaces or blank lines
  compressed = compressed.replace(/[ \t]+/g, ' ');
  compressed = compressed.replace(/\n{3,}/g, '\n\n');
  compressed = compressed.trim();

  const compressedChars = compressed.length;
  const savedChars = originalChars - compressedChars;
  const savingsRatio = originalChars > 0 ? (savedChars / originalChars) * 100 : 0;

  return {
    original: prompt,
    compressed,
    originalChars,
    compressedChars,
    savedChars,
    savingsRatio,
  };
}

/**
 * Estimates token count (rough approximation)
 * Most models use ~4 chars per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trims prompt to fit within a token limit
 */
export function trimToTokenLimit(prompt: string, maxTokens: number): string {
  const currentTokens = estimateTokens(prompt);
  
  if (currentTokens <= maxTokens) {
    return prompt;
  }

  // Calculate ratio and trim accordingly
  const ratio = maxTokens / currentTokens;
  const targetLength = Math.floor(prompt.length * ratio);
  
  // Trim and return
  return prompt.substring(0, targetLength).trim();
}

import { renderToString } from 'katex';

export type SegmentType = 'TEXT' | 'MATH_INLINE' | 'MATH_BLOCK' | 'CODE_INLINE' | 'CODE_BLOCK';

export interface MathSegment {
  type: SegmentType;
  content: string;
  original: string;
}

// Common LaTeX math commands that indicate mathematical content
const MATH_COMMANDS = [
  '\\frac', '\\sqrt', '\\sum', '\\int', '\\log', '\\ln', 
  '\\sin', '\\cos', '\\tan', '\\pi', '\\theta', '\\alpha', 
  '\\beta', '\\Delta', '\\pm', '\\times', '\\leq', '\\geq',
  '\\neq', '\\infty', '\\partial', '\\nabla', '\\prod'
];

// Mathematical operators and symbols
const MATH_SYMBOLS = ['×', '÷', '±', '≤', '≥', '√', '∞', '∑', '∫', 'π'];

/**
 * Detect if a string contains mathematical content
 */
export function detectMath(text: string): boolean {
  // Explicit delimiters are strong signals
  if (text.includes('$$') || text.includes('$')) {
    return true;
  }
  
  // Check for math commands
  for (const cmd of MATH_COMMANDS) {
    if (text.includes(cmd)) {
      return true;
    }
  }
  
  // Check for math symbols
  for (const sym of MATH_SYMBOLS) {
    if (text.includes(sym)) {
      return true;
    }
  }
  
  // Check for superscript/subscript patterns
  if (/[a-zA-Z]\^[\d\{\}]/.test(text) || /[a-zA-Z]_[\d\{\}]/.test(text)) {
    return true;
  }
  
  return false;
}

/**
 * Tokenize text into segments (TEXT, MATH_INLINE, MATH_BLOCK, CODE_INLINE, CODE_BLOCK)
 * Priority: code blocks > block math > inline math > text
 */
export function tokenizeMath(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let pos = 0;
  
  while (pos < text.length) {
    // Check for fenced code blocks ```...```
    const codeBlockMatch = text.slice(pos).match(/^```(\w*)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      const fullMatch = codeBlockMatch[0];
      segments.push({
        type: 'CODE_BLOCK',
        content: fullMatch,
        original: fullMatch
      });
      pos += fullMatch.length;
      continue;
    }
    
    // Check for inline code `...`
    const inlineCodeMatch = text.slice(pos).match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      const fullMatch = inlineCodeMatch[0];
      segments.push({
        type: 'CODE_INLINE',
        content: fullMatch,
        original: fullMatch
      });
      pos += fullMatch.length;
      continue;
    }
    
    // Check for block math $$...$$ or \[...\]
    const blockMathMatch = text.slice(pos).match(/^\$\$([\s\S]*?)\$\$/) || text.slice(pos).match(/^\\\[([\s\S]*?)\\\]/);
    if (blockMathMatch) {
      const fullMatch = blockMathMatch[0];
      const mathContent = blockMathMatch[1].trim();
      segments.push({
        type: 'MATH_BLOCK',
        content: mathContent,
        original: fullMatch
      });
      pos += fullMatch.length;
      continue;
    }
    
    // Check for inline math $...$ (but not $$)
    // More conservative: require at least one math command or symbol inside
    const inlineMathMatch = text.slice(pos).match(/^\$([^$\n]+)\$/) || text.slice(pos).match(/^\\\(([\s\S]*?)\\\)/);
    if (inlineMathMatch) {
      const fullMatch = inlineMathMatch[0];
      const mathContent = inlineMathMatch[1];
      
      // Only treat as math if it contains actual math commands/symbols, not just plain text
      const hasMathContent = MATH_COMMANDS.some(cmd => mathContent.includes(cmd)) ||
                            MATH_SYMBOLS.some(sym => mathContent.includes(sym)) ||
                            /[\^_]/.test(mathContent) ||
                            /\\[a-zA-Z]/.test(mathContent);
      
      if (hasMathContent) {
        segments.push({
          type: 'MATH_INLINE',
          content: mathContent,
          original: fullMatch
        });
        pos += fullMatch.length;
        continue;
      }
      // If no math content, treat as plain text (fall through to text handling)
    }
    
    // If no special pattern, consume one character as text
    // But try to grab a chunk of text for efficiency
    const nextSpecial = text.slice(pos).search(/[\$`\\]/);
    if (nextSpecial === -1) {
      // No more special chars, take the rest
      segments.push({
        type: 'TEXT',
        content: text.slice(pos),
        original: text.slice(pos)
      });
      break;
    } else if (nextSpecial > 0) {
      segments.push({
        type: 'TEXT',
        content: text.slice(pos, pos + nextSpecial),
        original: text.slice(pos, pos + nextSpecial)
      });
      pos += nextSpecial;
    } else {
      // Special char at current position, will be handled in next iteration
      segments.push({
        type: 'TEXT',
        content: text[pos],
        original: text[pos]
      });
      pos++;
    }
  }
  
  return segments;
}

/**
 * Normalize raw LaTeX by wrapping in $ delimiters when confident
 */
export function normalizeRawLaTeX(text: string): string {
  // Convert LaTeX delimiters to dollar signs
  // \[...\] -> $$...$$
  // \(...\) -> $...$
  let normalized = text;
  
  // Replace \[...\] with $$...$$
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$');
  
  // Replace \(...\) with $...$
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, '$$1$');
  
  // Only normalize if we detect math but no delimiters
  if (!detectMath(normalized) || normalized.includes('$')) {
    return normalized;
  }
  
  // Conservative: only wrap if we see clear math patterns
  // e.g., \frac{a}{b} -> $\frac{a}{b}$
  const fracPattern = /\\frac\{[^}]+\}\{[^}]+\}/g;
  const sqrtPattern = /\\sqrt\{[^}]+\}/g;
  const logPattern = /\\log_\{[^}]+\}/g;
  
  // Wrap \frac patterns
  normalized = normalized.replace(fracPattern, (match) => `$${match}$`);
  
  // Wrap \sqrt patterns
  normalized = normalized.replace(sqrtPattern, (match) => `$${match}$`);
  
  // Wrap \log patterns
  normalized = normalized.replace(logPattern, (match) => `$${match}$`);
  
  return normalized;
}

/**
 * Render a math segment using KaTeX
 */
export function renderMath(latex: string, displayMode: boolean): string {
  try {
    return renderToString(latex, { displayMode });
  } catch (error) {
    console.error('KaTeX render error:', error);
    return latex; // Fallback to original LaTeX on error
  }
}

/**
 * Performance timing for math rendering
 */
export interface MathRenderTiming {
  detectionMs: number;
  tokenizationMs: number;
  renderMs: number;
  totalMs: number;
}

export function measureMathRender(text: string, callback: () => void): MathRenderTiming {
  const timing: MathRenderTiming = {
    detectionMs: 0,
    tokenizationMs: 0,
    renderMs: 0,
    totalMs: 0
  };
  
  const start = performance.now();
  
  // Detection
  const detectStart = performance.now();
  const hasMath = detectMath(text);
  timing.detectionMs = performance.now() - detectStart;
  
  if (!hasMath) {
    timing.totalMs = performance.now() - start;
    callback();
    return timing;
  }
  
  // Tokenization
  const tokenizeStart = performance.now();
  const segments = tokenizeMath(text);
  timing.tokenizationMs = performance.now() - tokenizeStart;
  
  // Render (callback should handle actual rendering)
  const renderStart = performance.now();
  callback();
  timing.renderMs = performance.now() - renderStart;
  
  timing.totalMs = performance.now() - start;
  return timing;
}

import React, { useMemo } from 'react';
import { renderToString } from 'katex';
import { tokenizeMath, normalizeRawLaTeX, MathSegment, SegmentType, measureMathRender } from '@/lib/math/mathRenderer';

interface MathRendererProps {
  content: string;
  isStreaming?: boolean;
  onRenderTiming?: (timing: { detectionMs: number; tokenizationMs: number; renderMs: number; totalMs: number }) => void;
}

/**
 * Lightweight math renderer component
 * - Detects math in text
 * - Tokenizes into segments
 * - Renders each segment appropriately
 * - Preserves original content for copying
 */
export default function MathRenderer({ content, isStreaming = false, onRenderTiming }: MathRendererProps) {
  const segments = useMemo(() => {
    if (!content) return [];
    
    const normalizedContent = normalizeRawLaTeX(content);
    return tokenizeMath(normalizedContent);
  }, [content]);

  const timing = useMemo(() => {
    if (!content) return null;
    
    return measureMathRender(content, () => {
      // The actual rendering happens in the JSX below
    });
  }, [content]);

  // Report timing if callback provided
  React.useEffect(() => {
    if (timing && onRenderTiming) {
      onRenderTiming(timing);
    }
  }, [timing, onRenderTiming]);

  // During streaming, just show plain text to avoid expensive re-renders
  if (isStreaming) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return (
    <div className="math-renderer">
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`;
        
        switch (segment.type) {
          case 'TEXT':
            return <span key={key} className="text-segment">{segment.content}</span>;
          
          case 'MATH_INLINE':
            try {
              const html = renderToString(segment.content, { displayMode: false });
              return (
                <span 
                  key={key} 
                  className="math-inline"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (error) {
              console.error('KaTeX inline render error:', error);
              return <span key={key} className="math-fallback">${segment.content}</span>;
            }
          
          case 'MATH_BLOCK':
            try {
              const html = renderToString(segment.content, { displayMode: true });
              return (
                <div 
                  key={key} 
                  className="math-block my-4 overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            } catch (error) {
              console.error('KaTeX block render error:', error);
              return <pre key={key} className="math-fallback">$$\n{segment.content}\n$$</pre>;
            }
          
          case 'CODE_INLINE':
            return <code key={key} className="bg-neutral-800 px-1 py-0.5 rounded text-sm">{segment.content}</code>;
          
          case 'CODE_BLOCK':
            const lines = segment.content.split('\n');
            const language = lines[0].replace('```', '').trim();
            const codeContent = lines.slice(1, -1).join('\n');
            return (
              <pre key={key} className="bg-neutral-900 p-4 rounded-lg overflow-x-auto my-4">
                <code className="text-sm">{codeContent}</code>
              </pre>
            );
          
          default:
            return <span key={key}>{segment.content}</span>;
        }
      })}
    </div>
  );
}

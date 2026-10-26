"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useHighlightedCode } from '@/hooks/use-highlighted-code';

interface StreamingCodeBlockProps {
  streamContent: string;
  language: string;
  theme?: string;
  className?: string;
  isComplete?: boolean;
  onStartMessage?: string;
}

export default function StreamingCodeBlock({ 
  streamContent, 
  language, 
  className = '',
  isComplete = false,
}: StreamingCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = useHighlightedCode(streamContent, language);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(streamContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatLanguage = (lang: string) => {
    if (!lang || lang === 'code') return 'Code';
    const l = lang.toLowerCase().trim();
    if (l === 'js' || l === 'javascript') return 'JavaScript';
    if (l === 'ts' || l === 'typescript') return 'TypeScript';
    if (l === 'py' || l === 'python') return 'Python';
    if (l === 'css') return 'CSS';
    if (l === 'html') return 'HTML';
    if (l === 'jsx') return 'JSX';
    if (l === 'tsx') return 'TSX';
    return lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  };

  return (
    <div data-slot="code-block" className={`my-4 rounded-xl sm:rounded-2xl bg-[#1c1c1e] overflow-hidden w-full max-w-full min-w-0 ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-[#1c1c1e] border-b border-[#1c1c1e] select-none">
        <div className="flex items-center gap-2 min-w-0">
          {/* Show icon only for code languages, not for plain text */}
          {language !== 'plaintext' && language !== 'text' && (
            <img src="/file-code-regular-full.svg" alt="code" className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold text-neutral-200 truncate">
            {formatLanguage(language)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="p-1 sm:p-1.5 transition-colors rounded text-neutral-400 hover:text-white"
            title="Copy"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="code-scrollbar overflow-x-auto max-w-full px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-mono leading-relaxed text-neutral-200">
        <pre className="overflow-x-auto max-w-full" style={{ margin: 0, padding: 0, background: 'transparent' }}>
          <code className="block max-w-full" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "JetBrains Mono", monospace' }}>
            {lines.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
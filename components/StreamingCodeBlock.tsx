"use client";

import React, { useState, useEffect, useRef } from 'react';
import { codeToHtml } from 'shiki';
import { Download, Copy, Check, Code2, Loader2 } from 'lucide-react';

interface StreamingCodeBlockProps {
  streamContent: string;
  language: string;
  theme?: string;
  className?: string;
  isComplete?: boolean;
  onStartMessage?: string;
}

const formatLanguage = (lang: string) => {
  if (!lang || lang === 'code') return 'Code';
  const l = lang.toLowerCase().trim();
  if (l === 'js' || l === 'javascript') return 'JavaScript';
  if (l === 'ts' || l === 'typescript') return 'TypeScript';
  if (l === 'py' || l === 'python') return 'Python';
  if (l === 'cpp' || l === 'c++') return 'C++';
  if (l === 'cs' || l === 'csharp' || l === 'c#') return 'C#';
  if (l === 'html') return 'HTML';
  if (l === 'css') return 'CSS';
  if (l === 'json') return 'JSON';
  if (l === 'jsx') return 'JSX';
  if (l === 'tsx') return 'TSX';
  return lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
};

export default function StreamingCodeBlock({ 
  streamContent, 
  language, 
  theme = 'dracula',
  className = '',
  isComplete = false,
}: StreamingCodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);
  const lastHighlightTimeRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<NodeJS.Timeout>();

  // Check horizontal overflow to conditionally render side triangle icons
  useEffect(() => {
    const checkOverflow = () => {
      if (codeRef.current) {
        setHasOverflow(codeRef.current.scrollWidth > codeRef.current.clientWidth + 2);
      }
    };

    checkOverflow();
    const timer = setTimeout(checkOverflow, 80);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [streamContent, highlightedCode]);

  useEffect(() => {
    if (!streamContent) return;

    let isMounted = true;

    const doHighlight = async () => {
      try {
        const lang = language && language.trim() !== '' ? language : 'plaintext';
        const html = await codeToHtml(streamContent, {
          lang,
          theme: 'dracula',
        });
        if (isMounted) {
          setHighlightedCode(html);
          lastHighlightTimeRef.current = Date.now();
        }
      } catch (error) {
        console.error('Error in Shiki highlighting:', error);
      }
    };

    const now = Date.now();
    const elapsed = now - lastHighlightTimeRef.current;

    if (elapsed >= 60 || isComplete) {
      doHighlight();
    } else {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = setTimeout(() => {
        if (isMounted) doHighlight();
      }, 60 - elapsed);
    }

    return () => {
      isMounted = false;
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, [streamContent, language, isComplete]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(streamContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const extension = language === 'typescript' ? 'ts' :
                      language === 'javascript' ? 'js' :
                      language === 'python' ? 'py' :
                      language === 'jsx' ? 'jsx' :
                      language === 'tsx' ? 'tsx' :
                      language === 'css' ? 'css' :
                      language === 'html' ? 'html' : 'txt';

    const blob = new Blob([streamContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`relative group my-4 rounded-xl border border-neutral-800/60 bg-[#1c1c1e] overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1c1c1e] border-b border-neutral-800/60 select-none">
        <div className="flex items-center gap-2">
          {!isComplete || !streamContent ? (
            <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
          ) : (
            <Code2 className="w-4 h-4 text-neutral-400" />
          )}
          <span className="text-sm font-semibold text-neutral-200">
            {formatLanguage(language)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className={`p-1 transition-colors rounded ${
              !isComplete || !streamContent
                ? 'text-neutral-600 cursor-not-allowed opacity-40'
                : 'text-neutral-400 hover:text-white'
            }`}
            disabled={!isComplete || !streamContent}
            title={!isComplete ? 'Generating code...' : 'Download Code'}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className={`p-1 transition-colors rounded ${
              !isComplete || !streamContent
                ? 'text-neutral-600 cursor-not-allowed opacity-40'
                : 'text-neutral-400 hover:text-white'
            }`}
            disabled={!isComplete || !streamContent}
            title={!isComplete ? 'Generating code...' : 'Copy Code'}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Code Content Container (Scrollbar reaches bottom at exact level with triangles) */}
      <div
        ref={codeRef}
        className="code-scrollbar overflow-x-auto mx-5 pt-3.5 pb-2 text-xs sm:text-sm font-mono leading-[1.7] text-neutral-200"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "JetBrains Mono", monospace',
        }}
      >
        {highlightedCode ? (
          <div
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            className="shiki transition-opacity duration-150"
            style={{
              background: 'transparent',
              padding: 0,
              margin: 0,
            }}
          />
        ) : (
          <pre style={{ margin: 0, padding: 0, background: 'transparent' }}>
            <code style={{ fontFamily: 'inherit' }}>{streamContent}</code>
          </pre>
        )}
      </div>

      {/* Side Icon Indicators (Only rendered when code overflows horizontally) */}
      {hasOverflow && (
        <>
          <div className="absolute left-1 bottom-0 h-3.5 flex items-center z-10 pointer-events-none text-neutral-400 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14" fill="#e3e3e3">
              <path d="M640-200 200-480l440-280v560Z"/>
            </svg>
          </div>

          <div className="absolute right-1 bottom-0 h-3.5 flex items-center z-10 pointer-events-none text-neutral-400 opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14" fill="#e3e3e3" style={{ transform: 'rotate(180deg)' }}>
              <path d="M640-200 200-480l440-280v560Z"/>
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
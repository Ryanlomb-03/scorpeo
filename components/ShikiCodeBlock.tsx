"use client";

import React, { useState, useEffect, useRef } from 'react';
import { codeToHtml } from 'shiki';

interface ShikiCodeBlockProps {
  code: string;
  language: string;
  theme?: string;
  className?: string;
}

export default function ShikiCodeBlock({ 
  code, 
  language, 
  theme = 'github-dark',
  className = '' 
}: ShikiCodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const highlightCode = async () => {
      try {
        setIsLoading(true);
        const html = await codeToHtml(code, {
          lang: language,
          theme: theme,
        });
        setHighlightedCode(html);
      } catch (error) {
        console.error('Error highlighting code:', error);
        // Fallback to plain code if Shiki fails
        setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    };

    if (code) {
      highlightCode();
    }
  }, [code, language, theme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Premium code block container */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 1px 1px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.18)',
        }}
      >
        {/* Sticky header with language and copy button */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{
            background: 'rgba(13, 17, 23, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            height: '44px',
          }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#8b949e'
              }}
            >
              {language}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-gray-300 hover:text-white transition-colors hover:bg-white/5"
          >
            {copied ? (
              <>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 0 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
                <span className="text-green-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
                <span className="font-medium">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code content */}
        <div 
          ref={codeRef}
          className="overflow-x-auto"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.7',
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-gray-400 mr-3" />
              <span>Highlighting code...</span>
            </div>
          ) : (
            <div 
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
              className="shiki"
              style={{
                background: 'transparent',
                padding: '20px 24px',
                margin: 0,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
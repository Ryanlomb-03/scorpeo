import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import StreamingCodeBlock from './StreamingCodeBlock';
import 'katex/dist/katex.min.css';

const LIMIT = 150;

// Equation symbol definitions for tooltips
const EQUATION_SYMBOLS: Record<string, string> = {
  "R_{\\mu\\nu}": "Ricci curvature tensor - Measures how volumes change due to curvature",
  "R": "Ricci scalar - The trace/contraction of the Ricci tensor",
  "g_{\\mu\\nu}": "Metric tensor - Defines distances and geometry of spacetime",
  "G": "Gravitational constant - Newton's constant (~6.674×10⁻¹¹ m³/kg/s²)",
  "c": "Speed of light - (~3×10⁸ m/s)",
  "T_{\\mu\\nu}": "Stress-energy tensor - Contains all matter and energy content",
  "\\Lambda": "Cosmological constant - Represents vacuum energy",
  "\\pi": "Pi - Mathematical constant (~3.14159)",
  "\\mu": "Mu - Index notation (spacetime indices)",
  "\\nu": "Nu - Index notation (spacetime indices)",
};

export default function MessageBubble({ role, content, onEdit, isLoading, loadingPhase, messageId, userId, conversationId, onRetry, onVersionChange }: { role: string; content: string; onEdit?: (newContent: string) => void; isLoading?: boolean; loadingPhase?: number; messageId?: string; userId?: string; conversationId?: string; onRetry?: (messageId: string) => void; onVersionChange?: (messageId: string, version: number, content: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showTOC, setShowTOC] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [totalVersions, setTotalVersions] = useState(1);
  const [isRetrying, setIsRetrying] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingIndexRef = useRef(0);

  useEffect(() => {
    setEditText(content);
    headingIndexRef.current = 0; // Reset heading index when content changes
  }, [content]);

  const isUser = role === "user";

  // Fetch user's existing reaction when messageId and userId are available
  useEffect(() => {
    if (messageId && userId && !isUser) {
      fetchReaction();
    }
  }, [messageId, userId, isUser]);

  const fetchReaction = async () => {
    try {
      const response = await fetch(`/api/reactions?messageId=${messageId}`, {
        headers: {
          'x-user-id': userId || ''
        }
      });
      const data = await response.json();
      if (data.reaction) {
        if (data.reaction.reaction_type === 'like') {
          setLiked(true);
          setDisliked(false);
        } else if (data.reaction.reaction_type === 'dislike') {
          setDisliked(true);
          setLiked(false);
        }
      }
    } catch (error) {
      console.error('Error fetching reaction:', error);
    }
  };

  // Fetch message versions for retry system
  useEffect(() => {
    if (messageId && conversationId && !isUser) {
      fetchMessageVersions();
    }
  }, [messageId, conversationId, isUser]);

  const fetchMessageVersions = async () => {
    try {
      const response = await fetch(`/api/retry?messageId=${messageId}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const messageData = data[0];
          setTotalVersions(messageData.total_versions || 1);
          setCurrentVersion(messageData.current_version || 1);
          setVersionHistory(messageData.all_versions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching message versions:', error);
    }
  };

  const handleRetry = async () => {
    if (!messageId || !conversationId || isRetrying) return;
    
    setIsRetrying(true);
    try {
      if (onRetry) {
        await onRetry(messageId);
        // After retry completes, fetch the new version data
        setTimeout(() => fetchMessageVersions(), 1000);
      }
    } catch (error) {
      console.error('Error during retry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleVersionChange = (newVersion: number) => {
    if (newVersion < 1 || newVersion > totalVersions) return;
    
    const version = versionHistory.find(v => v.version === newVersion);
    if (version && onVersionChange) {
      setCurrentVersion(newVersion);
      onVersionChange(messageId || '', newVersion, version.content);
    }
  };

  const goToPreviousVersion = () => {
    if (currentVersion > 1) {
      handleVersionChange(currentVersion - 1);
    }
  };

  const goToNextVersion = () => {
    if (currentVersion < totalVersions) {
      handleVersionChange(currentVersion + 1);
    }
  };

  // Generate table of contents from markdown content
  const tocData = (() => {
    const headings: Array<{ id: string; text: string; level: string }> = [];
    const lines = content.split('\n');

    lines.forEach((line) => {
      const h1Match = line.match(/^#\s+(.+)$/);
      const h2Match = line.match(/^##\s+(.+)$/);
      const h3Match = line.match(/^###\s+(.+)$/);

      if (h1Match) {
        const text = h1Match[1].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        headings.push({ id: `heading-${id}`, text, level: 'h1' });
      } else if (h2Match) {
        const text = h2Match[1].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        headings.push({ id: `heading-${id}`, text, level: 'h2' });
      } else if (h3Match) {
        const text = h3Match[1].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        headings.push({ id: `heading-${id}`, text, level: 'h3' });
      }
    });

    return headings;
  })();

  // Check if content is long enough for TOC
  const hasLongContent = content.length > 500 && (content.includes('##') || content.includes('###'));

  useEffect(() => {
    if (hasLongContent) {
      setShowTOC(true);
    }
  }, [content, hasLongContent]);


  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isLong = content.length > LIMIT;
  const isShort = content.length <= 30 && !content.includes('\n');

  const getTruncatedText = () => {
    if (!isLong || expanded) return content;
    let truncated = content.slice(0, LIMIT);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
    return truncated + " ...";
  };

  const renderContent = () => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'plaintext';
            const codeContent = String(children).replace(/\n$/, '');

            if (!inline) {
              return (
                <div className="my-4">
                  <StreamingCodeBlock 
                    streamContent={codeContent}
                    language={language}
                    theme="github-dark"
                    isComplete={!isLoading}
                    onStartMessage={isLoading ? "Generating code..." : "Here's the code for this solution:"}
                  />
                </div>
              );
            }
            return (
              <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            const text = String(children).trim();
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return <h1 id={`heading-${id}`} className="text-2xl font-bold mb-6 mt-8 scroll-mt-4">{children}</h1>;
          },
          h2({ children }) {
            const text = String(children).trim();
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return <h2 id={`heading-${id}`} className="text-xl font-bold mb-4 mt-8 scroll-mt-4">{children}</h2>;
          },
          h3({ children }) {
            const text = String(children).trim();
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return <h3 id={`heading-${id}`} className="text-lg font-bold mb-3 mt-6 scroll-mt-4">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="ml-2">{children}</li>;
          },
          strong({ children }) {
            return <strong className="font-bold">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          a({ children, href }) {
            return <a href={href} className="text-blue-400 hover:text-blue-300 underline">{children}</a>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-neutral-600 pl-4 italic my-4">{children}</blockquote>;
          },
          table({ children }) {
            return (
              <div className="my-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="border-b border-neutral-700">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody>{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="border-b border-neutral-800 last:border-0">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-4 py-3 text-left font-semibold text-sm">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3 text-sm">{children}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    if (onEdit && editText.trim() && editText !== content) {
      onEdit(editText);
    }
    setIsEditing(false);
  };

  const handleLike = async () => {
    if (!messageId || !userId) return;
    
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          messageId,
          reactionType: 'like'
        })
      });
      const data = await response.json();
      
      if (data.action === 'created') {
        setLiked(true);
        setDisliked(false);
      } else if (data.action === 'removed') {
        setLiked(false);
      }
    } catch (error) {
      console.error('Error liking message:', error);
    }
  };

  const handleDislike = async () => {
    if (!messageId || !userId) return;
    
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          messageId,
          reactionType: 'dislike'
        })
      });
      const data = await response.json();
      
      if (data.action === 'created') {
        setDisliked(true);
        setLiked(false);
      } else if (data.action === 'removed') {
        setDisliked(false);
      }
    } catch (error) {
      console.error('Error disliking message:', error);
    }
  };

  if (isEditing) {
    const isEditShort = content.length <= 30 && !content.includes('\n');
    
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`w-full max-w-3xl bg-neutral-800 border border-neutral-700 rounded-3xl p-4`}>
          <textarea
            className="w-full bg-transparent outline-none text-white text-base resize-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={isEditShort ? 1 : 5}
            autoFocus
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 240) + 'px';
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="text-gray-400 text-sm hover:text-white px-4 py-2"
            >
              Cancel
            </button>
            <button 
              onClick={handleEditSubmit}
              disabled={!editText.trim() || editText === content}
              className={`text-sm px-5 py-2 rounded-full font-medium transition-colors ${
                editText.trim() && editText !== content
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-neutral-500 text-neutral-300 cursor-not-allowed'
              }`}
            >
              Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="flex flex-col items-end max-w-[70%] group">
          <div className={`
            outline-none
            bg-[#2f2f2f] text-white ${isShort ? 'rounded-full px-5 py-3 text-base' : 'rounded-2xl text-sm px-4 py-3'}
            leading-relaxed
            relative
          `}>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {getTruncatedText()}
            </div>
            {isLong && !expanded && (
              <button 
                onClick={() => setExpanded(!expanded)}
                className="absolute top-2 right-2 cursor-pointer hover:opacity-70 transition-opacity z-10"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'brightness(0) invert(1)' }}>
                <polyline points="6 9 12 15 18 9"/>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              </button>
            )}
            {isLong && expanded && (
              <button 
                onClick={() => setExpanded(!expanded)}
                className="absolute top-2 right-2 cursor-pointer hover:opacity-70 transition-opacity"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'brightness(0) invert(1)', transform: 'rotate(180deg)', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
              title={copied ? "Copied!" : "Copy"}
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ) : (
                <img src="/icons/copy.svg" alt="Copy" width="16" height="16" />
              )}
            </button>
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="M15 5l-4 4"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state for AI - simple pulsing white dot
  if (isLoading) {
    return (
      <div className="flex gap-3 mb-6 items-start">
        <div className="flex items-center pt-2">
          <div className="pulse-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-1 max-w-2xl -mt-0.5">
        {/* Table of Contents */}
        {showTOC && !isUser && (
          <div className="mb-6 p-4 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Contents</h4>
            <div className="space-y-2">
              {tocData.map((item: { id: string; text: string; level: string }) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={`block text-left text-sm hover:text-white transition-colors ${
                    item.level === 'h1' ? 'font-semibold text-gray-200' :
                    item.level === 'h2' ? 'text-gray-300 ml-2' :
                    'text-gray-400 ml-4'
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={contentRef} className="text-gray-200 text-[15px] leading-[1.7] relative">
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {getTruncatedText()}
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {renderContent()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 ml-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            ) : (
              <img src="/icons/copy.svg" alt="Copy" width="20" height="20" />
            )}
          </button>
          {liked ? (
            <button
              onClick={handleLike}
              className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
              title="Like"
            >
              <img src="/icons/like-filled.svg" alt="Like" width="20" height="20" />
            </button>
          ) : disliked ? (
            <button
              onClick={handleDislike}
              className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
              title="Dislike"
            >
              <img src="/icons/dislike-filled.svg" alt="Dislike" width="20" height="20" />
            </button>
          ) : (
            <>
              <button
                onClick={handleLike}
                className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
                title="Like"
              >
                <img src="/icons/like.svg" alt="Like" width="20" height="20" />
              </button>
              <button
                onClick={handleDislike}
                className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors"
                title="Dislike"
              >
                <img src="/icons/dislike.svg" alt="Dislike" width="20" height="20" />
              </button>
            </>
          )}
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="p-1.5 rounded-full hover:bg-neutral-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRetrying ? "Generating..." : "Retry"}
          >
            {isRetrying ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <img src="/icons/retry.svg" alt="Retry" width="20" height="20" />
            )}
          </button>
        </div>
        {/* Version Navigation */}
        {totalVersions > 1 && (
          <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
            <button
              onClick={goToPreviousVersion}
              disabled={currentVersion === 1}
              className="p-1 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
              </svg>
            </button>
            <span className="text-neutral-500 font-medium">
              {currentVersion}/{totalVersions}
            </span>
            <button
              onClick={goToNextVersion}
              disabled={currentVersion === totalVersions}
              className="p-1 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

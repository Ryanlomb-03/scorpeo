import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import type { Element } from 'hast';
import StreamingCodeBlock from './StreamingCodeBlock';
import WindowsArtifact from './WindowsArtifact';
import InstallationSequence from './InstallationSequence';
import QuizArtifact from './QuizArtifact';
import type { QuizArtifactType } from './QuizArtifact';
import { WindowsArtifact as WindowsArtifactType } from '@/types/windows';
import ClockArtifact, { ClockArtifactType } from './ClockArtifact';
import { GridCardsArtifact } from './artifacts/GridCardsArtifact';
import { TimetableArtifact } from './artifacts/TimetableArtifact';
import { MathMatrixArtifact } from './artifacts/MathMatrixArtifact';
import YouTubeVideoCard from './YouTubeVideoCard';
import { Artifact as ArtifactType, STUDY_METHODS_OPEN_TAG, STUDY_METHODS_CLOSE_TAG, TIMETABLE_OPEN_TAG, TIMETABLE_CLOSE_TAG, MATH_MATRIX_OPEN_TAG, MATH_MATRIX_CLOSE_TAG } from '@/types/artifacts';
import { extractVideoId, getVideoInfo, formatDuration } from '@/lib/youtube';
import {
  AlertTriangle,
  Info,
  CircleCheck,
  CircleX,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  Flame,
  OctagonX,
  Skull,
  Zap,
  Ban,
  MessageCircleWarning,
  StickyNote
} from 'lucide-react';

const LIMIT = 150;

/**
 * Custom rehype plugin to unwrap code blocks from paragraphs
 * This prevents hydration errors where <div> or <pre> cannot be descendants of <p>
 */
function rehypeUnwrapCodeBlocks() {
  const isBlockLike = (el: any): boolean => {
    if (!el || el.type !== 'element') return false;
    if (el.tagName === 'code') {
      const className = el.properties?.className || [];
      return className.some((c: string) => c.startsWith('language-'));
    }
    if (typeof el.tagName === 'string' && (el.tagName.startsWith('callout-') || el.tagName === 'div' || el.tagName === 'pre' || el.tagName === 'table')) {
      return true;
    }
    if (el.children && Array.isArray(el.children)) {
      return el.children.some(isBlockLike);
    }
    return false;
  };

  return (tree: any) => {
    visit(tree, 'element', (node: Element) => {
      // If this is a paragraph containing a code block, callout block, or other block elements
      if (node.tagName === 'p' && node.children) {
        const hasBlockElement = node.children.some(isBlockLike);
        
        if (hasBlockElement) {
          // Change paragraph to div
          node.tagName = 'div';
          node.properties = node.properties || {};
          node.properties.className = 'mb-4 last:mb-0 leading-relaxed';
        }
      }
    });
  };
}

/**
 * Normalize LaTeX delimiters to dollar signs for KaTeX rendering
 * Converts \(...\) to $...$ and \[...\] to $$...$$
 * Skips content inside fenced code blocks and inline code
 */
function normalizeLatexDelimiters(text: string): string {
  let result = '';
  let pos = 0;
  
  while (pos < text.length) {
    // Check for fenced code block ```...```
    const codeBlockMatch = text.slice(pos).match(/^```[\s\S]*?```/);
    if (codeBlockMatch) {
      result += codeBlockMatch[0];
      pos += codeBlockMatch[0].length;
      continue;
    }
    
    // Check for inline code `...`
    const inlineCodeMatch = text.slice(pos).match(/^`[^`]+`/);
    if (inlineCodeMatch) {
      result += inlineCodeMatch[0];
      pos += inlineCodeMatch[0].length;
      continue;
    }
    
    // Check for block LaTeX \[...\]
    const blockLatexMatch = text.slice(pos).match(/^\\\[([\s\S]*?)\\\]/);
    if (blockLatexMatch) {
      const mathContent = blockLatexMatch[1];
      result += `$$${mathContent}$$`;
      pos += blockLatexMatch[0].length;
      continue;
    }
    
    // Check for inline LaTeX \(...\)
    const inlineLatexMatch = text.slice(pos).match(/^\\\(([\s\S]*?)\\\)/);
    if (inlineLatexMatch) {
      const mathContent = inlineLatexMatch[1];
      result += `$${mathContent}$`;
      pos += inlineLatexMatch[0].length;
      continue;
    }
    
    // Regular text, add one character
    result += text[pos];
    pos++;
  }
  
  return result;
}

/**
 * Normalize whitespace in content
 * Specifically targets blank lines around tables and collapses excessive consecutive blank lines,
 * while safely preserving code block indentations and table structures.
 */
function normalizeWhitespace(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Preserve code blocks without modification
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    
    const isTableRow = trimmed.startsWith('|');
    const isBlank = trimmed.length === 0;
    
    if (isTableRow) {
      if (inTable) {
        result.push(line);
      } else {
        // Start of table: remove any excess blank lines preceding the table
        while (result.length > 0 && result[result.length - 1].trim().length === 0) {
          result.pop();
        }
        // Ensure exactly one blank line before table if preceded by text so markdown parses correctly
        if (result.length > 0) {
          result.push('');
        }
        result.push(line);
        inTable = true;
      }
    } else if (inTable && isBlank) {
      // First blank line right after table
      inTable = false;
      const prevWasBlank = result.length > 0 && result[result.length - 1].trim().length === 0;
      if (!prevWasBlank) {
        result.push('');
      }
    } else if (!isBlank) {
      inTable = false;
      result.push(line);
    } else {
      inTable = false;
      // Blank line elsewhere: collapse consecutive blank lines into at most one
      const prevWasBlank = result.length > 0 && result[result.length - 1].trim().length === 0;
      if (!prevWasBlank) {
        result.push('');
      }
    }
  }
  
  return result.join('\n').trim();
}

/**
 * Parse Windows artifacts from content
 * Looks for <?windows?> ... </?windows?> blocks
 */
function parseWindowsArtifacts(content: string): { artifacts: WindowsArtifactType[], cleanedContent: string } {
  const artifacts: WindowsArtifactType[] = [];
  let cleanedContent = content;
  
  // First, check for partial/incomplete artifact during streaming
  // If we see <?windows?> but no closing tag, create a placeholder
  const hasOpeningTag = content.includes('<?windows?>');
  const hasClosingTag = content.includes('</?windows?>');
  
  if (hasOpeningTag && !hasClosingTag) {
    // Create a placeholder artifact that will be replaced when complete
    const placeholderArtifact: WindowsArtifactType = {
      type: 'windows',
      language: 'loading',
      lines: [],
      theme: 'terminal',
      status: 'success' // Use 'success' to show grey play button
    };
    artifacts.push(placeholderArtifact);
    // Hide the opening tag from markdown
    cleanedContent = cleanedContent.replace(/<\?windows\?>[\s\S]*/, '');
    return { artifacts, cleanedContent };
  }
  
  // Match complete <?windows?> ... </?windows?> blocks
  const artifactRegex = /<\?windows\?>([\s\S]*?)<\/\?windows\?>/g;
  let match;
  
  while ((match = artifactRegex.exec(content)) !== null) {
    try {
      const artifact: WindowsArtifactType = JSON.parse(match[1].trim());
      if (artifact.type === 'windows') {
        artifacts.push(artifact);
        // Replace with empty string to hide from markdown rendering
        cleanedContent = cleanedContent.replace(match[0], '');
      }
    } catch (e) {
      // Invalid JSON, still hide the raw content
      cleanedContent = cleanedContent.replace(match[0], '');
    }
  }
  
  return { artifacts, cleanedContent };
}

/**
 * Parse Clock artifacts from content
 * Looks for <?clock?> ... </?clock?> blocks
 */
function parseClockArtifacts(content: string): { clocks: ClockArtifactType[], cleanedContent: string } {
  const clocks: ClockArtifactType[] = [];
  let cleanedContent = content;

  console.log('[ClockArtifact] Parsing content:', content.substring(0, 200));

  // During streaming: hide <?clock?> content immediately
  const clockStartRegex = /<\?clock\?>([\s\S]*)$/;
  const clockStartMatch = content.match(clockStartRegex);

  if (clockStartMatch) {
    console.log('[ClockArtifact] Found streaming clock artifact');
    cleanedContent = content.replace(clockStartRegex, '');

    try {
      const partialData = clockStartMatch[1].trim();
      
      // Only parse if the closing tag is present (complete block)
      const hasClosingTag = partialData.endsWith('</?clock?>');
      
      if (hasClosingTag) {
        // Remove closing tag
        const withoutClosingTag = partialData.replace(/<\/\?clock\?>$/, '').trim();
        console.log('[ClockArtifact] Complete clock artifact:', withoutClosingTag.substring(0, 200));

        if (withoutClosingTag.startsWith('{')) {
          try {
            const clock: ClockArtifactType = JSON.parse(withoutClosingTag);
            if (clock.type === 'clock') {
              clocks.push(clock);
              console.log('[ClockArtifact] Added clock artifact:', clock);
            }
          } catch (parseError) {
            console.error('[ClockArtifact] JSON parse error:', parseError);
          }
        }
      } else {
        console.log('[ClockArtifact] Clock artifact not yet complete, waiting for closing tag');
      }
    } catch (e) {
      console.error('[ClockArtifact] Parse error during streaming:', e);
    }

    return { clocks, cleanedContent };
  }

  // Match complete <?clock?> ... </?clock?> blocks
  const clockRegex = /<\?clock\?>([\s\S]*?)<\/\?clock\?>/g;
  let match;

  while ((match = clockRegex.exec(content)) !== null) {
    try {
      const clock: ClockArtifactType = JSON.parse(match[1].trim());
      if (clock.type === 'clock') {
        clocks.push(clock);
        cleanedContent = cleanedContent.replace(match[0], '');
        console.log('[ClockArtifact] Added complete clock artifact:', clock);
      }
    } catch (e) {
      console.error('[ClockArtifact] Parse error:', e);
      cleanedContent = cleanedContent.replace(match[0], '');
    }
  }

  console.log('[ClockArtifact] Final clocks array:', clocks);
  return { clocks, cleanedContent };
}

/**
 * Parse quiz artifacts from content
 * Looks for <?quiz?> ... </?quiz?> blocks
 */
function parseQuizArtifacts(content: string): { quizzes: QuizArtifactType[], cleanedContent: string } {
  const quizzes: QuizArtifactType[] = [];
  let cleanedContent = content;
  
  // During streaming: hide <?quiz?> content immediately to prevent raw JSON from showing
  const quizStartRegex = /<\?quiz\?>([\s\S]*)$/;
  const quizStartMatch = content.match(quizStartRegex);
  
  if (quizStartMatch) {
    // Hide everything from <?quiz?> onwards during streaming
    cleanedContent = content.replace(quizStartRegex, '');
    
    // Try to parse partial quiz data
    try {
      const partialData = quizStartMatch[1].trim();
      // Check if we have at least the opening brace
      if (partialData.startsWith('{')) {
        // Try to parse what we have so far
        // Find the last complete closing brace to extract valid JSON
        let braceCount = 0;
        let lastValidIndex = -1;
        
        for (let i = 0; i < partialData.length; i++) {
          if (partialData[i] === '{') braceCount++;
          if (partialData[i] === '}') braceCount--;
          if (braceCount === 0 && i > lastValidIndex) {
            lastValidIndex = i;
          }
        }
        
        if (lastValidIndex >= 0) {
          const jsonStr = partialData.substring(0, lastValidIndex + 1);
          const quiz: QuizArtifactType = JSON.parse(jsonStr);
          if (quiz.type === 'quiz' && quiz.title) {
            quizzes.push(quiz);
          }
        }
      }
    } catch (e) {
      // Invalid partial JSON, that's okay during streaming
    }
    
    return { quizzes, cleanedContent };
  }
  
  // Complete <?quiz?> ... </?quiz?> blocks
  const quizRegex = /<\?quiz\?>([\s\S]*?)<\/\?quiz\?>/g;
  let match;
  
  while ((match = quizRegex.exec(content)) !== null) {
    try {
      const quiz: QuizArtifactType = JSON.parse(match[1].trim());
      if (quiz.type === 'quiz' && quiz.title) {
        quizzes.push(quiz);
      }
      cleanedContent = cleanedContent.replace(match[0], '');
    } catch (e) {
      cleanedContent = cleanedContent.replace(match[0], '');
    }
  }
  
  return { quizzes, cleanedContent };
}

/**
 * Parse installation sequences from content
 * Looks for <?install?> delimiters OR detects numbered step patterns for installation
 */
function parseInstallationSequences(content: string): { sequences: string[][], cleanedContent: string } {
  const sequences: string[][] = [];
  let cleanedContent = content;
  
  // Match <?install?> ... </?install?> blocks
  const installRegex = /<\?install\?>([\s\S]*?)<\/\?install\?>/g;
  let match;
  
  while ((match = installRegex.exec(content)) !== null) {
    try {
      const steps = match[1].trim().split('\n').filter(line => line.trim());
      sequences.push(steps);
      // Replace with empty string to hide from markdown rendering
      cleanedContent = cleanedContent.replace(match[0], '');
    } catch (e) {
      // Invalid format, still hide the raw content
      cleanedContent = cleanedContent.replace(match[0], '');
    }
  }
  
  // Fallback: Detect numbered steps that look like installation instructions
  // Pattern: "Step 1:", "Step 2:", etc. with terminal commands
  const stepPattern = /(?:Step\s+\d+:|^\d+\.)\s*.*$/gm;
  const stepMatches = content.match(stepPattern);
  
  if (stepMatches && stepMatches.length >= 3) {
    // Check if these look like installation steps (contain install, setup, create, etc.)
    const installKeywords = ['install', 'setup', 'create', 'npm', 'pip', 'yarn', 'brew', 'apt', 'git', 'clone', 'build', 'run'];
    const hasInstallKeywords = stepMatches.some(step => 
      installKeywords.some(keyword => step.toLowerCase().includes(keyword))
    );
    
    if (hasInstallKeywords && sequences.length === 0) {
      // Extract all steps between the first and last step marker
      const firstStepIndex = content.search(stepPattern);
      const lines = content.substring(firstStepIndex).split('\n');
      const steps: string[] = [];
      
      for (const line of lines) {
        if (stepPattern.test(line)) {
          steps.push(line.replace(/^(?:Step\s+\d+:|\d+\.)\s*/i, '').trim());
        } else if (line.trim().startsWith('```') || line.trim() === '') {
          continue;
        } else if (steps.length > 0 && line.trim()) {
          // Add continuation lines
          steps[steps.length - 1] += ' ' + line.trim();
        }
      }
      
      if (steps.length > 0) {
        sequences.push(steps);
        // Remove the original steps from content
        cleanedContent = cleanedContent.replace(stepPattern, '');
      }
    }
  }
  
  return { sequences, cleanedContent };
}

/**
 * Normalize semantic markers to custom element syntax
 * 
 * Inline markers (icons only):
 *   ::warning::, ::info::, ::success::, ::error::, ::tip::, ::arrow::
 *   ::danger::, ::caution::, ::note::, ::fatal::, ::ban::, ::zap::
 * 
 * Block-level callout alerts (icon + colored box wrapping content):
 *   :::danger content goes here :::
 *   :::caution content goes here :::
 *   :::warning content goes here :::
 *   :::note content goes here :::
 *   :::info content goes here :::
 *   :::tip content goes here :::
 *   :::success content goes here :::
 *   :::error content goes here :::
 *   :::fatal content goes here :::
 * 
 * Multi-line block callouts:
 *   :::danger
 *   This is dangerous content
 *   that spans multiple lines
 *   :::
 * 
 * Step markers: ::step:N::
 * Converts to <semantic-type> custom elements for ReactMarkdown rendering
 */
function normalizeSemanticMarkers(text: string): string {
  const INLINE_TYPES = 'warning|info|success|error|tip|arrow|danger|caution|note|fatal|ban|zap';
  const BLOCK_TYPES = 'danger|caution|warning|note|info|tip|success|error|fatal';
  
  // First pass: handle block-level callouts :::type ... :::
  // Multi-line: :::type\n...\n:::
  const multiLineBlockRegex = new RegExp(
    `^[ \\t]*:::(${BLOCK_TYPES})[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n[ \\t]*:::[ \\t]*$`,
    'gm'
  );
  text = text.replace(multiLineBlockRegex, (_match, type, content) => {
    const trimmed = content.trim();
    return `<callout-${type}>${trimmed}</callout-${type}>`;
  });
  
  // Single-line: :::type content :::
  const singleLineBlockRegex = new RegExp(
    `:::(${BLOCK_TYPES})\\s+(.+?)\\s*:::`,
    'g'
  );
  text = text.replace(singleLineBlockRegex, (_match, type, content) => {
    return `<callout-${type}>${content.trim()}</callout-${type}>`;
  });
  
  // Second pass: handle inline markers and step markers (character-by-character to skip code)
  let result = '';
  let pos = 0;
  
  while (pos < text.length) {
    // Check for fenced code block ```...```
    const codeBlockMatch = text.slice(pos).match(/^```[\s\S]*?```/);
    if (codeBlockMatch) {
      result += codeBlockMatch[0];
      pos += codeBlockMatch[0].length;
      continue;
    }
    
    // Check for inline code `...`
    const inlineCodeMatch = text.slice(pos).match(/^`[^`]+`/);
    if (inlineCodeMatch) {
      result += inlineCodeMatch[0];
      pos += inlineCodeMatch[0].length;
      continue;
    }
    
    // Check for inline semantic markers ::type::
    const markerRegex = new RegExp(`^::(${INLINE_TYPES})::`);
    const markerMatch = text.slice(pos).match(markerRegex);
    if (markerMatch) {
      const type = markerMatch[1];
      result += `<semantic-${type}></semantic-${type}>`;
      pos += markerMatch[0].length;
      continue;
    }
    
    // Check for step markers ::step:N::
    const stepMatch = text.slice(pos).match(/^::step:(\d+)::/);
    if (stepMatch) {
      const number = stepMatch[1];
      result += `<semantic-step data-number="${number}"></semantic-step>`;
      pos += stepMatch[0].length;
      continue;
    }
    
    // Regular text, add one character
    result += text[pos];
    pos++;
  }
  
  return result;
}

interface WikiCardData {
  title: string;
  imageUrl?: string;
  description: string;
  extract: string;
  wikiUrl?: string;
}

interface WikiCardProps {
  title: string;
  imageUrl?: string | null;
  description: string;
  extract: string;
  wikiUrl?: string;
}

function WikiCard({ title, imageUrl, description, extract, wikiUrl }: WikiCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    // Check localStorage cache first so previously viewed images load instantly
    const cacheKey = `wiki_img_${title}`;
    const storedImage = localStorage.getItem(cacheKey);

    if (storedImage) {
      setCachedSrc(storedImage);
      setImageLoaded(true);
    } else {
      setCachedSrc(imageUrl);
      // Cache image URL locally
      localStorage.setItem(cacheKey, imageUrl);
    }
  }, [imageUrl, title]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 my-3 bg-neutral-900 border border-neutral-800 rounded-xl">
      {imageUrl && (
        <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-800">
          {/* Skeleton Loading State */}
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-neutral-700" />
          )}
          <img
            src={cachedSrc || imageUrl}
            alt={title}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      )}
      <div className="flex flex-col justify-center flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        {description && (
          <p className="text-xs font-medium text-neutral-400 mb-2 capitalize">{description}</p>
        )}
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{extract}</p>
      </div>
    </div>
  );
}

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

export default function MessageBubble({ role, content, thinking, onEdit, isLoading, loadingPhase, messageId, userId, conversationId, onRetry, onVersionChange, wikiCardData }: { role: string; content: string; thinking?: string; onEdit?: (newContent: string) => void; isLoading?: boolean; loadingPhase?: number; messageId?: string; userId?: string; conversationId?: string; onRetry?: (messageId: string) => void; onVersionChange?: (messageId: string, version: number, content: string) => void; wikiCardData?: WikiCardData }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showTOC, setShowTOC] = useState(false);
  const [youtubeVideoData, setYoutubeVideoData] = useState<any>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [timestampedSummary, setTimestampedSummary] = useState<any>(null);
  const [processedContent, setProcessedContent] = useState<string>(content);

  // Helper function to format YouTube date
  const formatYouTubeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const suffix = day % 10 === 1 && day % 100 !== 11 ? 'st' : day % 10 === 2 && day % 100 !== 12 ? 'nd' : day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th';
    return `${month} ${day}${suffix} ${year}`;
  };

  // Detect YouTube URL and fetch video info
  useEffect(() => {
    const videoId = extractVideoId(content);
    if (videoId) {
      getVideoInfo(videoId).then(data => {
        if (data) {
          setYoutubeVideoData({
            ...data,
            duration: formatDuration(data.duration)
          });
        }
      });
    }
  }, [content]);

  // Parse timestamps from assistant response for YouTube videos
  useEffect(() => {
    if (role === 'assistant' && youtubeVideoData) {
      // Parse timestamps in format [MM:SS] or [HH:MM:SS] or [MM:SS - MM:SS]
      const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\s*-\s*\d{1,2}:\d{2})?\]/g;
      const points: string[] = [];
      const timestamps: { [key: string]: number } = {};
      
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const timestampsInLine: number[] = [];
        let match;
        
        while ((match = timestampRegex.exec(line)) !== null) {
          const mins = parseInt(match[1]);
          const secs = parseInt(match[2]);
          const totalSeconds = mins * 60 + secs;
          timestampsInLine.push(totalSeconds);
        }
        
        if (timestampsInLine.length > 0) {
          // Remove timestamps from the line text
          const cleanLine = line.replace(timestampRegex, '').trim();
          if (cleanLine) {
            points.push(cleanLine);
            timestamps[points.length - 1] = timestampsInLine[0]; // Use first timestamp
          }
        }
      });
      
      if (points.length > 0) {
        setTimestampedSummary({ points, timestamps });
      }
    }
  }, [content, role, youtubeVideoData]);

  // Replace YouTube URLs in content with placeholder
  useEffect(() => {
    if (youtubeVideoData) {
      const urlRegex = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g;
      setProcessedContent(content.replace(urlRegex, ''));
    } else {
      setProcessedContent(content);
    }
  }, [content, youtubeVideoData]);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [totalVersions, setTotalVersions] = useState(1);
  const [isRetrying, setIsRetrying] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingIndexRef = useRef(0);
  const lastRenderTimeRef = useRef<number>(0);
  const markdownRenderTimeoutRef = useRef<NodeJS.Timeout>();
  const lastContentRef = useRef(content);

  useEffect(() => {
    if (lastContentRef.current !== content) {
      setEditText(content);
      headingIndexRef.current = 0;
      lastContentRef.current = content;
    }
  }, [content]);

  const isUser = role === "user";

  // Check if message is still streaming
  const isStreaming = isLoading;

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

  const handleRetry = async () => {
    if (!messageId || !conversationId || isRetrying) return;
    
    setIsRetrying(true);
    setShowVersionHistory(false);
    setEditText(''); // Clear current content
    try {
      if (onRetry) {
        await onRetry(messageId);
        // After retry completes, show version history
        setTimeout(() => {
          setIsRetrying(false);
          setShowVersionHistory(true);
          fetchMessageVersions();
        }, 1000);
      }
    } catch (error) {
      console.error('Error during retry:', error);
      setEditText(content); // Restore original content on error
      setIsRetrying(false);
    }
  };

  // Fetch message versions for retry system
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

  const handleVersionChange = (newVersion: number) => {
    if (newVersion < 1 || newVersion > totalVersions) return;
    
    const version = versionHistory.find(v => v.version === newVersion);
    if (version && onVersionChange) {
      setCurrentVersion(newVersion);
      setEditText(version.content); // Show selected version content
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

  // Fetch message versions when version history should be shown
  useEffect(() => {
    if (messageId && conversationId && !isUser && !isLoading && showVersionHistory) {
      fetchMessageVersions();
    }
  }, [messageId, conversationId, isUser, isLoading, showVersionHistory]);

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
  const isPeakHoursMessage = content.includes("This model is at its peak hours. Many people are using this model at the same time.");

  const getTruncatedText = () => {
    if (!isLong || expanded) return content;
    let truncated = content.slice(0, LIMIT);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
    return truncated + " ...";
  };

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : 'plaintext';
      const codeContent = String(children).replace(/\n$/, '');

      if (!inline) {
        // Return StreamingCodeBlock directly without wrapper
        // The parent element will handle the block-level rendering
        return (
          <StreamingCodeBlock
            streamContent={codeContent}
            language={language}
            theme="github-dark"
            isComplete={!isLoading}
          />
        );
      }
      return (
        <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
    // Handle text nodes to make timestamps clickable and style dictionary terms
    text({ children }: any) {
      const text = String(children);
      
      // Check for pronunciation markers: /.../ or PRONUNCIATION: ... or standalone IPA characters
      const pronunciationRegex = /\/([^/]+)\/|PRONUNCIATION:\s*([^\n]+)/gi;
      const pronunciationMatch = text.match(pronunciationRegex);
      
      // Check for standalone IPA characters (contains IPA symbols like əˈləʊ)
      const ipaRegex = /[əˈæɒɔʊɪɪɛɜʃʒʧθðŋɡʤʒwɾj]+/i;
      const ipaMatch = text.match(ipaRegex);
      
      // Check for example markers: Example: "..." or EXAMPLE:
      const exampleRegex = /(?:Example:|EXAMPLE:)\s*"([^"]+)"/gi;
      const exampleMatch = text.match(exampleRegex);
      
      // Check for timestamps
      const timestampRegex = /\[(\d{1,2}:\d{2})\]/g;
      const timestampMatch = text.match(timestampRegex);

      // Handle pronunciation with slashes or PRONUNCIATION label
      if (pronunciationMatch && !timestampMatch) {
        const parts = text.split(pronunciationRegex);
        return (
          <>
            {parts.map((part, index) => {
              if (index % 2 === 1) {
                // This is a pronunciation match
                const pronunciation = part.replace(pronunciationRegex, '$1$2');
                return (
                  <span key={index} className="font-serif italic text-purple-300 text-lg" style={{ fontFamily: 'Georgia, serif' }}>
                    /{pronunciation}/
                  </span>
                );
              }
              return <span key={index}>{part}</span>;
            })}
          </>
        );
      }

      // Handle standalone IPA characters (like həˈləʊ)
      if (ipaMatch && !timestampMatch && !pronunciationMatch) {
        const parts = text.split(ipaRegex);
        return (
          <>
            {parts.map((part, index) => {
              if (index % 2 === 1) {
                // This is an IPA match
                return (
                  <span key={index} className="font-serif italic text-purple-300 text-lg" style={{ fontFamily: 'Georgia, serif' }}>
                    {part}
                  </span>
                );
              }
              return <span key={index}>{part}</span>;
            })}
          </>
        );
      }

      // Handle examples
      if (exampleMatch && !timestampMatch) {
        const parts = text.split(exampleRegex);
        return (
          <>
            {parts.map((part, index) => {
              if (index % 2 === 1) {
                // This is an example match
                const example = part.replace(exampleRegex, '$1');
                return (
                  <span key={index} className="font-mono text-green-300 bg-neutral-800/50 px-2 py-1 rounded" style={{ fontFamily: 'Courier New, monospace' }}>
                    "{example}"
                  </span>
                );
              }
              return <span key={index}>{part}</span>;
            })}
          </>
        );
      }

      // Handle timestamps (existing logic)
      const timestampParts = text.split(timestampRegex);

      if (timestampParts.length === 1) {
        return <>{text}</>;
      }

      return (
        <>
          {timestampParts.map((part, index) => {
            // Even indices are regular text, odd indices are timestamps
            if (index % 2 === 1 && youtubeVideoData) {
              const [mins, secs] = part.split(':').map(Number);
              const seconds = mins * 60 + secs;
              return (
                <button
                  key={index}
                  onClick={() => {
                    const iframe = document.querySelector(`iframe[src*="${youtubeVideoData.id}"]`) as HTMLIFrameElement;
                    if (iframe) {
                      iframe.src = `https://www.youtube.com/embed/${youtubeVideoData.id}?start=${seconds}&autoplay=1`;
                    }
                  }}
                  className="text-gray-300 hover:text-gray-200 cursor-pointer"
                  title={`Jump to ${part}`}
                >
                  <span>[</span>
                  <span className="underline decoration-dotted underline-offset-2">{part}</span>
                  <span>]</span>
                </button>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </>
      );
    },
    // Inline semantic markers (with graded severity colors)
    'semantic-danger': () => {
      return <ShieldAlert className="w-4 h-4 inline-block mr-1.5 text-rose-500 animate-pulse" />;
    },
    'semantic-fatal': () => {
      return <Skull className="w-4 h-4 inline-block mr-1.5 text-red-600" />;
    },
    'semantic-caution': () => {
      return <AlertTriangle className="w-4 h-4 inline-block mr-1.5 text-amber-400" />;
    },
    'semantic-warning': () => {
      return <AlertTriangle className="w-4 h-4 inline-block mr-1.5 text-yellow-400" />;
    },
    'semantic-note': () => {
      return <StickyNote className="w-4 h-4 inline-block mr-1.5 text-indigo-400" />;
    },
    'semantic-info': () => {
      return <Info className="w-4 h-4 inline-block mr-1.5 text-sky-400" />;
    },
    'semantic-success': () => {
      return <CircleCheck className="w-4 h-4 inline-block mr-1.5 text-emerald-400" />;
    },
    'semantic-error': () => {
      return <CircleX className="w-4 h-4 inline-block mr-1.5 text-red-500" />;
    },
    'semantic-tip': () => {
      return <Lightbulb className="w-4 h-4 inline-block mr-1.5 text-amber-300" />;
    },
    'semantic-arrow': () => {
      return <ArrowRight className="w-4 h-4 inline-block mr-1.5 text-neutral-400" />;
    },
    'semantic-ban': () => {
      return <Ban className="w-4 h-4 inline-block mr-1.5 text-rose-500" />;
    },
    'semantic-zap': () => {
      return <Zap className="w-4 h-4 inline-block mr-1.5 text-amber-400" />;
    },
    'semantic-step': ({ 'data-number': number }: any) => {
      return <span className="step-number">{number}</span>;
    },

    // Block-level callouts with graded severity colors & styled banners
    'callout-danger': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-red-500/30 bg-red-950/25 text-red-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-red-100">
            <span className="font-semibold text-red-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Danger:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-fatal': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-red-600/40 bg-red-950/40 text-red-100 text-sm flex items-start gap-3 shadow-md min-w-0">
          <Skull className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed">
            <span className="font-bold text-red-400 mr-1.5 inline-block uppercase tracking-wider text-xs">Critical Danger:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-caution': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-amber-100">
            <span className="font-semibold text-amber-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Caution:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-warning': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-yellow-500/30 bg-yellow-950/20 text-yellow-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-yellow-100">
            <span className="font-semibold text-yellow-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Warning:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-note': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 text-indigo-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <StickyNote className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-indigo-100">
            <span className="font-semibold text-indigo-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Note:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-info': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-sky-500/30 bg-sky-950/20 text-sky-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-sky-100">
            <span className="font-semibold text-sky-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Info:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-tip': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <Lightbulb className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-emerald-100">
            <span className="font-semibold text-emerald-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Tip:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-success': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <CircleCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-emerald-100">
            <span className="font-semibold text-emerald-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Success:</span>
            {children}
          </div>
        </div>
      );
    },
    'callout-error': ({ children }: any) => {
      return (
        <div className="my-3.5 p-3.5 sm:p-4 rounded-xl border border-rose-500/30 bg-rose-950/25 text-rose-200 text-sm flex items-start gap-3 shadow-sm min-w-0">
          <CircleX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 font-normal leading-relaxed text-rose-100">
            <span className="font-semibold text-rose-300 mr-1.5 inline-block uppercase tracking-wider text-xs">Error:</span>
            {children}
          </div>
        </div>
      );
    },
    p({ children, node }: any) {
      // Check if children contain block-level elements (code blocks, callouts, divs, etc.)
      // If so, render as div instead of p to avoid HTML nesting / hydration errors
      const isBlockElement = (item: any): boolean => {
        if (!item || !React.isValidElement(item)) return false;
        
        const type = item.type as any;
        const typeName = typeof type === 'string' ? type : (type?.name || type?.displayName || '');
        
        // Custom callout elements
        if (typeof typeName === 'string' && (typeName.startsWith('callout-') || typeName.includes('callout'))) {
          return true;
        }

        // Streaming code blocks
        if (typeName === 'StreamingCodeBlock' || typeName === 'CodeBlock') return true;

        // Standard HTML block tags
        if (type === 'div' || type === 'pre' || type === 'table' || type === 'blockquote' || type === 'ul' || type === 'ol') {
          return true;
        }

        // Props / classes indicators
        const props = (item.props as any) || {};
        if (props['data-slot'] === 'code-block' || props.className?.includes('code-block-wrapper')) {
          return true;
        }

        // Recurse into children
        if (props.children) {
          return React.Children.toArray(props.children).some(isBlockElement);
        }

        return false;
      };

      const hasBlockContent = React.Children.toArray(children).some(isBlockElement);

      // Always use div to avoid HTML validation errors with nested block elements
      // Code blocks and other block-level elements cannot be inside <p> tags
      return <div className="mb-3 last:mb-0 leading-relaxed">{children}</div>;
    },
    h1({ children }: any) {
      const text = String(children).trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return <h1 id={`heading-${id}`} className="text-2xl font-bold mb-6 mt-8 scroll-mt-4">{children}</h1>;
    },
    h2({ children }: any) {
      const text = String(children).trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return <h2 id={`heading-${id}`} className="text-xl font-bold mb-4 mt-8 scroll-mt-4">{children}</h2>;
    },
    h3({ children }: any) {
      const text = String(children).trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return <h3 id={`heading-${id}`} className="text-lg font-bold mb-3 mt-6 scroll-mt-4">{children}</h3>;
    },
    ul({ children }: any) {
      return <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="ml-2">{children}</li>;
    },
    strong({ children }: any) {
      return <strong className="font-bold">{children}</strong>;
    },
    em({ children }: any) {
      return <em className="italic">{children}</em>;
    },
    a({ children, href }: any) {
      return <a href={href} className="text-blue-400 hover:text-blue-300 underline">{children}</a>;
    },
    blockquote({ children }: any) {
      return <blockquote className="border-l-4 border-neutral-600 pl-4 italic my-4">{children}</blockquote>;
    },
    table({ children }: any) {
      return (
        <div className="my-3 w-full overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/40 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          <table className="w-full min-w-full border-collapse text-left text-sm">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: any) {
      return (
        <thead className="border-b border-neutral-700/80 bg-neutral-800/60 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          {children}
        </thead>
      );
    },
    tbody({ children }: any) {
      return <tbody className="divide-y divide-neutral-800/70">{children}</tbody>;
    },
    tr({ children }: any) {
      return <tr className="hover:bg-neutral-800/30 transition-colors">{children}</tr>;
    },
    th({ children }: any) {
      return (
        <th className="px-3.5 py-2 text-left font-semibold text-xs tracking-wider text-neutral-300 uppercase whitespace-nowrap">
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td className="px-3.5 py-2 text-sm text-neutral-200 align-top leading-normal">
          {children}
        </td>
      );
    },
  }), [isLoading]);

  const renderContent = () => {
    // Use the separate thinking prop if provided, otherwise parse from content
    const thinkingContent = thinking || null;
    let answerContent = content;

    // Parse artifact markers - check both backend-converted and raw tags
    const backendParts = answerContent.split(/\[STUDY_METHODS_START\](.*?)\[STUDY_METHODS_END\]/g);
    const rawParts = answerContent.split(new RegExp(`${STUDY_METHODS_OPEN_TAG}([\\s\\S]*?)${STUDY_METHODS_CLOSE_TAG}`, 's'));

    // Parse timetable markers
    const timetableBackendParts = answerContent.split(/\[TIMETABLE_START\](.*?)\[TIMETABLE_END\]/g);
    const timetableRawParts = answerContent.split(new RegExp(`${TIMETABLE_OPEN_TAG}([\\s\\S]*?)${TIMETABLE_CLOSE_TAG}`, 's'));

    // Parse math matrix markers
    const mathMatrixBackendParts = answerContent.split(/\[MATH_MATRIX_START\](.*?)\[MATH_MATRIX_END\]/g);
    const mathMatrixRawParts = answerContent.split(new RegExp(`${MATH_MATRIX_OPEN_TAG}([\\s\\S]*?)${MATH_MATRIX_CLOSE_TAG}`, 's'));

    console.log('[MessageBubble] Timetable backend parts:', timetableBackendParts.length);
    console.log('[MessageBubble] Timetable raw parts:', timetableRawParts.length);
    console.log('[MessageBubble] Contains timetable open tag:', answerContent.includes(TIMETABLE_OPEN_TAG));
    console.log('[MessageBubble] Contains timetable close tag:', answerContent.includes(TIMETABLE_CLOSE_TAG));

    console.log('[MessageBubble] Backend parts:', backendParts.length);
    console.log('[MessageBubble] Raw parts:', rawParts.length);
    console.log('[MessageBubble] Content length:', answerContent.length);
    console.log('[MessageBubble] Open tag constant:', STUDY_METHODS_OPEN_TAG);
    console.log('[MessageBubble] Close tag constant:', STUDY_METHODS_CLOSE_TAG);
    console.log('[MessageBubble] Contains open tag:', answerContent.includes(STUDY_METHODS_OPEN_TAG));
    console.log('[MessageBubble] Contains close tag:', answerContent.includes(STUDY_METHODS_CLOSE_TAG));
    console.log('[MessageBubble] First 200 chars:', answerContent.substring(0, 200));
    console.log('[MessageBubble] Last 200 chars:', answerContent.substring(answerContent.length - 200));

    // Use backend markers if available, otherwise use raw tags
    const parts = backendParts.length > 1 ? backendParts : rawParts;

    // Check for timetable artifact
    const timetableParts = timetableBackendParts.length > 1 ? timetableBackendParts : timetableRawParts;

    if (timetableParts.length > 1) {
      // Has timetable artifact
      if (isLoading) {
        // During streaming, hide artifact content
        const withoutArtifact = timetableParts.map((part, index) => {
          if (index % 2 === 0) return part;
          return '';
        }).join('');

        const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(withoutArtifact);
        const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
        const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
        const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
        const normalizedWhitespace = normalizeWhitespace(withoutInstall);
        const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
        const withMarkers = normalizeSemanticMarkers(normalizedContent);

        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
            components={markdownComponents}
          >
            {withMarkers}
          </ReactMarkdown>
        );
      }

      // When complete, render timetable
      return (
        <>
          {timetableParts.map((part, index) => {
            if (index % 2 === 0) {
              // Regular text
              const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(part);
              const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
              const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
              const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
              const normalizedWhitespace = normalizeWhitespace(withoutInstall);
              const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
              const withMarkers = normalizeSemanticMarkers(normalizedContent);

              return (
                <ReactMarkdown
                  key={index}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                  components={markdownComponents}
                >
                  {withMarkers}
                </ReactMarkdown>
              );
            } else {
              // Timetable JSON
              try {
                const timetableData = JSON.parse(part);
                return <TimetableArtifact key={index} data={timetableData} />;
              } catch (e) {
                console.error('Failed to parse timetable:', e);
                return null;
              }
            }
          })}
        </>
      );
    }

    if (parts.length > 1) {
      // Has artifact - render parts with artifact component
      // Only render artifact when not loading (when complete)
      if (isLoading) {
        // During streaming, hide artifact content completely
        const withoutArtifact = parts.map((part, index) => {
          if (index % 2 === 0) {
            return part;
          }
          return '';
        }).join('');

        const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(withoutArtifact);
        const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
        const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
        const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
        const normalizedWhitespace = normalizeWhitespace(withoutInstall);
        const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
        const withMarkers = normalizeSemanticMarkers(normalizedContent);

        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
            components={markdownComponents}
          >
            {withMarkers}
          </ReactMarkdown>
        );
      }

      // When complete, render artifact
      return (
        <>
          {parts.map((part, index) => {
            if (index % 2 === 0) {
              // Regular text - also parse other artifacts
              const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(part);
              const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
              const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
              const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
              const normalizedWhitespace = normalizeWhitespace(withoutInstall);
              const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
              const withMarkers = normalizeSemanticMarkers(normalizedContent);

              return (
                <ReactMarkdown
                  key={index}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                  components={markdownComponents}
                >
                  {withMarkers}
                </ReactMarkdown>
              );
            } else {
              // Artifact JSON
              try {
                const artifactData = JSON.parse(part);
                return <GridCardsArtifact key={index} data={artifactData} />;
              } catch (e) {
                console.error('Failed to parse artifact:', e);
                return null;
              }
            }
          })}
        </>
      );
    }

    // No artifact - proceed with normal rendering with cleaned content
    const contentWithoutRawTags = answerContent
      .replace(new RegExp(`${STUDY_METHODS_OPEN_TAG}[\\s\\S]*?${STUDY_METHODS_CLOSE_TAG}`, 'gs'), '')
      .replace(new RegExp(`${TIMETABLE_OPEN_TAG}[\\s\\S]*?${TIMETABLE_CLOSE_TAG}`, 'gs'), '')
      .replace(new RegExp(`${MATH_MATRIX_OPEN_TAG}[\\s\\S]*?${MATH_MATRIX_CLOSE_TAG}`, 'gs'), '');
    const contentWithoutMarkers = contentWithoutRawTags
      .replace(/\[STUDY_METHODS_START\][\s\S]*?\[STUDY_METHODS_END\]/gs, '')
      .replace(/\[TIMETABLE_START\][\s\S]*?\[TIMETABLE_END\]/gs, '')
      .replace(/\[MATH_MATRIX_START\][\s\S]*?\[MATH_MATRIX_END\]/gs, '');

    // No artifact detected by splitting, but check if raw tags exist in content
    // Check for math matrix artifact
    const mathMatrixParts = mathMatrixBackendParts.length > 1 ? mathMatrixBackendParts : mathMatrixRawParts;

    if (mathMatrixParts.length > 1) {
      // Has math matrix artifact
      if (isLoading) {
        // During streaming, hide artifact content
        const withoutArtifact = mathMatrixParts.map((part, index) => {
          if (index % 2 === 0) return part;
          return '';
        }).join('');

        const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(withoutArtifact);
        const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
        const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
        const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
        const normalizedWhitespace = normalizeWhitespace(withoutInstall);
        const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
        const withMarkers = normalizeSemanticMarkers(normalizedContent);

        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
            components={markdownComponents}
          >
            {withMarkers}
          </ReactMarkdown>
        );
      }

      // When complete, render math matrix
      return (
        <>
          {mathMatrixParts.map((part, index) => {
            if (index % 2 === 0) {
              // Regular text
              const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(part);
              const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
              const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
              const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);
              const normalizedWhitespace = normalizeWhitespace(withoutInstall);
              const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
              const withMarkers = normalizeSemanticMarkers(normalizedContent);

              return (
                <ReactMarkdown
                  key={index}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                  components={markdownComponents}
                >
                  {withMarkers}
                </ReactMarkdown>
              );
            } else {
              // Math matrix JSON
              try {
                const mathMatrixData = JSON.parse(part);
                return <MathMatrixArtifact key={index} data={mathMatrixData} />;
              } catch (e) {
                console.error('Failed to parse math matrix:', e);
                return null;
              }
            }
          })}
        </>
      );
    }

    // Check for math matrix first
    if (answerContent.includes(MATH_MATRIX_OPEN_TAG)) {
      console.log('[MessageBubble] Math matrix open tag detected');
      const escapedOpenTag = MATH_MATRIX_OPEN_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedCloseTag = MATH_MATRIX_CLOSE_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      if (answerContent.includes(MATH_MATRIX_CLOSE_TAG)) {
        const match = answerContent.match(new RegExp(`${escapedOpenTag}([\\s\\S]*?)${escapedCloseTag}`, 's'));
        if (match && match[1]) {
          try {
            const mathMatrixData = JSON.parse(match[1]);
            const beforeArtifact = answerContent.split(MATH_MATRIX_OPEN_TAG)[0];
            const afterArtifact = answerContent.split(MATH_MATRIX_CLOSE_TAG)[1] || '';

            return (
              <>
                {beforeArtifact && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                    components={markdownComponents}
                  >
                    {beforeArtifact}
                  </ReactMarkdown>
                )}
                <MathMatrixArtifact data={mathMatrixData} />
                {afterArtifact && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                    components={markdownComponents}
                  >
                    {afterArtifact}
                  </ReactMarkdown>
                )}
              </>
            );
          } catch (e) {
            console.error('[MessageBubble] Failed to parse math matrix:', e);
          }
        }
      } else {
        // No close tag yet - try to parse partial content
        const match = answerContent.match(new RegExp(`${escapedOpenTag}([\\s\\S]*)$`, 's'));
        if (match && match[1]) {
          try {
            const partialContent = match[1].trim();
            const lastBraceIndex = partialContent.lastIndexOf('}');
            if (lastBraceIndex > 0 && partialContent.startsWith('{')) {
              const completeJson = partialContent.substring(0, lastBraceIndex + 1);
              const mathMatrixData = JSON.parse(completeJson);
              const beforeArtifact = answerContent.split(MATH_MATRIX_OPEN_TAG)[0];

              return (
                <>
                  {beforeArtifact && (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                      components={markdownComponents}
                    >
                      {beforeArtifact}
                    </ReactMarkdown>
                  )}
                  <MathMatrixArtifact data={mathMatrixData} />
                </>
              );
            }
          } catch (e) {
            console.log('[MessageBubble] Partial math matrix not valid JSON yet:', e);
          }
        }
      }
    }

    // Check for timetable first
    if (answerContent.includes(TIMETABLE_OPEN_TAG)) {
      console.log('[MessageBubble] Timetable open tag detected');
      const escapedOpenTag = TIMETABLE_OPEN_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedCloseTag = TIMETABLE_CLOSE_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      console.log('[MessageBubble] Escaped open tag:', escapedOpenTag);
      console.log('[MessageBubble] Escaped close tag:', escapedCloseTag);
      
      // Try with close tag first
      if (answerContent.includes(TIMETABLE_CLOSE_TAG)) {
        console.log('[MessageBubble] Close tag found, parsing with both tags');
        const match = answerContent.match(new RegExp(`${escapedOpenTag}([\\s\\S]*?)${escapedCloseTag}`, 's'));
        console.log('[MessageBubble] Match result:', match ? 'Match found' : 'No match');
        if (match && match[1]) {
          try {
            const timetableData = JSON.parse(match[1]);
            const beforeArtifact = answerContent.split(TIMETABLE_OPEN_TAG)[0];
            const afterArtifact = answerContent.split(TIMETABLE_CLOSE_TAG)[1] || '';

            return (
              <>
                {beforeArtifact && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                    components={markdownComponents}
                  >
                    {beforeArtifact}
                  </ReactMarkdown>
                )}
                <TimetableArtifact data={timetableData} />
                {afterArtifact && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                    components={markdownComponents}
                  >
                    {afterArtifact}
                  </ReactMarkdown>
                )}
              </>
            );
          } catch (e) {
            console.error('[MessageBubble] Failed to parse timetable:', e);
          }
        }
      } else {
        // No close tag yet - try to parse from open tag to end of content
        console.log('[MessageBubble] No close tag yet, trying to parse partial content');
        const match = answerContent.match(new RegExp(`${escapedOpenTag}([\\s\\S]*)$`, 's'));
        console.log('[MessageBubble] Partial match result:', match ? 'Match found' : 'No match');
        if (match && match[1]) {
          console.log('[MessageBubble] Partial content length:', match[1].length);
          console.log('[MessageBubble] Partial content preview:', match[1].substring(0, 100));
          try {
            const partialContent = match[1].trim();
            // Find the last complete JSON object by finding the last }
            const lastBraceIndex = partialContent.lastIndexOf('}');
            if (lastBraceIndex > 0 && partialContent.startsWith('{')) {
              const completeJson = partialContent.substring(0, lastBraceIndex + 1);
              console.log('[MessageBubble] Trying to parse complete JSON');
              const timetableData = JSON.parse(completeJson);
              const beforeArtifact = answerContent.split(TIMETABLE_OPEN_TAG)[0];

              return (
                <>
                  {beforeArtifact && (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                      components={markdownComponents}
                    >
                      {beforeArtifact}
                    </ReactMarkdown>
                  )}
                  <TimetableArtifact data={timetableData} />
                </>
              );
            }
          } catch (e) {
            console.log('[MessageBubble] Partial content not valid JSON yet:', e);
          }
        }
      }
    }

    if (answerContent.includes(STUDY_METHODS_OPEN_TAG) && answerContent.includes(STUDY_METHODS_CLOSE_TAG)) {
      console.log('[MessageBubble] Raw tags detected but not parsed - forcing artifact render');
      // Escape special regex characters in tags
      const escapedOpenTag = STUDY_METHODS_OPEN_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedCloseTag = STUDY_METHODS_CLOSE_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = answerContent.match(new RegExp(`${escapedOpenTag}([\\s\\S]*?)${escapedCloseTag}`, 's'));
      console.log('[MessageBubble] Match result:', match ? 'Match found' : 'No match');
      if (match && match[1]) {
        console.log('[MessageBubble] Match content length:', match[1].length);
        console.log('[MessageBubble] Match content preview:', match[1].substring(0, 100));
        try {
          const artifactData = JSON.parse(match[1]);
          console.log('[MessageBubble] Parsed artifact data:', artifactData);
          // Get text before artifact
          const beforeArtifact = answerContent.split(STUDY_METHODS_OPEN_TAG)[0];
          // Get text after artifact
          const afterArtifact = answerContent.split(STUDY_METHODS_CLOSE_TAG)[1] || '';

          return (
            <>
              {beforeArtifact && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                  components={markdownComponents}
                >
                  {beforeArtifact}
                </ReactMarkdown>
              )}
              <GridCardsArtifact data={artifactData} />
              {afterArtifact && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
                  components={markdownComponents}
                >
                  {afterArtifact}
                </ReactMarkdown>
              )}
            </>
          );
        } catch (e) {
          console.error('[MessageBubble] Failed to parse forced artifact:', e);
        }
      }
    }

    // No artifact - proceed with normal rendering with cleaned content
    const cleanedContent = contentWithoutMarkers;

    // Show thinking if available
    const shouldShowThinking = !isLoading && thinkingContent;
    const shouldAutoExpand = isThinkingOpen;

    // Parse artifacts even during streaming to hide raw JSON
    const { artifacts, cleanedContent: withoutWindows } = parseWindowsArtifacts(cleanedContent);
    const { quizzes, cleanedContent: withoutQuiz } = parseQuizArtifacts(withoutWindows);
    const { clocks, cleanedContent: withoutClock } = parseClockArtifacts(withoutQuiz);
    const { sequences, cleanedContent: withoutInstall } = parseInstallationSequences(withoutClock);

    // Normalize whitespace even during streaming
    const normalizedWhitespace = normalizeWhitespace(withoutInstall);

    // During streaming, show plain text (with artifacts removed) to avoid expensive re-renders
    if (isLoading) {
      return <div className="whitespace-pre-wrap">{normalizedWhitespace}</div>;
    }
    
    // Normalize LaTeX delimiters before rendering
    const normalizedContent = normalizeLatexDelimiters(normalizedWhitespace);
    
    // Normalize semantic markers
    const withMarkers = normalizeSemanticMarkers(normalizedContent);

    // Remove raw study methods tags from final output
    const withoutRawTags = withMarkers.replace(
      /\[STUDY_METHODS_START\].*?\[STUDY_METHODS_END\]/gs,
      ''
    );
    
    return (
      <>
        {/* Thinking container hidden - user requested to not show thinking UI */}
        {/* {shouldShowThinking && (
          <div className="border border-neutral-900 bg-neutral-900/80 rounded-lg overflow-hidden text-xs text-neutral-400 mb-4">
            <button
              onClick={() => setIsThinkingOpen(!isThinkingOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-neutral-400 animate-pulse' : 'bg-neutral-400'}`}></span>
                <span className="font-medium text-neutral-300">
                  {isLoading ? 'Thinking...' : 'Thought process'}
                </span>
              </div>
              
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${shouldAutoExpand ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {shouldAutoExpand && (
              <div className="px-3 py-2 border-t border-neutral-800 whitespace-pre-wrap">
                {thinkingContent}
              </div>
            )}
          </div>
        )} */}
        
        {/* Render Windows artifacts */}
        {artifacts.map((artifact, index) => (
          <WindowsArtifact key={index} artifact={artifact} isLoading={isLoading} />
        ))}
        
        {/* Render quiz artifacts - only when not streaming */}
        {!isLoading && quizzes.map((quiz, index) => (
          <QuizArtifact key={index} artifact={quiz} isLoading={isLoading} />
        ))}

        {/* Render clock artifacts */}
        {clocks.map((clock, index) => (
          <ClockArtifact key={index} data={clock} />
        ))}

        {/* Render installation sequences */}
        {sequences.map((steps, index) => (
          <InstallationSequence key={index} steps={steps} />
        ))}
        
        {/* Render markdown with semantic markers */}
        <div className="prose prose-invert max-w-none w-full min-w-0 overflow-hidden prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-1">
          <ReactMarkdown
            remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw, rehypeUnwrapCodeBlocks]}
            components={markdownComponents}
          >
            {processedContent
              .replace(/\[YOUTUBE_VIDEO_START\]([\s\S]*?)\[YOUTUBE_VIDEO_END\]/g, '')
              .replace(/\[WIKI_CARD_START\]([\s\S]*?)\[WIKI_CARD_END\]/g, '')
              .replace(/\[THINKING_START\]([\s\S]*?)\[THINKING_END\]/g, '')}
          </ReactMarkdown>
        </div>

        {/* YouTube video card if available */}
        {youtubeVideoData && (
          <>
            {/* Title, channel, and date above the card */}
            <div className="mb-3">
              <h3 className="text-white font-semibold text-lg leading-tight mb-2">
                {youtubeVideoData.title}
              </h3>
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <span className="font-medium text-white">{youtubeVideoData.channelTitle}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <g fill="none">
                    <rect width="17.98" height="5.25" x="3.01" y="3.46" fill="currentColor" opacity=".2" rx="1" />
                    <rect width="17.98" height="17.98" x="3.01" y="3.46" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" rx="3" />
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.69 1.76v3.4m8.68-3.4v3.4m4.2 3.54H3.83" />
                    <path fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7.63 12.76a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m0 4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m4.87-4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m0 4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m4.88-4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0" />
                  </g>
                </svg>
                <span>
                  {formatYouTubeDate(youtubeVideoData.publishedAt)}
                </span>
              </div>
            </div>
            <YouTubeVideoCard data={youtubeVideoData} summary={timestampedSummary} showDescription={showDescription} />
            {/* Toggle button outside card, bottom right */}
            {youtubeVideoData.description && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="flex items-center gap-2 text-gray-400 text-sm hover:text-white transition-colors bg-neutral-800 rounded-full px-4 py-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="w-4 h-4">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
                      <path d="M15.5 5v6.34c0 3.77 0 5.66-1.17 6.83s-3.05 1.17-6.82 1.17H5" />
                      <path d="m19.77 7.96l-1.43-1.44c-1.34-1.34-2-2-2.83-2s-1.5.66-2.83 2l-1.44 1.44" />
                    </g>
                  </svg>
                  <span>{showDescription ? 'Key Points' : 'Description'}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Wiki card if available */}
        {wikiCardData && (
          <WikiCard
            title={wikiCardData.title}
            imageUrl={wikiCardData.imageUrl}
            description={wikiCardData.description}
            extract={wikiCardData.extract}
            wikiUrl={wikiCardData.wikiUrl}
          />
        )}
      </>
    );
  };

  const renderMarkdownWithMarkers = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
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
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%] group">
          <div className={`
            outline-none
            bg-[#2f2f2f] text-white ${isShort ? 'rounded-full px-4 sm:px-5 py-2.5 sm:py-3 text-base' : 'rounded-2xl text-sm px-3 sm:px-4 py-2.5 sm:py-3'}
            leading-relaxed
            relative
          `}>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
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

  // Peak hours warning message - render as alert box
  if (isPeakHoursMessage && !isUser) {
    return (
      <div className="flex gap-3 mb-4">
        <div className="flex-1 max-w-2xl">
          <div className="bg-neutral-900/80 border border-neutral-700 rounded-xl p-4 animate-slide-up">
            <p className="text-white text-sm leading-relaxed mb-2">
              This model is at its peak hours. Many people are using this model at the same time.
            </p>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Thanks for using our website
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3 mb-4 w-full max-w-full min-w-0">
      <div className="flex-1 min-w-0 max-w-2xl -mt-0.5 w-full">
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

        <div ref={contentRef} className="text-gray-200 text-[15px] leading-[1.7] relative break-words w-full min-w-0">
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {getTruncatedText()}
            </div>
          ) : (
            <div className="w-full min-w-0 overflow-hidden">
              {renderContent()}
            </div>
          )}
        </div>

        {/* Sources section - rendered at bottom before copy button */}
        {wikiCardData && (
          <div className="mt-6 border-t border-neutral-800/60 pt-4">
            <h4 className="text-base font-semibold text-white mb-3">Sources</h4>
            <ol className="space-y-2.5 text-sm list-decimal list-outside ml-4 text-neutral-300">
              <li className="pl-1">
                <div className="inline-flex items-center gap-2">
                  <a
                    href={wikiCardData.wikiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="decoration-dotted-custom text-white hover:text-white transition"
                  >
                    {wikiCardData.title} - Wikipedia
                  </a>
                  <div className="relative inline-block group">
                    {/* Pill Badge */}
                    <span className="ml-2 inline-flex items-center rounded-full bg-[#27272a] px-2.5 py-0.5 text-[11px] font-medium text-neutral-400 border border-neutral-700/40 cursor-pointer select-none">
                      Wikipedia
                    </span>

                    {/* Clickable Hover Card Popover */}
                    <a
                      href={wikiCardData.wikiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[320px] p-4 bg-[#18181b] border border-neutral-800 rounded-2xl shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 ease-out cursor-pointer block text-left"
                    >
                      {/* Arrow pointing to center of badge */}
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#18181b] border-t border-l border-neutral-800 rotate-45" />

                      {/* Card Content */}
                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
                          <img
                            src="https://en.wikipedia.org/static/favicon/wikipedia.ico"
                            alt="Wikipedia"
                            className="w-4 h-4 rounded-sm"
                          />
                          <span>Wikipedia</span>
                        </div>
                        <div className="text-sm font-semibold text-white tracking-tight">
                          {wikiCardData.title} - Wikipedia
                        </div>
                        <p className="text-xs text-neutral-300/90 leading-relaxed line-clamp-3">
                          "{wikiCardData.extract}"
                        </p>
                      </div>
                    </a>
                  </div>
                </div>
              </li>
            </ol>
          </div>
        )}

        {/* Render copy button ONLY after the AI has finished generating */}
        {!isStreaming && role === "assistant" && content && (
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition"
              title="Copy response"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              )}
              <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
        {/* Version Navigation - only show after completion and when there are multiple versions */}
        {showVersionHistory && !isRetrying && totalVersions > 1 && (
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

'use client';

import React from 'react';

interface YouTubeVideoData {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  transcript?: string; // Full transcript with timestamps
}

interface YouTubeVideoCardProps {
  data: YouTubeVideoData;
}

export default function YouTubeVideoCard({ data }: YouTubeVideoCardProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const jumpToTimestamp = (seconds: number) => {
    const iframe = document.querySelector(`iframe[src*="${data.id}"]`) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${data.id}?start=${seconds}&autoplay=1`;
    }
  };

  // Parse transcript for timestamps - extract only the timestamp section
  const parseTranscript = (text: string) => {
    const lines = text.split('\n');
    const sections: { time: string; content: string }[] = [];
    let inTimestampSection = false;
    
    lines.forEach(line => {
      // Check if we're in the timestamp section
      if (line.includes('📅 Timestamps') || line.includes('Timestamps:')) {
        inTimestampSection = true;
        return;
      }
      
      // Stop if we've left the timestamp section (next section starts)
      if (inTimestampSection && (line.startsWith('🤝') || line.startsWith('🔍') || line.startsWith('📌') || line.startsWith('⚠️'))) {
        inTimestampSection = false;
        return;
      }
      
      if (inTimestampSection) {
        // Match timestamps like [MM:SS] or MM:SS format
        const timestampMatch = line.match(/\[(\d{1,2}:\d{2})\]|^(\d{1,2}:\d{2})\s*(–|-)/);
        if (timestampMatch) {
          const time = timestampMatch[1] || timestampMatch[2];
          const content = line.replace(timestampMatch[0], '').replace(/^[–-]\s*/, '').trim();
          if (content) {
            sections.push({ time, content });
          }
        }
      }
    });
    
    return sections;
  };

  // Remove timestamp section from description for display
  const removeTimestampSection = (text: string) => {
    const lines = text.split('\n');
    const filteredLines: string[] = [];
    let inTimestampSection = false;
    
    lines.forEach(line => {
      // Check if we're entering the timestamp section
      if (line.includes('📅 Timestamps') || line.includes('Timestamps:')) {
        inTimestampSection = true;
        return;
      }
      
      // Stop if we've left the timestamp section
      if (inTimestampSection && (line.startsWith('🤝') || line.startsWith('🔍') || line.startsWith('📌') || line.startsWith('⚠️'))) {
        inTimestampSection = false;
        filteredLines.push(line);
        return;
      }
      
      // Skip lines while in timestamp section
      if (!inTimestampSection) {
        filteredLines.push(line);
      }
    });
    
    return filteredLines.join('\n');
  };

  // Extract only the timestamp section from description
  const transcriptSections = parseTranscript(data.description || '');
  // Remove timestamp section from description for display
  const descriptionWithoutTimestamps = removeTimestampSection(data.description || '');

  return (
    <div className="bg-neutral-800 rounded-xl overflow-hidden my-4">
      {/* Title, channel, and date at the TOP */}
      <div className="bg-neutral-900 p-5 border-b border-neutral-700">
        <h3 className="text-white font-semibold text-lg leading-tight mb-2">
          {data.title}
        </h3>
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <span className="font-medium text-white">{data.channelTitle}</span>
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
            {new Date(data.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* YouTube Embed Player - BELOW title/separator */}
      <div className="relative w-full pt-[56.25%] bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${data.id}`}
          title={data.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
      
      {/* Stats directly under video */}
      <div className="bg-neutral-900 p-4 flex items-center gap-6 text-gray-400 text-sm border-b border-neutral-700">
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512" className="w-4 h-4">
            <path d="M0 0h512v512H0z" fill="none" />
            <path fill="currentColor" d="M464 184h-10.9a78.7 78.7 0 0 0-16-7.18C419.5 171 396.26 168 368 168s-51.5 3-69.06 8.82c-14.06 4.69-20.25 9.86-22.25 11.87a47.94 47.94 0 0 0-41.36 0c-2-2-8.19-7.18-22.25-11.87C195.5 171 172.26 168 144 168s-51.5 3-69.06 8.82a78.7 78.7 0 0 0-16 7.18H48a16 16 0 0 0 0 32h.17c1 45.46 6.44 72.78 18.11 92.23a66.78 66.78 0 0 0 31.92 28c12.23 5.24 27.22 7.79 45.8 7.79c24.15 0 58.48-3.71 77.72-35.77c9.68-16.14 15.09-37.69 17.21-70.52A16 16 0 0 0 240 232a16 16 0 0 1 32 0a16 16 0 0 0 1.07 5.71c2.12 32.83 7.53 54.38 17.21 70.52a66.78 66.78 0 0 0 31.92 28c12.23 5.24 27.22 7.79 45.8 7.79c24.15 0 58.48-3.71 77.72-35.77c11.67-19.45 17.13-46.77 18.11-92.23h.17a16 16 0 0 0 0-32Z" />
          </svg>
          <span>{formatNumber(data.viewCount)} views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" className="w-4 h-4">
            <path d="M0 0h16v16H0z" fill="none" />
            <path fill="currentColor" d="M4 14H2a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h2zM7.206 2.323a1.392 1.392 0 0 1 2.531 1.098L9 6h4.114a2 2 0 0 1 1.872 2.702l-1.5 4A2 2 0 0 1 11.614 14H5V7.662a6 6 0 0 1 .855-3.087z" />
          </svg>
          <span>{formatNumber(data.likeCount)} likes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" className="w-4 h-4">
            <path d="M0 0h16v16H0z" fill="none" />
            <path fill="currentColor" d="M16 11.1c0-1.5-1.5-2.8-3.2-3.3c-1.3 1.5-3.9 2.4-6.4 2.4h-.5c-.1.3-.1.5-.1.8c0 2 2.2 3.6 5 3.6h.6c.4.5 1.7 1.4 3.4 1.4c0 0-.8-.4-.8-1.8c0-.6 2-1.8 2-3.1" />
            <path fill="currentColor" d="M13 4.6C13 2.1 10.2 0 6.6 0S0 2.1 0 4.6c0 1.7 2 3.2 3 4C3 10.4 1.6 11 1.6 11c2.3 0 3.6-1.1 4.2-1.8h.8c3.5.1 6.4-2 6.4-4.6" />
          </svg>
          <span>{formatNumber(data.commentCount)} comments</span>
        </div>
      </div>
      
      {/* Transcript/Content below stats */}
      {transcriptSections.length > 0 && (
        <div className="bg-neutral-900 p-5 border-b border-neutral-700">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="w-4 h-4">
              <path d="M0 0h24v24H0z" fill="none" />
              <path fill="currentColor" fillRule="evenodd" d="M.25 9A6.75 6.75 0 0 1 7 2.25h10A6.75 6.75 0 0 1 23.75 9v6A6.75 6.75 0 0 1 17 21.75H7A6.75 6.75 0 0 1 .25 15zm4.5 2.828a3.578 3.578 0 0 1 6.109-2.53l.171.172a.75.75 0 0 1-1.06 1.06l-.172-.171a2.078 2.078 0 0 0-3.548 1.47v.343a2.078 2.078 0 0 0 3.548 1.47l.172-.172a.75.75 0 1 1 1.06 1.06l-.171.172a3.578 3.578 0 0 1-6.109-2.53zM16.328 8.25a3.58 3.58 0 0 0-3.578 3.578v.344a3.578 3.578 0 0 0 6.109 2.53l.171-.172a.75.75 0 1 0-1.06-1.06l-.172.171a2.079 2.079 0 0 1-3.548-1.47v-.343a2.078 2.078 0 0 1 3.548-1.47l.172.172a.75.75 0 0 0 1.06-1.06l-.171-.172a3.58 3.58 0 0 0-2.53-1.048" clipRule="evenodd" />
            </svg>
            Captions
          </h4>
          <div className="space-y-3">
            {transcriptSections.map((section, index) => (
              <div key={index} className="text-gray-300 text-sm leading-relaxed">
                {section.time && (
                  <button
                    onClick={() => {
                      const [mins, secs] = section.time.split(':').map(Number);
                      const seconds = mins * 60 + secs;
                      jumpToTimestamp(seconds);
                    }}
                    className="text-white mr-2 cursor-pointer font-mono"
                    title={`Jump to ${section.time}`}
                  >
                    <span>[</span>
                    <span className="underline decoration-dotted underline-offset-2">{section.time}</span>
                    <span>]</span>
                  </button>
                )}
                <span>{section.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Description under transcript */}
      {descriptionWithoutTimestamps && (
        <div className="bg-neutral-900 p-5">
          <h4 className="text-white font-medium mb-2">Description</h4>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {descriptionWithoutTimestamps}
          </p>
        </div>
      )}
    </div>
  );
}

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
}

interface TimestampedSummary {
  points: string[];
  timestamps: { [key: string]: number }; // Map of point index to timestamp in seconds
}

interface YouTubeVideoCardProps {
  data: YouTubeVideoData;
  summary?: TimestampedSummary;
  showDescription?: boolean;
}

export default function YouTubeVideoCard({ data, summary, showDescription = false }: YouTubeVideoCardProps) {
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
    // Update the iframe to seek to the timestamp
    const iframe = document.querySelector(`iframe[src*="${data.id}"]`) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${data.id}?start=${seconds}&autoplay=1`;
    }
  };

  return (
    <div className="bg-neutral-800 rounded-xl overflow-hidden my-4">
      {/* YouTube Embed Player - at the top */}
      <div className="relative w-full pt-[56.25%] bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${data.id}`}
          title={data.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
      
      {/* Stats below video */}
      <div className="bg-neutral-900 p-5 pt-3 flex items-center gap-6 text-gray-400 text-sm">
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

      {/* Key Points or Description */}
      {showDescription ? (
        data.description && (
          <div className="bg-neutral-900 px-5 pt-4 pb-3">
            <h4 className="text-white font-medium mb-3">Description</h4>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {data.description}
            </p>
          </div>
        )
      ) : (
        summary && summary.points.length > 0 && (
          <div className="bg-neutral-900 px-5 pt-4 pb-3">
            <h4 className="text-white font-medium mb-3">Key Points</h4>
            <ul className="space-y-2">
              {summary.points.map((point, index) => {
                const timestamp = summary.timestamps[index];
                const cleanPoint = point.replace(/\*\*/g, '').replace(/\*/g, '');
                return (
                  <li key={index} className="text-gray-300 text-sm leading-relaxed">
                    {timestamp !== undefined && (
                      <button
                        onClick={() => jumpToTimestamp(timestamp)}
                        className="text-gray-300 hover:text-gray-200 mr-2 cursor-pointer"
                        title={`Jump to ${formatTimestamp(timestamp)}`}
                      >
                        <span>[</span>
                        <span className="underline decoration-dotted underline-offset-2">{formatTimestamp(timestamp)}</span>
                        <span>]</span>
                      </button>
                    )}
                    <span className="font-semibold" dangerouslySetInnerHTML={{ __html: cleanPoint }} />
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}
      

    </div>
  );
}

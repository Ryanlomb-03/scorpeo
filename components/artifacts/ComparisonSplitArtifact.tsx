'use client';

import React from 'react';
import { ComparisonSplitData } from '@/types/artifacts';

interface ComparisonSplitArtifactProps {
  data: ComparisonSplitData;
}

export function ComparisonSplitArtifact({ data }: ComparisonSplitArtifactProps) {
  const renderPreviewBox = (previewBox: any) => {
    switch (previewBox.type) {
      case 'structured_lines':
        return (
          <div className="border-2 border-gray-600 rounded-lg p-4 h-32 bg-neutral-800">
            <div className="border-b border-gray-600 pb-2 mb-2">
              <div className="h-3 bg-gray-600 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-600 rounded w-1/2"></div>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-gray-700 rounded"></div>
              <div className="h-2 bg-gray-700 rounded w-5/6"></div>
              <div className="h-2 bg-gray-700 rounded w-4/6"></div>
            </div>
          </div>
        );
      case 'blurt_box':
        return (
          <div className="border-2 border-gray-600 rounded-lg p-4 h-48 bg-neutral-800 w-full">
            <div className="text-xs text-gray-400 mb-2 font-handwritten text-center">
              (what you remember)
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-gray-700 rounded"></div>
              <div className="h-2 bg-gray-700 rounded w-5/6"></div>
              <div className="h-2 bg-gray-700 rounded w-4/6"></div>
              <div className="h-2 bg-gray-700 rounded w-3/6"></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="border border-gray-600 rounded p-2 bg-neutral-700">
                <div className="text-xs text-gray-400 text-center">Forgot</div>
              </div>
              <div className="border border-gray-600 rounded p-2 bg-neutral-700">
                <div className="text-xs text-gray-400 text-center">Questions</div>
              </div>
            </div>
          </div>
        );
      case 'cornell':
        return (
          <div className="border-2 border-gray-600 rounded-lg p-4 h-32 bg-neutral-800 flex gap-2">
            <div className="w-1/4 border-r border-gray-600 pr-2">
              <div className="h-2 bg-gray-700 rounded mb-1"></div>
              <div className="h-2 bg-gray-700 rounded"></div>
            </div>
            <div className="w-3/4">
              <div className="h-2 bg-gray-700 rounded mb-1"></div>
              <div className="h-2 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        );
      case 'charting':
        return (
          <div className="border-2 border-gray-600 rounded-lg p-4 h-32 bg-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-gray-600 rounded p-2">
                <div className="h-2 bg-gray-700 rounded"></div>
              </div>
              <div className="border border-gray-600 rounded p-2">
                <div className="h-2 bg-gray-700 rounded"></div>
              </div>
              <div className="border border-gray-600 rounded p-2 col-span-2">
                <div className="h-2 bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="border-2 border-gray-600 rounded-lg p-4 h-32 bg-neutral-800"></div>;
    }
  };

  return (
    <div className="w-full bg-neutral-900 rounded-2xl p-6 shadow-lg">
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-400 mb-1">Title</div>
          <div className="h-8 bg-neutral-800 rounded border border-gray-700"></div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Date</div>
          <div className="h-8 bg-neutral-800 rounded border border-gray-700"></div>
        </div>
      </div>
      <h2 className="text-2xl font-serif text-white mb-6 text-center">{data.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {data.columns.map((column, index) => (
          <div key={index} className="flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4 text-center">{column.heading}</h3>
            {renderPreviewBox(column.previewBox)}
            <ul className="mt-4 space-y-2">
              {column.points.map((point, pointIndex) => (
                <li key={pointIndex} className="text-gray-200 text-sm flex items-start">
                  <span className="mr-2 text-gray-500">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

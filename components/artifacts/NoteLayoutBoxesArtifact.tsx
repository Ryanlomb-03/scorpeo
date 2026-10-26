'use client';

import React from 'react';
import { NoteLayoutBoxesData } from '@/types/artifacts';

interface NoteLayoutBoxesArtifactProps {
  data: NoteLayoutBoxesData;
}

export function NoteLayoutBoxesArtifact({ data }: NoteLayoutBoxesArtifactProps) {
  const renderTemplate = () => {
    switch (data.template) {
      case 'cornell':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="flex h-full gap-2">
              {/* Cue Column */}
              <div className="w-1/4 border-r-2 border-gray-300 pr-2">
                <div className="text-xs text-gray-500 font-bold mb-2">CUES</div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                </div>
              </div>
              {/* Notes Column */}
              <div className="w-1/2 border-r-2 border-gray-300 pr-2">
                <div className="text-xs text-gray-500 font-bold mb-2">NOTES</div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded w-5/6"></div>
                  <div className="h-2 bg-gray-100 rounded w-4/6"></div>
                  <div className="h-2 bg-gray-100 rounded"></div>
                </div>
              </div>
              {/* Summary Column */}
              <div className="w-1/4">
                <div className="text-xs text-gray-500 font-bold mb-2">SUMMARY</div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'boxing':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="space-y-3">
              <div className="border-2 border-gray-400 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-bold mb-1">Main Topic</div>
                <div className="h-2 bg-gray-100 rounded"></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-gray-400 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-bold mb-1">Point 1</div>
                  <div className="h-2 bg-gray-100 rounded"></div>
                </div>
                <div className="border-2 border-gray-400 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-bold mb-1">Point 2</div>
                  <div className="h-2 bg-gray-100 rounded"></div>
                </div>
              </div>
              <div className="border-2 border-gray-400 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-bold mb-1">Key Takeaway</div>
                <div className="h-2 bg-gray-100 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        );
      case 'mindmapping':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4 relative">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-blue-100 border-2 border-blue-400 rounded-full px-4 py-2 text-sm font-bold text-blue-800">
                Central Idea
              </div>
            </div>
            {/* Branches */}
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-xs">Branch 1</div>
            </div>
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-xs">Branch 2</div>
            </div>
            <div className="absolute top-1/2 left-8 transform -translate-y-1/2">
              <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-xs">Branch 3</div>
            </div>
            <div className="absolute top-1/2 right-8 transform -translate-y-1/2">
              <div className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-xs">Branch 4</div>
            </div>
          </div>
        );
      case 'charting':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 h-full">
              <div className="border-2 border-gray-400 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-bold mb-2">Category 1</div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                </div>
              </div>
              <div className="border-2 border-gray-400 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-bold mb-2">Category 2</div>
                <div className="space-y-1">
                  <div className="h-2 bg-gray-100 rounded"></div>
                  <div className="h-2 bg-gray-100 rounded w-5/6"></div>
                </div>
              </div>
              <div className="border-2 border-gray-400 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-500 font-bold mb-2">Comparison</div>
                <div className="h-2 bg-gray-100 rounded"></div>
              </div>
            </div>
          </div>
        );
      case 'brain_dump':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="text-xs text-gray-500 font-bold mb-4 text-center">BRAIN DUMP - Write everything you remember</div>
            <div className="space-y-2">
              <div className="h-2 bg-gray-100 rounded"></div>
              <div className="h-2 bg-gray-100 rounded w-5/6"></div>
              <div className="h-2 bg-gray-100 rounded w-4/6"></div>
              <div className="h-2 bg-gray-100 rounded w-3/4"></div>
              <div className="h-2 bg-gray-100 rounded w-1/2"></div>
              <div className="h-2 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        );
      case 'slides':
        return (
          <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3 h-full">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <div key={num} className="border-2 border-gray-400 rounded-lg p-2 flex flex-col">
                  <div className="text-xs text-gray-500 font-bold mb-1">Slide {num}</div>
                  <div className="flex-1 bg-gray-50 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="w-full h-96 bg-white border-2 border-gray-300 rounded-lg p-4">Unknown template</div>;
    }
  };

  return (
    <div className="w-full bg-gray-50 rounded-2xl p-6">
      <h2 className="text-xl font-serif text-gray-800 mb-4 capitalize">
        {data.template.replace('_', ' ')} Template
      </h2>
      {renderTemplate()}
    </div>
  );
}

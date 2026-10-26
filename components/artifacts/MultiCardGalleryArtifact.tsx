'use client';

import React from 'react';
import { MultiCardGalleryData } from '@/types/artifacts';

interface MultiCardGalleryArtifactProps {
  data: MultiCardGalleryData;
}

export function MultiCardGalleryArtifact({ data }: MultiCardGalleryArtifactProps) {
  return (
    <div className="w-full bg-gray-50 rounded-2xl p-6">
      <h2 className="text-2xl font-serif text-gray-800 mb-6 text-center">Note Methods Gallery</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <h3 className="font-bold text-gray-800 mb-2 text-center text-sm uppercase tracking-wide">
              {card.title}
            </h3>
            {card.topic && (
              <p className="text-xs text-gray-500 mb-3 text-center italic">{card.topic}</p>
            )}
            <div className="border-2 border-gray-300 rounded-lg p-3 h-32 bg-gray-50">
              <div className="space-y-1">
                <div className="h-2 bg-gray-200 rounded"></div>
                <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                <div className="h-2 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2 text-center">{card.layout}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

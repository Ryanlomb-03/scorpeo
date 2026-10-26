'use client';

import React from 'react';
import { GridCardData } from '@/types/artifacts';

interface GridCardsArtifactProps {
  data: GridCardData;
}

export function GridCardsArtifact({ data }: GridCardsArtifactProps) {
  return (
    <div className="w-full max-w-4xl mx-auto p-6 sm:p-8">
      {/* Main Grid Title */}
      <h2 className="text-3xl font-serif font-bold text-white mb-6">
        Study Methods
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {data.cards.map((card, index) => (
          <div key={index} className="space-y-2">
            <h3 className="font-serif italic text-2xl text-white font-semibold">
              {card.title}
            </h3>
            <ol className="space-y-1">
              {card.items.map((item, itemIndex) => (
                <li key={itemIndex} className="text-gray-200 text-sm leading-relaxed">
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

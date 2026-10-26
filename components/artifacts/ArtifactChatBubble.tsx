'use client';

import React from 'react';
import { Artifact, ArtifactType } from '@/types/artifacts';
import { ArtifactRenderer } from './ArtifactRenderer';

interface ArtifactChatBubbleProps {
  artifact: Artifact;
}

export function ArtifactChatBubble({ artifact }: ArtifactChatBubbleProps) {
  return (
    <div className="w-full my-4">
      {/* Artifact Container - Dark background, white text */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-lg border border-gray-700">
        {/* Artifact Title */}
        {artifact.title && (
          <h2 className="text-2xl font-serif font-bold mb-4 text-white">
            {artifact.title}
          </h2>
        )}

        {/* Artifact Content */}
        <div className="relative">
          <ArtifactRenderer artifact={artifact} />
        </div>
      </div>
    </div>
  );
}

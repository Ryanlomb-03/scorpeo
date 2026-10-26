'use client';

import React from 'react';
import { Artifact, ArtifactType } from '@/types/artifacts';
import { GridCardsArtifact } from './GridCardsArtifact';
import { TimetableArtifact } from './TimetableArtifact';
import { MathMatrixArtifact } from './MathMatrixArtifact';
import { ComparisonSplitArtifact } from './ComparisonSplitArtifact';
import { NoteLayoutBoxesArtifact } from './NoteLayoutBoxesArtifact';
import { MultiCardGalleryArtifact } from './MultiCardGalleryArtifact';
import { ArrowOverlay } from './ArrowOverlay';

interface ArtifactRendererProps {
  artifact: Artifact;
}

export function ArtifactRenderer({ artifact }: ArtifactRendererProps) {
  const renderArtifact = () => {
    switch (artifact.type) {
      case '2x3_GRID_CARDS':
        return <GridCardsArtifact data={artifact.data} />;
      case 'TIMETABLE':
        return <TimetableArtifact data={artifact.data} />;
      case 'MATH_MATRIX_TABLE':
        return <MathMatrixArtifact data={artifact.data} />;
      case 'COMPARISON_SPLIT':
        return <ComparisonSplitArtifact data={artifact.data} />;
      case 'NOTE_LAYOUT_BOXES':
        return <NoteLayoutBoxesArtifact data={artifact.data} />;
      case 'MULTI_CARD_GALLERY':
        return <MultiCardGalleryArtifact data={artifact.data} />;
      default:
        return <div className="text-red-500">Unknown artifact type</div>;
    }
  };

  return (
    <div className="relative w-full">
      {renderArtifact()}
      {artifact.arrows && artifact.arrows.length > 0 && (
        <ArrowOverlay arrows={artifact.arrows} />
      )}
    </div>
  );
}

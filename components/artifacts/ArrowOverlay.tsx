'use client';

import React from 'react';
import { ArrowAnnotation } from '@/types/artifacts';

interface ArrowOverlayProps {
  arrows: ArrowAnnotation[];
}

export function ArrowOverlay({ arrows }: ArrowOverlayProps) {
  return (
    <svg
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#ef4444"
          />
        </marker>
      </defs>
      {arrows.map((arrow, index) => (
        <g key={index}>
          <line
            x1={arrow.from.x}
            y1={arrow.from.y}
            x2={arrow.to.x}
            y2={arrow.to.y}
            stroke={arrow.color || '#ef4444'}
            strokeWidth={arrow.width || 2}
            strokeDasharray={arrow.dashed ? '5,5' : 'none'}
            markerEnd="url(#arrowhead)"
          />
          {arrow.label && (
            <text
              x={(arrow.from.x + arrow.to.x) / 2}
              y={(arrow.from.y + arrow.to.y) / 2 - 10}
              fill={arrow.color || '#ef4444'}
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              {arrow.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

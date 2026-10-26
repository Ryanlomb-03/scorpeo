'use client';

import React from 'react';
import { TimetableData } from '@/types/artifacts';

interface TimetableArtifactProps {
  data: TimetableData;
}

export function TimetableArtifact({ data }: TimetableArtifactProps) {
  const getHighlightClass = (highlight?: string) => {
    switch (highlight) {
      case 'yellow':
        return 'bg-yellow-900/30';
      case 'pink':
        return 'bg-pink-900/30';
      case 'green':
        return 'bg-green-900/30';
      default:
        return '';
    }
  };

  return (
    <div className="w-full bg-neutral-900 rounded-2xl p-6 shadow-lg">
      {data.title && (
        <h2 className="text-2xl font-handwritten text-white mb-6 text-center">
          {data.title}
        </h2>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-0" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333333' }}>
              {data.headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left font-bold text-white font-sans"
                  style={{ border: 'none' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{ borderBottom: '1px solid #333333' }}
                className={getHighlightClass(row.highlight)}
              >
                <td className="px-4 py-3 text-white font-mono" style={{ border: 'none' }}>{row.time}</td>
                <td className="px-4 py-3 text-white font-medium" style={{ border: 'none' }}>{row.subject}</td>
                <td className="px-4 py-3 text-white" style={{ border: 'none' }}>{row.topic}</td>
                <td className="px-4 py-3 text-white" style={{ border: 'none' }}>{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { MathMatrixData } from '@/types/artifacts';

interface MathMatrixArtifactProps {
  data: MathMatrixData;
}

export function MathMatrixArtifact({ data }: MathMatrixArtifactProps) {
  return (
    <div className="w-full bg-neutral-900 rounded-2xl p-6 shadow-lg overflow-x-auto">
      <h2 className="text-xl font-serif text-white mb-4 text-center">{data.title || 'Math Table'}</h2>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="border border-gray-600 px-4 py-2 bg-neutral-800 font-mono text-sm"></th>
            {data.columnHeaders.map((header, index) => (
              <th key={index} className="border border-gray-600 px-4 py-2 bg-neutral-800 font-mono text-sm text-white">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rowHeaders.map((rowHeader, rowIndex) => (
            <tr key={rowIndex}>
              <td className="border border-gray-600 px-4 py-2 bg-neutral-800 font-mono text-sm font-semibold text-white">
                {rowHeader}
              </td>
              {data.cells[rowIndex].map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-gray-600 px-4 py-2 text-center font-mono text-sm text-white">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

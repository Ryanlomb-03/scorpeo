'use client';

import React from 'react';
import { ArtifactChatBubble } from '@/components/artifacts/ArtifactChatBubble';
import { Artifact } from '@/types/artifacts';

export default function ArtifactPreviewPage() {
  const sampleArtifacts: Artifact[] = [
    {
      type: '2x3_GRID_CARDS',
      title: 'Study Methods Overview',
      data: {
        cards: [
          {
            title: 'Feynman',
            items: ['Choose a concept', 'Teach it to a child', 'Identify gaps', 'Review and simplify'],
          },
          {
            title: 'Blurting',
            items: ['Read the material', 'Write everything you remember', 'Compare with source', 'Fill in gaps'],
          },
          {
            title: 'Pomodoro',
            items: ['Work for 25 minutes', 'Take 5-minute break', 'Repeat 4 times', 'Take longer break'],
          },
          {
            title: 'Active Recall',
            items: ['Close the book', 'Try to recall', 'Check your answers', 'Repeat spaced intervals'],
          },
          {
            title: 'Spaced Repetition',
            items: ['Review after 1 day', 'Review after 3 days', 'Review after 1 week', 'Review after 1 month'],
          },
          {
            title: 'Mind Mapping',
            items: ['Start with central idea', 'Add main branches', 'Add sub-branches', 'Use colors and images'],
          },
        ],
      },
    },
    {
      type: 'TIMETABLE',
      title: 'Study Schedule',
      data: {
        headers: ['TIME', 'SUBJECT', 'TOPIC', 'DURATION'],
        rows: [
          { time: '8:00 AM', subject: 'Math', topic: 'Calculus Integration', duration: '1h' },
          { time: '9:00 AM', subject: 'Physics', topic: 'Newton\'s Laws', duration: '1h' },
          { time: '10:00 AM', subject: 'BREAK', topic: 'Short Break', duration: '15m', highlight: 'yellow' },
          { time: '10:15 AM', subject: 'Chemistry', topic: 'Organic Chemistry', duration: '1h' },
          { time: '11:15 AM', subject: 'BREAK', topic: 'LUNCH BREAK', duration: '1h', highlight: 'pink' },
          { time: '12:15 PM', subject: 'Biology', topic: 'Cell Structure', duration: '1h' },
          { time: '1:15 PM', subject: 'BREAK', topic: 'DINNER BREAK', duration: '45m', highlight: 'green' },
          { time: '2:00 PM', subject: 'History', topic: 'World War II', duration: '1h' },
        ],
      },
    },
    {
      type: 'MATH_MATRIX_TABLE',
      title: 'Trigonometry Reference Table',
      data: {
        rowHeaders: ['sin α', 'cos α', 'tan α', 'cot α', 'sec α', 'cosec α'],
        columnHeaders: ['0°', '30°', '45°', '60°', '90°', '180°'],
        cells: [
          ['0', '1/2', '√2/2', '√3/2', '1', '0'],
          ['1', '√3/2', '√2/2', '1/2', '0', '-1'],
          ['0', '1/√3', '1', '√3', '∞', '0'],
          ['∞', '√3', '1', '1/√3', '0', '∞'],
          ['1', '2/√3', '√2', '2', '∞', '-1'],
          ['∞', '2', '√2', '2/√3', '1', '∞'],
        ],
      },
    },
    {
      type: 'COMPARISON_SPLIT',
      title: 'How to take notes',
      data: {
        columns: [
          {
            heading: 'IN CLASS',
            previewBox: { type: 'structured_lines' },
            points: ['Structured Notes', 'Symbols', 'Abbreviations', 'Cues', 'Important info', 'Diagrams', 'Boxes or frames'],
          },
          {
            heading: 'OUT OF CLASS',
            previewBox: { type: 'blurt_box' },
            points: ['Headers for important topics', 'Active recall', 'Bullet points', 'Symbols', 'Highlighting & underlining'],
          },
        ],
      },
    },
    {
      type: 'NOTE_LAYOUT_BOXES',
      title: 'Cornell Notes Template',
      data: {
        template: 'cornell',
        sections: [
          { name: 'Cues', position: { x: 0, y: 0, width: 25, height: 100 } },
          { name: 'Notes', position: { x: 25, y: 0, width: 50, height: 100 } },
          { name: 'Summary', position: { x: 75, y: 0, width: 25, height: 100 } },
        ],
      },
    },
    {
      type: 'MULTI_CARD_GALLERY',
      title: 'Note Taking Methods Gallery',
      data: {
        cards: [
          { title: 'CORNELL', topic: 'Anatomy 150 - Ch. 20', layout: 'Three-column layout with cues, notes, summary' },
          { title: 'BOXING', topic: 'Psychology 101 - Ch. 5', layout: 'Boxed sections for key concepts' },
          { title: 'MINDMAPPING', topic: 'Biology 201 - Ch. 12', layout: 'Central idea with branching concepts' },
          { title: 'CHARTING', topic: 'Chemistry 301 - Ch. 8', layout: 'Table-style comparison charts' },
          { title: 'SLIDES', topic: 'History 201 - Ch. 15', layout: 'Slide-based visual notes' },
          { title: 'BULLET', topic: 'Physics 101 - Ch. 3', layout: 'Traditional bullet point notes' },
          { title: 'OUTLINE', topic: 'English 201 - Ch. 7', layout: 'Hierarchical outline structure' },
          { title: 'SENTENCE', topic: 'Philosophy 101 - Ch. 2', layout: 'Sentence-based note taking' },
          { title: 'BRAIN DUMP', topic: 'Study Review - All Topics', layout: 'Free-form memory dump' },
        ],
      },
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">Artifact Chat Preview</h1>
        <p className="text-gray-400 mb-8 text-center">
          How artifacts will appear in the chat UI (dark theme: black background, white text)
        </p>

        <div className="space-y-8">
          {sampleArtifacts.map((artifact, index) => (
            <div key={index} className="space-y-2">
              <div className="text-sm text-gray-500 mb-2">
                User: Show me study methods
              </div>
              <ArtifactChatBubble artifact={artifact} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

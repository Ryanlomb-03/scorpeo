// Artifact Types and Interfaces

export type ArtifactType =
  | '2x3_GRID_CARDS'     // 6 method cards (2 columns x 3 rows)
  | 'TIMETABLE'          // Highlighted schedule table
  | 'MATH_MATRIX_TABLE'  // Trigonometry / Math lookup matrix
  | 'COMPARISON_SPLIT'   // Dual side-by-side note guide
  | 'NOTE_LAYOUT_BOXES'  // Cornell / Boxing / Charting templates
  | 'MULTI_CARD_GALLERY';// 3x3 grid overview gallery

// Custom tags specifically for Study Methods artifact (2x3_GRID_CARDS)
export const STUDY_METHODS_OPEN_TAG = '<?study_methods?>';
export const STUDY_METHODS_CLOSE_TAG = '</?study_methods?>';

// Custom tags for Timetable artifact
export const TIMETABLE_OPEN_TAG = '<?timetable?>';
export const TIMETABLE_CLOSE_TAG = '</?timetable?>';

// Custom tags for Math Matrix artifact
export const MATH_MATRIX_OPEN_TAG = '<?math_matrix?>';
export const MATH_MATRIX_CLOSE_TAG = '</?math_matrix?>';

// Base Artifact Interface
export interface Artifact {
  type: ArtifactType;
  title?: string;
  data: any; // Specific data structure based on type
  arrows?: ArrowAnnotation[];
}

// Arrow Annotation for pointing
export interface ArrowAnnotation {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  label?: string;
  width?: number;
  dashed?: boolean;
}

// 1. 2x3 Grid Cards Data Structure
export interface GridCardData {
  cards: Array<{
    title: string;
    items: string[];
  }>;
}

// 2. Timetable Data Structure
export interface TimetableData {
  title?: string; // Optional title (e.g., "Study Plan", "Daily Schedule", "Meeting Agenda")
  headers: string[]; // ['TIME', 'SUBJECT', 'TOPIC', 'DURATION'] - customizable
  rows: Array<{
    time: string;
    subject: string;
    topic: string;
    duration: string;
    highlight?: 'yellow' | 'pink' | 'green' | 'none';
  }>;
}

// 3. Math Matrix Table Data Structure
export interface MathMatrixData {
  title?: string; // Optional title (e.g., "Trigonometry Reference Table")
  rowHeaders: string[]; // ['sin α', 'cos α', 'tan α', ...]
  columnHeaders: string[]; // ['0°', '30°', '45°', ...]
  cells: string[][]; // 2D array of math expressions (can include LaTeX)
}

// 4. Comparison Split Data Structure
export interface ComparisonSplitData {
  title: string;
  columns: Array<{
    heading: string;
    previewBox: {
      type: 'structured_lines' | 'blurt_box' | 'cornell' | 'charting';
      content?: any;
    };
    points: string[];
  }>;
}

// 5. Note Layout Boxes Data Structure
export interface NoteLayoutBoxesData {
  template: 'cornell' | 'boxing' | 'mindmapping' | 'charting' | 'brain_dump' | 'slides';
  sections: Array<{
    name: string;
    content?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
}

// 6. Multi Card Gallery Data Structure
export interface MultiCardGalleryData {
  cards: Array<{
    title: string;
    topic?: string;
    layout: string; // Description of the layout
  }>;
}

export type WindowsTheme = 'terminal' | 'security' | 'error' | 'build' | 'network' | 'binary' | 'interactive';

export type OutputType = 'code' | 'input' | 'output' | 'success' | 'warning' | 'error' | 'system' | 'path' | 'prompt';

export interface WindowsLine {
  type: OutputType;
  content: string;
  timestamp?: string;
}

export interface ExecutionMetadata {
  exitCode: number;
  executionTime: number;
  status: string;
  executed: boolean;
}

export interface WindowsArtifact {
  type: 'windows';
  language: string;
  title?: string;
  input?: string;
  sourceCode?: string; // The actual code to execute
  lines: WindowsLine[];
  status?: 'success' | 'error' | 'warning' | 'running';
  theme: WindowsTheme;
  interactive?: boolean;
  execution?: ExecutionMetadata; // Execution results
  executeOnLoad?: boolean; // Whether to auto-execute when loaded
}

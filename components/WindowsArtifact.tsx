import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import type { WindowsArtifact, WindowsTheme, OutputType, ExecutionMetadata } from '@/types/windows';

interface WindowsArtifactProps {
  artifact: WindowsArtifact;
  isLoading?: boolean;
}

const themeColors: Record<WindowsTheme, { bg: string; header: string; accent: string; border: string }> = {
  terminal: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  security: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  error: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  build: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  network: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  binary: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
  interactive: { bg: '#000000', header: '#000000', accent: '#00FF00', border: '#00FF00' },
};

const outputColors: Record<OutputType, string> = {
  code: '#00FF00',
  input: '#00FF00',
  output: '#00FF00',
  success: '#00FF00',
  warning: '#FFFF00',
  error: '#FF0000',
  system: '#00FF00',
  path: '#00FF00',
  prompt: '#00FF00',
};

export default function WindowsArtifact({ artifact, isLoading = false }: WindowsArtifactProps) {
  const theme = themeColors[artifact.theme];
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayedLines, setDisplayedLines] = useState<Array<{ line: typeof artifact.lines[0], text: string, complete: boolean }>>([]);
  const [executionResult, setExecutionResult] = useState<ExecutionMetadata | null>(artifact.execution || null);
  const [isExecuting, setIsExecuting] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const currentLineIndexRef = useRef<number>(0);
  const currentCharIndexRef = useRef<number>(0);

  // Initialize refs when artifact changes
  useEffect(() => {
    currentLineIndexRef.current = 0;
    currentCharIndexRef.current = 0;
    setCurrentStep(0);
    setDisplayedLines([]);
    setIsPlaying(false);
    setIsExpanded(false);
  }, [artifact]);

  const getLineColor = (type: OutputType) => outputColors[type] || outputColors.output;

  // Execute code if executeOnLoad is true and not already executed
  useEffect(() => {
    const executeCodeIfNeeded = async () => {
      if (artifact.executeOnLoad && artifact.sourceCode && !executionResult?.executed && !isExecuting) {
        setIsExecuting(true);
        try {
          const response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: artifact.language,
              sourceCode: artifact.sourceCode,
              stdin: artifact.input || '',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Execution failed');
          }

          const result = await response.json();
          setExecutionResult({
            exitCode: result.exitCode,
            executionTime: result.executionTime,
            status: result.status,
            executed: true,
          });

          // Update lines with actual output
          if (result.stdout) {
            const outputLines = result.stdout.split('\n').filter((line: string) => line.trim());
            setDisplayedLines(outputLines.map((line: string) => ({
              line: { type: 'output', content: line },
              text: line,
              complete: true,
            })));
          }

          if (result.stderr) {
            const errorLines = result.stderr.split('\n').filter((line: string) => line.trim());
            setDisplayedLines(prev => [
              ...prev,
              ...errorLines.map((line: string) => ({
                line: { type: 'error', content: line },
                text: line,
                complete: true,
              })),
            ]);
          }
        } catch (error) {
          console.error('Execution failed:', error);
          setExecutionResult({
            exitCode: -1,
            executionTime: 0,
            status: 'Execution Failed',
            executed: false,
          });
          // Show error message in terminal
          setDisplayedLines([{
            line: { type: 'error', content: error instanceof Error ? error.message : 'Execution service unavailable' },
            text: error instanceof Error ? error.message : 'Execution service unavailable',
            complete: true,
          }]);
          // Update artifact status to error
          if (artifact.status === 'running') {
            // We can't modify the artifact prop directly, but we can track this in local state
            // The UI will show the error message in the terminal
          }
        } finally {
          setIsExecuting(false);
        }
      }
    };

    executeCodeIfNeeded();
  }, [artifact.executeOnLoad, artifact.sourceCode, artifact.input, artifact.language, executionResult, isExecuting]);

  const resetPlayback = () => {
    setCurrentStep(0);
    setDisplayedLines([]);
    setIsPlaying(false);
    setIsExpanded(false);
    currentLineIndexRef.current = 0;
    currentCharIndexRef.current = 0;
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  };

  const playLine = (lineIndex: number, startChar: number = 0) => {
    if (lineIndex >= artifact.lines.length) {
      setIsPlaying(false);
      setIsExpanded(true);
      return;
    }

    currentLineIndexRef.current = lineIndex;
    const line = artifact.lines[lineIndex];
    const text = line.content;
    let currentIndex = startChar;
    currentCharIndexRef.current = currentIndex;

    const typeChar = () => {
      if (currentIndex <= text.length) {
        setDisplayedLines(prev => {
          const newLines = [...prev];
          const existingIndex = newLines.findIndex(l => l.line === line);
          const isComplete = currentIndex === text.length;
          
          if (existingIndex >= 0) {
            newLines[existingIndex] = { line, text: text.slice(0, currentIndex), complete: isComplete };
          } else {
            newLines.push({ line, text: text.slice(0, currentIndex), complete: isComplete });
          }
          return newLines;
        });
        currentIndex++;
        currentCharIndexRef.current = currentIndex;
        animationRef.current = setTimeout(typeChar, 30);
      } else {
        // Line complete, pause before next line
        animationRef.current = setTimeout(() => {
          setCurrentStep(lineIndex + 1);
          playLine(lineIndex + 1, 0);
        }, 500);
      }
    };

    typeChar();
  };

  const togglePlayback = () => {
    if (isLoading) return; // Disable while AI is generating
    
    if (!isPlaying) {
      // Start playing from beginning
      resetPlayback();
      setIsPlaying(true);
      setIsExpanded(true);
      playLine(0, 0);
    } else {
      // Pause - capture current position
      setIsPlaying(false);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      // Position is already tracked in refs, no need to update
    }
  };

  const resumePlayback = () => {
    if (isLoading) return; // Disable while AI is generating
    
    if (!isPlaying && displayedLines.length > 0) {
      setIsPlaying(true);
      setIsExpanded(true);
      // Resume from the tracked position
      playLine(currentLineIndexRef.current, currentCharIndexRef.current);
    }
  };

  const isComplete = currentStep >= artifact.lines.length && displayedLines.length === artifact.lines.length;

  const handlePlayClick = () => {
    if (isLoading) return;
    
    // Don't play if artifact has no lines (placeholder during streaming)
    if (artifact.lines.length === 0) return;
    
    if (isComplete) {
      // Restart from beginning
      resetPlayback();
      setIsPlaying(true);
      setIsExpanded(true);
      playLine(0, 0);
    } else if (displayedLines.length === 0) {
      // Start playing from beginning
      setIsPlaying(true);
      setIsExpanded(true);
      playLine(0, 0);
    } else if (isPlaying) {
      // Pause
      setIsPlaying(false);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    } else {
      // Resume from paused position
      setIsPlaying(true);
      setIsExpanded(true);
      playLine(currentLineIndexRef.current, currentCharIndexRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <div 
        className="my-4 rounded-lg overflow-hidden transition-all duration-300 w-full max-w-full min-w-0" 
        style={{ 
          backgroundColor: theme.bg,
          border: `2px solid ${theme.border}`,
          borderRadius: '12px',
          maxHeight: isExpanded ? 'none' : '60px'
        }}
      >
      {/* Window Header */}
      <div 
        className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2" 
        style={{ 
          backgroundColor: theme.header
        }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>
        <span 
          className="flex-1 text-center text-xs sm:text-sm font-bold font-mono truncate px-1" 
          style={{ color: theme.accent }}
        >
          root@cyberops:~#
        </span>
        <button
          onClick={handlePlayClick}
          disabled={isLoading || artifact.lines.length === 0}
          className="p-1.5 sm:p-2 rounded transition-colors hover:bg-white/10 disabled:cursor-not-allowed shrink-0"
          style={{ 
            color: (isLoading || artifact.lines.length === 0) ? '#888888' : theme.accent,
            opacity: (isLoading || artifact.lines.length === 0) ? 0.5 : 1
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>

      {/* Terminal Content */}
      <div 
        className="p-3 sm:p-4 font-mono text-xs sm:text-sm overflow-x-auto max-h-96 windows-terminal-scroll max-w-full break-words"
        style={{ 
          display: isExpanded ? 'block' : 'none'
        }}
      >
        {artifact.input && (
          <div className="mb-2 break-all" style={{ color: outputColors.input }}>
            <span style={{ color: outputColors.prompt }}>$</span> {artifact.input}
          </div>
        )}

        {displayedLines.map((item, index) => (
          <div key={index} className="mb-1 break-words" style={{ color: getLineColor(item.line.type) }}>
            {item.line.type === 'prompt' && <span className="mr-2">$</span>}
            {item.text}
            {isPlaying && index === displayedLines.length - 1 && !item.complete && (
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ backgroundColor: theme.accent }} />
            )}
          </div>
        ))}

        {artifact.status === 'running' && (
          <div className="flex items-center gap-1 mt-2" style={{ color: outputColors.system }}>
            <span className="animate-spin">◌</span>
            <span>Running...</span>
          </div>
        )}

        {artifact.status === 'success' && currentStep >= artifact.lines.length && (
          <div className="mt-2 flex items-center gap-1" style={{ color: outputColors.success }}>
            <span>✓</span>
            <span>Process completed successfully</span>
            {executionResult && executionResult.executed && (
              <span className="ml-2 text-xs">
                (exit code: {executionResult.exitCode}, {executionResult.executionTime}s)
              </span>
            )}
          </div>
        )}

        {artifact.status === 'error' && (
          <div className="mt-2 flex items-center gap-1" style={{ color: outputColors.error }}>
            <span>✗</span>
            <span>Process failed with errors</span>
            {executionResult && (
              <span className="ml-2 text-xs">
                {executionResult.executed ? `(exit code: ${executionResult.exitCode})` : '(execution unavailable)'}
              </span>
            )}
          </div>
        )}

        {isExecuting && (
          <div className="mt-2 flex items-center gap-1" style={{ color: outputColors.system }}>
            <span className="animate-spin">◌</span>
            <span>Executing code...</span>
          </div>
        )}

        {!executionResult?.executed && artifact.sourceCode && !isExecuting && (
          <div className="mt-2 text-xs" style={{ color: outputColors.warning }}>
            Preview only — output was not executed
          </div>
        )}
      </div>

      {/* Progress Bar for Binary Theme */}
      {artifact.theme === 'binary' && (
        <div className="h-1" style={{ backgroundColor: '#000000' }}>
          <div 
            className="h-full transition-all duration-300"
            style={{ 
              width: '75%',
              backgroundColor: theme.accent,
              animation: 'pulse 2s infinite'
            }}
          />
        </div>
      )}
    </div>

    {/* Disclaimer */}
    <div 
      className="my-2 text-center text-xs text-neutral-500"
    >
      This is a simulation. No actual hacking is occurring.
    </div>
    </>
  );
}

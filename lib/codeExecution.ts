/**
 * Code Execution Service using Piston API
 * Executes code in a sandboxed environment and returns real output
 * Public API: https://emkc.org/api/v2/piston/execute
 */

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  status: string;
}

interface ExecutionRequest {
  language: string;
  sourceCode: string;
  stdin?: string;
  args?: string[];
}

// Piston Public API endpoint (free, no API key required)
// Note: If unauthorized, the service may require auth. We'll handle gracefully.
const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';

// Language mapping for Piston (uses language names and versions)
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  python3: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  js: { language: 'javascript', version: '18.15.0' },
  node: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.1' },
  cpp: { language: 'c++', version: '10.2.1' },
  'c++': { language: 'c++', version: '10.2.1' },
  go: { language: 'go', version: '1.20.4' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.2.1' },
  php: { language: 'php', version: '8.2.8' },
  bash: { language: 'bash', version: '5.1.16' },
  shell: { language: 'bash', version: '5.1.16' },
  sql: { language: 'sqlite3', version: '3.39.4' },
  csharp: { language: 'csharp', version: '6.0.421' },
  fsharp: { language: 'fsharp', version: '6.0.421' },
  swift: { language: 'swift', version: '5.8.1' },
  kotlin: { language: 'kotlin', version: '1.8.21' },
  scala: { language: 'scala', version: '3.3.0' },
  r: { language: 'r', version: '4.3.1' },
  perl: { language: 'perl', version: '5.38.0' },
  lua: { language: 'lua', version: '5.4.6' },
  haskell: { language: 'haskell', version: '9.4.5' },
  elixir: { language: 'elixir', version: '1.14.4' },
  erlang: { language: 'erlang', version: '26.0.2' },
  clojure: { language: 'clojure', version: '1.11.1' },
  nasm: { language: 'nasm', version: '2.15.05' },
  assembly: { language: 'nasm', version: '2.15.05' },
  fortran: { language: 'fortran', version: '11.1.0' },
  pascal: { language: 'pascal', version: '3.2.2' },
  d: { language: 'd', version: '2.102.0' },
  ocaml: { language: 'ocaml', version: '4.14.1' },
  prolog: { language: 'prolog', version: '3.0.0' },
  scheme: { language: 'scheme', version: '0.3.4' },
  tcl: { language: 'tcl', version: '8.6.13' },
};

/**
 * Get Piston language config from language name
 */
function getLanguageConfig(language: string): { language: string; version: string } {
  const normalizedLang = language.toLowerCase().trim();
  return LANGUAGE_MAP[normalizedLang] || LANGUAGE_MAP.python; // Default to Python
}

/**
 * Execute code in Piston sandbox
 */
export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const langConfig = getLanguageConfig(request.language);
  
  const body = {
    language: langConfig.language,
    version: langConfig.version,
    files: [
      {
        name: 'main',
        content: request.sourceCode,
      },
    ],
    stdin: request.stdin || '',
    args: request.args || [],
  };

  try {
    const response = await fetch(PISTON_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // If unauthorized or service unavailable, throw specific error
      if (response.status === 401 || response.status === 403) {
        throw new Error('Piston API requires authentication');
      }
      throw new Error(`Piston API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract execution results
    const runResult = data.run || {};
    const compileResult = data.compile || {};

    // Combine compile and run output
    const stdout = (compileResult.stdout || '') + (runResult.stdout || '');
    const stderr = (compileResult.stderr || '') + (runResult.stderr || '');
    const exitCode = runResult.code !== null ? runResult.code : (compileResult.code !== null ? compileResult.code : -1);
    const executionTime = (runResult.wall_time || 0) + (compileResult.wall_time || 0);
    const status = runResult.status || compileResult.status || 'Unknown';

    return {
      stdout,
      stderr,
      exitCode,
      executionTime: executionTime / 1000, // Convert to seconds
      status,
    };
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown execution error');
  }
}

/**
 * Check if execution service is available
 */
export async function isExecutionServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch('https://emkc.org/api/v2/piston/runtimes');
    return response.ok;
  } catch {
    return false;
  }
}

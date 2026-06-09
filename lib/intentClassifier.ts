export interface IntentResult {
  type: 'greeting' | 'chat' | 'generate_code' | 'debug_code' | 'explain_code' | 'math' | 'research' | 'creative' | 'fallback';
  complexity: number; // 1-10
  confidence: number; // 0-1
  keywords: string[];
  language?: string[]; // Detected programming languages
  mode: 'generation' | 'explanation' | 'debugging' | 'chat';
}

export class IntentClassifier {
  private greetingPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|good night)/i,
    /^(thanks|thank you|thx)/i,
    /^(how are you|how are you doing|how's it going)/i,
    /^(bye|goodbye|see you|later)/i,
  ];

  // Generate code patterns - force generation mode
  private generatePatterns = [
    'create', 'generate', 'build', 'make', 'write', 'construct', 'implement',
    'html', 'css', 'javascript', 'react', 'nextjs', 'vue', 'angular', 'svelte',
    'code', 'component', 'function', 'class', 'hook', 'button', 'form', 'page',
    'login', 'register', 'signup', 'dashboard', 'navbar', 'header', 'footer',
    'card', 'modal', 'dropdown', 'sidebar', 'navigation', 'menu', 'search',
    'api', 'endpoint', 'route', 'handler', 'middleware', 'service'
  ];

  // Debug patterns
  private debugPatterns = [
    'bug', 'error', 'fix', 'debug', 'broken', 'not working', 'wrong', 'fail',
    'why doesn\'t', 'how to fix', 'what\'s wrong', 'help me fix', 'solve this',
    'issue', 'problem', 'troubleshoot', 'debugging', 'fixing', 'correct',
    'doesn\'t work', 'not respond', 'crash', 'exception', 'throw error'
  ];

  // Explain patterns
  private explainPatterns = [
    'explain', 'how does', 'how do', 'what is', 'why does', 'how does this work',
    'how it works', 'tell me about', 'describe', 'what are', 'understand',
    'overview', 'introduction', 'basics', 'fundamentals', 'concept'
  ];

  // Programming languages for detection
  private programmingLanguages = [
    'html', 'css', 'javascript', 'js', 'typescript', 'ts', 'react', 'vue', 'angular', 'svelte',
    'nextjs', 'next.js', 'nuxt', 'angular', 'ember', 'jquery', 'backbone',
    'python', 'django', 'flask', 'fastapi', 'django', 'pyramid', 'tornado', 'asyncio',
    'java', 'spring', 'hibernate', 'jpa', 'maven', 'gradle', 'java', 'kotlin', 'android',
    'c++', 'c', 'csharp', 'c#', '.net', 'asp', 'dotnet', 'razor', 'blazor',
    'php', 'laravel', 'symfony', 'codeigniter', 'wordpress', 'magento', 'drupal',
    'ruby', 'rails', 'sinatra', 'padrino', 'jekyll', 'middleman',
    'go', 'golang', 'golang', 'echo', 'gin', 'fiber', 'buffalo',
    'rust', 'rust', 'cargo', 'actix', 'rocket', 'tokio',
    'swift', 'swiftui', 'uikit', 'coredata', 'combine', 'alamofire',
    'sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'mongodb', 'redis', 'cassandra',
    'docker', 'kubernetes', 'k8s', 'helm', 'nginx', 'apache', 'linux', 'bash', 'shell',
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial', 'version control'
  ];

  private codingKeywords = [
    'react', 'nextjs', 'next.js', 'typescript', 'ts', 'javascript', 'js',
    'python', 'django', 'flask', 'fastapi', 'node', 'node.js',
    'function', 'class', 'component', 'hook', 'api', 'endpoint',
    'database', 'sql', 'nosql', 'mongo', 'postgres', 'mysql',
    'code', 'coding', 'programming', 'developer', 'stack overflow',
    'import', 'export', 'require', 'package', 'library', 'framework',
    'css', 'html', 'jsx', 'tsx', 'vue', 'angular', 'svelte',
    'algorithm', 'data structure', 'array', 'object', 'string',
    'loop', 'condition', 'if', 'else', 'switch', 'case', 'for', 'while',
    'async', 'await', 'promise', 'callback', 'fetch', 'http',
    'git', 'github', 'version control', 'branch', 'commit', 'merge',
    'docker', 'container', 'kubernetes', 'k8s', 'devops', 'ci/cd',
  ];

  private mathKeywords = [
    'equation', 'formula', 'theorem', 'proof', 'calculate', 'solve',
    'derivative', 'integral', 'limit', 'matrix', 'tensor', 'vector',
    'algebra', 'calculus', 'geometry', 'statistics', 'probability',
    'einstein', 'relativity', 'e=mc2', 'physics', 'quantum', 'gravity',
    'ricci', 'metric', 'curvature', 'schwarzschild', 'field equation',
    'x', 'y', 'z', 'π', 'pi', 'sigma', 'delta', 'sum', 'product',
    'angle', 'degree', 'radian', 'triangle', 'circle', 'sphere',
    'factorial', 'logarithm', 'exponential', 'square root',
    'polynomial', 'series', 'sequence', 'convergence', 'divergence',
    'eigenvalue', 'eigenvector', 'determinant', 'transpose',
  ];

  private researchKeywords = [
    'research', 'study', 'analysis', 'investigate', 'explore',
    'literature review', 'citation', 'reference', 'source',
    'history', 'background', 'context', 'overview',
    'compare', 'contrast', 'evaluate', 'critique',
    'explain in detail', 'deep dive', 'comprehensive',
    'why does', 'how does', 'mechanism', 'principle',
    'advantages', 'disadvantages', 'pros', 'cons',
    'future of', 'trends in', 'evolution of',
  ];

  private creativeKeywords = [
    'story', 'poem', 'write', 'creative', 'fiction', 'narrative',
    'script', 'dialogue', 'character', 'plot', 'scene',
    'animation', 'visualize', 'imagine', 'design', 'art',
    'metaphor', 'analogy', 'example', 'illustrate',
    'funny', 'joke', 'humor', 'entertainment',
    'marketing copy', 'blog post', 'article', 'content',
    'brainstorm', 'idea', 'innovative', 'original',
  ];

  classify(message: string): IntentResult {
    const trimmed = message.trim().toLowerCase();
    const keywords = this.extractKeywords(message);
    const detectedLanguages = this.detectLanguages(message);
    const complexity = this.calculateComplexity(message, keywords);
    
    // Check for greetings first (high confidence rule-based)
    if (this.isGreeting(trimmed)) {
      return {
        type: 'greeting',
        complexity: 1,
        confidence: 0.95,
        keywords: keywords.slice(0, 3),
        mode: 'chat'
      };
    }

    // Pattern-based classification (fast, deterministic)
    const generateScore = this.countMatches(keywords, this.generatePatterns);
    const debugScore = this.countMatches(keywords, this.debugPatterns);
    const explainScore = this.countMatches(keywords, this.explainPatterns);

    // Determine intent based on patterns
    if (generateScore >= 2 || (generateScore === 1 && detectedLanguages.length > 0)) {
      return {
        type: 'generate_code',
        complexity,
        confidence: 0.99,
        keywords: keywords.slice(0, 5),
        language: detectedLanguages,
        mode: 'generation'
      };
    }

    if (debugScore >= 2) {
      return {
        type: 'debug_code',
        complexity,
        confidence: 0.98,
        keywords: keywords.slice(0, 5),
        mode: 'debugging'
      };
    }

    if (explainScore >= 2) {
      return {
        type: 'explain_code',
        complexity,
        confidence: 0.95,
        keywords: keywords.slice(0, 5),
        mode: 'explanation'
      };
    }

    // Fallback to keyword-based classification for other intents
    const mathScore = this.countKeywords(keywords, this.mathKeywords);
    const researchScore = this.countKeywords(keywords, this.researchKeywords);
    const creativeScore = this.countKeywords(keywords, this.creativeKeywords);
    const codingScore = this.countKeywords(keywords, this.codingKeywords);

    const scores = {
      generate_code: generateScore * 2, // Boost generate patterns
      debug_code: debugScore * 2,
      explain_code: explainScore * 2,
      coding: codingScore,
      math: mathScore,
      research: researchScore,
      creative: creativeScore,
      chat: 1
    };

    const maxScore = Math.max(...Object.values(scores));
    const winningIntent = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) as keyof typeof scores;

    // Calculate confidence
    const secondHighest = Object.values(scores).sort((a, b) => b - a)[1];
    const confidence = maxScore === 1 ? 0.5 : (maxScore - secondHighest) / maxScore;

    // Map to final type and mode
    let finalType: IntentResult['type'];
    let mode: IntentResult['mode'] = 'chat';

    switch (winningIntent) {
      case 'generate_code':
        finalType = 'generate_code';
        mode = 'generation';
        break;
      case 'debug_code':
        finalType = 'debug_code';
        mode = 'debugging';
        break;
      case 'explain_code':
        finalType = 'explain_code';
        mode = 'explanation';
        break;
      case 'coding':
        finalType = 'generate_code'; // Default coding to generate
        mode = 'generation';
        break;
      case 'math':
        finalType = 'math';
        mode = 'explanation';
        break;
      case 'research':
        finalType = 'research';
        mode = 'explanation';
        break;
      case 'creative':
        finalType = 'creative';
        mode = 'generation';
        break;
      default:
        finalType = 'chat';
        mode = 'chat';
    }

    return {
      type: finalType,
      complexity,
      confidence: Math.min(0.99, Math.max(0.5, confidence)),
      keywords: keywords.slice(0, 5),
      language: detectedLanguages.length > 0 ? detectedLanguages : undefined,
      mode
    };
  }

  private isGreeting(message: string): boolean {
    return this.greetingPatterns.some(pattern => pattern.test(message));
  }

  private detectLanguages(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const detected = this.programmingLanguages.filter(lang => 
      lowerMessage.includes(lang.toLowerCase())
    );
    return Array.from(new Set(detected));
  }

  private countMatches(messageKeywords: string[], patterns: string[]): number {
    return messageKeywords.reduce((count, keyword) => {
      return count + patterns.reduce((patternCount, pattern) => {
        return patternCount + (keyword.includes(pattern) || pattern.includes(keyword) ? 1 : 0);
      }, 0);
    }, 0);
  }

  private extractKeywords(message: string): string[] {
    // Remove special characters and split into words
    const words = message
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    return Array.from(new Set(words)); // Remove duplicates
  }

  private countKeywords(messageKeywords: string[], categoryKeywords: string[]): number {
    return messageKeywords.filter(keyword => 
      categoryKeywords.some(category => keyword.includes(category) || category.includes(keyword))
    ).length;
  }

  private calculateComplexity(message: string, keywords: string[]): number {
    let complexity = 1;

    // Length factor
    if (message.length > 100) complexity += 1;
    if (message.length > 300) complexity += 1;
    if (message.length > 500) complexity += 2;

    // Keyword count factor
    if (keywords.length > 5) complexity += 1;
    if (keywords.length > 10) complexity += 1;

    // Question complexity
    if (message.includes('why') || message.includes('how') || message.includes('explain')) {
      complexity += 2;
    }
    if (message.includes('prove') || message.includes('derive') || message.includes('calculate')) {
      complexity += 3;
    }

    // Technical terms
    const technicalTerms = [...this.mathKeywords, ...this.codingKeywords];
    const technicalCount = keywords.filter(k => technicalTerms.some(t => k.includes(t))).length;
    if (technicalCount > 3) complexity += 1;
    if (technicalCount > 6) complexity += 2;

    return Math.min(10, complexity);
  }

  getModelRoles(intent: IntentResult): string[] {
    switch (intent.type) {
      case 'greeting':
        return ['chat'];
      case 'generate_code':
        return ['coding', 'code'];
      case 'debug_code':
        return ['coding', 'code', 'reasoning'];
      case 'explain_code':
        return ['coding', 'chat', 'reasoning'];
      case 'math':
        return ['math', 'reasoning', 'chat'];
      case 'research':
        return ['reasoning', 'chat', 'math'];
      case 'creative':
        return ['creative', 'chat'];
      case 'chat':
        return ['chat'];
      default:
        return ['chat'];
    }
  }

  getModelParameters(intent: IntentResult): any {
    const baseParams = {
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 1000,
      stream: true
    };

    switch (intent.type) {
      case 'greeting':
        return {
          ...baseParams,
          temperature: 0.5,
          max_tokens: 50,
          top_p: 0.8
        };
      case 'generate_code':
      case 'debug_code':
      case 'explain_code':
        return {
          ...baseParams,
          temperature: 0.2,
          max_tokens: 2000,
          top_p: 0.9
        };
      case 'math':
        return {
          ...baseParams,
          temperature: 0.1,
          max_tokens: 1500,
          top_p: 0.9
        };
      case 'research':
      // fallback for any other types treated as reasoning
      case 'fallback':
        return {
          ...baseParams,
          temperature: 0.3,
          max_tokens: 3000,
          top_p: 0.95
        };
      case 'creative':
        return {
          ...baseParams,
          temperature: 1.0,
          max_tokens: 2000,
          top_p: 0.95
        };
      default:
        return baseParams;
    }
  }
}

export const intentClassifier = new IntentClassifier();

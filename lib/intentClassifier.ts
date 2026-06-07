export interface IntentResult {
  type: 'greeting' | 'chat' | 'coding' | 'math' | 'research' | 'creative' | 'fallback';
  complexity: number; // 1-10
  confidence: number; // 0-1
  keywords: string[];
}

export class IntentClassifier {
  private greetingPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|good night)/i,
    /^(thanks|thank you|thx)/i,
    /^(how are you|how are you doing|how's it going)/i,
    /^(bye|goodbye|see you|later)/i,
  ];

  private codingKeywords = [
    'react', 'nextjs', 'next.js', 'typescript', 'ts', 'javascript', 'js',
    'python', 'django', 'flask', 'fastapi', 'node', 'node.js',
    'function', 'class', 'component', 'hook', 'api', 'endpoint',
    'database', 'sql', 'nosql', 'mongo', 'postgres', 'mysql',
    'bug', 'error', 'fix', 'debug', 'compile', 'build', 'deploy',
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
    const complexity = this.calculateComplexity(message, keywords);
    
    // Check for greetings first (high confidence rule-based)
    if (this.isGreeting(trimmed)) {
      return {
        type: 'greeting',
        complexity: 1,
        confidence: 0.95,
        keywords: keywords.slice(0, 3)
      };
    }

    // Count keyword matches per category
    const codingScore = this.countKeywords(keywords, this.codingKeywords);
    const mathScore = this.countKeywords(keywords, this.mathKeywords);
    const researchScore = this.countKeywords(keywords, this.researchKeywords);
    const creativeScore = this.countKeywords(keywords, this.creativeKeywords);

    // Determine intent based on keyword scores
    const scores = {
      coding: codingScore,
      math: mathScore,
      research: researchScore,
      creative: creativeScore,
      chat: 1 // baseline for general chat
    };

    const maxScore = Math.max(...Object.values(scores));
    const winningIntent = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) as keyof typeof scores;

    // Calculate confidence based on score difference
    const secondHighest = Object.values(scores).sort((a, b) => b - a)[1];
    const confidence = maxScore === 0 ? 0.5 : (maxScore - secondHighest) / maxScore;

    // Map winning intent to final type
    let finalType: IntentResult['type'];
    switch (winningIntent) {
      case 'coding':
        finalType = 'coding';
        break;
      case 'math':
        finalType = 'math';
        break;
      case 'research':
        finalType = 'research';
        break;
      case 'creative':
        finalType = 'creative';
        break;
      default:
        finalType = 'chat';
    }

    return {
      type: finalType,
      complexity,
      confidence: Math.min(0.95, Math.max(0.5, confidence)),
      keywords: keywords.slice(0, 5)
    };
  }

  private isGreeting(message: string): boolean {
    return this.greetingPatterns.some(pattern => pattern.test(message));
  }

  private extractKeywords(message: string): string[] {
    // Remove special characters and split into words
    const words = message
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    return [...new Set(words)]; // Remove duplicates
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
      case 'coding':
        return ['coding', 'chat'];
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
      case 'coding':
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
      case 'reasoning':
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

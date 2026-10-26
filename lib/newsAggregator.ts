/**
 * News Aggregator
 * Multi-source news retrieval: NewsAPI.org (primary) → FreeNewsAPI (secondary) → GDELT (tertiary)
 * Returns deduplicated, unified article objects for AI context injection.
 */

const NEWS_API_KEY = 'd00737b6d10246859cc93b3f80e67055';
const FREE_NEWS_API_KEY = '42ccf2173cd4d29ea26c37d7cbfc4581ba2280023eaf9a21d6427caa10629536';

export interface NewsArticle {
  title: string;
  url: string;
  source: string;       // publisher name
  publishedAt: string;   // ISO 8601
  snippet: string;       // short description / first paragraph
  imageUrl?: string;
}

/**
 * NewsAPI.org – primary source
 * Docs: https://newsapi.org/docs
 * Requires API key
 */
async function searchNewsAPI(
  query: string,
  lang?: string,
  pageSize: number = 8
): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      apiKey: NEWS_API_KEY,
      pageSize: String(Math.min(pageSize, 100)),
    });
    if (lang) {
      // NewsAPI uses ISO 639-1 language codes (lowercase)
      params.set('language', lang.toLowerCase());
    }

    const url = `https://newsapi.org/v2/everything?${params.toString()}`;
    console.log(`[NewsAPI.org] GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[NewsAPI.org] HTTP ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const articles: any[] = data.articles || [];

    return articles.map((a: any) => ({
      title: a.title || 'Untitled',
      url: a.url || '',
      source: a.source?.name || a.source || 'Unknown',
      publishedAt: a.publishedAt || new Date().toISOString(),
      snippet: truncate(a.description || '', 200),
      imageUrl: a.urlToImage || undefined,
    })).filter((a: NewsArticle) => a.url && a.title !== 'Untitled');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[NewsAPI.org] Request timed out');
    } else {
      console.error('[NewsAPI.org] Error:', error.message || error);
    }
    return [];
  }
}

/**
 * FreeNewsAPI – secondary source
 * Docs: https://freenewsapi.io/docs
 * Requires API key
 */
async function searchFreeNewsAPI(
  query: string,
  lang?: string,
  size: number = 8
): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      api_key: FREE_NEWS_API_KEY,
      size: String(Math.min(size, 20)),
    });
    if (lang) {
      // FreeNewsAPI uses ISO 639-1 language codes (lowercase)
      params.set('lang', lang.toLowerCase());
    }

    const url = `https://freenewsapi.ai/v1/search?${params.toString()}`;
    console.log(`[FreeNewsAPI] GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[FreeNewsAPI] HTTP ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const hits: any[] = data.articles || data.hits || data.results || [];

    return hits.map((a: any) => ({
      title: a.title || 'Untitled',
      url: a.url || a.link || '',
      source: a.source || a.publisher || a.domain || 'Unknown',
      publishedAt: a.published_at || a.pubDate || a.date || new Date().toISOString(),
      snippet: truncate(a.description || a.snippet || a.text || a.body || '', 200),
      imageUrl: a.image || a.thumbnail || undefined,
    })).filter((a: NewsArticle) => a.url && a.title !== 'Untitled');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[FreeNewsAPI] Request timed out');
    } else {
      console.error('[FreeNewsAPI] Error:', error.message || error);
    }
    return [];
  }
}

/**
 * Search for news articles across multiple sources.
 * Returns up to `limit` deduplicated articles.
 */
export async function searchNews(
  query: string,
  lang?: string,
  limit: number = 5
): Promise<NewsArticle[]> {
  console.log(`[NewsAggregator] Searching for: "${query}" (lang=${lang || 'any'}, limit=${limit})`);

  // Try NewsAPI.org first
  let articles = await searchNewsAPI(query, lang, limit + 3); // fetch extra for dedup
  console.log(`[NewsAggregator] NewsAPI.org returned ${articles.length} articles`);

  // If not enough results, try FreeNewsAPI as fallback
  if (articles.length < 2) {
    console.log(`[NewsAggregator] Falling back to FreeNewsAPI`);
    const freeNewsArticles = await searchFreeNewsAPI(query, lang, limit + 3);
    console.log(`[NewsAggregator] FreeNewsAPI returned ${freeNewsArticles.length} articles`);
    articles = [...articles, ...freeNewsArticles];
  }

  // If still not enough results, try GDELT as final fallback
  if (articles.length < 2) {
    console.log(`[NewsAggregator] Falling back to GDELT`);
    const gdeltArticles = await searchGDELT(query, limit + 3);
    console.log(`[NewsAggregator] GDELT returned ${gdeltArticles.length} articles`);
    articles = [...articles, ...gdeltArticles];
  }

  // Deduplicate
  const deduped = deduplicateArticles(articles);
  console.log(`[NewsAggregator] After dedup: ${deduped.length} articles`);

  return deduped.slice(0, limit);
}

/**
 * GDELT – secondary/fallback source
 * Uses the GDELT DOC 2.0 API (free, no key)
 */
async function searchGDELT(
  query: string,
  maxRecords: number = 8
): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      query: query,
      mode: 'ArtList',
      maxrecords: String(Math.min(maxRecords, 25)),
      format: 'json',
      sort: 'DateDesc',
    });

    const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
    console.log(`[GDELT] GET ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[GDELT] HTTP ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const articles: any[] = data.articles || [];

    return articles.map((a: any) => ({
      title: a.title || 'Untitled',
      url: a.url || '',
      source: a.domain || a.source || 'Unknown',
      publishedAt: a.seendate
        ? parseGDELTDate(a.seendate)
        : new Date().toISOString(),
      snippet: truncate(a.title || '', 200), // GDELT articles often lack descriptions
      imageUrl: a.socialimage || undefined,
    })).filter((a: NewsArticle) => a.url && a.title !== 'Untitled');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[GDELT] Request timed out');
    } else {
      console.error('[GDELT] Error:', error.message || error);
    }
    return [];
  }
}

/**
 * Parse GDELT date format (YYYYMMDDHHmmss) to ISO string
 */
function parseGDELTDate(dateStr: string): string {
  try {
    if (dateStr.length >= 14) {
      const y = dateStr.slice(0, 4);
      const m = dateStr.slice(4, 6);
      const d = dateStr.slice(6, 8);
      const h = dateStr.slice(8, 10);
      const min = dateStr.slice(10, 12);
      const s = dateStr.slice(12, 14);
      return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
    }
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Deduplicate articles by normalised URL and fuzzy title matching
 */
function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const normUrl = normalizeUrl(article.url);
    const normTitle = article.title.toLowerCase().trim().replace(/\s+/g, ' ');

    // Skip if we've seen this URL or a very similar title
    if (seen.has(normUrl)) continue;
    
    let titleDupe = false;
    for (const existing of seen) {
      if (existing.startsWith('title:') && similarity(existing.slice(6), normTitle) > 0.85) {
        titleDupe = true;
        break;
      }
    }
    if (titleDupe) continue;

    seen.add(normUrl);
    seen.add(`title:${normTitle}`);
    result.push(article);
  }

  return result;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Simple Jaccard-like similarity for short strings
 */
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s\S*$/, '') + '…';
}

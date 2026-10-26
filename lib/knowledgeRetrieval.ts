/**
 * Knowledge Retrieval System
 * Implements 4-level retrieval strategy based on intent classification
 */

import { classifyIntent, calculateRelevanceScore, IntentResult } from './intentRouter';
import { searchNews, NewsArticle } from './newsAggregator';

export interface RetrievalResult {
  level: number; // 0-3
  source: 'model' | 'wikidata' | 'wikipedia' | 'web' | 'news';
  data: any;
  relevanceScore: number;
  shouldShowCard: boolean;
}

/**
 * Retrieve knowledge based on intent classification
 */
export async function retrieveKnowledge(query: string): Promise<RetrievalResult> {
  const intent = classifyIntent(query);
  
  console.log(`[Knowledge Retrieval] Intent for "${query}":`, {
    type: intent.type,
    confidence: intent.confidence,
    knowledgeLevel: intent.knowledgeLevel,
    shouldShowCard: intent.shouldShowCard,
  });

  // Level 0: Model knowledge only - no external retrieval
  if (intent.knowledgeLevel === 0) {
    console.log(`[Knowledge Retrieval] Using model knowledge only (Level 0)`);
    return {
      level: 0,
      source: 'model',
      data: null,
      relevanceScore: 1.0,
      shouldShowCard: false,
    };
  }

  // Level 1: Wikidata for entity lookups
  if (intent.knowledgeLevel === 1) {
    console.log(`[Knowledge Retrieval] Fetching from Wikidata (Level 1)`);
    const wikidata = await fetchWikidata(query);
    return {
      level: 1,
      source: 'wikidata',
      data: wikidata,
      relevanceScore: wikidata ? 0.8 : 0,
      shouldShowCard: intent.shouldShowCard && wikidata !== null,
    };
  }

  // Level 2: Wikipedia for knowledge/explanation
  if (intent.knowledgeLevel === 2) {
    console.log(`[Knowledge Retrieval] Fetching from Wikipedia (Level 2)`);
    const wikipedia = await fetchWikipedia(query);
    const relevanceScore = wikipedia 
      ? calculateRelevanceScore(query, wikipedia.title, wikipedia.extract)
      : 0;

    console.log(`[Knowledge Retrieval] Wikipedia relevance score: ${relevanceScore}`);

    // Only show card if relevance is high enough
    const shouldShow = intent.shouldShowCard && relevanceScore > 0.4;

    return {
      level: 2,
      source: 'wikipedia',
      data: wikipedia,
      relevanceScore,
      shouldShowCard: shouldShow,
    };
  }

  // Level 3: News search for current/fresh information
  if (intent.knowledgeLevel === 3) {
    console.log(`[Knowledge Retrieval] Fetching news (Level 3)`);
    try {
      const articles = await searchNews(query);
      if (articles.length > 0) {
        console.log(`[Knowledge Retrieval] Got ${articles.length} news articles`);
        return {
          level: 3,
          source: 'news',
          data: articles,
          relevanceScore: 0.8,
          shouldShowCard: true,
        };
      }
    } catch (error) {
      console.error('[Knowledge Retrieval] News fetch error:', error);
    }

    // Fallback: empty results
    console.log(`[Knowledge Retrieval] No news articles found`);
    return {
      level: 3,
      source: 'news',
      data: null,
      relevanceScore: 0,
      shouldShowCard: false,
    };
  }

  // Fallback
  console.log(`[Knowledge Retrieval] Fallback to model knowledge`);
  return {
    level: 0,
    source: 'model',
    data: null,
    relevanceScore: 1.0,
    shouldShowCard: false,
  };
}

/**
 * Fetch structured entity data from Wikidata
 */
async function fetchWikidata(query: string): Promise<any | null> {
  try {
    console.log(`[Knowledge Retrieval] Fetching Wikidata for: ${query}`);
    
    // Search for entity
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=1`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    console.log(`[Knowledge Retrieval] Wikidata search result:`, JSON.stringify(searchData, null, 2));

    if (!searchData.search || searchData.search.length === 0) {
      console.log(`[Knowledge Retrieval] No Wikidata results for: ${query}`);
      return null;
    }

    const entity = searchData.search[0];
    const entityId = entity.id;

    console.log(`[Knowledge Retrieval] Found entity: ${entity.label} (${entityId})`);

    // Fetch entity details
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`;
    const entityResponse = await fetch(entityUrl);
    const entityData = await entityResponse.json();

    // Extract relevant properties
    const claims = entityData.entities[entityId].claims || {};
    
    return {
      id: entityId,
      label: entity.label,
      description: entity.description,
      claims,
      url: `https://www.wikidata.org/wiki/${entityId}`,
    };
  } catch (error) {
    console.error('[Knowledge Retrieval] Wikidata fetch error:', error);
    return null;
  }
}

/**
 * Fetch Wikipedia article
 */
async function fetchWikipedia(query: string): Promise<any | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      // Try search API fallback
      return await searchWikipedia(query);
    }

    const data = await response.json();

    return {
      title: data.title,
      extract: data.extract,
      thumbnail: data.thumbnail?.source,
      url: data.content_urls?.desktop?.page || data.content_urls?.mobile?.page,
      description: data.description,
    };
  } catch (error) {
    console.error('Wikipedia fetch error:', error);
    return null;
  }
}

/**
 * Fallback Wikipedia search
 */
async function searchWikipedia(query: string): Promise<any | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&origin=*`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.query?.search || data.query.search.length === 0) {
      return null;
    }

    const title = data.query.search[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    return {
      title: summaryData.title,
      extract: summaryData.extract,
      thumbnail: summaryData.thumbnail?.source,
      url: summaryData.content_urls?.desktop?.page || summaryData.content_urls?.mobile?.page,
      description: summaryData.description,
    };
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}


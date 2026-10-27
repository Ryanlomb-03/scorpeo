import { NextRequest, NextResponse } from 'next/server';

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings?: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get('word');

  if (!word) {
    return NextResponse.json({ error: 'Word parameter is required' }, { status: 400 });
  }

  try {
    // Try Free Dictionary API first
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, source: 'free-dictionary', data });
    } else if (response.status === 429) {
      // Rate limited, try fallback
      console.log('[Dictionary API] Rate limited, trying fallback');
      return await fetchFallbackDictionary(word);
    } else {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('[Dictionary API] Error:', error);
    // Try fallback on error
    return await fetchFallbackDictionary(word);
  }
}

async function fetchFallbackDictionary(word: string) {
  try {
    // Use alternative dictionary API as fallback
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, source: 'fallback', data });
    }
    return NextResponse.json({ error: 'Word not found' }, { status: 404 });
  } catch (error) {
    console.error('[Dictionary Fallback] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch word definition' }, { status: 500 });
  }
}

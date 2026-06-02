import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://igofnasquyrrkrwvtqsq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnb2ZuYXNxdXlycmtyd3Z0cXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjAwNjQsImV4cCI6MjA5NTczNjA2NH0.bHAyDFqbD087z2fq4SfkLBCKOxRGwjGfOKaV-CCDY1w";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    // Search conversations by title
    const { data: conversationsByTitle, error: titleError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .ilike("title", `%${query}%`)
      .order("updated_at", { ascending: false });

    if (titleError) {
      console.error("Title search error:", titleError);
    }

    // Search messages by content
    const { data: messages, error: messageError } = await supabase
      .from("messages")
      .select("conversation_id, content")
      .ilike("content", `%${query}%`);

    if (messageError) {
      console.error("Message search error:", messageError);
    }

    // Get unique conversation IDs from message search
    const conversationIdsFromMessages = messages
      ? Array.from(new Set(messages.map(m => m.conversation_id)))
      : [];

    // Fetch full conversation details for message matches
    let conversationsByMessages: any[] = [];
    if (conversationIdsFromMessages.length > 0) {
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .in("id", conversationIdsFromMessages)
        .order("updated_at", { ascending: false });

      if (convError) {
        console.error("Conversation fetch error:", convError);
      } else {
        // Add matching message snippets
        conversationsByMessages = (convData || []).map(conv => {
          const matchingMessages = messages?.filter(m => m.conversation_id === conv.id) || [];
          const snippets = matchingMessages.slice(0, 2).map(m => extractSnippet(m.content, query));
          return {
            ...conv,
            snippets
          };
        });
      }
    }

    // Combine results, removing duplicates
    const allConversations = new Map();
    
    (conversationsByTitle || []).forEach(conv => {
      allConversations.set(conv.id, conv);
    });

    conversationsByMessages.forEach(conv => {
      if (allConversations.has(conv.id)) {
        // Merge snippets if conversation already exists
        const existing = allConversations.get(conv.id);
        allConversations.set(conv.id, {
          ...existing,
          snippets: conv.snippets
        });
      } else {
        allConversations.set(conv.id, conv);
      }
    });

    return NextResponse.json({
      results: Array.from(allConversations.values())
    });

  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

// Extract a snippet around the search term
function extractSnippet(text: string, query: string, maxLength: number = 100): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text.substring(0, maxLength) + "...";

  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + query.length + 50);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}
